import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Prospect } from "@prisma/client";

export type ReportProspectInput = Pick<
  Prospect,
  | "id"
  | "slug"
  | "companyName"
  | "decisionMakerName"
  | "decisionMakerRole"
  | "industry"
  | "painType"
  | "painSummary"
  | "customPainPoint"
  | "icpScore"
  | "icpFitScore"
  | "fitScore"
  | "calendarUrl"
  | "bookingUrl"
  | "landingpageUrl"
>;

export type PrintMailingProspectInput = {
  icpScore?: number | null;
  icpFitScore?: number | null;
  fitScore?: number | null;
  events?: Array<{ type: string }>;
};

export function shouldRecommendPrintMailing(prospect: PrintMailingProspectInput) {
  const score = Math.max(prospect.icpScore ?? 0, prospect.icpFitScore ?? 0, prospect.fitScore ?? 0);
  const events = prospect.events ?? [];
  return score >= 60
    && events.some((event) => event.type === "page_view")
    && !events.some((event) => event.type === "booking_completed");
}

export async function writeProspectReportPdf({
  prospect,
  landingpageId,
  baseUrl
}: {
  prospect: ReportProspectInput;
  landingpageId: string;
  baseUrl: string;
}) {
  const reportId = `report-${prospect.id}-${Date.now()}`;
  const relativeUrl = `/uploads/reports/${reportId}.pdf`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "reports");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, `${reportId}.pdf`), buildProspectReportPdf(prospect, landingpageId, baseUrl));
  return relativeUrl;
}

export function buildProspectReportPdf(prospect: ReportProspectInput, landingpageId: string, baseUrl: string) {
  const landingpageUrl = prospect.landingpageUrl || `${baseUrl.replace(/\/$/, "")}/p/${prospect.slug || landingpageId}`;
  const appointmentUrl = prospect.bookingUrl || prospect.calendarUrl || "Terminlink wird nachgereicht";
  const contact = [prospect.decisionMakerName, prospect.decisionMakerRole].filter(Boolean).join(", ") || "Ansprechpartner nicht hinterlegt";
  const score = Math.max(prospect.icpScore ?? 0, prospect.icpFitScore ?? 0, prospect.fitScore ?? 0);
  const painPoint = prospect.customPainPoint || prospect.painSummary || prospect.painType || "Manuelle Abstimmung und wiederkehrende Rückfragen im Backoffice";
  const lines = [
    "Tasklytic Kurzreport",
    `Firma: ${prospect.companyName}`,
    `Ansprechpartner: ${contact}`,
    `Branche: ${prospect.industry || "nicht eindeutig erkannt"}`,
    `ICP Score: ${score}`,
    "",
    "Schmerzpunkt-Hypothese:",
    painPoint,
    "",
    "Moegliche Zeitfresser:",
    "- Rueckfragen zu Auftragsstatus ueber mehrere Kanaele",
    "- Doppelte Dateneingaben in Dispo, E-Mail, Telefon oder Excel",
    "- Manuelle Angebots-, Rechnungs- oder Dokumentenprozesse",
    "- Abstimmung im Backoffice ohne klare Prozessuebergabe",
    "",
    "Empfohlene naechste Schritte:",
    "1. Prozess mit hohem manuellem Aufwand auswaehlen",
    "2. Zeitverlust und Wiederholungen kurz quantifizieren",
    "3. In einem kurzen Termin pruefen, ob Automatisierung sinnvoll ist",
    "",
    `QR-Code zur Landingpage: ${landingpageUrl}`,
    `Terminlink: ${appointmentUrl}`
  ];

  return createSimplePdf(lines);
}

function createSimplePdf(lines: string[]) {
  const content = [
    "BT",
    "/F1 20 Tf",
    "56 780 Td",
    `(${escapePdfText(lines[0] || "Kurzreport")}) Tj`,
    "/F1 10 Tf",
    ...lines.slice(1).flatMap((line) => ["0 -18 Td", `(${escapePdfText(line)}) Tj`]),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) {
    chunks.push(`${offset.toString().padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(""), "utf8");
}

function escapePdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, (char) => {
    const replacements: Record<string, string> = {
      ä: "ae",
      ö: "oe",
      ü: "ue",
      Ä: "Ae",
      Ö: "Oe",
      Ü: "Ue",
      ß: "ss",
      "€": "EUR"
    };
    return replacements[char] ?? "";
  }).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
