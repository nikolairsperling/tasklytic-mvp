CREATE TYPE "ImpactJobType" AS ENUM ('landingpage', 'video', 'letter');
CREATE TYPE "ImpactJobStatus" AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE "VideoProvider" AS ENUM ('mock', 'heygen', 'tavus', 'synthesia', 'custom');
CREATE TYPE "VideoGenerationStatus" AS ENUM ('none', 'pending', 'script_ready', 'processing', 'ready', 'failed');

ALTER TABLE "Prospect"
  ADD COLUMN "personalVideoScript" TEXT,
  ADD COLUMN "personalVideoStatus" "VideoGenerationStatus" NOT NULL DEFAULT 'none',
  ADD COLUMN "personalVideoProvider" TEXT,
  ADD COLUMN "personalVideoJobId" TEXT,
  ADD COLUMN "personalVideoError" TEXT;

ALTER TABLE "LandingpageTemplate"
  ADD COLUMN "headerLogoUrl" TEXT,
  ADD COLUMN "headerLogoAlt" TEXT,
  ADD COLUMN "headerLogoWidth" INTEGER,
  ADD COLUMN "headerLogoHeight" INTEGER,
  ADD COLUMN "headerLogoPosition" TEXT NOT NULL DEFAULT 'left',
  ADD COLUMN "headerShowTextFallback" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "headerTextFallback" TEXT NOT NULL DEFAULT 'Tasklytic';

CREATE TABLE "ImpactJob" (
  "id" TEXT NOT NULL,
  "type" "ImpactJobType" NOT NULL,
  "name" TEXT NOT NULL,
  "campaignId" TEXT,
  "status" "ImpactJobStatus" NOT NULL DEFAULT 'pending',
  "totalItems" INTEGER NOT NULL DEFAULT 0,
  "processedItems" INTEGER NOT NULL DEFAULT 0,
  "creditsUsed" INTEGER NOT NULL DEFAULT 0,
  "resultJson" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImpactJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "provider" "VideoProvider" NOT NULL DEFAULT 'mock',
  "providerTemplateId" TEXT,
  "defaultScriptPrompt" TEXT,
  "defaultThumbnailUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoGenerationJob" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "campaignId" TEXT,
  "videoTemplateId" TEXT,
  "provider" "VideoProvider" NOT NULL DEFAULT 'mock',
  "status" "VideoGenerationStatus" NOT NULL DEFAULT 'pending',
  "scriptText" TEXT,
  "videoUrl" TEXT,
  "thumbnailUrl" TEXT,
  "errorMessage" TEXT,
  "providerJobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoGenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImpactJob_type_status_idx" ON "ImpactJob"("type", "status");
CREATE INDEX "ImpactJob_campaignId_idx" ON "ImpactJob"("campaignId");
CREATE INDEX "VideoTemplate_provider_isActive_idx" ON "VideoTemplate"("provider", "isActive");
CREATE INDEX "VideoGenerationJob_prospectId_createdAt_idx" ON "VideoGenerationJob"("prospectId", "createdAt");
CREATE INDEX "VideoGenerationJob_campaignId_idx" ON "VideoGenerationJob"("campaignId");
CREATE INDEX "VideoGenerationJob_status_idx" ON "VideoGenerationJob"("status");

ALTER TABLE "ImpactJob" ADD CONSTRAINT "ImpactJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoGenerationJob" ADD CONSTRAINT "VideoGenerationJob_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoGenerationJob" ADD CONSTRAINT "VideoGenerationJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoGenerationJob" ADD CONSTRAINT "VideoGenerationJob_videoTemplateId_fkey" FOREIGN KEY ("videoTemplateId") REFERENCES "VideoTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
