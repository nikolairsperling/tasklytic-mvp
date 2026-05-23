import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: RouteProps) {
  const { id } = await params;
  const job = await prisma.videoGenerationJob.findUnique({
    where: { id },
    include: {
      prospect: { select: { id: true, companyName: true, slug: true } },
      campaign: { select: { id: true, name: true } },
      videoTemplate: { select: { id: true, name: true, provider: true } }
    }
  });
  if (!job) return NextResponse.json({ error: "Video-Job nicht gefunden" }, { status: 404 });
  return NextResponse.json(job);
}
