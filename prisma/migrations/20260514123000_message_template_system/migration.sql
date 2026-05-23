ALTER TABLE "MessageTemplate"
ADD COLUMN "subject" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN "targetAudience" TEXT,
ADD COLUMN "tone" TEXT,
ADD COLUMN "qualityScore" INTEGER,
ADD COLUMN "qualityJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "lastTestJson" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "MessageTemplate_channel_idx" ON "MessageTemplate"("channel");
CREATE INDEX "MessageTemplate_category_idx" ON "MessageTemplate"("category");
CREATE INDEX "MessageTemplate_status_idx" ON "MessageTemplate"("status");
CREATE INDEX "MessageTemplate_updatedAt_idx" ON "MessageTemplate"("updatedAt");
