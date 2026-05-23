import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const emails = await prisma.inboundEmail.findMany({
    orderBy: { receivedAt: "desc" },
    include: {
      matchedProspect: { select: { companyName: true, decisionMakerEmail: true } },
      matchedCampaign: { select: { name: true } }
    },
    take: 100
  });

  return NextResponse.json(emails);
}
