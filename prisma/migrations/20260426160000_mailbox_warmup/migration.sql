-- AlterTable
ALTER TABLE "MailboxSettings"
ADD COLUMN     "warmupStartDate" TIMESTAMP(3),
ADD COLUMN     "warmupLevel" INTEGER;
