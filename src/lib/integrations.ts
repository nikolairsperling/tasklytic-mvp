import type { Prisma, Prospect } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/smtp-settings";

const slackSchema = z.object({
  enabled: z.boolean().default(false),
  webhookUrl: z.string().url().optional().or(z.literal("")),
});

const clickupSchema = z.object({
  enabled: z.boolean().default(false),
  apiToken: z.string().optional().default(""),
  teamId: z.string().optional().default(""),
  spaceId: z.string().optional().default(""),
  folderId: z.string().optional().default(""),
  listId: z.string().optional().default(""),
  defaultAssignee: z.string().optional().default("")
});

const DEFAULT_CLICKUP_LIST_ID = "901523299248";

const openAiSchema = z.object({
  enabled: z.boolean().default(true),
  apiKey: z.string().optional().default("")
});

export async function getSafeIntegrationSettings() {
  const settings = await prisma.integrationSettings.findMany();
  const byType = Object.fromEntries(settings.map((entry) => [entry.type, entry]));
  const slack = byType.slack;
  const clickup = byType.clickup;
  const openai = byType.openai;

  return {
    slack: {
      enabled: slack?.enabled ?? false,
      webhookSet: Boolean(slack?.encryptedSecret)
    },
    clickup: {
      enabled: clickup?.enabled ?? false,
      tokenSet: Boolean(clickup?.encryptedSecret || process.env.CLICKUP_API_TOKEN),
      config: {
        ...((clickup?.configJson as Record<string, string> | undefined) ?? {}),
        ...(!clickup?.configJson && process.env.CLICKUP_LIST_ID ? { listId: process.env.CLICKUP_LIST_ID } : {})
      }
    },
    openai: {
      enabled: openai?.enabled ?? true,
      keySet: Boolean(openai?.encryptedSecret || process.env.OPENAI_API_KEY),
      source: openai?.encryptedSecret ? "db" : process.env.OPENAI_API_KEY ? "env" : "none"
    }
  };
}

export async function saveSlackSettings(payload: unknown) {
  const parsed = slackSchema.parse(payload);
  const existing = await prisma.integrationSettings.findUnique({ where: { type: "slack" } });
  const encryptedSecret = parsed.webhookUrl
    ? encryptRequired(parsed.webhookUrl)
    : existing?.encryptedSecret;

  return prisma.integrationSettings.upsert({
    where: { type: "slack" },
    create: { type: "slack", enabled: parsed.enabled, configJson: {}, encryptedSecret },
    update: { enabled: parsed.enabled, configJson: {}, encryptedSecret }
  });
}

export async function saveClickUpSettings(payload: unknown) {
  const parsed = clickupSchema.parse(payload);
  const existing = await prisma.integrationSettings.findUnique({ where: { type: "clickup" } });
  const encryptedSecret = parsed.apiToken
    ? encryptRequired(parsed.apiToken)
    : existing?.encryptedSecret;

  return prisma.integrationSettings.upsert({
    where: { type: "clickup" },
    create: {
      type: "clickup",
      enabled: parsed.enabled,
      configJson: { teamId: parsed.teamId, spaceId: parsed.spaceId, folderId: parsed.folderId, listId: parsed.listId, defaultAssignee: parsed.defaultAssignee },
      encryptedSecret
    },
    update: {
      enabled: parsed.enabled,
      configJson: { teamId: parsed.teamId, spaceId: parsed.spaceId, folderId: parsed.folderId, listId: parsed.listId, defaultAssignee: parsed.defaultAssignee },
      encryptedSecret
    }
  });
}

export async function saveOpenAiSettings(payload: unknown) {
  const parsed = openAiSchema.parse(payload);
  const existing = await prisma.integrationSettings.findUnique({ where: { type: "openai" } });
  const apiKey = parsed.apiKey.trim();
  const encryptedSecret = apiKey ? encryptRequired(apiKey) : existing?.encryptedSecret;

  return prisma.integrationSettings.upsert({
    where: { type: "openai" },
    create: { type: "openai", enabled: parsed.enabled, configJson: {}, encryptedSecret },
    update: { enabled: parsed.enabled, configJson: {}, encryptedSecret }
  });
}

export async function getEffectiveOpenAiApiKey(): Promise<string | null> {
  const settings = await prisma.integrationSettings.findUnique({ where: { type: "openai" } });
  if (settings?.encryptedSecret) {
    return decryptIntegrationSecret(settings.encryptedSecret);
  }
  return process.env.OPENAI_API_KEY ?? null;
}

export async function testOpenAiConnection(fetcher: typeof fetch = fetch) {
  const apiKey = await getEffectiveOpenAiApiKey();
  if (!apiKey) throw new Error("OpenAI API Key fehlt.");
  const response = await fetcher("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("OpenAI API Key ist ungültig.");
  }
  if (!response.ok) throw new Error("OpenAI ist nicht erreichbar oder hat die Anfrage abgelehnt.");
  return { ok: true };
}

export async function sendSlackTestMessage() {
  const settings = await prisma.integrationSettings.findUnique({ where: { type: "slack" } });
  if (!settings?.encryptedSecret) throw new Error("Slack Webhook URL fehlt.");
  const url = decryptIntegrationSecret(settings.encryptedSecret);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Tasklytic Slack Testnachricht" })
  });
  if (!response.ok) throw new Error("Slack Testnachricht fehlgeschlagen.");
}

export async function testClickUpConnection(fetcher: typeof fetch = fetch) {
  const { token, listId } = await getEffectiveClickUpSettings();
  if (!listId) throw new Error("ClickUp List ID fehlt.");
  const response = await fetcher(`https://api.clickup.com/api/v2/list/${listId}`, {
    headers: { Authorization: token }
  });
  if (!response.ok) {
    await logClickUpResponseError(response);
    throw new Error("ClickUp Testverbindung fehlgeschlagen.");
  }
  const list = await response.json();
  return { ok: true, message: "ClickUp verbunden: Liste gefunden", list: { id: list.id, name: list.name } };
}

export async function createClickUpTask({ name, description }: { name: string; description?: string }) {
  const { token, listId, defaultAssignee } = await getEffectiveClickUpSettings();
  if (!listId) throw new Error("ClickUp List ID fehlt.");
  const status = await getFirstClickUpListStatus({ token, listId });
  const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      description,
      ...(status ? { status } : {}),
      ...(defaultAssignee ? { assignees: [defaultAssignee] } : {})
    })
  });
  if (!response.ok) {
    await logClickUpResponseError(response);
    throw new Error("ClickUp Task konnte nicht erstellt werden.");
  }
  return response.json();
}

type ClickUpLeadProspect = Pick<
  Prospect,
  | "companyName"
  | "decisionMakerName"
  | "firstName"
  | "lastName"
  | "decisionMakerEmail"
  | "companyEmail"
  | "phone"
  | "companyPhone"
  | "decisionMakerPhone"
  | "source"
  | "enrichmentNotes"
>;

type ClickUpField = {
  id: string;
  name: string;
  type?: string;
};

type ClickUpTask = {
  id: string;
  name: string;
  description?: string | null;
  text_content?: string | null;
  custom_fields?: Array<{
    id?: string;
    name?: string;
    value?: unknown;
  }>;
};

type ClickUpSyncProspect = Prospect & {
  campaignEnrollments?: Array<{
    status: string;
    nextSendAt?: Date | null;
    campaign?: { name: string } | null;
  }>;
  notes?: Array<{ text: string; createdAt: Date }>;
};

type ClickUpSyncOptions = {
  checkDuplicates: boolean;
  updateExisting: boolean;
  appendComment: boolean;
  onlyCampaignReady: boolean;
};

type ClickUpSyncPayload = {
  taskName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  city: string;
  industry: string;
  score: number;
  status: string;
  nextFollowup: Date | null;
  campaign: string;
  notes: string;
};

type ClickUpLeadPayload = {
  name: string;
  description: string;
  contactName: string;
  email: string;
  phone: string;
  company: string;
  source: string;
};

export async function createClickUpTaskForLead(prospect: ClickUpLeadProspect, fetcher: typeof fetch = fetch) {
  const settings = await getOptionalClickUpSettings();
  if (!settings.enabled || !settings.token) return { skipped: true, reason: "disabled" };
  if (!settings.listId) throw new Error("ClickUp List ID fehlt.");
  const payload = buildClickUpLeadPayload(prospect);
  const status = await getFirstClickUpListStatus({ token: settings.token, listId: settings.listId, fetcher });
  const fields = await getClickUpListFields({ token: settings.token, listId: settings.listId, fetcher });
  const tasks = await getClickUpListTasks({ token: settings.token, listId: settings.listId, fetcher });
  const duplicate = findClickUpLeadDuplicate(payload, tasks, fields);
  if (duplicate) {
    console.info("ClickUp Lead existiert bereits", { taskId: duplicate.id, lead: payload.name });
    const updated = await updateClickUpDuplicateLeadTask({
      task: duplicate,
      payload,
      token: settings.token,
      source: payload.source,
      fields,
      fetcher
    });
    console.info("ClickUp Lead aktualisiert", { taskId: duplicate.id, lead: payload.name });
    return { ok: true, duplicate: true, updated, task: duplicate };
  }

  const customFields = buildClickUpCustomFieldPayload(fields, payload);
  const response = await fetcher(`https://api.clickup.com/api/v2/list/${settings.listId}/task`, {
    method: "POST",
    headers: { Authorization: settings.token, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      description: payload.description,
      ...(status ? { status } : {}),
      ...(settings.defaultAssignee ? { assignees: [settings.defaultAssignee] } : {}),
      ...(customFields.length > 0 ? { custom_fields: customFields } : {})
    })
  });
  if (!response.ok) {
    await logClickUpResponseError(response);
    throw new Error("ClickUp Lead konnte nicht erstellt werden.");
  }
  const created = await response.json();
  console.info("ClickUp Lead neu erstellt", { taskId: created?.id, lead: payload.name });
  return { ok: true, duplicate: false, task: created };
}

function buildClickUpLeadPayload(prospect: ClickUpLeadProspect): ClickUpLeadPayload {
  const contactName = prospect.decisionMakerName || [prospect.firstName, prospect.lastName].filter(Boolean).join(" ").trim();
  const name = prospect.companyName || contactName || "Neuer Lead";
  const email = prospect.decisionMakerEmail || prospect.companyEmail || "";
  const phone = prospect.decisionMakerPhone || prospect.phone || prospect.companyPhone || "";
  const source = prospect.source || "-";
  const description = [
    `Name: ${contactName || "-"}`,
    `E-Mail: ${email || "-"}`,
    `Telefon: ${phone || "-"}`,
    `Firma: ${prospect.companyName || "-"}`,
    `Quelle: ${source}`,
    `Notizen: ${prospect.enrichmentNotes || "-"}`
  ].join("\n");

  return { name, description, contactName, email, phone, company: prospect.companyName || "", source };
}

export async function createClickUpTaskForLeadSafe(prospect: ClickUpLeadProspect) {
  try {
    await createClickUpTaskForLead(prospect);
  } catch (error) {
    console.error("ClickUp Lead-Sync fehlgeschlagen", {
      message: error instanceof Error ? error.message : "Unbekannter Fehler",
      prospectCompany: prospect.companyName
    });
  }
}

export async function syncProspectsToClickUp(prospects: ClickUpSyncProspect[], options: ClickUpSyncOptions, fetcher: typeof fetch = fetch) {
  const settings = await getEffectiveClickUpSettings();
  if (!settings.listId) throw new Error("ClickUp List ID fehlt.");
  const [status, fields, tasks] = await Promise.all([
    getFirstClickUpListStatus({ token: settings.token, listId: settings.listId, fetcher }),
    getClickUpListFields({ token: settings.token, listId: settings.listId, fetcher }),
    options.checkDuplicates ? getClickUpListTasks({ token: settings.token, listId: settings.listId, fetcher }) : Promise.resolve([] as ClickUpTask[])
  ]);
  const summary = { successful: 0, updated: 0, created: 0, skipped: 0, failed: 0 };
  const errors: Array<{ prospectId: string; companyName: string; message: string }> = [];

  for (const prospect of prospects) {
    const payload = buildClickUpSyncPayload(prospect);
    if (options.onlyCampaignReady && !isClickUpCampaignReady(prospect)) {
      summary.skipped += 1;
      await logClickUpSync({ prospectId: prospect.id, action: "skipped", status: "skipped", payload });
      continue;
    }

    try {
      const duplicate = options.checkDuplicates ? findClickUpSyncDuplicate(payload, tasks, fields) : null;
      if (duplicate?.task && options.updateExisting) {
        await updateClickUpSyncTask({ taskId: duplicate.task.id, token: settings.token, fields, payload, appendComment: options.appendComment, fetcher });
        summary.successful += 1;
        summary.updated += 1;
        await logClickUpSync({ prospectId: prospect.id, clickUpTaskId: duplicate.task.id, action: "updated", status: "success", matchedBy: duplicate.matchedBy, payload });
        continue;
      }
      if (duplicate?.task && !options.updateExisting) {
        summary.skipped += 1;
        await logClickUpSync({ prospectId: prospect.id, clickUpTaskId: duplicate.task.id, action: "skipped", status: "skipped", matchedBy: duplicate.matchedBy, payload });
        continue;
      }

      const created = await createClickUpSyncTask({ token: settings.token, listId: settings.listId, defaultAssignee: settings.defaultAssignee, status, fields, payload, fetcher });
      if (options.appendComment && created?.id) {
        await appendClickUpSyncComment({ token: settings.token, taskId: String(created.id), payload, fetcher });
      }
      summary.successful += 1;
      summary.created += 1;
      await logClickUpSync({ prospectId: prospect.id, clickUpTaskId: typeof created?.id === "string" ? created.id : undefined, action: "created", status: "success", payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ClickUp Sync fehlgeschlagen.";
      summary.failed += 1;
      errors.push({ prospectId: prospect.id, companyName: prospect.companyName, message });
      await logClickUpSync({ prospectId: prospect.id, action: "failed", status: "failed", errorMessage: message, payload });
    }
  }

  return { ...summary, errors, analytics: await getClickUpSyncAnalytics() };
}

export async function getClickUpSyncAnalytics() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [totalSynced, todaySynced, updates, openErrors] = await Promise.all([
    prisma.clickUpSyncLog.count({ where: { status: "success" } }),
    prisma.clickUpSyncLog.count({ where: { status: "success", createdAt: { gte: startOfToday } } }),
    prisma.clickUpSyncLog.count({ where: { action: "updated", status: "success" } }),
    prisma.clickUpSyncLog.count({ where: { status: "failed" } })
  ]);
  return { totalSynced, todaySynced, updates, openErrors };
}

function buildClickUpSyncPayload(prospect: ClickUpSyncProspect): ClickUpSyncPayload {
  const activeEnrollment = prospect.campaignEnrollments?.find((entry) => entry.status === "active") ?? prospect.campaignEnrollments?.[0] ?? null;
  const contactName = prospect.decisionMakerName || [prospect.firstName, prospect.lastName].filter(Boolean).join(" ").trim();
  const email = prospect.decisionMakerEmail || prospect.companyEmail || "";
  const phone = prospect.decisionMakerPhone || prospect.phone || prospect.companyPhone || "";
  const score = prospect.icpFitScore || prospect.fitScore || prospect.icpScore || prospect.totalScore || 0;
  const notes = [
    prospect.enrichmentNotes,
    prospect.companyProfileSummary,
    prospect.painSummary,
    prospect.notes?.[0]?.text
  ].filter(Boolean).join("\n\n");
  return {
    taskName: prospect.companyName || contactName || "Tasklytic Lead",
    contactName,
    email,
    phone,
    website: prospect.websiteUrl || "",
    city: prospect.city || "",
    industry: prospect.industry || "",
    score,
    status: prospect.status || prospect.leadStatus || "",
    nextFollowup: prospect.followUpAt ?? activeEnrollment?.nextSendAt ?? null,
    campaign: activeEnrollment?.campaign?.name ?? "",
    notes
  };
}

function isClickUpCampaignReady(prospect: ClickUpSyncProspect) {
  return Boolean(prospect.decisionMakerEmail && prospect.slug && !["inactive", "unreachable"].includes(prospect.companyStatus));
}

function findClickUpSyncDuplicate(payload: ClickUpSyncPayload, tasks: ClickUpTask[], fields: ClickUpField[]) {
  const email = normalizeEmailForClickUp(payload.email);
  const phone = normalizePhoneForClickUp(payload.phone);
  const company = normalizeCompanyForClickUp(payload.taskName);
  const city = normalizeTextForClickUp(payload.city);

  for (const task of tasks) {
    const haystack = buildSyncDuplicateHaystack(task, fields);
    if (email && haystack.emailValues.includes(email)) return { task, matchedBy: "email" };
    if (phone && haystack.phoneValues.includes(phone)) return { task, matchedBy: "phone" };
    if (company && city && haystack.companyValues.includes(company) && haystack.cityValues.includes(city)) return { task, matchedBy: "company_city" };
  }
  return null;
}

function buildSyncDuplicateHaystack(task: ClickUpTask, fields: ClickUpField[]) {
  const text = `${task.name}\n${task.description ?? ""}\n${task.text_content ?? ""}`;
  const fieldValues = clickUpTaskFieldValues(task, fields);
  const emailValues = collectFieldOrTextValues(fieldValues, ["email", "e-mail", "mail"], text, normalizeEmailForClickUp);
  const phoneValues = collectFieldOrTextValues(fieldValues, ["telefon", "phone", "tel"], text, normalizePhoneForClickUp);
  const companyValues = collectFieldOrTextValues(fieldValues, ["firma", "company", "unternehmen"], text, normalizeCompanyForClickUp);
  const cityValues = collectFieldOrTextValues(fieldValues, ["stadt", "city", "ort"], text, normalizeTextForClickUp);
  const taskNameAsCompany = normalizeCompanyForClickUp(task.name);
  if (taskNameAsCompany) companyValues.push(taskNameAsCompany);
  return { emailValues, phoneValues, companyValues, cityValues };
}

function clickUpTaskFieldValues(task: ClickUpTask, fields: ClickUpField[]) {
  const fieldValues = new Map<string, unknown>();
  for (const customField of task.custom_fields ?? []) {
    const fieldName = customField.name ?? fields.find((field) => field.id === customField.id)?.name;
    if (fieldName) fieldValues.set(normalizeFieldName(fieldName), customField.value);
  }
  return fieldValues;
}

async function createClickUpSyncTask({
  token,
  listId,
  defaultAssignee,
  status,
  fields,
  payload,
  fetcher
}: {
  token: string;
  listId: string;
  defaultAssignee?: string;
  status?: string;
  fields: ClickUpField[];
  payload: ClickUpSyncPayload;
  fetcher: typeof fetch;
}) {
  const response = await fetcher(`https://api.clickup.com/api/v2/list/${listId}/task`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.taskName,
      description: buildClickUpSyncDescription(payload),
      ...(status ? { status } : {}),
      ...(defaultAssignee ? { assignees: [defaultAssignee] } : {}),
      custom_fields: buildClickUpSyncCustomFieldPayload(fields, payload)
    })
  });
  if (!response.ok) {
    await logClickUpResponseError(response);
    throw new Error("ClickUp Task konnte nicht erstellt werden.");
  }
  return response.json();
}

async function updateClickUpSyncTask({
  taskId,
  token,
  fields,
  payload,
  appendComment,
  fetcher
}: {
  taskId: string;
  token: string;
  fields: ClickUpField[];
  payload: ClickUpSyncPayload;
  appendComment: boolean;
  fetcher: typeof fetch;
}) {
  const response = await fetcher(`https://api.clickup.com/api/v2/task/${taskId}`, {
    method: "PUT",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ name: payload.taskName, description: buildClickUpSyncDescription(payload) })
  });
  if (!response.ok) {
    await logClickUpResponseError(response);
    throw new Error("ClickUp Task konnte nicht aktualisiert werden.");
  }
  for (const customField of buildClickUpSyncCustomFieldPayload(fields, payload)) {
    await setClickUpCustomField({ token, taskId, fieldId: customField.id, value: customField.value, fetcher });
  }
  if (appendComment) await appendClickUpSyncComment({ token, taskId, payload, fetcher });
  return response.json();
}

async function setClickUpCustomField({ token, taskId, fieldId, value, fetcher }: { token: string; taskId: string; fieldId: string; value: unknown; fetcher: typeof fetch }) {
  const response = await fetcher(`https://api.clickup.com/api/v2/task/${taskId}/field/${fieldId}`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ value })
  });
  if (!response.ok) await logClickUpResponseError(response);
}

async function appendClickUpSyncComment({ token, taskId, payload, fetcher }: { token: string; taskId: string; payload: ClickUpSyncPayload; fetcher: typeof fetch }) {
  const today = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(new Date());
  const comment_text = [
    "Aktualisiert aus Tasklytic",
    "Quelle: Outreach",
    `Status: ${payload.status || "-"}`,
    `Score: ${payload.score}`,
    `Datum: ${today}`
  ].join("\n");
  const response = await fetcher(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ comment_text })
  });
  if (!response.ok) await logClickUpResponseError(response);
}

function buildClickUpSyncDescription(payload: ClickUpSyncPayload) {
  return [
    payload.notes,
    "",
    "Tasklytic Daten",
    `Ansprechpartner: ${payload.contactName || "-"}`,
    `E-Mail: ${payload.email || "-"}`,
    `Telefon: ${payload.phone || "-"}`,
    `Webseite: ${payload.website || "-"}`,
    `Stadt: ${payload.city || "-"}`,
    `Branche: ${payload.industry || "-"}`,
    `ICP Score: ${payload.score}`,
    `Status: ${payload.status || "-"}`,
    `Wiedervorlage: ${payload.nextFollowup ? payload.nextFollowup.toISOString().slice(0, 10) : "-"}`,
    `Kampagne: ${payload.campaign || "-"}`
  ].filter((line, index) => index > 1 || line).join("\n");
}

function buildClickUpSyncCustomFieldPayload(fields: ClickUpField[], payload: ClickUpSyncPayload) {
  const mapping = [
    { names: ["ansprechpartner", "kontakt", "contact", "person"], value: payload.contactName },
    { names: ["email", "e-mail", "mail"], value: payload.email },
    { names: ["telefon", "phone", "tel"], value: payload.phone },
    { names: ["webseite", "website", "url"], value: payload.website },
    { names: ["stadt", "city", "ort"], value: payload.city },
    { names: ["branche", "industry"], value: payload.industry },
    { names: ["icp score", "score"], value: payload.score },
    { names: ["status"], value: payload.status },
    { names: ["wiedervorlage", "next followup", "followup", "follow-up"], value: payload.nextFollowup },
    { names: ["kampagne", "campaign"], value: payload.campaign }
  ];
  return mapping.flatMap(({ names, value }) => {
    if (value === null || value === undefined || value === "") return [];
    const field = fields.find((candidate) => names.some((name) => normalizeFieldName(candidate.name).includes(name)));
    if (!field) return [];
    return [{ id: field.id, value: coerceClickUpFieldValue(field, value) }];
  });
}

function coerceClickUpFieldValue(field: ClickUpField, value: unknown) {
  if (value instanceof Date) return field.type === "date" ? value.getTime() : value.toISOString().slice(0, 10);
  if (field.type === "number" && typeof value === "number") return value;
  return String(value);
}

async function logClickUpSync(input: { prospectId?: string; clickUpTaskId?: string; action: string; status: string; matchedBy?: string; errorMessage?: string; payload: ClickUpSyncPayload }) {
  await prisma.clickUpSyncLog.create({
    data: {
      prospectId: input.prospectId,
      clickUpTaskId: input.clickUpTaskId,
      action: input.action,
      status: input.status,
      matchedBy: input.matchedBy,
      errorMessage: input.errorMessage,
      payloadJson: input.payload as unknown as Prisma.InputJsonValue
    }
  }).catch(() => undefined);
}

function getIntegrationSettingsSecret() {
  const secret = process.env.INTEGRATION_SETTINGS_SECRET;
  if (!secret) {
    throw new Error("INTEGRATION_SETTINGS_SECRET fehlt in der Server-Konfiguration.");
  }
  return secret;
}

function encryptRequired(value: string) {
  return encryptSecret(value, getIntegrationSettingsSecret());
}

function decryptIntegrationSecret(value: string) {
  return decryptSecret(value, getIntegrationSettingsSecret());
}

export async function getEffectiveClickUpSettings() {
  const settings = await getOptionalClickUpSettings();
  if (!settings.token) throw new Error("ClickUp API Token fehlt.");
  return { ...settings, token: settings.token };
}

async function getOptionalClickUpSettings() {
  const settings = await prisma.integrationSettings.findUnique({ where: { type: "clickup" } });
  const token = settings?.encryptedSecret
    ? decryptIntegrationSecret(settings.encryptedSecret)
    : process.env.CLICKUP_API_TOKEN;
  const config = (settings?.configJson as Record<string, string> | undefined) ?? {};
  return {
    enabled: settings?.enabled ?? Boolean(process.env.CLICKUP_API_TOKEN),
    token,
    listId: config.listId || process.env.CLICKUP_LIST_ID || DEFAULT_CLICKUP_LIST_ID,
    defaultAssignee: config.defaultAssignee || process.env.CLICKUP_DEFAULT_ASSIGNEE,
    source: settings?.encryptedSecret ? "database" as const : "env" as const
  };
}

async function getFirstClickUpListStatus({ token, listId, fetcher = fetch }: { token: string; listId: string; fetcher?: typeof fetch }) {
  const response = await fetcher(`https://api.clickup.com/api/v2/list/${listId}`, {
    headers: { Authorization: token }
  });
  if (!response.ok) {
    await logClickUpResponseError(response);
    throw new Error("ClickUp Listenstatus konnte nicht geladen werden.");
  }
  const body = await response.json();
  const firstStatus = Array.isArray(body.statuses) ? body.statuses[0]?.status : undefined;
  return typeof firstStatus === "string" && firstStatus.trim() ? firstStatus : undefined;
}

async function getClickUpListFields({ token, listId, fetcher = fetch }: { token: string; listId: string; fetcher?: typeof fetch }): Promise<ClickUpField[]> {
  const response = await fetcher(`https://api.clickup.com/api/v2/list/${listId}/field`, {
    headers: { Authorization: token }
  });
  if (!response.ok) {
    await logClickUpResponseError(response);
    return [];
  }
  const body = await response.json();
  const fields = Array.isArray(body.fields) ? body.fields : [];
  return fields
    .filter((field: Partial<ClickUpField>) => typeof field.id === "string" && typeof field.name === "string")
    .map((field: ClickUpField) => ({ id: field.id, name: field.name, type: field.type }));
}

async function getClickUpListTasks({ token, listId, fetcher = fetch }: { token: string; listId: string; fetcher?: typeof fetch }): Promise<ClickUpTask[]> {
  const tasks: ClickUpTask[] = [];
  for (let page = 0; page < 10; page += 1) {
    const response = await fetcher(`https://api.clickup.com/api/v2/list/${listId}/task?include_closed=true&page=${page}&subtasks=false`, {
      headers: { Authorization: token }
    });
    if (!response.ok) {
      await logClickUpResponseError(response);
      throw new Error("ClickUp Tasks konnten nicht geladen werden.");
    }
    const body = await response.json();
    const pageTasks = Array.isArray(body.tasks) ? body.tasks : [];
    tasks.push(...pageTasks);
    if (pageTasks.length === 0 || Boolean(body.last_page)) break;
  }
  return tasks;
}

function findClickUpLeadDuplicate(payload: ClickUpLeadPayload, tasks: ClickUpTask[], fields: ClickUpField[]) {
  const email = normalizeEmailForClickUp(payload.email);
  const phone = normalizePhoneForClickUp(payload.phone);
  const company = normalizeCompanyForClickUp(payload.company);
  const contact = normalizeTextForClickUp(payload.contactName);

  return tasks.find((task) => {
    const haystack = buildDuplicateHaystack(task, fields);
    if (email && haystack.emailValues.includes(email)) return true;
    if (phone && haystack.phoneValues.includes(phone)) return true;
    return Boolean(company && contact && haystack.companyValues.includes(company) && haystack.contactValues.includes(contact));
  });
}

function buildDuplicateHaystack(task: ClickUpTask, fields: ClickUpField[]) {
  const text = `${task.name}\n${task.description ?? ""}\n${task.text_content ?? ""}`;
  const fieldValues = new Map<string, unknown>();
  for (const customField of task.custom_fields ?? []) {
    const fieldName = customField.name ?? fields.find((field) => field.id === customField.id)?.name;
    if (fieldName) fieldValues.set(normalizeFieldName(fieldName), customField.value);
  }

  const emailValues = collectFieldOrTextValues(fieldValues, ["email", "e-mail", "mail"], text, normalizeEmailForClickUp);
  const phoneValues = collectFieldOrTextValues(fieldValues, ["telefon", "phone", "tel"], text, normalizePhoneForClickUp);
  const companyValues = collectFieldOrTextValues(fieldValues, ["firma", "company", "unternehmen"], text, normalizeCompanyForClickUp);
  const contactValues = collectFieldOrTextValues(fieldValues, ["ansprechpartner", "kontakt", "name", "contact"], text, normalizeTextForClickUp);
  const taskNameAsCompany = normalizeCompanyForClickUp(task.name);
  const taskNameAsContact = normalizeTextForClickUp(task.name);
  if (taskNameAsCompany) companyValues.push(taskNameAsCompany);
  if (taskNameAsContact) contactValues.push(taskNameAsContact);

  return { emailValues, phoneValues, companyValues, contactValues };
}

function collectFieldOrTextValues(
  fieldValues: Map<string, unknown>,
  names: string[],
  text: string,
  normalize: (value: string | null | undefined) => string
) {
  const values = new Set<string>();
  for (const [name, value] of fieldValues.entries()) {
    if (names.some((candidate) => name.includes(candidate))) {
      const normalized = normalize(clickUpValueToText(value));
      if (normalized) values.add(normalized);
    }
  }
  for (const label of names) {
    const match = text.match(new RegExp(`${escapeRegExp(label)}\\s*:\\s*([^\\n]+)`, "i"));
    const normalized = normalize(match?.[1]);
    if (normalized) values.add(normalized);
  }
  return [...values];
}

function clickUpValueToText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(clickUpValueToText).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return clickUpValueToText(record.value ?? record.name ?? record.label ?? record.email ?? "");
  }
  return "";
}

async function updateClickUpDuplicateLeadTask({
  task,
  payload,
  token,
  source,
  fields,
  fetcher
}: {
  task: ClickUpTask;
  payload: ClickUpLeadPayload;
  token: string;
  source: string;
  fields: ClickUpField[];
  fetcher: typeof fetch;
}) {
  const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date());
  const note = `Lead erneut eingegangen am ${date} über ${source || "-"}`;
  const description = [task.description || task.text_content || payload.description, "", note].filter(Boolean).join("\n");
  const response = await fetcher(`https://api.clickup.com/api/v2/task/${task.id}`, {
    method: "PUT",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ description })
  });
  if (!response.ok) {
    await logClickUpResponseError(response);
    throw new Error("ClickUp Lead konnte nicht aktualisiert werden.");
  }

  for (const customField of buildClickUpCustomFieldPayload(fields, payload)) {
    const fieldResponse = await fetcher(`https://api.clickup.com/api/v2/task/${task.id}/field/${customField.id}`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ value: customField.value })
    });
    if (!fieldResponse.ok) await logClickUpResponseError(fieldResponse);
  }

  return response.json();
}

function buildClickUpCustomFieldPayload(fields: ClickUpField[], payload: ClickUpLeadPayload) {
  const mapping = [
    { names: ["email", "e-mail", "mail"], value: payload.email },
    { names: ["telefon", "phone", "tel"], value: payload.phone },
    { names: ["firma", "company", "unternehmen"], value: payload.company },
    { names: ["ansprechpartner", "kontakt", "contact", "person"], value: payload.contactName },
    { names: ["quelle", "source"], value: payload.source }
  ];
  return mapping.flatMap(({ names, value }) => {
    if (!value) return [];
    const field = fields.find((candidate) => names.some((name) => normalizeFieldName(candidate.name).includes(name)));
    return field ? [{ id: field.id, value }] : [];
  });
}

function normalizeEmailForClickUp(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhoneForClickUp(value: string | null | undefined) {
  return (value ?? "").replace(/[^\d+]/g, "").replace(/^00/, "+");
}

function normalizeCompanyForClickUp(value: string | null | undefined) {
  return normalizeTextForClickUp(value)
    .replace(/\b(gmbh|ug|ag|kg|ohg|mbh|ltd|limited|inc|corp|corporation)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextForClickUp(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeFieldName(value: string) {
  return normalizeTextForClickUp(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function logClickUpResponseError(response: Response) {
  const body = await response.text().catch(() => "<response body konnte nicht gelesen werden>");
  console.error(`ClickUp Fehler: ${response.status} ${body}`);
}
