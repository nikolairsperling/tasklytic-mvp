ALTER TABLE "Prospect" ADD COLUMN "postalCode" TEXT,
ADD COLUMN "street" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "companyEmail" TEXT,
ADD COLUMN "employeeCount" INTEGER,
ADD COLUMN "companyStatus" TEXT NOT NULL DEFAULT 'unclear';

CREATE TABLE "LeadImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "mappedJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "prospectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadImportRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSignature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSignature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadImportBatch_status_createdAt_idx" ON "LeadImportBatch"("status", "createdAt");
CREATE INDEX "LeadImportRow_batchId_status_idx" ON "LeadImportRow"("batchId", "status");
CREATE INDEX "LeadImportRow_prospectId_idx" ON "LeadImportRow"("prospectId");
CREATE INDEX "EmailSignature_isDefault_idx" ON "EmailSignature"("isDefault");

ALTER TABLE "LeadImportRow" ADD CONSTRAINT "LeadImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LeadImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadImportRow" ADD CONSTRAINT "LeadImportRow_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
