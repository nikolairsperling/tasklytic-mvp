CREATE TABLE "ClickUpSyncLog" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT,
  "clickUpTaskId" TEXT,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "matchedBy" TEXT,
  "errorMessage" TEXT,
  "payloadJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClickUpSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClickUpSyncLog_prospectId_createdAt_idx" ON "ClickUpSyncLog"("prospectId", "createdAt");
CREATE INDEX "ClickUpSyncLog_status_createdAt_idx" ON "ClickUpSyncLog"("status", "createdAt");
CREATE INDEX "ClickUpSyncLog_action_createdAt_idx" ON "ClickUpSyncLog"("action", "createdAt");

ALTER TABLE "ClickUpSyncLog"
  ADD CONSTRAINT "ClickUpSyncLog_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
