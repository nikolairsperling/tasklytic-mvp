import { NextResponse } from "next/server";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const { slug } = await params;
  return NextResponse.redirect(new URL(`/mock-videos/${encodeURIComponent(slug)}`, request.url));
}
