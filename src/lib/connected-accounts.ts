export const CONNECTED_ACCOUNT_TYPES = [
  "SMTP",
  "MAILBOX",
  "SLACK",
  "CLICKUP",
  "OPENAI",
  "HEYGEN",
  "CUSTOM"
] as const;

export type ConnectedAccountType = (typeof CONNECTED_ACCOUNT_TYPES)[number];

export type ConnectedAccountInput = {
  name: string;
  type: ConnectedAccountType;
  provider: string | null;
  notes: string | null;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeConnectedAccountType(value: unknown): ConnectedAccountType {
  const normalized = stringValue(value).toLowerCase().replace(/[\s_-]+/g, "");
  const aliases: Record<string, ConnectedAccountType> = {
    smtp: "SMTP",
    mail: "MAILBOX",
    mailbox: "MAILBOX",
    email: "MAILBOX",
    slack: "SLACK",
    clickup: "CLICKUP",
    openai: "OPENAI",
    gpt: "OPENAI",
    heygen: "HEYGEN",
    video: "HEYGEN",
    custom: "CUSTOM",
    other: "CUSTOM",
    unknown: "CUSTOM",
    sonstiges: "CUSTOM"
  };

  return aliases[normalized] ?? "CUSTOM";
}

export function connectedAccountData(body: Record<string, unknown>): ConnectedAccountInput {
  return {
    name: stringValue(body.name),
    type: normalizeConnectedAccountType(body.type),
    provider: stringValue(body.provider) || null,
    notes: stringValue(body.notes) || null
  };
}

export function validateConnectedAccount(data: ConnectedAccountInput) {
  if (!data.name) {
    throw new Error("Name ist erforderlich.");
  }
}
