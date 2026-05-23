import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logSystemError, serializeSystemErrorLog } from "@/lib/error-diagnostics";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestIdFromHeaders } from "@/lib/request-id";

const errorLogSchema = z.object({
  requestId: z.string().optional(),
  area: z.string().min(1).default("system"),
  action: z.string().min(1).default("unknown"),
  apiRoute: z.string().optional(),
  method: z.string().optional(),
  httpStatus: z.number().int().optional(),
  errorCode: z.string().optional(),
  userMessage: z.string().optional(),
  technicalDetail: z.string().optional(),
  responseBody: z.string().optional(),
  durationMs: z.number().int().optional(),
  affectedType: z.string().optional(),
  affectedId: z.string().optional(),
  source: z.enum(["client", "server", "smoke-test"]).optional()
});

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const session = await getSessionFromCookies();
  if (!session) {
    const response = NextResponse.json({ error: "Berechtigung fehlt.", errorCode: "PERMISSION_DENIED", requestId }, { status: 401 });
    response.headers.set("x-request-id", requestId);
    return response;
  }
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "100"), 200);
  const logs = await prisma.systemErrorLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit
  });
  const response = NextResponse.json({ items: logs.map(serializeSystemErrorLog), requestId });
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const payload = errorLogSchema.parse(await request.json());
  const result = await logSystemError({ ...payload, requestId: payload.requestId ?? requestId });
  const response = NextResponse.json({ ok: true, ...result });
  response.headers.set("x-request-id", result.requestId);
  return response;
}
