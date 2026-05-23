import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const count = await prisma.pushSubscription.count({ where: { userId: session.userId } });
  return NextResponse.json({
    enabled: count > 0,
    supported: true,
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null
  });
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    const payload = subscriptionSchema.parse(await request.json());
    const userAgent = request.headers.get("user-agent");

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint: payload.endpoint },
      create: {
        userId: session.userId,
        endpoint: payload.endpoint,
        p256dh: payload.keys.p256dh,
        auth: payload.keys.auth,
        userAgent
      },
      update: {
        userId: session.userId,
        p256dh: payload.keys.p256dh,
        auth: payload.keys.auth,
        userAgent
      }
    });

    return NextResponse.json({ ok: true, id: subscription.id });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Push-Subscription konnte nicht gespeichert werden.") }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    const result = await prisma.pushSubscription.deleteMany({ where: { userId: session.userId } });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Push-Subscription konnte nicht gelöscht werden.") }, { status: 400 });
  }
}
