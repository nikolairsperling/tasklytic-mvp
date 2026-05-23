ALTER TABLE "Prospect" ADD COLUMN "lastResearchError" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "lastResearchErrorCode" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "lastResearchAt" TIMESTAMP(3);
ALTER TABLE "Prospect" ADD COLUMN "lastSuccessfulResearchAt" TIMESTAMP(3);
