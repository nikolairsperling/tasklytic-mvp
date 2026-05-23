ALTER TABLE "Prospect" ADD COLUMN "failedStep" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
