-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "voiceAiProvider" TEXT NOT NULL DEFAULT 'test';
ALTER TABLE "AppSettings" ADD COLUMN "voiceAiDefaultVoice" TEXT NOT NULL DEFAULT 'neutral';
ALTER TABLE "AppSettings" ADD COLUMN "voiceAiEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VoiceAiTestCall" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT,
    "testPhoneNumber" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'test',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "transcript" TEXT NOT NULL,
    "audioUrl" TEXT,
    "summary" TEXT NOT NULL,
    "detectedObjections" TEXT[],
    "conversationQuality" TEXT NOT NULL,
    "appointmentIntent" TEXT NOT NULL,
    "recommendedImprovement" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceAiTestCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceAiTestCall_status_createdAt_idx" ON "VoiceAiTestCall"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceAiTestCall_prospectId_createdAt_idx" ON "VoiceAiTestCall"("prospectId", "createdAt");

-- AddForeignKey
ALTER TABLE "VoiceAiTestCall" ADD CONSTRAINT "VoiceAiTestCall_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
