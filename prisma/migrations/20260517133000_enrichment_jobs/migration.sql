-- CreateTable
CREATE TABLE "EnrichmentJob" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "successful" INTEGER NOT NULL DEFAULT 0,
    "invalid" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "currentLeadName" TEXT,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichmentJobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "leadImportRowId" TEXT NOT NULL,
    "prospectId" TEXT,
    "companyName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrichmentJob_batchId_createdAt_idx" ON "EnrichmentJob"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "EnrichmentJob_status_updatedAt_idx" ON "EnrichmentJob"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EnrichmentJobItem_jobId_leadImportRowId_key" ON "EnrichmentJobItem"("jobId", "leadImportRowId");

-- CreateIndex
CREATE INDEX "EnrichmentJobItem_jobId_status_idx" ON "EnrichmentJobItem"("jobId", "status");

-- CreateIndex
CREATE INDEX "EnrichmentJobItem_leadImportRowId_idx" ON "EnrichmentJobItem"("leadImportRowId");

-- CreateIndex
CREATE INDEX "EnrichmentJobItem_prospectId_idx" ON "EnrichmentJobItem"("prospectId");

-- AddForeignKey
ALTER TABLE "EnrichmentJob" ADD CONSTRAINT "EnrichmentJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LeadImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentJobItem" ADD CONSTRAINT "EnrichmentJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "EnrichmentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentJobItem" ADD CONSTRAINT "EnrichmentJobItem_leadImportRowId_fkey" FOREIGN KEY ("leadImportRowId") REFERENCES "LeadImportRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
