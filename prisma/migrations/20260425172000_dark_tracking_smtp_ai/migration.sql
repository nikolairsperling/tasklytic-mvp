-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "estimatedDealValue" INTEGER,
ADD COLUMN "estimatedCostPerLead" INTEGER,
ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "CampaignEnrollment" ADD COLUMN "repliedAt" TIMESTAMP(3),
ADD COLUMN "bookedAt" TIMESTAMP(3),
ADD COLUMN "notInterestedAt" TIMESTAMP(3),
ADD COLUMN "lastActivityAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EmailSendLog" ADD COLUMN "trackingToken" TEXT,
ADD COLUMN "clickToken" TEXT,
ADD COLUMN "openedAt" TIMESTAMP(3),
ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "clickedAt" TIMESTAMP(3),
ADD COLUMN "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "landingpageUrl" TEXT;

-- CreateTable
CREATE TABLE "SmtpSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "user" TEXT NOT NULL,
    "encryptedPassword" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "replyToEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmtpSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSendLog_trackingToken_key" ON "EmailSendLog"("trackingToken");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSendLog_clickToken_key" ON "EmailSendLog"("clickToken");
