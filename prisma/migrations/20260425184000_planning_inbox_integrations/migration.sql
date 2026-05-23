-- CreateEnum
CREATE TYPE "MailboxProvider" AS ENUM ('imap');

-- CreateEnum
CREATE TYPE "InboundEmailStatus" AS ENUM ('unread', 'read', 'archived');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('slack', 'clickup');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "scheduledStartAt" TIMESTAMP(3),
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
ADD COLUMN "sendWindowStart" TEXT,
ADD COLUMN "sendWindowEnd" TEXT,
ADD COLUMN "weekdaysOnly" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MailboxSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" "MailboxProvider" NOT NULL DEFAULT 'imap',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "user" TEXT NOT NULL,
    "encryptedPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "matchedProspectId" TEXT,
    "matchedCampaignId" TEXT,
    "status" "InboundEmailStatus" NOT NULL DEFAULT 'unread',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSettings" (
    "id" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB NOT NULL,
    "encryptedSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_messageId_key" ON "InboundEmail"("messageId");

-- CreateIndex
CREATE INDEX "InboundEmail_fromEmail_idx" ON "InboundEmail"("fromEmail");

-- CreateIndex
CREATE INDEX "InboundEmail_matchedProspectId_idx" ON "InboundEmail"("matchedProspectId");

-- CreateIndex
CREATE INDEX "InboundEmail_matchedCampaignId_idx" ON "InboundEmail"("matchedCampaignId");

-- CreateIndex
CREATE INDEX "InboundEmail_receivedAt_idx" ON "InboundEmail"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSettings_type_key" ON "IntegrationSettings"("type");

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_matchedProspectId_fkey" FOREIGN KEY ("matchedProspectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_matchedCampaignId_fkey" FOREIGN KEY ("matchedCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
