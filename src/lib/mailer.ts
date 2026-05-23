import nodemailer from "nodemailer";
import { z } from "zod";
import { delay } from "@/lib/email-delay";

const smtpEnvSchema = z.object({
  SMTP_HOST: z.string().trim().min(1, "SMTP_HOST fehlt"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .union([z.literal("true"), z.literal("false"), z.boolean(), z.undefined()])
    .transform((value) => value === true || value === "true")
    .default(false),
  SMTP_USER: z.string().trim().min(1, "SMTP_USER fehlt"),
  SMTP_PASS: z.string().trim().min(1, "SMTP_PASS fehlt"),
  SMTP_FROM_EMAIL: z.string().trim().email("SMTP_FROM_EMAIL ist ungültig"),
  SMTP_FROM_NAME: z.string().trim().min(1).default("Tasklytic"),
  SMTP_REPLY_TO_EMAIL: z.string().trim().email().optional()
});

export type SmtpConfig = z.infer<typeof smtpEnvSchema>;

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailSendResult = {
  messageId?: string;
};

export async function sendSmtpMail(payload: MailPayload): Promise<MailSendResult> {
  const { getEffectiveSmtpConfig } = await import("@/lib/smtp-settings");
  const config = await getEffectiveSmtpConfig();
  const transporter = createSmtpTransport(config);

  await delay();

  const result = await transporter.sendMail({
    from: `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM_EMAIL}>`,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: config.SMTP_REPLY_TO_EMAIL
  });

  return { messageId: result.messageId };
}

export function getSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig {
  return smtpEnvSchema.parse(env);
}

export async function verifySmtpConnection(): Promise<void> {
  const { getEffectiveSmtpConfig } = await import("@/lib/smtp-settings");
  const config = await getEffectiveSmtpConfig();
  const transporter = createSmtpTransport(config);
  await transporter.verify();
}

function createSmtpTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS
    }
  });
}
