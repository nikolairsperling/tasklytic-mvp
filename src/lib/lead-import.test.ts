import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { confirmLeadImport, findDuplicateProspect, mapImportRow, parseLeadImportFile, previewLeadImport, suggestMapping } from "@/lib/lead-import";
import { prisma } from "@/lib/prisma";

describe("lead import mapping and persistence", () => {
  it("reads xlsx files and suggests common German column mappings", () => {
    const sheet = XLSX.utils.json_to_sheet([
      {
        Name: "Bremen Spedition",
        Ort: "Bremen",
        Website: "bremen.example",
        "E-Mail": "kontakt@bremen.example",
        "Ges. Vertreter 1": "Max Muster"
      }
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Leads");
    const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

    const rows = parseLeadImportFile(buffer, "Sperditionen_Bremenumzu.xlsx");
    const mapping = suggestMapping(Object.keys(rows[0]));

    expect(rows[0].Name).toBe("Bremen Spedition");
    expect(mapping.Name).toBe("companyName");
    expect(mapping.Ort).toBe("city");
    expect(mapping.Website).toBe("websiteUrl");
    expect(mapping["E-Mail"]).toBe("decisionMakerEmail");
    expect(mapping["Ges. Vertreter 1"]).toBe("decisionMakerName");
  });

  it("parses semicolon, comma and tab CSV files with quotes, empty fields and umlauts", () => {
    const semicolonRows = parseLeadImportFile(Buffer.from('Firma;Ort;Telefon;Website\n"Müller Logistik";Köln;"+49 221 123";\n'), "leads.csv");
    const commaRows = parseLeadImportFile(Buffer.from('companyName,city,decisionMakerEmail\n"Alpha, Beta GmbH",Bremen,chef@example.com\n'), "leads.csv");
    const tabRows = parseLeadImportFile(Buffer.from("Firma\tpostalCode\temployeeCount\nSchneider GmbH\t28195\t42\n"), "leads.csv");

    expect(semicolonRows[0]).toMatchObject({ Firma: "Müller Logistik", Ort: "Köln", Telefon: "+49 221 123", Website: "" });
    expect(commaRows[0]).toMatchObject({ companyName: "Alpha, Beta GmbH", city: "Bremen", decisionMakerEmail: "chef@example.com" });
    expect(tabRows[0]).toMatchObject({ Firma: "Schneider GmbH", postalCode: "28195", employeeCount: "42" });
  });

  it("splits decision maker names from Ges. Vertreter 1 into first and last name", () => {
    const mapped = mapImportRow(
      { Name: "Bremen Spedition", Ort: "Bremen", "Ges. Vertreter 1": "Thomas Müller" },
      { Name: "companyName", Ort: "city", "Ges. Vertreter 1": "decisionMakerName" }
    );

    expect(mapped.decisionMakerName).toBe("Thomas Müller");
    expect(mapped.firstName).toBe("Thomas");
    expect(mapped.lastName).toBe("Müller");
  });

  it("imports prospects, allows missing email and website, and skips duplicates by company and city", async () => {
    const suffix = Date.now();
    const rows = [
      { Name: `Import Alpha ${suffix}`, Ort: "Bremen", Website: "", "E-Mail": "", Telefon: "0421 123", "Mitarbeiterzahl": "42" },
      { Name: `Import Alpha ${suffix}`, Ort: "Bremen", Website: "", "E-Mail": "", Telefon: "0421 123", "Mitarbeiterzahl": "42" }
    ];
    const mapping = {
      Name: "companyName",
      Ort: "city",
      Website: "websiteUrl",
      "E-Mail": "decisionMakerEmail",
      Telefon: "phone",
      Mitarbeiterzahl: "employeeCount"
    } as const;

    const mapped = mapImportRow(rows[0], mapping);
    expect(mapped.employeeCount).toBe(42);
    expect(mapped.websiteUrl).toBeUndefined();
    expect(mapped.decisionMakerEmail).toBeUndefined();
    expect(mapped.phone).toBe("0421 123");

    const batch = await confirmLeadImport({ filename: "leads.csv", rows, mapping });
    expect(batch.createdCount).toBe(1);
    expect(batch.duplicateCount).toBe(1);
    expect(batch.skippedCount).toBe(1);
    expect(batch.updatedCount).toBe(0);

    const prospect = await prisma.prospect.findFirstOrThrow({ where: { companyName: `Import Alpha ${suffix}`, city: "Bremen" } });
    expect(prospect.employeeCount).toBe(42);
    expect(prospect.phone).toBe("0421 123");

    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("detects duplicates by normalized website, email, phone, company and postal code priority", async () => {
    const suffix = Date.now();
    const websiteProspect = await prisma.prospect.create({ data: { companyName: `Website Match ${suffix}`, city: "Berlin", country: "DE", businessFields: [], websiteUrl: "https://www.match-site.example/" } });
    const emailProspect = await prisma.prospect.create({ data: { companyName: `Email Match ${suffix}`, city: "Berlin", country: "DE", businessFields: [], decisionMakerEmail: `chef-${suffix}@match.example` } });
    const phoneProspect = await prisma.prospect.create({ data: { companyName: `Phone Match ${suffix}`, city: "Berlin", country: "DE", businessFields: [], phone: "+49 421 123-456" } });
    const cityProspect = await prisma.prospect.create({ data: { companyName: `City Match ${suffix}`, city: "Hamburg", country: "DE", businessFields: [] } });
    const postalProspect = await prisma.prospect.create({ data: { companyName: `Postal Match ${suffix}`, city: "Kiel", postalCode: "28195", country: "DE", businessFields: [] } });

    await expect(findDuplicateProspect(parseProspectPayloadForTest({ companyName: `Other ${suffix}`, city: "X", websiteUrl: "http://match-site.example/kontakt" }))).resolves.toMatchObject({ id: websiteProspect.id });
    await expect(findDuplicateProspect(parseProspectPayloadForTest({ companyName: `Other ${suffix}`, city: "X", decisionMakerEmail: `CHEF-${suffix}@MATCH.EXAMPLE` }))).resolves.toMatchObject({ id: emailProspect.id });
    await expect(findDuplicateProspect(parseProspectPayloadForTest({ companyName: `Other ${suffix}`, city: "X", phone: "+49 (421) 123456" }))).resolves.toMatchObject({ id: phoneProspect.id });
    await expect(findDuplicateProspect(parseProspectPayloadForTest({ companyName: `  CITY MATCH ${suffix}  `, city: " hamburg " }))).resolves.toMatchObject({ id: cityProspect.id });
    await expect(findDuplicateProspect(parseProspectPayloadForTest({ companyName: `POSTAL MATCH ${suffix}`, city: "Other", postalCode: "28195" }))).resolves.toMatchObject({ id: postalProspect.id });

    await prisma.prospect.deleteMany({ where: { id: { in: [websiteProspect.id, emailProspect.id, phoneProspect.id, cityProspect.id, postalProspect.id] } } });
  });

  it("supports duplicate skip, enrich, overwrite and create summaries", async () => {
    const suffix = Date.now();
    const existing = await prisma.prospect.create({
      data: {
        companyName: `Import Mode ${suffix}`,
        city: "Bremen",
        country: "DE",
        businessFields: [],
        websiteUrl: `https://import-mode-${suffix}.example`,
        phone: "0421 111"
      }
    });
    const mapping = { Firma: "companyName", Ort: "city", Website: "websiteUrl", Telefon: "phone", Email: "companyEmail" } as const;
    const duplicateRow = { Firma: `Import Mode ${suffix}`, Ort: "Bremen", Website: `www.import-mode-${suffix}.example/`, Telefon: "0421 222", Email: `info-${suffix}@example.com` };

    const skipBatch = await confirmLeadImport({ filename: "skip.csv", rows: [duplicateRow], mapping, duplicateMode: "skip" });
    expect(skipBatch.createdCount).toBe(0);
    expect(skipBatch.updatedCount).toBe(0);
    expect(skipBatch.skippedCount).toBe(1);
    expect(skipBatch.duplicateCount).toBe(1);

    const enrichBatch = await confirmLeadImport({ filename: "enrich.csv", rows: [duplicateRow], mapping, duplicateMode: "enrich" });
    const enriched = await prisma.prospect.findUniqueOrThrow({ where: { id: existing.id } });
    expect(enrichBatch.updatedCount).toBe(1);
    expect(enriched.phone).toBe("0421 111");
    expect(enriched.companyEmail).toBe(`info-${suffix}@example.com`);

    const overwriteBatch = await confirmLeadImport({ filename: "overwrite.csv", rows: [duplicateRow], mapping, duplicateMode: "overwrite" });
    const overwritten = await prisma.prospect.findUniqueOrThrow({ where: { id: existing.id } });
    expect(overwriteBatch.updatedCount).toBe(1);
    expect(overwritten.phone).toBe("0421 222");

    const emptyOverwriteBatch = await confirmLeadImport({ filename: "empty.csv", rows: [{ ...duplicateRow, Telefon: "", Email: "" }], mapping, duplicateMode: "overwrite" });
    const notBlanked = await prisma.prospect.findUniqueOrThrow({ where: { id: existing.id } });
    expect(emptyOverwriteBatch.updatedCount).toBe(1);
    expect(notBlanked.phone).toBe("0421 222");
    expect(notBlanked.companyEmail).toBe(`info-${suffix}@example.com`);

    const createBatch = await confirmLeadImport({ filename: "create.csv", rows: [duplicateRow], mapping, duplicateMode: "create" });
    expect(createBatch.createdCount).toBe(1);
    expect(createBatch.updatedCount).toBe(0);

    const preview = await previewLeadImport([duplicateRow, { Firma: "", Ort: "Bremen", Website: "", Telefon: "", Email: "" }], mapping, "skip");
    expect(preview).toMatchObject({
      validRows: 1,
      invalidRows: 1,
      newLeads: 0,
      duplicates: 1,
      leadsToEnrich: 0,
      faultyRows: 1,
      skippedRows: 1
    });

    await prisma.leadImportBatch.deleteMany({ where: { id: { in: [skipBatch.id, enrichBatch.id, overwriteBatch.id, emptyOverwriteBatch.id, createBatch.id] } } });
    await prisma.prospect.deleteMany({ where: { OR: [{ id: existing.id }, { companyName: `Import Mode ${suffix}` }] } });
  });

  it("reports row errors when the company name is missing and imports decision maker email", async () => {
    const suffix = Date.now();
    const rows = [
      { Firma: "", Ort: "Bremen", decisionMakerEmail: "chef@example.com" },
      { Firma: `Import Entscheider ${suffix}`, Ort: "Hamburg", decisionMakerEmail: "chef@example.com" }
    ];
    const mapping = { Firma: "companyName", Ort: "city", decisionMakerEmail: "decisionMakerEmail" } as const;

    const batch = await confirmLeadImport({ filename: "leads.csv", rows, mapping });
    expect(batch.createdCount).toBe(1);
    expect(batch.invalidCount).toBe(1);
    expect(batch.importErrors).toEqual([{ row: 2, field: "companyName", message: "Firma fehlt." }]);

    const prospect = await prisma.prospect.findFirstOrThrow({ where: { companyName: `Import Entscheider ${suffix}` } });
    expect(prospect.decisionMakerEmail).toBe("chef@example.com");

    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.delete({ where: { id: prospect.id } });
  });

  it("imports leads with optional invalid email and website values as warnings", async () => {
    const suffix = Date.now();
    const rows = [
      { Firma: `Optional Empty Email ${suffix}`, Ort: "Bremen", "E-Mail": "", Website: "empty-email.example" },
      { Firma: `Optional Invalid Email ${suffix}`, Ort: "Bremen", "E-Mail": "keine-mail", Website: "invalid-email.example" },
      { Firma: `Optional Empty Website ${suffix}`, Ort: "Bremen", "E-Mail": `empty-website-${suffix}@example.com`, Website: "" },
      { Firma: `Optional Normalized Website ${suffix}`, Ort: "Bremen", "E-Mail": `normalized-${suffix}@example.com`, Website: "www.hartmann.de" },
      { Firma: `Optional Invalid Website ${suffix}`, Ort: "Bremen", "E-Mail": `invalid-website-${suffix}@example.com`, Website: "nicht valide url" },
      { Firma: "", Ort: "Bremen", "E-Mail": `missing-company-${suffix}@example.com`, Website: "missing-company.example" },
      { Firma: `Optional Valid Lead ${suffix}`, Ort: "Bremen", "E-Mail": `valid-${suffix}@example.com`, Website: "hartmann.de" }
    ];
    const mapping = { Firma: "companyName", Ort: "city", "E-Mail": "decisionMakerEmail", Website: "websiteUrl" } as const;

    const batch = await confirmLeadImport({ filename: "optional.csv", rows, mapping, duplicateMode: "create" });
    expect(batch.createdCount).toBe(6);
    expect(batch.invalidCount).toBe(1);
    expect(batch.importWarnings).toEqual([
      { row: 3, field: "decisionMakerEmail", message: "Ungültige E-Mail wurde ignoriert." },
      { row: 6, field: "websiteUrl", message: "Ungültige Website wurde ignoriert." }
    ]);
    expect(batch.importErrors).toEqual([{ row: 7, field: "companyName", message: "Firma fehlt." }]);

    const prospects = await prisma.prospect.findMany({ where: { companyName: { contains: ` ${suffix}` } } });
    expect(prospects).toHaveLength(6);
    expect(prospects.find((prospect) => prospect.companyName === `Optional Empty Email ${suffix}`)?.decisionMakerEmail).toBeNull();
    expect(prospects.find((prospect) => prospect.companyName === `Optional Invalid Email ${suffix}`)?.decisionMakerEmail).toBeNull();
    expect(prospects.find((prospect) => prospect.companyName === `Optional Empty Website ${suffix}`)?.websiteUrl).toBeNull();
    expect(prospects.find((prospect) => prospect.companyName === `Optional Normalized Website ${suffix}`)?.websiteUrl).toBe("https://www.hartmann.de");
    expect(prospects.find((prospect) => prospect.companyName === `Optional Invalid Website ${suffix}`)?.websiteUrl).toBeNull();
    expect(prospects.find((prospect) => prospect.companyName === `Optional Valid Lead ${suffix}`)?.websiteUrl).toBe("https://hartmann.de");

    await prisma.leadImportBatch.delete({ where: { id: batch.id } });
    await prisma.prospect.deleteMany({ where: { id: { in: prospects.map((prospect) => prospect.id) } } });
  });

  it("treats 17 created leads and 483 skipped duplicates as a successful import", async () => {
    const suffix = Date.now();
    const duplicateRows = Array.from({ length: 483 }, (_, index) => ({
      Firma: `Bulk Duplicate ${suffix} ${index}`,
      Ort: "Bremen",
      Website: `bulk-duplicate-${suffix}-${index}.example`
    }));
    const newRows = Array.from({ length: 17 }, (_, index) => ({
      Firma: `Bulk New ${suffix} ${index}`,
      Ort: "Hamburg",
      Website: `bulk-new-${suffix}-${index}.example`
    }));
    const mapping = { Firma: "companyName", Ort: "city", Website: "websiteUrl" } as const;
    let batchId: string | null = null;

    await prisma.prospect.deleteMany({
      where: {
        OR: [
          { companyName: { startsWith: "Bulk Duplicate " } },
          { companyName: { startsWith: "Bulk New " } }
        ]
      }
    });

    try {
      await prisma.prospect.createMany({
        data: duplicateRows.map((row) => ({
          companyName: row.Firma,
          city: row.Ort,
          country: "DE",
          businessFields: [],
          websiteUrl: `https://${row.Website}`
        }))
      });

      const batch = await confirmLeadImport({ filename: "bulk.csv", rows: [...newRows, ...duplicateRows], mapping, duplicateMode: "skip" });
      batchId = batch.id;

      expect(batch.createdCount).toBe(17);
      expect(batch.updatedCount).toBe(0);
      expect(batch.skippedCount).toBe(483);
      expect(batch.duplicateCount).toBe(483);
      expect(batch.invalidCount).toBe(0);
      expect(batch.importWarnings).toEqual([]);
      expect(batch.importErrors).toEqual([]);
    } finally {
      if (batchId) await prisma.leadImportBatch.delete({ where: { id: batchId } });
      await prisma.prospect.deleteMany({
        where: {
          OR: [
            { companyName: { startsWith: `Bulk Duplicate ${suffix}` } },
            { companyName: { startsWith: `Bulk New ${suffix}` } }
          ]
        }
      });
    }
  }, 20000);
});

function parseProspectPayloadForTest(input: { companyName: string; city: string; websiteUrl?: string; decisionMakerEmail?: string; phone?: string; postalCode?: string }) {
  return {
    country: "DE",
    businessFields: [],
    openDispatcherJob: false,
    status: "draft",
    companyStatus: "unclear",
    ...input
  } as Parameters<typeof findDuplicateProspect>[0];
}
