-- CreateTable
CREATE TABLE "ReportAsset" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "landingpageId" TEXT NOT NULL,
    "reportUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportAsset_prospectId_createdAt_idx" ON "ReportAsset"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportAsset_landingpageId_idx" ON "ReportAsset"("landingpageId");

-- AddForeignKey
ALTER TABLE "ReportAsset" ADD CONSTRAINT "ReportAsset_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
