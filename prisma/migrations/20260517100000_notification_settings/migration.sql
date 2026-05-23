ALTER TABLE "AppSettings"
  ADD COLUMN "pushNewEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushReplyEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushLeadEnrichmentEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushFollowUpEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushCampaignStatusEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushErrorEnabled" BOOLEAN NOT NULL DEFAULT true;
