import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = verifySessionToken(request.cookies.get(sessionCookieName)?.value);
  return NextResponse.json({
    authenticated: Boolean(session),
    userEmail: session?.email ?? null
  });
}
