import { z } from "zod";

const smtpFields = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME"
] as const;

const testEmailSchema = z.object({
  to: z.string().trim().email()
});

export type SmtpSettingsStatus = {
  configured: boolean;
  missingFields: string[];
  values: {
    SMTP_HOST: string | null;
    SMTP_PORT: string | null;
    SMTP_SECURE: string | null;
    SMTP_USER: string | null;
    SMTP_FROM_EMAIL: string | null;
    SMTP_FROM_NAME: string | null;
    SMTP_PASS_SET: boolean;
  };
};

export function getSmtpSettingsStatus(env: NodeJS.ProcessEnv = process.env): SmtpSettingsStatus {
  const missingFields = smtpFields.filter((field) => !env[field]);

  return {
    configured: missingFields.length === 0,
    missingFields,
    values: {
      SMTP_HOST: env.SMTP_HOST ?? null,
      SMTP_PORT: env.SMTP_PORT ?? null,
      SMTP_SECURE: env.SMTP_SECURE ?? null,
      SMTP_USER: env.SMTP_USER ?? null,
      SMTP_FROM_EMAIL: env.SMTP_FROM_EMAIL ?? null,
      SMTP_FROM_NAME: env.SMTP_FROM_NAME ?? null,
      SMTP_PASS_SET: Boolean(env.SMTP_PASS)
    }
  };
}

export function parseTestEmailPayload(payload: unknown): { to: string } {
  return testEmailSchema.parse(payload);
}

export function getPublicAppUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.PUBLIC_APP_URL ?? env.NEXT_PUBLIC_APP_URL ?? null;
}
