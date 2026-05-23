CREATE TABLE "CampaignEmailVariant" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 50,
  "landingpageUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignEmailVariant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CampaignEnrollment"
  ADD COLUMN "emailVariantId" TEXT,
  ADD COLUMN "emailVariantLabel" TEXT,
  ADD COLUMN "blockedReason" TEXT;

ALTER TABLE "EmailSendLog"
  ADD COLUMN "emailVariantId" TEXT,
  ADD COLUMN "emailVariantLabel" TEXT;

CREATE UNIQUE INDEX "CampaignEmailVariant_campaignId_label_key" ON "CampaignEmailVariant"("campaignId", "label");
CREATE INDEX "CampaignEmailVariant_campaignId_isActive_idx" ON "CampaignEmailVariant"("campaignId", "isActive");
CREATE INDEX "CampaignEnrollment_emailVariantId_idx" ON "CampaignEnrollment"("emailVariantId");
CREATE INDEX "EmailSendLog_campaignId_emailVariantId_idx" ON "EmailSendLog"("campaignId", "emailVariantId");

ALTER TABLE "CampaignEmailVariant"
  ADD CONSTRAINT "CampaignEmailVariant_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignEnrollment"
  ADD CONSTRAINT "CampaignEnrollment_emailVariantId_fkey"
  FOREIGN KEY ("emailVariantId") REFERENCES "CampaignEmailVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailSendLog"
  ADD CONSTRAINT "EmailSendLog_emailVariantId_fkey"
  FOREIGN KEY ("emailVariantId") REFERENCES "CampaignEmailVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
