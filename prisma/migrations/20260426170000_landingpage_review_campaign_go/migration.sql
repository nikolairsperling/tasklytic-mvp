ALTER TABLE "Prospect" ADD COLUMN "landingpageReviewStatus" TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE "Campaign" ADD COLUMN "manualGoApproved" BOOLEAN NOT NULL DEFAULT false;
