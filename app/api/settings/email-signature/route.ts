import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { saveEmailSignature } from "@/lib/email-signature";
import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  id: z.string().optional(),
  name: z.string().default("Standard Signatur"),
  html: z.string().default(""),
  plainText: z.string().default(""),
  isDefault: z.boolean().optional().default(true)
});

export async function GET() {
  const signatures = await prisma.emailSignature.findMany({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
  return NextResponse.json({ active: signatures.find((signature) => signature.isDefault) ?? signatures[0] ?? null, data: signatures });
}

export async function POST(request: Request) {
  return save(request);
}

export async function PATCH(request: Request) {
  return save(request);
}

async function save(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());
    return NextResponse.json(await saveEmailSignature(payload), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Signatur konnte nicht gespeichert werden.") }, { status: 400 });
  }
}
