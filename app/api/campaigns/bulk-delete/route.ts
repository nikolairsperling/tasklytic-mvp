import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { bulkDeleteSchema } from "@/lib/bulk-delete";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { ids } = bulkDeleteSchema.parse(await request.json());
    const result = await prisma.campaign.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ deleted: result.count, failed: Math.max(0, ids.length - result.count) });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Einträge konnten nicht gelöscht werden.") }, { status: 400 });
  }
}
