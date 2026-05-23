export type MailboxWarmupInput = {
  warmupStartDate?: Date | string | null;
  warmupLevel?: number | null;
};

export function getMailboxWarmupAllowedEmailsToday(
  mailbox: MailboxWarmupInput,
  now = new Date(),
  maxEmailsPerDay = 50
): number {
  const warmupStartDate = normalizeDate(mailbox.warmupStartDate);
  const warmupLevel = normalizeLevel(mailbox.warmupLevel);

  if (!warmupStartDate || warmupLevel === null) {
    return maxEmailsPerDay;
  }

  if (now < warmupStartDate) {
    return maxEmailsPerDay;
  }

  const daysSinceStart = Math.max(0, diffUtcDays(warmupStartDate, now));
  return Math.max(1, Math.min(maxEmailsPerDay, warmupLevel + daysSinceStart));
}

function normalizeDate(value?: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLevel(value?: number | null): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return Math.max(1, Math.floor(value));
}

function diffUtcDays(start: Date, end: Date): number {
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((endDay - startDay) / 86_400_000);
}
