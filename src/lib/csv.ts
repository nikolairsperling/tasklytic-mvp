import type { Prospect } from "@prisma/client";
import { parse as parseCsv } from "csv-parse/sync";
import { normalizeBoolean, parseProspectPayload, serializeStatus } from "@/lib/prospects";

function escapeCsv(value: string | number | undefined): string {
  if (value === undefined) {
    return "";
  }

  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function prospectsToCsv(prospects: Prospect[], appUrl?: string): string {
  const header = [
    "companyName",
    "city",
    "websiteUrl",
    "decisionMakerName",
    "decisionMakerEmail",
    "totalScore",
    "status",
    "landingpageUrl"
  ];

  const rows = prospects.map((prospect) => {
    const landingpageUrl =
      prospect.slug && appUrl
        ? `${appUrl.replace(/\/$/, "")}/p/${prospect.slug}`
        : prospect.slug
          ? `/p/${prospect.slug}`
          : "";

    return [
      prospect.companyName,
      prospect.city,
      prospect.websiteUrl ?? "",
      prospect.decisionMakerName ?? "",
      prospect.decisionMakerEmail ?? "",
      prospect.totalScore,
      prospect.status,
      landingpageUrl
    ]
      .map(escapeCsv)
      .join(",");
  });

  return [header.join(","), ...rows].join("\n");
}

export function parseProspectsCsv(csv: string) {
  const rows = parseCsv(csv, {
    bom: true,
    columns: true,
    delimiter: [",", ";", "\t"],
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true
  }) as Array<Record<string, string>>;

  return rows.map((raw, index) => {
    try {
      return parseProspectPayload({
        ...raw,
        vehicleCount: raw.vehicleCount,
        trailerCount: raw.trailerCount,
        locationsCount: raw.locationsCount,
        businessFields: raw.businessFields,
        openDispatcherJob: normalizeBoolean(raw.openDispatcherJob ?? ""),
        isFamilyOwned: raw.isFamilyOwned ? normalizeBoolean(raw.isFamilyOwned) : undefined,
        icpFitScore: raw.icpFitScore,
        timingScore: raw.timingScore,
        painScore: raw.painScore,
        contactQualityScore: raw.contactQualityScore,
        totalScore: raw.totalScore,
        status: serializeStatus(raw.status)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ungültige CSV-Zeile";
      throw new Error(`CSV-Zeile ${index + 2}: ${message}`);
    }
  });
}
