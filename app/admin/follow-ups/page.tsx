import { prisma } from "@/lib/prisma";
import { buildFollowUpWhere, type FollowUpView } from "@/lib/follow-ups";
import { FollowUpDashboard, type FollowUpItem } from "@/components/admin/follow-up-dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ view?: string }>;
};

export default async function FollowUpsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const initialView = parseView(params.view);
  const now = new Date();

  const [today, overdue, week, done] = await Promise.all([
    prisma.prospect.findMany({ where: buildFollowUpWhere("due", now), orderBy: [{ followUpAt: "asc" }, { lastContactedAt: "desc" }], take: 100 }),
    prisma.prospect.findMany({ where: buildFollowUpWhere("overdue", now), orderBy: [{ followUpAt: "asc" }, { lastContactedAt: "desc" }], take: 100 }),
    prisma.prospect.findMany({ where: buildFollowUpWhere("week", now), orderBy: [{ followUpAt: "asc" }, { lastContactedAt: "desc" }], take: 100 }),
    prisma.prospect.findMany({ where: buildFollowUpWhere("done", now), orderBy: [{ updatedAt: "desc" }], take: 100 })
  ]);

  const summary = {
    today: today.length,
    overdue: overdue.length,
    week: week.length,
    done: done.length,
    dueCount: today.length + overdue.length,
    totalOpen: today.length + overdue.length + week.length
  };

  const lists = {
    due: today.map(toFollowUpItem),
    overdue: overdue.map(toFollowUpItem),
    week: week.map(toFollowUpItem),
    done: done.map(toFollowUpItem)
  } satisfies Record<FollowUpView, FollowUpItem[]>;

  return <FollowUpDashboard summary={summary} lists={lists} initialView={initialView} />;
}

function parseView(value: string | undefined): FollowUpView {
  if (value === "overdue" || value === "week" || value === "done") return value;
  return "due";
}

function toFollowUpItem(prospect: {
  id: string;
  companyName: string;
  city: string;
  decisionMakerName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  companyPhone: string | null;
  decisionMakerPhone: string | null;
  decisionMakerEmail: string | null;
  lastEmailSentAt: Date | null;
  followUpReason: string | null;
  followUpAt: Date | null;
  followUpStatus: string;
  status: string;
  leadStatus: string;
  slug: string | null;
  landingpageUrl: string | null;
  companyEmail: string | null;
}): FollowUpItem {
  return {
    id: prospect.id,
    companyName: prospect.companyName,
    city: prospect.city,
    decisionMakerName: prospect.decisionMakerName,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    phone: prospect.phone,
    companyPhone: prospect.companyPhone,
    decisionMakerPhone: prospect.decisionMakerPhone,
    decisionMakerEmail: prospect.decisionMakerEmail,
    lastEmailSentAt: prospect.lastEmailSentAt?.toISOString() ?? null,
    followUpReason: prospect.followUpReason,
    followUpAt: prospect.followUpAt?.toISOString() ?? null,
    followUpStatus: prospect.followUpStatus,
    status: prospect.status,
    leadStatus: prospect.leadStatus,
    slug: prospect.slug,
    landingpageUrl: prospect.landingpageUrl,
    companyEmail: prospect.companyEmail
  };
}
