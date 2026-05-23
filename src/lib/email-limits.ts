import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMailboxWarmupAllowedEmailsToday } from "@/lib/mailbox-warmup";

const emailLimitsSchema = z.object({
  EMAIL_MAX_EMAILS_PER_DAY: z.coerce.number().int().positive().optional().default(50),
  EMAIL_MAX_EMAILS_PER_BATCH: z.coerce.number().int().positive().optional().default(20),
  EMAIL_MAX_EMAILS_PER_PROSPECT_PER_DAY: z.coerce.number().int().positive().optional().default(1)
});

export type EmailLimits = {
  maxEmailsPerDay: number;
  maxEmailsPerBatch: number;
  maxEmailsPerProspectPerDay: number;
};

export type EmailLimitDecision = {
  allowed: boolean;
  reason?: string;
  nextSendAt?: Date;
};

export function getEmailLimits(env: NodeJS.ProcessEnv = process.env): EmailLimits {
  const parsed = emailLimitsSchema.parse(env);
  return {
    maxEmailsPerDay: parsed.EMAIL_MAX_EMAILS_PER_DAY,
    maxEmailsPerBatch: parsed.EMAIL_MAX_EMAILS_PER_BATCH,
    maxEmailsPerProspectPerDay: parsed.EMAIL_MAX_EMAILS_PER_PROSPECT_PER_DAY
  };
}

export function getNextLimitRetryAt(now = new Date()): Date {
  return addDays(now, 1);
}

export function getBatchLimit(limit?: number): number {
  const configured = getEmailLimits().maxEmailsPerBatch;
  if (!limit || Number.isNaN(limit)) {
    return configured;
  }
  return Math.max(1, Math.min(configured, Math.floor(limit)));
}

export async function checkEmailSendingLimits(input: {
  prospectId: string;
  now?: Date;
}): Promise<EmailLimitDecision> {
  const now = input.now ?? new Date();
  const limits = getEmailLimits();
  const smtp = await prisma.smtpSettings.findUnique({ where: { id: "default" }, select: { dailyLimit: true } });
  const maxEmailsPerDay = smtp?.dailyLimit ?? limits.maxEmailsPerDay;
  const { start, end } = getUtcDayBounds(now);
  const mailbox = await prisma.mailboxSettings.findUnique({ where: { id: "default" } });
  const allowedEmailsToday = mailbox
    ? getMailboxWarmupAllowedEmailsToday(
        { warmupStartDate: mailbox.warmupStartDate, warmupLevel: mailbox.warmupLevel },
        now,
        maxEmailsPerDay
      )
    : maxEmailsPerDay;

  const sentToday = await prisma.emailSendLog.count({
    where: {
      status: "sent",
      sentAt: { gte: start, lt: end }
    }
  });

  if (sentToday >= allowedEmailsToday) {
    return {
      allowed: false,
      reason: "Limit erreicht",
      nextSendAt: getNextLimitRetryAt(now)
    };
  }

  const prospectSentToday = await prisma.emailSendLog.count({
    where: {
      prospectId: input.prospectId,
      status: "sent",
      sentAt: { gte: start, lt: end }
    }
  });

  if (prospectSentToday >= limits.maxEmailsPerProspectPerDay) {
    return {
      allowed: false,
      reason: "Limit erreicht",
      nextSendAt: getNextLimitRetryAt(now)
    };
  }

  return { allowed: true };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getUtcDayBounds(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = addDays(start, 1);
  return { start, end };
}
