-- AlterTable
ALTER TABLE "EmailTemplate" RENAME COLUMN "bodyText" TO "body";

ALTER TABLE "EmailTemplate" DROP COLUMN "bodyHtml";
