ALTER TABLE "LetterTemplate"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "body" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "footer" TEXT,
  ADD COLUMN "qrCodePosition" TEXT,
  ADD COLUMN "landingPageUrlVariable" TEXT NOT NULL DEFAULT '{{LandingPage_URL}}',
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

UPDATE "LetterTemplate"
SET
  "body" = COALESCE(NULLIF("googleDocsText", ''), NULLIF("previewText", ''), ''),
  "footer" = COALESCE("footer", '{{Absender_Firma}} · {{Absender_Email}} · {{Absender_Website}}'),
  "qrCodePosition" = COALESCE("qrCodePosition", 'unten'),
  "landingPageUrlVariable" = COALESCE(NULLIF("landingPageUrlVariable", ''), '{{LandingPage_URL}}');

UPDATE "LetterTemplate"
SET "isDefault" = true
WHERE "id" = (
  SELECT "id"
  FROM "LetterTemplate"
  ORDER BY "isSystemTemplate" DESC, "updatedAt" DESC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM "LetterTemplate" WHERE "isDefault" = true
);
