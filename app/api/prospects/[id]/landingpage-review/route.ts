import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const payloadSchema = z.object({
  landingpageReviewStatus: z.enum(["draft", "needs_review", "approved"])
});

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = payloadSchema.parse(await request.json());
    const prospect = await prisma.prospect.update({
      where: { id },
      data: { landingpageReviewStatus: payload.landingpageReviewStatus }
    });

    return NextResponse.json(prospect);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Landingpage-Status konnte nicht aktualisiert werden.") },
      { status: 400 }
    );
  }
}
