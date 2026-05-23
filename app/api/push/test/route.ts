import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { getSessionFromCookies } from "@/lib/auth";
import { createNotificationEvent } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    const subscriptionCount = await prisma.pushSubscription.count({ where: { userId: session.userId } });
    const event = await createNotificationEvent({
      type: "test",
      title: "Tasklytic Push ist aktiv",
      body: "Test-Benachrichtigung erfolgreich vorbereitet.",
      url: "/admin/dashboard"
    });
    return NextResponse.json({
      ok: true,
      delivered: false,
      subscriptionCount,
      notification: event,
      message: "Test-Notification gespeichert. Der Browser zeigt sie lokal über den Service Worker an."
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Test-Push fehlgeschlagen.") }, { status: 400 });
  }
}
