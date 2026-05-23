import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { sendDueCampaignEmails } from "@/lib/campaigns";
import { getSmtpConfig } from "@/lib/mailer";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const sendDuePayloadSchema = z.object({
  limit: z.coerce.number().int().positive().max(20).optional()
});

export async function POST(request: Request, { params }: RouteProps) {
  try {
    getSmtpConfig();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const payload = sendDuePayloadSchema.parse(body);
    const result = await sendDueCampaignEmails({
      campaignId: id,
      limit: payload.limit
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Fällige Mails konnten nicht gesendet werden.") },
      { status: 400 }
    );
  }
}
