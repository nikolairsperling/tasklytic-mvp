ALTER TABLE "Campaign" ADD COLUMN "selectedProspectId" TEXT;

CREATE INDEX "Campaign_selectedProspectId_idx" ON "Campaign"("selectedProspectId");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_selectedProspectId_fkey" FOREIGN KEY ("selectedProspectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
