CREATE TABLE "LetterTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "googleDocId" TEXT,
    "googleDocUrl" TEXT,
    "previewText" TEXT NOT NULL DEFAULT '',
    "googleDocsText" TEXT NOT NULL DEFAULT '',
    "googleDocsJson" JSONB NOT NULL DEFAULT '{}',
    "imageAltTexts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "pageCount" INTEGER,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isInUse" BOOLEAN NOT NULL DEFAULT false,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckStatus" TEXT NOT NULL DEFAULT 'unchecked',
    "lastCheckSummary" TEXT,
    "lastCheckIssues" JSONB NOT NULL DEFAULT '[]',
    "detectedRecipientVariables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "detectedSenderVariables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "detectedPersonalizationVariables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "systemKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LetterTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LetterTemplate_systemKey_key" ON "LetterTemplate"("systemKey");
CREATE INDEX "LetterTemplate_isSystemTemplate_idx" ON "LetterTemplate"("isSystemTemplate");
CREATE INDEX "LetterTemplate_isChecked_idx" ON "LetterTemplate"("isChecked");
CREATE INDEX "LetterTemplate_createdAt_idx" ON "LetterTemplate"("createdAt");
