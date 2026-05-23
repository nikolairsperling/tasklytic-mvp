ALTER TABLE "Offer" ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'default';
CREATE INDEX "Offer_workspaceId_idx" ON "Offer"("workspaceId");

ALTER TABLE "AppSettings" ADD COLUMN "imprintMode" TEXT NOT NULL DEFAULT 'content';
ALTER TABLE "AppSettings" ADD COLUMN "imprintUrl" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "imprintContent" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN "privacyMode" TEXT NOT NULL DEFAULT 'content';
ALTER TABLE "AppSettings" ADD COLUMN "privacyUrl" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "privacyContent" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN "cookiesMode" TEXT NOT NULL DEFAULT 'content';
ALTER TABLE "AppSettings" ADD COLUMN "cookiesUrl" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "cookiesContent" TEXT NOT NULL DEFAULT '';
