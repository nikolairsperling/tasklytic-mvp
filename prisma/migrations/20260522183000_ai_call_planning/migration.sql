CREATE TYPE "AiCallStatus" AS ENUM (
  'call_eligible',
  'call_planned',
  'call_called',
  'call_interested',
  'call_not_interested',
  'call_callback_requested',
  'call_failed'
);

CREATE TABLE "AiCall" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "status" "AiCallStatus" NOT NULL DEFAULT 'call_planned',
  "plannedFor" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "calledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "voice" TEXT NOT NULL DEFAULT 'neutral',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "phone" TEXT NOT NULL,
  "eligibilitySnapshot" JSONB NOT NULL DEFAULT '{}',
  "detectedInterest" TEXT,
  "detectedObjection" TEXT,
  "summary" TEXT,
  "painPoints" JSONB NOT NULL DEFAULT '[]',
  "objections" JSONB NOT NULL DEFAULT '[]',
  "nextStep" TEXT,
  "callbackRequestedAt" TIMESTAMP(3),
  "appointmentStatus" TEXT,
  "transcript" TEXT,
  "audioUrl" TEXT,
  "confidenceScore" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiCall_prospectId_createdAt_idx" ON "AiCall"("prospectId", "createdAt");
CREATE INDEX "AiCall_status_plannedFor_idx" ON "AiCall"("status", "plannedFor");

ALTER TABLE "AiCall"
  ADD CONSTRAINT "AiCall_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
