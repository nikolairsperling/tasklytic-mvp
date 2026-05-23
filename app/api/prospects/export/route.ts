import { prisma } from "@/lib/prisma";
import { prospectsToCsv } from "@/lib/csv";
import { getErrorMessage } from "@/lib/api";

export async function GET() {
  try {
    const prospects = await prisma.prospect.findMany({
      orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }]
    });

    const csv = `\uFEFF${prospectsToCsv(prospects, process.env.NEXT_PUBLIC_APP_URL)}`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tasklytic-prospects.csv"'
      }
    });
  } catch (error) {
    return Response.json(
      { error: getErrorMessage(error, "CSV-Export fehlgeschlagen") },
      { status: 500 }
    );
  }
}
