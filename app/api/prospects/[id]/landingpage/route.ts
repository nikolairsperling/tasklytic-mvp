import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { buildLandingpageUrl } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { generateProspectSlug } from "@/lib/slug";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const prospect = await prisma.prospect.findUnique({ where: { id } });

    if (!prospect) {
      return NextResponse.json({ error: "Prospect nicht gefunden" }, { status: 404 });
    }

    let slug = generateProspectSlug(prospect.companyName, prospect.city);
    const existing = await prisma.prospect.findFirst({
      where: {
        slug,
        NOT: { id }
      }
    });

    if (existing) {
      slug = `${slug}-${prospect.id.slice(0, 6)}`;
    }

    const updated = await prisma.prospect.update({
      where: { id },
      data: {
        landingpageUrl: buildLandingpageUrl(slug),
        slug,
        status: "landingpage_ready",
        landingpageReviewStatus: "needs_review"
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Landingpage konnte nicht vorbereitet werden.") },
      { status: 400 }
    );
  }
}
