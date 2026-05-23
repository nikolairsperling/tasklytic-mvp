import { NextResponse } from "next/server";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { connectedAccountData, validateConnectedAccount } from "@/lib/connected-accounts";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const data = connectedAccountData(body);
    validateConnectedAccount(data);
    return NextResponse.json(await prisma.connectedAccount.update({ where: { id }, data }));
  } catch (error) {
    const status = isRecordNotFoundError(error) ? 404 : 400;
    return NextResponse.json({ error: getErrorMessage(error, "Account konnte nicht gespeichert werden.") }, { status });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.connectedAccount.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    const status = isRecordNotFoundError(error) ? 404 : 400;
    return NextResponse.json({ error: getErrorMessage(error, "Account konnte nicht gelöscht werden.") }, { status });
  }
}
