CREATE TABLE "TargetGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industryKeywords" JSONB NOT NULL,
    "painKeywords" JSONB NOT NULL,
    "icpRules" JSONB NOT NULL,
    "emailTone" TEXT NOT NULL,
    "landingpageStyle" TEXT NOT NULL,
    "videoStyle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Prospect" ADD COLUMN "targetGroupId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "targetGroupId" TEXT;

CREATE INDEX "Prospect_targetGroupId_idx" ON "Prospect"("targetGroupId");
CREATE INDEX "Campaign_targetGroupId_idx" ON "Campaign"("targetGroupId");

ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "TargetGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "TargetGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
