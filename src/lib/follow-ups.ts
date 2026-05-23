import type { Prisma } from "@prisma/client";

export const followUpStatuses = ["open", "done", "snoozed", "dismissed"] as const;
export type FollowUpStatus = (typeof followUpStatuses)[number];

export const followUpViews = ["due", "overdue", "week", "done"] as const;
export type FollowUpView = (typeof followUpViews)[number];

export function isFollowUpStatus(value: string | null | undefined): value is FollowUpStatus {
  return followUpStatuses.some((status) => status === value);
}

export function calculateFollowUpAt(sentAt: Date, followUpDays?: number | null) {
  if (typeof followUpDays === "number" && Number.isFinite(followUpDays) && followUpDays >= 0) {
    return addDays(sentAt, followUpDays);
  }

  return addBusinessDays(sentAt, 2);
}

export function addBusinessDays(date: Date, businessDays: number) {
  const next = new Date(date);
  let remaining = Math.max(0, Math.floor(businessDays));
  while (remaining > 0) {
    next.setDate(next.getDate() + 1);
    const day = next.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + Math.max(0, Math.floor(days)));
  return next;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function endOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const remaining = day === 0 ? 0 : 7 - day;
  next.setDate(next.getDate() + remaining);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function normalizeFollowUpDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getFollowUpViewLabel(view: FollowUpView) {
  return {
    due: "Heute fällig",
    overdue: "Überfällig",
    week: "Diese Woche",
    done: "Erledigt"
  }[view];
}

export function getFollowUpCategory(value: { followUpAt: Date | null; followUpStatus: string; lastContactedAt: Date | null }, now = new Date()): FollowUpView | null {
  if (value.followUpStatus !== "open") {
    return "done";
  }

  if (!value.followUpAt) {
    return null;
  }

  const today = startOfDay(now);
  const dueDate = value.followUpAt;
  if (dueDate < today) return "overdue";
  if (dueDate >= today && dueDate <= endOfDay(now)) return "due";
  if (dueDate <= endOfWeek(now)) return "week";
  return null;
}

export function buildFollowUpWhere(view: FollowUpView | "all", now = new Date()): Prisma.ProspectWhereInput {
  const today = startOfDay(now);
  const weekEnd = endOfWeek(now);
  if (view === "overdue") {
    return { followUpStatus: "open", followUpAt: { lt: today } };
  }
  if (view === "due") {
    return { followUpStatus: "open", followUpAt: { gte: today, lte: endOfDay(now) } };
  }
  if (view === "week") {
    return { followUpStatus: "open", followUpAt: { gt: endOfDay(now), lte: weekEnd } };
  }
  if (view === "done") {
    return { followUpStatus: { in: ["done", "snoozed", "dismissed"] } };
  }
  return {
    OR: [
      { followUpStatus: "open", followUpAt: { not: null } },
      { lastEmailSentAt: { not: null } }
    ]
  };
}

export function buildContactedNoReplyWhere(): Prisma.ProspectWhereInput {
  return {
    status: "contacted",
    lastEmailSentAt: { not: null },
    followUpStatus: "open"
  };
}

export function getFollowUpDueCountFilter(now = new Date()): Prisma.ProspectWhereInput {
  return {
    followUpStatus: "open",
    followUpAt: { lte: endOfDay(now) },
    lastEmailSentAt: { not: null }
  };
}
