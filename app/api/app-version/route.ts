import { NextResponse } from "next/server";
import { getBuildVersion } from "@/lib/build-version";

export const dynamic = "force-dynamic";

export async function GET() {
  const version = getBuildVersion();
  return NextResponse.json(
    { version, buildId: version },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      }
    }
  );
}
