CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "targetGroupId" TEXT,
    "businessName" TEXT NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "targetAudienceDescription" TEXT NOT NULL,
    "coreProblems" JSONB NOT NULL,
    "solutions" JSONB NOT NULL,
    "valueProposition" TEXT NOT NULL,
    "toneOfVoice" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Offer" (
    "id",
    "userId",
    "name",
    "businessName",
    "serviceDescription",
    "targetAudienceDescription",
    "coreProblems",
    "solutions",
    "valueProposition",
    "toneOfVoice",
    "isDefault",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "userId",
    'Standard-Angebot',
    "businessName",
    "serviceDescription",
    "targetAudienceDescription",
    "coreProblems",
    "solutions",
    "valueProposition",
    "toneOfVoice",
    true,
    "createdAt",
    "updatedAt"
FROM "UserOffer"
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "TargetGroup" ADD COLUMN "defaultOfferId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "offerId" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "suggestedOfferId" TEXT;

CREATE INDEX "Offer_userId_idx" ON "Offer"("userId");
CREATE INDEX "Offer_targetGroupId_idx" ON "Offer"("targetGroupId");
CREATE INDEX "Offer_isDefault_idx" ON "Offer"("isDefault");
CREATE INDEX "TargetGroup_defaultOfferId_idx" ON "TargetGroup"("defaultOfferId");
CREATE INDEX "Campaign_offerId_idx" ON "Campaign"("offerId");
CREATE INDEX "Prospect_suggestedOfferId_idx" ON "Prospect"("suggestedOfferId");

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "TargetGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TargetGroup" ADD CONSTRAINT "TargetGroup_defaultOfferId_fkey" FOREIGN KEY ("defaultOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_suggestedOfferId_fkey" FOREIGN KEY ("suggestedOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
