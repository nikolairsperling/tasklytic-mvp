ALTER TABLE "AppSettings"
ADD COLUMN "appName" TEXT NOT NULL DEFAULT 'Tasklytic',
ADD COLUMN "secondaryColor" TEXT NOT NULL DEFAULT '#ecfeff',
ADD COLUMN "iconUrl" TEXT;

CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT,
  "role" TEXT NOT NULL DEFAULT 'admin',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
