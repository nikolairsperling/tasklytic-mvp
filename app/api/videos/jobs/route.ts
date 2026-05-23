import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const jobs = await prisma.videoGenerationJob.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      prospect: { select: { id: true, companyName: true, slug: true, personalVideoStatus: true } },
      campaign: { select: { id: true, name: true } },
      videoTemplate: { select: { id: true, name: true, provider: true } }
    }
  });
  return NextResponse.json(jobs);
}
