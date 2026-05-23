-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('draft', 'qualified', 'landingpage_ready', 'contacted', 'responded', 'disqualified');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "companyName" TEXT NOT NULL,
    "legalName" TEXT,
    "websiteUrl" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "employeeRange" TEXT,
    "vehicleCount" INTEGER,
    "trailerCount" INTEGER,
    "locationsCount" INTEGER,
    "businessFields" TEXT[],
    "isFamilyOwned" BOOLEAN,
    "decisionMakerName" TEXT,
    "decisionMakerRole" TEXT,
    "decisionMakerEmail" TEXT,
    "linkedinUrl" TEXT,
    "openDispatcherJob" BOOLEAN NOT NULL DEFAULT false,
    "jobUrl" TEXT,
    "jobSignalText" TEXT,
    "fleetSignalText" TEXT,
    "locationSignalText" TEXT,
    "contactStructureSignalText" TEXT,
    "websiteMaturitySignal" TEXT,
    "icpFitScore" INTEGER NOT NULL DEFAULT 0,
    "timingScore" INTEGER NOT NULL DEFAULT 0,
    "painScore" INTEGER NOT NULL DEFAULT 0,
    "contactQualityScore" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "status" "ProspectStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_slug_key" ON "Prospect"("slug");
