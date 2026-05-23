import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await prisma.notificationEvent.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), read: true }
    });
    if (result.count === 0) {
      await prisma.notificationDismissal.upsert({
        where: { notificationId: id },
        update: {},
        create: { notificationId: id }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Benachrichtigung konnte nicht gelöscht werden.") }, { status: 400 });
  }
}
