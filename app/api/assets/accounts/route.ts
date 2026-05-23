import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { connectedAccountData, validateConnectedAccount } from "@/lib/connected-accounts";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    return NextResponse.json(await prisma.connectedAccount.findMany({ orderBy: { createdAt: "desc" } }));
  } catch (error) {
    console.error("[assets/accounts] GET failed", error);
    return NextResponse.json({
      items: [],
      warning: getErrorMessage(error, "Accounts konnten nicht geladen werden.")
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const data = connectedAccountData(body);
    validateConnectedAccount(data);
    const account = await prisma.connectedAccount.create({ data });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("ASSET_SAVE_FAILED", { asset: "connectedAccount", action: "create", message: getErrorMessage(error, "Account konnte nicht erstellt werden.") });
    return NextResponse.json({ error: getErrorMessage(error, "Account konnte nicht erstellt werden.") }, { status: 400 });
  }
}
