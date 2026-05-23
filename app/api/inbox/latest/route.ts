import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const email = await prisma.inboundEmail.findFirst({
    orderBy: { receivedAt: "desc" },
    include: {
      matchedProspect: { select: { companyName: true, decisionMakerEmail: true } },
      matchedCampaign: { select: { name: true } }
    }
  });

  return NextResponse.json({ email });
}
