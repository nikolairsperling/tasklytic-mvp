import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { getNotificationCenterData } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    return NextResponse.json(await getNotificationCenterData());
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Benachrichtigungen konnten nicht geladen werden.") }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    await prisma.notificationEvent.updateMany({ where: { read: false, deletedAt: null }, data: { read: true } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Benachrichtigungen konnten nicht aktualisiert werden.") }, { status: 400 });
  }
}
