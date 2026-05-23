ALTER TABLE "Prospect"
ADD COLUMN "lastEmailSentAt" TIMESTAMP(3),
ADD COLUMN "followUpReason" TEXT,
ADD COLUMN "followUpStatus" TEXT NOT NULL DEFAULT 'open';

ALTER TABLE "CampaignFlowSettings"
ADD COLUMN "followUpDays" INTEGER;

ALTER TABLE "AppSettings"
ADD COLUMN "ownPhoneNumber" TEXT,
ADD COLUMN "defaultCountryDialCode" TEXT NOT NULL DEFAULT '+49',
ADD COLUMN "callProviderMode" TEXT NOT NULL DEFAULT 'tel-link';
