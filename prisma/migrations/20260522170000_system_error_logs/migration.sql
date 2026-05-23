CREATE TABLE "SystemErrorLog" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "apiRoute" TEXT,
  "method" TEXT,
  "httpStatus" INTEGER,
  "errorCode" TEXT NOT NULL,
  "userMessage" TEXT NOT NULL,
  "technicalDetail" TEXT,
  "responseBody" TEXT,
  "durationMs" INTEGER,
  "affectedType" TEXT,
  "affectedId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'server',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SystemErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemErrorLog_requestId_key" ON "SystemErrorLog"("requestId");
CREATE INDEX "SystemErrorLog_createdAt_idx" ON "SystemErrorLog"("createdAt");
CREATE INDEX "SystemErrorLog_area_createdAt_idx" ON "SystemErrorLog"("area", "createdAt");
CREATE INDEX "SystemErrorLog_errorCode_createdAt_idx" ON "SystemErrorLog"("errorCode", "createdAt");
CREATE INDEX "SystemErrorLog_affectedType_affectedId_idx" ON "SystemErrorLog"("affectedType", "affectedId");
