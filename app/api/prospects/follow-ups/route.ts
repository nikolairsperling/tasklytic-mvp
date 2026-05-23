import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildFollowUpWhere, type FollowUpView } from "@/lib/follow-ups";

export async function GET(request: Request) {
  try {
    const now = new Date();
    const { searchParams } = new URL(request.url);
    const view = parseView(searchParams.get("view"));

    const [todayCount, overdueCount, weekCount, doneCount, dueItems, overdueItems, weekItems, doneItems] = await Promise.all([
      prisma.prospect.count({ where: buildFollowUpWhere("due", now) }),
      prisma.prospect.count({ where: buildFollowUpWhere("overdue", now) }),
      prisma.prospect.count({ where: buildFollowUpWhere("week", now) }),
      prisma.prospect.count({ where: buildFollowUpWhere("done", now) }),
      prisma.prospect.findMany({ where: buildFollowUpWhere("due", now), orderBy: [{ followUpAt: "asc" }, { lastContactedAt: "desc" }], take: 100 }),
      prisma.prospect.findMany({ where: buildFollowUpWhere("overdue", now), orderBy: [{ followUpAt: "asc" }, { lastContactedAt: "desc" }], take: 100 }),
      prisma.prospect.findMany({ where: buildFollowUpWhere("week", now), orderBy: [{ followUpAt: "asc" }, { lastContactedAt: "desc" }], take: 100 }),
      prisma.prospect.findMany({ where: buildFollowUpWhere("done", now), orderBy: [{ updatedAt: "desc" }], take: 100 })
    ]);

    const summary = {
      today: todayCount,
      overdue: overdueCount,
      week: weekCount,
      done: doneCount,
      dueCount: todayCount + overdueCount,
      totalOpen: todayCount + overdueCount + weekCount
    };

    const data = view === "due"
      ? dueItems
      : view === "overdue"
        ? overdueItems
        : view === "week"
          ? weekItems
          : view === "done"
            ? doneItems
            : [...dueItems, ...overdueItems, ...weekItems, ...doneItems];

    return NextResponse.json({
      summary,
      data: data.map((prospect) => ({
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
        lastContactedAt: prospect.lastContactedAt?.toISOString() ?? null,
        followUpAt: prospect.followUpAt?.toISOString() ?? null,
        followUpReason: prospect.followUpReason,
        followUpStatus: prospect.followUpStatus,
        status: prospect.status,
        leadStatus: prospect.leadStatus,
        slug: prospect.slug,
        landingpageUrl: prospect.landingpageUrl,
        companyEmail: prospect.companyEmail
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Wiedervorlagen konnten nicht geladen werden.") }, { status: 500 });
  }
}

function parseView(value: string | null): FollowUpView | "all" {
  if (value === "overdue" || value === "due" || value === "week" || value === "done") return value;
  return "all";
}
