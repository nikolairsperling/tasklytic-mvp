import * as XLSX from "xlsx";
import { parse as parseCsv } from "csv-parse/sync";
import type { Prisma, Prospect } from "@prisma/client";
import type { ProspectInput } from "@/lib/prospects";
import { parseProspectPayload, splitDecisionMakerName } from "@/lib/prospects";
import { createClickUpTaskForLeadSafe } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { calculateProspectScore } from "@/lib/scoring";

export const importableProspectFields = [
  "companyName",
  "city",
  "postalCode",
  "street",
  "phone",
  "email",
  "decisionMakerEmail",
  "companyEmail",
  "websiteUrl",
  "website",
  "legalName",
  "decisionMakerName",
  "employeeCount",
  "employeeRange"
] as const;

export type ImportField = (typeof importableProspectFields)[number];
export type ImportMapping = Partial<Record<string, ImportField | "">>;
export type RawImportRow = Record<string, string>;
export type DuplicateImportMode = "skip" | "enrich" | "overwrite" | "create";

const mappingSynonyms: Record<ImportField, string[]> = {
  companyName: ["name", "firma", "unternehmen", "company", "companyname", "firmenname"],
  city: ["ort", "stadt", "city"],
  postalCode: ["plz", "postleitzahl", "zip", "postalcode"],
  street: ["straße", "strasse", "street", "adresse", "anschrift"],
  phone: ["tel", "telefon", "phone", "rufnummer"],
  email: ["kontakt email", "kontakt-email", "allgemeine email"],
  decisionMakerEmail: ["e-mail", "email", "mail", "geschaeftsfuehreremail", "ansprechpartneremail"],
  companyEmail: ["firmaemail", "companyemail", "infoemail", "kontaktmail"],
  websiteUrl: ["website", "webseite", "url", "homepage", "internet"],
  website: ["website", "webseite", "url", "homepage", "internet"],
  legalName: ["legalname", "legal name", "firmenname", "firma", "unternehmen"],
  decisionMakerName: ["ges vertreter 1", "ges. vertreter 1", "geschaeftsfuehrer", "geschäftsführer", "ansprechpartner", "vertreter"],
  employeeCount: ["mitarbeiterzahl", "mitarbeiter", "employees", "employee_count"],
  employeeRange: ["mitarbeiterrange", "employee range", "groesse", "größe"]
};

const companyFallbackColumns = ["Firma", "firma", "Unternehmen", "unternehmen", "Name", "name", "Company", "company"];

export type LeadImportIssue = { row: number; field: string; message: string };
export type LeadImportError = LeadImportIssue;
export type LeadImportPreview = {
  validRows: number;
  invalidRows: number;
  newLeads: number;
  duplicates: number;
  leadsToEnrich: number;
  faultyRows: number;
  skippedRows: number;
  sampleRows: Array<Partial<ProspectInput>>;
  warnings: LeadImportIssue[];
  errors: LeadImportError[];
};

type DuplicateMatchType = "websiteDomain" | "email" | "phone" | "companyCity" | "companyPostalCode";
type DuplicateMatch = {
  prospect: Pick<Prospect, "id" | "companyName" | "city" | "postalCode" | "phone" | "companyPhone" | "decisionMakerPhone" | "decisionMakerEmail" | "companyEmail" | "websiteUrl">;
  type: DuplicateMatchType;
};

export function parseLeadImportFile(buffer: Buffer, filename: string): RawImportRow[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    return normalizeRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }));
  }

  if (lower.endsWith(".csv")) {
    return normalizeRows(parseCsv(buffer.toString("utf8"), {
      bom: true,
      columns: (headers: string[]) => headers.map((header) => cleanCell(header)),
      delimiter: [",", ";", "\t"],
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true
    }) as Array<Record<string, unknown>>);
  }

  throw new Error("Nur CSV- und XLSX-Dateien werden unterstützt.");
}

export function suggestMapping(columns: string[]): ImportMapping {
  const result: ImportMapping = {};
  for (const column of columns) {
    const normalizedColumn = normalizeHeader(column);
    const match = importableProspectFields.find((field) =>
      mappingSynonyms[field].some((synonym) => normalizeHeader(synonym) === normalizedColumn)
    );
    if (match) {
      result[column] = match;
    }
  }
  return result;
}

export function mapImportRow(row: RawImportRow, mapping: ImportMapping): Partial<ProspectInput> {
  const mapped: Record<string, unknown> = {
    country: "DE",
    businessFields: [],
    openDispatcherJob: false,
    status: "draft",
    companyStatus: "unclear"
  };

  for (const [source, target] of Object.entries(mapping)) {
    if (!target) continue;
    const value = cleanCell(row[source]);
    if (!value) continue;
    const normalizedTarget = normalizeTargetField(target);
    mapped[normalizedTarget] = normalizedTarget === "employeeCount" ? parseInteger(value) : normalizeUrlField(normalizedTarget, value);
  }

  if (!mapped.companyName) {
    mapped.companyName = mapped.legalName || readCompanyFallback(row);
  }

  if (!mapped.companyEmail && mapped.decisionMakerEmail && String(mapped.decisionMakerEmail).startsWith("info@")) {
    mapped.companyEmail = mapped.decisionMakerEmail;
    delete mapped.decisionMakerEmail;
  }

  if (mapped.decisionMakerName && !mapped.firstName && !mapped.lastName) {
    Object.assign(mapped, splitDecisionMakerName(String(mapped.decisionMakerName)));
  }

  return mapped;
}

export async function previewLeadImport(rows: RawImportRow[], mapping: ImportMapping, duplicateMode: DuplicateImportMode = "skip"): Promise<LeadImportPreview> {
  const errors: LeadImportError[] = [];
  const warnings: LeadImportIssue[] = [];
  const sampleRows: Array<Partial<ProspectInput>> = [];
  const existingProspects = await loadDuplicateCandidates();
  const importedProspects: DuplicateMatch["prospect"][] = [];
  let validRows = 0;
  let newLeads = 0;
  let duplicates = 0;
  let skippedRows = 0;

  rows.forEach((raw, index) => {
    const rowNumber = index + 2;
    if (isEmptyRow(raw)) {
      errors.push({ row: rowNumber, field: "row", message: "CSV-Zeile ist komplett leer." });
      skippedRows += 1;
      return;
    }

    const mapped = prepareImportRow(raw, mapping, rowNumber, warnings);
    try {
      validateImportRow(mapped);
      const parsed = parseProspectPayload({ ...mapped, city: mapped.city ?? "" });
      validRows += 1;
      if (sampleRows.length < 5) {
        sampleRows.push(parsed);
      }
      const duplicate = findDuplicateInProspects(parsed, [...existingProspects, ...importedProspects]);
      if (duplicate) {
        duplicates += 1;
        if (duplicateMode === "skip") skippedRows += 1;
      } else {
        newLeads += 1;
        importedProspects.push(toDuplicateCandidate(parsed, `preview-${index}`));
      }
    } catch (error) {
      errors.push(formatImportError(rowNumber, error));
    }
  });

  return {
    validRows,
    invalidRows: errors.length,
    newLeads: duplicateMode === "create" ? validRows : newLeads,
    duplicates,
    leadsToEnrich: duplicateMode === "enrich" ? duplicates : 0,
    faultyRows: errors.length,
    skippedRows,
    sampleRows,
    warnings,
    errors
  };
}

export async function confirmLeadImport({
  filename,
  mapping,
  rows,
  duplicateMode,
  skipDuplicates = true,
  leadListId
}: {
  filename: string;
  mapping: ImportMapping;
  rows: RawImportRow[];
  duplicateMode?: DuplicateImportMode;
  skipDuplicates?: boolean;
  leadListId?: string | null;
}) {
  const mode = duplicateMode ?? (skipDuplicates ? "skip" : "overwrite");
  const batch = await prisma.leadImportBatch.create({
    data: {
      filename,
      status: "processing",
      totalRows: rows.length
    }
  });

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  const importedProspectIds: string[] = [];
  const errors: LeadImportError[] = [];
  const warnings: LeadImportIssue[] = [];

  for (const [index, raw] of rows.entries()) {
    const rowNumber = index + 2;
    if (isEmptyRow(raw)) {
      invalidCount += 1;
      const error = { row: rowNumber, field: "row", message: "CSV-Zeile ist komplett leer." };
      errors.push(error);
      await createImportRow(batch.id, raw, null, "failed", error.message);
      continue;
    }

    const mapped = prepareImportRow(raw, mapping, rowNumber, warnings);
    try {
      validateImportRow(mapped);
      const parsed = parseProspectPayload({ ...mapped, city: mapped.city ?? "" });
      const duplicate = await findDuplicateProspect(parsed);
      if (duplicate && mode !== "create") {
        duplicateCount += 1;
        if (mode === "skip") {
          skippedCount += 1;
          await createImportRow(batch.id, raw, parsed, "duplicate", "Duplikat übersprungen", duplicate.id);
          continue;
        }
        updatedCount += 1;
        const updateData = mode === "enrich" ? buildEnrichData(duplicate, parsed) : removeUndefined(parsed);
        const scoreInput = { ...duplicate, ...updateData } as Partial<ProspectInput>;
        const scores = calculateProspectScore(scoreInput);
        const updated = await prisma.prospect.update({
          where: { id: duplicate.id },
          data: { ...updateData, ...scores }
        });
        await createImportRow(batch.id, raw, parsed, "duplicate", mode === "enrich" ? "Bestehender Prospect ergänzt" : "Bestehender Prospect überschrieben", updated.id);
        continue;
      }

      const scores = calculateProspectScore(parsed);
      const created = await prisma.prospect.create({ data: { ...parsed, ...scores } });
      await createClickUpTaskForLeadSafe(created);
      createdCount += 1;
      importedProspectIds.push(created.id);
      await createImportRow(batch.id, raw, parsed, "imported", null, created.id);
    } catch (error) {
      invalidCount += 1;
      const issue = formatImportError(rowNumber, error);
      const message = issue.message;
      errors.push(issue);
      await createImportRow(batch.id, raw, mapped, "failed", message);
    }
  }

  if (leadListId && importedProspectIds.length > 0) {
    await prisma.leadListMember.createMany({
      data: importedProspectIds.map((prospectId) => ({ leadListId, prospectId })),
      skipDuplicates: true
    });
  }

  const completed = await prisma.leadImportBatch.update({
    where: { id: batch.id },
    data: {
      status: "completed",
      createdCount,
      updatedCount,
      skippedCount,
      invalidCount,
      duplicateCount
    },
    include: { rows: true }
  });

  return { ...completed, importedProspectIds, importWarnings: warnings, importErrors: errors };
}

export async function findDuplicateProspect(input: ProspectInput) {
  const candidates = await loadDuplicateCandidates();
  const match = findDuplicateInProspects(input, candidates);
  if (!match) return null;
  return prisma.prospect.findUnique({ where: { id: match.prospect.id } });
}

export function normalizeWebsiteDomain(value: string | null | undefined) {
  const raw = cleanCell(value).toLowerCase();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).hostname.replace(/^www\./, "").replace(/\/+$/, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/\/+$/, "");
  }
}

export function normalizeEmail(value: string | null | undefined) {
  const normalized = cleanCell(value).toLowerCase();
  if (!normalized) return null;
  return isValidEmail(normalized) ? normalized : null;
}

export function normalizeWebsite(value: string | null | undefined) {
  const trimmed = cleanCell(value);
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isValidWebsiteUrl(withProtocol)) return null;
  return withProtocol;
}

export function normalizePhone(value: string | null | undefined) {
  return cleanCell(value).replace(/[^\d+]/g, "");
}

export function normalizeCompanyPart(value: string | null | undefined) {
  return cleanCell(value).toLowerCase();
}

function createImportRow(batchId: string, raw: RawImportRow, mapped: unknown, status: string, reason?: string | null, prospectId?: string) {
  return prisma.leadImportRow.create({
    data: {
      batchId,
      rawJson: raw,
      mappedJson: mapped === null ? undefined : mapped,
      status,
      reason,
      prospectId
    }
  });
}

function normalizeRows(rows: Array<Record<string, unknown>>): RawImportRow[] {
  return rows
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim(), cleanCell(value)])));
}

function validateImportRow(mapped: Partial<ProspectInput>) {
  if (!cleanCell(mapped.companyName)) {
    throw new ImportValidationError("companyName", "Firma fehlt.");
  }
  parseProspectPayload({ ...mapped, city: mapped.city ?? "" });
}

function isEmptyRow(row: RawImportRow) {
  return Object.values(row).every((value) => !cleanCell(value));
}

function cleanCell(value: unknown) {
  return String(value ?? "").replace(/\uFEFF/g, "").trim();
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeUrlField(target: string, value: string) {
  if (target !== "websiteUrl") {
    return value;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function prepareImportRow(raw: RawImportRow, mapping: ImportMapping, row: number, warnings: LeadImportIssue[]) {
  const mapped = mapImportRow(raw, mapping);
  normalizeOptionalContactFields(mapped, row, warnings);
  return mapped;
}

function normalizeOptionalContactFields(mapped: Partial<ProspectInput>, row: number, warnings: LeadImportIssue[]) {
  if ("decisionMakerEmail" in mapped) {
    const original = mapped.decisionMakerEmail;
    const normalized = normalizeEmail(original);
    if (normalized) {
      mapped.decisionMakerEmail = normalized;
    } else {
      delete mapped.decisionMakerEmail;
      if (cleanCell(original)) {
        warnings.push({ row, field: "decisionMakerEmail", message: "Ungültige E-Mail wurde ignoriert." });
      }
    }
  }

  if ("companyEmail" in mapped) {
    const original = mapped.companyEmail;
    const normalized = normalizeEmail(original);
    if (normalized) {
      mapped.companyEmail = normalized;
    } else {
      delete mapped.companyEmail;
    }
  }

  if ("websiteUrl" in mapped) {
    const original = mapped.websiteUrl;
    const normalized = normalizeWebsite(original);
    if (normalized) {
      mapped.websiteUrl = normalized;
    } else {
      delete mapped.websiteUrl;
      if (cleanCell(original)) {
        warnings.push({ row, field: "websiteUrl", message: "Ungültige Website wurde ignoriert." });
      }
    }
  }
}

function formatImportError(row: number, error: unknown): LeadImportError {
  if (error instanceof ImportValidationError) {
    return { row, field: error.field, message: error.message };
  }
  return { row, field: "database", message: error instanceof Error ? error.message : "Import fehlgeschlagen." };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidWebsiteUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && /^[^\s.]+\.[^\s]+$/.test(url.hostname);
  } catch {
    return false;
  }
}

class ImportValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

function normalizeTargetField(target: ImportField): keyof ProspectInput {
  if (target === "website") return "websiteUrl";
  if (target === "email") return "companyEmail";
  return target;
}

function readCompanyFallback(row: RawImportRow) {
  for (const column of companyFallbackColumns) {
    const value = cleanCell(row[column]);
    if (value) return value;
  }
  return undefined;
}

function parseInteger(value: string) {
  const number = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function removeUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== "")) as T;
}

function loadDuplicateCandidates() {
  return prisma.prospect.findMany({
    select: {
      id: true,
      companyName: true,
      city: true,
      postalCode: true,
      phone: true,
      companyPhone: true,
      decisionMakerPhone: true,
      decisionMakerEmail: true,
      companyEmail: true,
      websiteUrl: true
    }
  });
}

function findDuplicateInProspects(input: ProspectInput, prospects: DuplicateMatch["prospect"][]): DuplicateMatch | null {
  const inputWebsite = normalizeWebsiteDomain(input.websiteUrl);
  if (inputWebsite) {
    const prospect = prospects.find((candidate) => normalizeWebsiteDomain(candidate.websiteUrl) === inputWebsite);
    if (prospect) return { prospect, type: "websiteDomain" };
  }

  const inputEmails = [input.decisionMakerEmail, input.companyEmail].map(normalizeEmail).filter(Boolean);
  if (inputEmails.length > 0) {
    const prospect = prospects.find((candidate) => [candidate.decisionMakerEmail, candidate.companyEmail].map(normalizeEmail).some((email) => email && inputEmails.includes(email)));
    if (prospect) return { prospect, type: "email" };
  }

  const inputPhone = normalizePhone(input.phone);
  if (inputPhone) {
    const prospect = prospects.find((candidate) => [candidate.phone, candidate.companyPhone, candidate.decisionMakerPhone].map(normalizePhone).includes(inputPhone));
    if (prospect) return { prospect, type: "phone" };
  }

  const inputCompanyName = normalizeCompanyPart(input.companyName);
  const inputCity = normalizeCompanyPart(input.city);
  if (inputCompanyName && inputCity) {
    const prospect = prospects.find((candidate) => normalizeCompanyPart(candidate.companyName) === inputCompanyName && normalizeCompanyPart(candidate.city) === inputCity);
    if (prospect) return { prospect, type: "companyCity" };
  }

  const inputPostalCode = normalizeCompanyPart(input.postalCode);
  if (inputCompanyName && inputPostalCode) {
    const prospect = prospects.find((candidate) => normalizeCompanyPart(candidate.companyName) === inputCompanyName && normalizeCompanyPart(candidate.postalCode) === inputPostalCode);
    if (prospect) return { prospect, type: "companyPostalCode" };
  }

  return null;
}

function toDuplicateCandidate(input: ProspectInput, id: string): DuplicateMatch["prospect"] {
  return {
    id,
    companyName: input.companyName,
    city: input.city,
    postalCode: input.postalCode ?? null,
    phone: input.phone ?? null,
    companyPhone: null,
    decisionMakerPhone: null,
    decisionMakerEmail: input.decisionMakerEmail ?? null,
    companyEmail: input.companyEmail ?? null,
    websiteUrl: input.websiteUrl ?? null
  };
}

function buildEnrichData(existing: Prospect, parsed: ProspectInput): Prisma.ProspectUpdateInput {
  const updateData: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(removeUndefined(parsed))) {
    if (field === "businessFields") {
      if (Array.isArray(value) && value.length > 0 && Array.isArray(existing.businessFields) && existing.businessFields.length === 0) {
        updateData[field] = value;
      }
      continue;
    }
    const current = (existing as unknown as Record<string, unknown>)[field];
    if (isBlankValue(current)) {
      updateData[field] = value;
    }
  }
  return updateData as Prisma.ProspectUpdateInput;
}

function isBlankValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return cleanCell(value) === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
