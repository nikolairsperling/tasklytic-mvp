-- AlterTable
ALTER TABLE "InboundEmail"
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'neutral',
ADD COLUMN     "confidence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiSummary" TEXT;
