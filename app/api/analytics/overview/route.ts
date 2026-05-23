import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { getAnalyticsOverview, parseAnalyticsFilters } from "@/lib/analytics-overview";

export async function GET(request: Request) {
  try {
    const filters = parseAnalyticsFilters(new URL(request.url).searchParams);
    return NextResponse.json(await getAnalyticsOverview(filters));
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Analytics konnten nicht geladen werden.") }, { status: 500 });
  }
}
