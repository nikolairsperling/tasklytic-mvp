import { NextResponse } from "next/server";
import { getMailboxHealth } from "@/lib/mailbox";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getMailboxHealth());
}
