CREATE TABLE "LeadList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadListMember" (
    "id" TEXT NOT NULL,
    "leadListId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadListMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadList_targetGroupId_idx" ON "LeadList"("targetGroupId");
CREATE INDEX "LeadList_createdAt_idx" ON "LeadList"("createdAt");
CREATE INDEX "LeadListMember_prospectId_idx" ON "LeadListMember"("prospectId");
CREATE UNIQUE INDEX "LeadListMember_leadListId_prospectId_key" ON "LeadListMember"("leadListId", "prospectId");

ALTER TABLE "LeadList" ADD CONSTRAINT "LeadList_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "TargetGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadListMember" ADD CONSTRAINT "LeadListMember_leadListId_fkey" FOREIGN KEY ("leadListId") REFERENCES "LeadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadListMember" ADD CONSTRAINT "LeadListMember_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
