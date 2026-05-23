import { NextResponse } from "next/server";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { isImpactJobStatus } from "@/lib/impact";
import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: RouteProps) {
  const { id } = await params;
  const job = await prisma.impactJob.findUnique({
    where: { id },
    include: { campaign: { select: { id: true, name: true } } }
  });
  if (!job) return NextResponse.json({ error: "Impact Job nicht gefunden" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const body = await request.json();
    const job = await prisma.impactJob.update({
      where: { id },
      data: {
        name: typeof body.name === "string" ? body.name : undefined,
        status: isImpactJobStatus(body.status) ? body.status : undefined,
        totalItems: body.totalItems === undefined ? undefined : Number(body.totalItems),
        processedItems: body.processedItems === undefined ? undefined : Number(body.processedItems),
        creditsUsed: body.creditsUsed === undefined ? undefined : Number(body.creditsUsed),
        resultJson: body.resultJson,
        errorMessage: typeof body.errorMessage === "string" ? body.errorMessage : undefined
      }
    });
    return NextResponse.json(job);
  } catch (error) {
    if (isRecordNotFoundError(error)) return NextResponse.json({ error: "Impact Job nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Impact Job konnte nicht gespeichert werden.") }, { status: 400 });
  }
}
