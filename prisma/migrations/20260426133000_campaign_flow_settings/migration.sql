ALTER TABLE "Prospect" ADD COLUMN "landingpageUrl" TEXT,
ADD COLUMN "emailStatus" TEXT,
ADD COLUMN "lastContactedAt" TIMESTAMP(3);

CREATE TABLE "CampaignFlowSettings" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "generateLandingpage" BOOLEAN NOT NULL DEFAULT true,
    "generateVideo" BOOLEAN NOT NULL DEFAULT false,
    "sendEmail" BOOLEAN NOT NULL DEFAULT true,
    "emailTemplateId" TEXT,
    "videoTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignFlowSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignFlowSettings_campaignId_key" ON "CampaignFlowSettings"("campaignId");
CREATE INDEX "CampaignFlowSettings_campaignId_idx" ON "CampaignFlowSettings"("campaignId");

ALTER TABLE "CampaignFlowSettings" ADD CONSTRAINT "CampaignFlowSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
