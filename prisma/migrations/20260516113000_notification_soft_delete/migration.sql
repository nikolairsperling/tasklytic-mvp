ALTER TABLE "NotificationEvent" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "NotificationEvent_deletedAt_createdAt_idx" ON "NotificationEvent"("deletedAt", "createdAt");

CREATE TABLE "NotificationDismissal" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDismissal_notificationId_key" ON "NotificationDismissal"("notificationId");
