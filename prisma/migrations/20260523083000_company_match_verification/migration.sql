ALTER TABLE "Prospect"
  ADD COLUMN "websiteOriginal" TEXT,
  ADD COLUMN "websiteVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "websiteCandidate" TEXT,
  ADD COLUMN "websiteConfidence" INTEGER,
  ADD COLUMN "emailOriginal" TEXT,
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailCandidate" TEXT,
  ADD COLUMN "emailConfidence" INTEGER,
  ADD COLUMN "companyMatchConfidence" INTEGER,
  ADD COLUMN "companyMatchSource" TEXT;
