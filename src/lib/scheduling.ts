export type CampaignSchedule = {
  status?: string | null;
  sendingStatus?: string | null;
  scheduledStartAt?: Date | null;
  timezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  weekdaysOnly?: boolean | null;
  manualGoApproved?: boolean | null;
};

export type ScheduleDecision = {
  allowed: boolean;
  reason?: string;
};

export function canSendCampaignNow(campaign: CampaignSchedule, now = new Date()): ScheduleDecision {
  const effectiveSendingStatus = getEffectiveCampaignSendingStatus(campaign);
  if (!["active", "scheduled"].includes(effectiveSendingStatus)) {
    return { allowed: false, reason: "Kampagne ist nicht freigegeben." };
  }

  if (campaign.manualGoApproved !== true) {
    return { allowed: false, reason: "Kampagne ist noch nicht freigegeben." };
  }

  if (campaign.scheduledStartAt && now < campaign.scheduledStartAt) {
    return { allowed: false, reason: "Kampagne ist noch nicht gestartet." };
  }

  const timezone = campaign.timezone || "Europe/Berlin";
  const local = getLocalParts(now, timezone);

  if (campaign.weekdaysOnly !== false && (local.weekday === 6 || local.weekday === 7)) {
    return { allowed: false, reason: "Versand ist auf Werktage beschränkt." };
  }

  const currentMinutes = local.hour * 60 + local.minute;
  const start = parseTime(campaign.sendWindowStart) ?? 8 * 60;
  const end = parseTime(campaign.sendWindowEnd) ?? 18 * 60;

  if (currentMinutes < start) {
    return { allowed: false, reason: "Versandfenster hat noch nicht begonnen." };
  }

  if (currentMinutes > end) {
    return { allowed: false, reason: "Versandfenster ist bereits beendet." };
  }

  return { allowed: true };
}

export function getNextAllowedCampaignSendAt(campaign: CampaignSchedule, now = new Date()): Date {
  if (campaign.scheduledStartAt && now < campaign.scheduledStartAt) {
    return new Date(campaign.scheduledStartAt);
  }

  const timezone = campaign.timezone || "Europe/Berlin";
  const local = getLocalParts(now, timezone);
  const start = parseTime(campaign.sendWindowStart) ?? 8 * 60;
  const end = parseTime(campaign.sendWindowEnd) ?? 18 * 60;
  const weekdaysOnly = campaign.weekdaysOnly !== false;

  if (!weekdaysOnly && local.hour * 60 + local.minute < start) {
    return localPartsToUtc({ ...local, hour: Math.floor(start / 60), minute: start % 60 }, timezone);
  }

  if (!weekdaysOnly && local.hour * 60 + local.minute <= end) {
    return new Date(now);
  }

  let candidate = {
    year: local.year,
    month: local.month,
    day: local.day,
    weekday: local.weekday
  };

  const currentMinutes = local.hour * 60 + local.minute;
  const shouldAdvance = weekdaysOnly
    ? candidate.weekday === 6 || candidate.weekday === 7 || currentMinutes > end
    : currentMinutes > end;

  if (!shouldAdvance && currentMinutes < start) {
    return localPartsToUtc({ ...candidate, hour: Math.floor(start / 60), minute: start % 60 }, timezone);
  }

  if (!weekdaysOnly && currentMinutes <= end && currentMinutes >= start) {
    return new Date(now);
  }

  do {
    candidate = addLocalDays(candidate, 1);
  } while (weekdaysOnly && (candidate.weekday === 6 || candidate.weekday === 7));

  return localPartsToUtc({ ...candidate, hour: Math.floor(start / 60), minute: start % 60 }, timezone);
}

export function getEffectiveCampaignSendingStatus(campaign: Pick<CampaignSchedule, "status" | "sendingStatus">): string {
  if (campaign.sendingStatus && campaign.sendingStatus !== "draft") {
    return campaign.sendingStatus;
  }

  if (campaign.status === "active") {
    return "active";
  }

  if (campaign.status && campaign.status !== "draft") {
    return campaign.status;
  }

  return campaign.sendingStatus ?? "draft";
}

function parseTime(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function getLocalParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
  };

  return {
    weekday: weekdays[parts.weekday] ?? 1,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function addLocalDays(local: { year: number; month: number; day: number; weekday: number }, days: number) {
  const shifted = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: ((local.weekday - 1 + days) % 7 + 7) % 7 + 1
  };
}

function localPartsToUtc(
  local: { year: number; month: number; day: number; hour: number; minute: number },
  timezone: string
) {
  let guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);

  for (let i = 0; i < 3; i += 1) {
    const formatted = getLocalParts(new Date(guess), timezone);
    const targetMinutes = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    const formattedMinutes = Date.UTC(formatted.year, formatted.month - 1, formatted.day, formatted.hour, formatted.minute);
    const diff = targetMinutes - formattedMinutes;
    if (diff === 0) {
      return new Date(guess);
    }
    guess += diff;
  }

  return new Date(guess);
}
