ALTER TABLE "Prospect" ADD COLUMN "leadStatus" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "Prospect" ADD COLUMN "followUpAt" TIMESTAMP(3);
ALTER TABLE "Prospect" ADD COLUMN "assignedTo" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "showInCrm" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Prospect" ADD COLUMN "source" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "salutation" TEXT;

CREATE TABLE "ProspectNote" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProspectNote_prospectId_createdAt_idx" ON "ProspectNote"("prospectId", "createdAt");

ALTER TABLE "ProspectNote" ADD CONSTRAINT "ProspectNote_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
