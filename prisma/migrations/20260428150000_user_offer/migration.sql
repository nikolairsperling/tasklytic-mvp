CREATE TABLE "UserOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "targetAudienceDescription" TEXT NOT NULL,
    "coreProblems" JSONB NOT NULL,
    "solutions" JSONB NOT NULL,
    "valueProposition" TEXT NOT NULL,
    "toneOfVoice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserOffer_userId_key" ON "UserOffer"("userId");
