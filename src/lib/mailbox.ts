import { ImapFlow } from "imapflow";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { markProspectCampaignEnrollmentsReplied } from "@/lib/campaigns";
import { classifyEmail } from "@/lib/inbox-classification";
import { getMailboxWarmupAllowedEmailsToday } from "@/lib/mailbox-warmup";
import { trackProspectEvent } from "@/lib/prospect-events";
import { decryptSecret, encryptSecret, getEffectiveSmtpConfig, getSafeSmtpSettings } from "@/lib/smtp-settings";

const mailboxInputSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().positive(),
  secure: z.union([z.boolean(), z.string()]).transform((value) => value === true || value === "true"),
  user: z.string().trim().min(1),
  password: z.string().optional().default(""),
  warmupStartDate: z
    .union([z.string().trim().min(1), z.literal(""), z.undefined()])
    .transform((value) => value || undefined),
  warmupLevel: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.undefined()])
    .transform((value) => (value === "" || value === undefined ? undefined : value))
});

export type SafeMailboxSettings = {
  configured: boolean;
  tested: boolean;
  missingFields: string[];
  smtpImportAvailable: boolean;
  values: {
    provider: "imap";
    host: string | null;
    port: string | null;
    secure: string | null;
    user: string | null;
    passwordSet: boolean;
    passwordPlaceholder: string | null;
    testedAt: string | null;
    warmupStartDate: string | null;
    warmupLevel: string | null;
    allowedEmailsToday: number | null;
  };
};

export type MailboxHealth = {
  smtpConfigured: boolean;
  imapConfigured: boolean;
  imapTested: boolean;
  mailboxReady: boolean;
  lastSyncAt: string | null;
  errors: string[];
};

export type MailboxErrorCode =
  | "configuration_missing"
  | "connection_failed"
  | "login_failed"
  | "mailbox_open_failed"
  | "folder_not_found"
  | "fetch_failed"
  | "parser_failed"
  | "db_insert_failed"
  | "not_ready"
  | "unknown";

export class MailboxOperationError extends Error {
  code: MailboxErrorCode;
  publicMessage: string;

  constructor(code: MailboxErrorCode, publicMessage: string, detail?: string) {
    super(detail ? `${publicMessage}: ${detail}` : publicMessage);
    this.name = "MailboxOperationError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

type MailboxConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  passwordPresent: boolean;
  testedAt: Date | null;
};

export function parseMailboxSettingsPayload(payload: unknown) {
  return mailboxInputSchema.parse(payload);
}

export async function getSafeMailboxSettings(): Promise<SafeMailboxSettings> {
  const [settings, smtp] = await Promise.all([
    prisma.mailboxSettings.findUnique({ where: { id: "default" } }),
    getSafeSmtpSettings()
  ]);
  const missingFields = [
    !settings?.host ? "fehlender IMAP Host" : null,
    !settings?.port ? "fehlender IMAP Port" : null,
    !settings?.user ? "fehlender IMAP Benutzer" : null,
    !settings?.encryptedPassword ? "fehlendes Passwort" : null
  ].filter(Boolean) as string[];
  const allowedEmailsToday = settings
    ? getMailboxWarmupAllowedEmailsToday(
        { warmupStartDate: settings.warmupStartDate, warmupLevel: settings.warmupLevel },
        new Date()
      )
    : null;
  return {
    configured: missingFields.length === 0,
    tested: Boolean(settings?.testedAt),
    missingFields,
    smtpImportAvailable: smtp.configured,
    values: {
      provider: "imap",
      host: settings?.host ?? null,
      port: settings ? String(settings.port) : null,
      secure: settings ? String(settings.secure) : null,
      user: settings?.user ?? null,
      passwordSet: Boolean(settings?.encryptedPassword),
      passwordPlaceholder: settings?.encryptedPassword ? "••••••••" : null,
      testedAt: settings?.testedAt?.toISOString() ?? null,
      warmupStartDate: settings?.warmupStartDate ? settings.warmupStartDate.toISOString().slice(0, 10) : null,
      warmupLevel: settings?.warmupLevel != null ? String(settings.warmupLevel) : null,
      allowedEmailsToday
    }
  };
}

export async function getMailboxHealth(): Promise<MailboxHealth> {
  const [smtp, mailbox, latestInboundEmail] = await Promise.all([
    getSafeSmtpSettings(),
    getSafeMailboxSettings(),
    prisma.inboundEmail.findFirst({ orderBy: { receivedAt: "desc" }, select: { receivedAt: true } })
  ]);

  const errors = new Set<string>();
  for (const field of mailbox.missingFields) errors.add(field);
  if (mailbox.configured && !mailbox.tested) errors.add("IMAP Verbindung wurde noch nicht erfolgreich getestet.");

  return {
    smtpConfigured: smtp.configured,
    imapConfigured: mailbox.configured,
    imapTested: mailbox.tested,
    mailboxReady: mailbox.configured && mailbox.tested && errors.size === 0,
    lastSyncAt: latestInboundEmail?.receivedAt?.toISOString() ?? null,
    errors: [...errors]
  };
}

export async function saveMailboxSettings(payload: ReturnType<typeof parseMailboxSettingsPayload>) {
  const existing = await prisma.mailboxSettings.findUnique({ where: { id: "default" } });
  const password = payload.password.trim();

  if (password && !process.env.MAILBOX_SETTINGS_SECRET && !process.env.SMTP_SETTINGS_SECRET) {
    throw new Error("MAILBOX_SETTINGS_SECRET oder SMTP_SETTINGS_SECRET fehlt.");
  }

  const secret = process.env.MAILBOX_SETTINGS_SECRET ?? process.env.SMTP_SETTINGS_SECRET;
  const encryptedPassword = password ? encryptSecret(password, secret) : existing?.encryptedPassword;

  return prisma.mailboxSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      host: payload.host,
      port: payload.port,
      secure: payload.secure,
      user: payload.user,
      encryptedPassword,
      warmupStartDate: payload.warmupStartDate ? new Date(payload.warmupStartDate) : null,
      warmupLevel: payload.warmupLevel ?? null,
      testedAt: null
    },
    update: {
      host: payload.host,
      port: payload.port,
      secure: payload.secure,
      user: payload.user,
      encryptedPassword,
      warmupStartDate: payload.warmupStartDate ? new Date(payload.warmupStartDate) : null,
      warmupLevel: payload.warmupLevel ?? null,
      testedAt: null
    }
  });
}

export async function importMailboxSettingsFromSmtp() {
  const smtpConfig = await getEffectiveSmtpConfig();
  const domain = extractMailboxDomain(smtpConfig.SMTP_USER) ?? extractMailboxDomain(smtpConfig.SMTP_FROM_EMAIL);
  const host = suggestImapHost(smtpConfig.SMTP_HOST, domain);
  const secret = process.env.MAILBOX_SETTINGS_SECRET ?? process.env.SMTP_SETTINGS_SECRET;
  if (!secret) throw new Error("MAILBOX_SETTINGS_SECRET oder SMTP_SETTINGS_SECRET fehlt.");

  return prisma.mailboxSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      host,
      port: 993,
      secure: true,
      user: smtpConfig.SMTP_USER,
      encryptedPassword: encryptSecret(smtpConfig.SMTP_PASS, secret),
      testedAt: null
    },
    update: {
      host,
      port: 993,
      secure: true,
      user: smtpConfig.SMTP_USER,
      encryptedPassword: encryptSecret(smtpConfig.SMTP_PASS, secret),
      testedAt: null
    }
  });
}

export async function getMailboxClient(): Promise<ImapFlow> {
  return createMailboxClient(await getMailboxConfig());
}

async function getMailboxConfig(): Promise<MailboxConfig> {
  const settings = await prisma.mailboxSettings.findUnique({ where: { id: "default" } });
  if (!settings) {
    throw new MailboxOperationError("configuration_missing", "Mail-Einstellungen sind unvollständig.");
  }
  const missingFields = [
    !settings.host ? "fehlender IMAP Host" : null,
    !settings.port ? "fehlender IMAP Port" : null,
    !settings.user ? "fehlender IMAP Benutzer" : null,
    !settings.encryptedPassword ? "fehlendes Passwort" : null
  ].filter(Boolean) as string[];

  if (missingFields.length > 0) {
    throw new MailboxOperationError("configuration_missing", "Mail-Einstellungen sind unvollständig.", missingFields.join(", "));
  }

  const secret = process.env.MAILBOX_SETTINGS_SECRET ?? process.env.SMTP_SETTINGS_SECRET;
  if (!secret) {
    throw new MailboxOperationError("configuration_missing", "Mail-Einstellungen sind unvollständig.", "Mailbox-Secret fehlt.");
  }
  let pass = "";
  try {
    pass = decryptSecret(settings.encryptedPassword!, secret);
  } catch (error) {
    throw new MailboxOperationError("configuration_missing", "Mail-Einstellungen sind unvollständig.", getRawErrorMessage(error));
  }

  return {
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    user: settings.user,
    pass,
    passwordPresent: Boolean(settings.encryptedPassword && pass),
    testedAt: settings.testedAt
  };
}

function createMailboxClient(config: MailboxConfig): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    },
    logger: false
  });
}

export async function testMailboxConnection(): Promise<void> {
  const config = await getMailboxConfig();
  logMailboxConfig("test-connection", config);
  const client = createMailboxClient(config);
  try {
    await client.connect();
    await client.logout();
    await prisma.mailboxSettings.update({
      where: { id: "default" },
      data: { testedAt: new Date() }
    });
  } catch (error) {
    console.error("[mailbox:test-connection:error]", {
      code: classifyMailboxError(error, "connect"),
      message: getRawErrorMessage(error)
    });
    throw toMailboxOperationError(error, "connect");
  }
}

export async function syncInbox(limit = 50) {
  const config = await getMailboxConfig();
  logMailboxConfig("sync", config);
  await assertMailboxReadyForSync(config);
  console.info("MAILBOX_SYNC_START", { limit });
  const client = createMailboxClient(config);
  let created = 0;
  let skipped = 0;
  let lock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null = null;
  let mailboxPath = "INBOX";

  try {
    await client.connect();
    console.info("[mailbox:sync] CONNECTED");
    try {
      const selected = await openInboxMailbox(client);
      lock = selected.lock;
      mailboxPath = selected.path;
      console.info("[mailbox:sync] MAILBOX_OPENED", { path: mailboxPath });
    } catch (error) {
      console.error("[mailbox:sync:error]", {
        phase: "open-mailbox",
        code: error instanceof MailboxOperationError ? error.code : classifyMailboxError(error, "open-mailbox"),
        message: getRawErrorMessage(error)
      });
      throw error instanceof MailboxOperationError ? error : toMailboxOperationError(error, "open-mailbox");
    }

    const status = await client.status(mailboxPath, { messages: true });
    const total = status.messages ?? 0;
    console.info("[mailbox:sync] MESSAGE_COUNT", { path: mailboxPath, total });
    console.info("[mailbox:sync] FETCH_STARTED", { path: mailboxPath, limit });
    if (total === 0) {
      console.info("[mailbox:sync] FETCH_SUCCESS", { created, skipped, total });
      console.info("MAILBOX_SYNC_SUCCESS", { created, skipped, total });
      return { created, skipped };
    }
    const start = Math.max(1, total - limit + 1);

    let messages: AsyncIterable<Awaited<ReturnType<ImapFlow["fetchOne"]>>> | null = null;
    try {
      messages = client.fetch(`${start}:*`, {
        envelope: true,
        source: true
      }) as AsyncIterable<Awaited<ReturnType<ImapFlow["fetchOne"]>>>;
    } catch (error) {
      console.error("[mailbox:sync:error]", {
        phase: "fetch-start",
        code: "fetch_failed",
        message: getRawErrorMessage(error)
      });
      throw new MailboxOperationError("fetch_failed", "Nachrichtenabruf fehlgeschlagen", getRawErrorMessage(error));
    }

    for await (const message of messages) {
      if (!message) {
        skipped += 1;
        continue;
      }
      const messageId = message.envelope?.messageId ?? `${message.uid}-${message.envelope?.date?.toISOString()}`;
      const from = message.envelope?.from?.[0];
      const to = message.envelope?.to?.[0];
      const fromEmail = from?.address?.toLowerCase();
      if (!messageId || !fromEmail) {
        skipped += 1;
        continue;
      }

      const exists = await prisma.inboundEmail.findUnique({ where: { messageId } });
      if (exists) {
        skipped += 1;
        continue;
      }

      let match: Awaited<ReturnType<typeof matchInboundEmail>>;
      let classification: ReturnType<typeof classifyEmail>;
      let bodyText = "";
      try {
        bodyText = message.source?.toString("utf8").slice(0, 20000) ?? "";
        match = await matchInboundEmail(fromEmail);
        classification = classifyEmail([message.envelope?.subject ?? "", bodyText].join("\n\n"));
      } catch (error) {
        console.error("[mailbox:sync:error]", {
          phase: "parse",
          code: "parser_failed",
          message: getRawErrorMessage(error),
          messageId
        });
        throw new MailboxOperationError("parser_failed", "Parserfehler", getRawErrorMessage(error));
      }

      try {
        await prisma.inboundEmail.create({
          data: {
            messageId,
            fromEmail,
            fromName: from?.name,
            toEmail: to?.address,
            subject: message.envelope?.subject ?? "(ohne Betreff)",
            bodyText,
            receivedAt: message.envelope?.date ?? new Date(),
            matchedProspectId: match.prospectId,
            matchedCampaignId: match.campaignId,
            category: classification.category,
            confidence: classification.confidence,
            aiSummary: classification.aiSummary
          }
        });
      } catch (error) {
        console.error("[mailbox:sync] MAIL_FETCH_OK", { messageId, fromEmail, subject: message.envelope?.subject ?? "(ohne Betreff)" });
        console.error("[mailbox:sync:error] DB_SAVE_FAILED", {
          code: "db_insert_failed",
          message: getRawErrorMessage(error),
          messageId
        });
        throw new MailboxOperationError("db_insert_failed", "DB Insert Fehler", getRawErrorMessage(error));
      }

      if (match.prospectId) {
        await prisma.prospect.update({
          where: { id: match.prospectId },
          data: { status: "responded" }
        });
      }

      if (match.prospectId) {
        const repliedAt = new Date();
        await markProspectCampaignEnrollmentsReplied(match.prospectId, repliedAt);
        await trackProspectEvent(
          { prospectId: match.prospectId, type: "email_replied", meta: { inboundMessageId: messageId } },
          prisma
        );
      }

      created += 1;
    }
    console.info("[mailbox:sync] FETCH_SUCCESS", { created, skipped, total });
    console.info("MAILBOX_SYNC_SUCCESS", { created, skipped, total });
  } catch (error) {
    if (error instanceof MailboxOperationError) {
      console.error("MAILBOX_SYNC_FAILED", { code: error.code, message: error.publicMessage });
      throw error;
    }
    console.error("MAILBOX_SYNC_FAILED", {
      code: classifyMailboxError(error, "connect"),
      message: getRawErrorMessage(error)
    });
    console.error("[mailbox:sync:error]", {
      phase: "connect-or-fetch",
      code: classifyMailboxError(error, "connect"),
      message: getRawErrorMessage(error)
    });
    throw toMailboxOperationError(error, "connect");
  } finally {
    lock?.release();
    await client.logout().catch(() => undefined);
  }

  return { created, skipped };
}

async function openInboxMailbox(client: ImapFlow): Promise<{ path: string; lock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> }> {
  const candidates = ["INBOX", "Inbox", "Posteingang"];
  const attempted = new Set<string>();
  const failures: { path: string; message: string }[] = [];

  for (const path of candidates) {
    attempted.add(path);
    try {
      return { path, lock: await client.getMailboxLock(path) };
    } catch (error) {
      failures.push({ path, message: getRawErrorMessage(error) });
    }
  }

  let listedPaths: string[] = [];
  try {
    const boxes = await client.list();
    listedPaths = boxes.map((box) => box.path).filter(Boolean);
    console.info("[mailbox:sync] MAILBOX_LIST", { paths: listedPaths });
  } catch (error) {
    console.error("[mailbox:sync:error]", {
      phase: "list-mailboxes",
      code: "mailbox_open_failed",
      message: getRawErrorMessage(error)
    });
  }

  const fallbackPaths = listedPaths.filter((path) => {
    const normalized = path.toLowerCase();
    return normalized === "inbox" || normalized.includes("posteingang");
  });

  for (const path of fallbackPaths) {
    if (attempted.has(path)) continue;
    try {
      return { path, lock: await client.getMailboxLock(path) };
    } catch (error) {
      failures.push({ path, message: getRawErrorMessage(error) });
    }
  }

  throw new MailboxOperationError(
    listedPaths.length > 0 ? "folder_not_found" : "mailbox_open_failed",
    listedPaths.length > 0 ? "Ordner INBOX nicht gefunden" : "Mailbox konnte nicht geöffnet werden",
    JSON.stringify({ attempted: failures, listedPaths })
  );
}

async function assertMailboxReadyForSync(config: MailboxConfig) {
  const health = await getMailboxHealth();
  if (!health.mailboxReady) {
    throw new MailboxOperationError("not_ready", "Mail-Einstellungen sind noch nicht bereit.", `testedAt=${config.testedAt?.toISOString() ?? "null"}`);
  }
}

export function getMailboxPublicError(error: unknown) {
  const operationError = error instanceof MailboxOperationError ? error : toMailboxOperationError(error, "connect");
  return {
    code: operationError.code,
    message: operationError.publicMessage
  };
}

function extractMailboxDomain(value: string | null | undefined) {
  const domain = value?.split("@")[1]?.trim().toLowerCase();
  return domain && domain.includes(".") ? domain : null;
}

function suggestImapHost(smtpHost: string | null | undefined, domain: string | null) {
  const normalizedSmtpHost = smtpHost?.toLowerCase() ?? "";
  if (normalizedSmtpHost.includes("hostinger") || domain?.includes("hostinger")) return "imap.hostinger.com";
  if (domain) return `imap.${domain}`;
  return "mail.example.com";
}

function friendlySmtpField(field: string) {
  const mapping: Record<string, string> = {
    SMTP_HOST: "fehlender SMTP Host",
    SMTP_PORT: "fehlender SMTP Port",
    SMTP_SECURE: "fehlendes SMTP Secure-Flag",
    SMTP_USER: "fehlender SMTP Benutzer",
    SMTP_PASS: "fehlendes SMTP Passwort",
    SMTP_FROM_EMAIL: "fehlende Absenderadresse",
    SMTP_FROM_NAME: "fehlender Absendername",
    EMAIL_MAX_EMAILS_PER_DAY: "fehlendes Tageslimit"
  };
  return mapping[field] ?? field;
}

function describeMailboxConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("auth") || lower.includes("login") || lower.includes("credential")) {
    return "Auth Fehler";
  }
  if (lower.includes("tls") || lower.includes("ssl") || lower.includes("certificate") || lower.includes("cert")) {
    return "TLS Fehler";
  }
  if (lower.includes("timeout")) {
    return "Verbindungstimeout";
  }
  if (lower.includes("host") || lower.includes("enotfound") || lower.includes("getaddrinfo")) {
    return "IMAP Host nicht erreichbar";
  }
  if (lower.includes("port")) {
    return "IMAP Port ungültig";
  }
  return message || "Mailbox-Verbindung fehlgeschlagen";
}

function logMailboxConfig(context: "test-connection" | "sync", config: MailboxConfig) {
  console.info(`[mailbox:${context}:config]`, {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    passwordPresent: config.passwordPresent,
    testedAt: config.testedAt?.toISOString() ?? null
  });
}

function toMailboxOperationError(error: unknown, phase: "connect" | "open-mailbox"): MailboxOperationError {
  if (error instanceof MailboxOperationError) return error;
  const code = classifyMailboxError(error, phase);
  const detail = getRawErrorMessage(error);
  const publicMessage = {
    configuration_missing: "Mail-Einstellungen sind unvollständig.",
    connection_failed: "Verbindung zum IMAP-Server fehlgeschlagen",
    login_failed: "Login fehlgeschlagen",
    mailbox_open_failed: "Mailbox konnte nicht geöffnet werden",
    folder_not_found: "Ordner INBOX nicht gefunden",
    fetch_failed: "Nachrichtenabruf fehlgeschlagen",
    parser_failed: "Parserfehler",
    db_insert_failed: "DB Insert Fehler",
    not_ready: "Mail-Einstellungen sind noch nicht bereit.",
    unknown: "Synchronisierung fehlgeschlagen. Bitte Mail-Einstellungen prüfen."
  }[code];
  return new MailboxOperationError(code, publicMessage, detail);
}

function classifyMailboxError(error: unknown, phase: "connect" | "open-mailbox"): MailboxErrorCode {
  if (phase === "open-mailbox") return "mailbox_open_failed";
  const message = getRawErrorMessage(error).toLowerCase();
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code).toLowerCase() : "";
  const responseCode = typeof error === "object" && error && "responseCode" in error ? String((error as { responseCode?: unknown }).responseCode).toLowerCase() : "";

  if (
    message.includes("auth") ||
    message.includes("login") ||
    message.includes("credential") ||
    message.includes("authentication") ||
    responseCode.includes("auth") ||
    responseCode.includes("login")
  ) {
    return "login_failed";
  }

  if (
    code.includes("econnrefused") ||
    code.includes("enotfound") ||
    code.includes("etimedout") ||
    code.includes("eai_again") ||
    message.includes("timeout") ||
    message.includes("getaddrinfo") ||
    message.includes("certificate") ||
    message.includes("tls") ||
    message.includes("ssl") ||
    message.includes("connection")
  ) {
    return "connection_failed";
  }

  return "unknown";
}

function getRawErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "Unbekannter Fehler");
}

export async function matchInboundEmail(fromEmail: string) {
  const prospect = await prisma.prospect.findFirst({
    where: { decisionMakerEmail: { equals: fromEmail, mode: "insensitive" } },
    include: {
      campaignEnrollments: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return {
    prospectId: prospect?.id ?? null,
    campaignId: prospect?.campaignEnrollments[0]?.campaignId ?? null,
    enrollmentId: prospect?.campaignEnrollments[0]?.id ?? null
  };
}
