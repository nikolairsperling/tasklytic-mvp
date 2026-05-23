import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { trackProspectEvent } from "@/lib/prospect-events";
import { writeProspectReportPdf } from "@/lib/report-assets";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const prospect = await prisma.prospect.findFirst({
      where: { OR: [{ id }, { slug: id }] }
    });
    if (!prospect) {
      return NextResponse.json({ error: "Landingpage nicht gefunden." }, { status: 404 });
    }

    const landingpageId = prospect.slug || prospect.id;
    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const reportUrl = await writeProspectReportPdf({ prospect, landingpageId, baseUrl });
    const asset = await prisma.reportAsset.create({
      data: {
        prospectId: prospect.id,
        landingpageId,
        reportUrl
      }
    });

    await trackProspectEvent({
      prospectId: prospect.id,
      type: "report_generated",
      meta: { landingpageId, reportAssetId: asset.id, reportUrl }
    }, prisma);

    return NextResponse.json({ id: asset.id, reportUrl });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Report konnte nicht generiert werden.") },
      { status: 400 }
    );
  }
}
