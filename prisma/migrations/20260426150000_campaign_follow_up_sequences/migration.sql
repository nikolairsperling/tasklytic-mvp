-- Add CampaignEnrollmentStatus values for sequence stop states.
ALTER TYPE "CampaignEnrollmentStatus" ADD VALUE IF NOT EXISTS 'replied';
ALTER TYPE "CampaignEnrollmentStatus" ADD VALUE IF NOT EXISTS 'finished';

-- Campaign steps now carry an explicit step number and activation flag.
ALTER TABLE "CampaignStep" ADD COLUMN "stepNumber" INTEGER;
ALTER TABLE "CampaignStep" ADD COLUMN "body" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CampaignStep" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "CampaignStep"
SET "stepNumber" = "position" + 1,
    "body" = "bodyText"
WHERE "stepNumber" IS NULL;

ALTER TABLE "CampaignStep" ALTER COLUMN "stepNumber" SET NOT NULL;
ALTER TABLE "CampaignStep" ALTER COLUMN "stepNumber" SET DEFAULT 1;

-- Enrollments need scheduling state for follow-up sequencing.
ALTER TABLE "CampaignEnrollment" ADD COLUMN "currentStep" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CampaignEnrollment" ADD COLUMN "nextSendAt" TIMESTAMP(3);
ALTER TABLE "CampaignEnrollment" ADD COLUMN "lastSentAt" TIMESTAMP(3);

WITH latest_sent AS (
  SELECT
    ce.id AS enrollment_id,
    ce."campaignId" AS campaign_id,
    ce."createdAt" AS created_at,
    MAX(cs."position") AS max_position,
    MAX(esl."sentAt") AS last_sent_at
  FROM "CampaignEnrollment" ce
  LEFT JOIN "EmailSendLog" esl
    ON esl."enrollmentId" = ce.id
   AND esl.status = 'sent'
  LEFT JOIN "CampaignStep" cs
    ON cs.id = esl."stepId"
  GROUP BY ce.id, ce."campaignId", ce."createdAt"
),
step_targets AS (
  SELECT
    ls.enrollment_id,
    ls.max_position,
    ls.last_sent_at,
    ls.created_at,
    ns."delayDays" AS next_delay
  FROM latest_sent ls
  LEFT JOIN "CampaignStep" ns
    ON ns."campaignId" = ls.campaign_id
   AND ns."stepNumber" = COALESCE(ls.max_position + 2, 1)
)
UPDATE "CampaignEnrollment" ce
SET
  "lastSentAt" = st.last_sent_at,
  "currentStep" = COALESCE(st.max_position + 2, 1),
  "nextSendAt" = CASE
    WHEN st.max_position IS NULL THEN st.created_at
    WHEN st.next_delay IS NULL THEN NULL
    ELSE st.last_sent_at + (st.next_delay * INTERVAL '1 day')
  END
FROM step_targets st
WHERE ce.id = st.enrollment_id
  AND ce."status" = 'active';

CREATE UNIQUE INDEX "CampaignStep_campaignId_stepNumber_key" ON "CampaignStep"("campaignId", "stepNumber");
CREATE INDEX "CampaignEnrollment_campaignId_nextSendAt_idx" ON "CampaignEnrollment"("campaignId", "nextSendAt");
