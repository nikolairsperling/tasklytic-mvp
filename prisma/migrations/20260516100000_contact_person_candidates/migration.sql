ALTER TABLE "Prospect"
ADD COLUMN "decisionMakerSourceUrl" TEXT,
ADD COLUMN "decisionMakerSourceTextSnippet" TEXT,
ADD COLUMN "decisionMakerFoundAt" TIMESTAMP(3),
ADD COLUMN "decisionMakerConfidence" TEXT,
ADD COLUMN "contactCandidates" JSONB;
