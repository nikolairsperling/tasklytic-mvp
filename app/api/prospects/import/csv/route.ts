import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseProspectsCsv } from "@/lib/csv";
import { createClickUpTaskForLeadSafe } from "@/lib/integrations";
import { calculateProspectScore } from "@/lib/scoring";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV-Datei fehlt." }, { status: 400 });
    }

    const contents = await file.text();
    const prospects = parseProspectsCsv(contents);
    console.info("IMPORT_START", { filename: file.name, rows: prospects.length });

    if (prospects.length === 0) {
      return NextResponse.json({ error: "Keine gültigen Prospect-Zeilen gefunden." }, { status: 400 });
    }

    const created = await prisma.$transaction(
      prospects.map((prospect) => prisma.prospect.create({ data: { ...prospect, ...calculateProspectScore(prospect) } as Prisma.ProspectUncheckedCreateInput }))
    );
    await Promise.all(created.map((prospect) => createClickUpTaskForLeadSafe(prospect)));

    return NextResponse.json({ count: created.length }, { status: 201 });
  } catch (error) {
    console.error("IMPORT_FAILED", { message: getErrorMessage(error, "CSV-Import fehlgeschlagen") });
    return NextResponse.json(
      {
        error: getErrorMessage(error, "CSV-Import fehlgeschlagen")
      },
      { status: 400 }
    );
  }
}
