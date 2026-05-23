CREATE TYPE "EnrichmentRunStatus" AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE "ProspectEnrichmentRun" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "status" "EnrichmentRunStatus" NOT NULL DEFAULT 'pending',
    "sourceUrl" TEXT NOT NULL,
    "pagesScanned" INTEGER NOT NULL DEFAULT 0,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "rawSummary" TEXT,
    "suggestionsJson" JSONB NOT NULL,
    "sourcesJson" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectEnrichmentRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProspectEnrichmentRun_prospectId_createdAt_idx" ON "ProspectEnrichmentRun"("prospectId", "createdAt");

ALTER TABLE "ProspectEnrichmentRun" ADD CONSTRAINT "ProspectEnrichmentRun_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
