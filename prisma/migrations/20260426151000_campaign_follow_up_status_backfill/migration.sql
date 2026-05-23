UPDATE "CampaignEnrollment"
SET "status" = 'finished'::"CampaignEnrollmentStatus"
WHERE "status" = 'active'
  AND "nextSendAt" IS NULL;

UPDATE "Campaign"
SET "status" = 'completed'::"CampaignStatus"
WHERE NOT EXISTS (
  SELECT 1
  FROM "CampaignEnrollment" ce
  WHERE ce."campaignId" = "Campaign".id
    AND ce."status" = 'active'
);
