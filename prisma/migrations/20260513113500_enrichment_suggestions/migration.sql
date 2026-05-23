ALTER TABLE "Prospect"
ADD COLUMN "enrichmentStatus" TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN "enrichmentUpdatedAt" TIMESTAMP(3),
ADD COLUMN "enrichmentSource" TEXT,
ADD COLUMN "enrichmentConfidence" INTEGER,
ADD COLUMN "enrichmentNotes" TEXT,
ADD COLUMN "enrichmentSuggestions" JSONB;
