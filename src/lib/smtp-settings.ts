import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SmtpConfig } from "@/lib/mailer";

const smtpSettingsInputSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().positive(),
  secure: z.union([z.boolean(), z.string()]).transform((value) => value === true || value === "true"),
  user: z.string().trim().min(1),
  password: z.string().optional().default(""),
  fromEmail: z.string().trim().email(),
  fromName: z.string().trim().min(1),
  dailyLimit: z.coerce.number().int().positive().optional().default(50),
  replyToEmail: z
    .union([z.string().trim().email(), z.literal(""), z.undefined()])
    .transform((value) => value || undefined)
});

export type SmtpSettingsInput = z.infer<typeof smtpSettingsInputSchema>;

export type SafeSmtpSettings = {
  configured: boolean;
  source: "database" | "env" | "none";
  missingFields: string[];
  values: {
    SMTP_HOST: string | null;
    SMTP_PORT: string | null;
    SMTP_SECURE: string | null;
    SMTP_USER: string | null;
    SMTP_FROM_EMAIL: string | null;
    SMTP_FROM_NAME: string | null;
    SMTP_REPLY_TO_EMAIL: string | null;
    SMTP_PASS_SET: boolean;
    EMAIL_MAX_EMAILS_PER_DAY: string | null;
  };
};

export function parseSmtpSettingsPayload(payload: unknown): SmtpSettingsInput {
  return smtpSettingsInputSchema.parse(payload);
}

export async function getSafeSmtpSettings(): Promise<SafeSmtpSettings> {
  const stored = await prisma.smtpSettings.findUnique({ where: { id: "default" } });

  if (stored) {
    const missingFields = [
      !stored.host ? "SMTP_HOST" : null,
      !stored.port ? "SMTP_PORT" : null,
      !stored.user ? "SMTP_USER" : null,
      !stored.encryptedPassword ? "SMTP_PASS" : null,
      !stored.fromEmail ? "SMTP_FROM_EMAIL" : null,
      !stored.fromName ? "SMTP_FROM_NAME" : null,
      !stored.dailyLimit ? "EMAIL_MAX_EMAILS_PER_DAY" : null
    ].filter(Boolean) as string[];

    return {
      configured: missingFields.length === 0,
      source: "database",
      missingFields,
      values: {
        SMTP_HOST: stored.host,
        SMTP_PORT: String(stored.port),
        SMTP_SECURE: String(stored.secure),
        SMTP_USER: stored.user,
        SMTP_FROM_EMAIL: stored.fromEmail,
        SMTP_FROM_NAME: stored.fromName,
        SMTP_REPLY_TO_EMAIL: stored.replyToEmail,
        SMTP_PASS_SET: Boolean(stored.encryptedPassword),
        EMAIL_MAX_EMAILS_PER_DAY: String(stored.dailyLimit)
      }
    };
  }

  return getEnvSmtpStatus();
}

export async function saveSmtpSettings(payload: SmtpSettingsInput) {
  const existing = await prisma.smtpSettings.findUnique({ where: { id: "default" } });
  const password = payload.password.trim();

  if (password && !process.env.SMTP_SETTINGS_SECRET) {
    throw new Error("SMTP_SETTINGS_SECRET fehlt. SMTP-Passwörter können nicht gespeichert werden.");
  }

  const encryptedPassword = password
    ? encryptSecret(password, process.env.SMTP_SETTINGS_SECRET)
    : existing?.encryptedPassword;

  return prisma.smtpSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      host: payload.host,
      port: payload.port,
      secure: payload.secure,
      user: payload.user,
      encryptedPassword,
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      replyToEmail: payload.replyToEmail,
      dailyLimit: payload.dailyLimit
    },
    update: {
      host: payload.host,
      port: payload.port,
      secure: payload.secure,
      user: payload.user,
      encryptedPassword,
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      replyToEmail: payload.replyToEmail,
      dailyLimit: payload.dailyLimit
    }
  });
}

export async function getEffectiveSmtpConfig(): Promise<SmtpConfig> {
  const stored = await prisma.smtpSettings.findUnique({ where: { id: "default" } });

  if (stored?.encryptedPassword) {
    return {
      SMTP_HOST: stored.host,
      SMTP_PORT: stored.port,
      SMTP_SECURE: stored.secure,
      SMTP_USER: stored.user,
      SMTP_PASS: decryptSecret(stored.encryptedPassword, process.env.SMTP_SETTINGS_SECRET),
      SMTP_FROM_EMAIL: stored.fromEmail,
      SMTP_FROM_NAME: stored.fromName,
      SMTP_REPLY_TO_EMAIL: stored.replyToEmail ?? undefined
    };
  }

  const { getSmtpConfig } = await import("@/lib/mailer");
  return getSmtpConfig();
}

export function getEnvSmtpStatus(env: NodeJS.ProcessEnv = process.env): SafeSmtpSettings {
  const missingFields = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM_EMAIL",
    "SMTP_FROM_NAME"
  ].filter((field) => !env[field]);

  return {
    configured: missingFields.length === 0,
    source: missingFields.length === 0 ? "env" : "none",
    missingFields,
    values: {
      SMTP_HOST: env.SMTP_HOST ?? null,
      SMTP_PORT: env.SMTP_PORT ?? null,
      SMTP_SECURE: env.SMTP_SECURE ?? null,
      SMTP_USER: env.SMTP_USER ?? null,
      SMTP_FROM_EMAIL: env.SMTP_FROM_EMAIL ?? null,
      SMTP_FROM_NAME: env.SMTP_FROM_NAME ?? null,
      SMTP_REPLY_TO_EMAIL: env.SMTP_REPLY_TO_EMAIL ?? null,
      SMTP_PASS_SET: Boolean(env.SMTP_PASS),
      EMAIL_MAX_EMAILS_PER_DAY: env.EMAIL_MAX_EMAILS_PER_DAY ?? "50"
    }
  };
}

export function encryptSecret(value: string, secret?: string): string {
  if (!secret) {
    throw new Error("SMTP_SETTINGS_SECRET fehlt.");
  }

  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(value: string, secret?: string): string {
  if (!secret) {
    throw new Error("SMTP_SETTINGS_SECRET fehlt.");
  }

  const [ivText, tagText, encryptedText] = value.split(":");
  const key = crypto.createHash("sha256").update(secret).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64")),
    decipher.final()
  ]).toString("utf8");
}
