DO $$
DECLARE
  fallback_offer_id TEXT;
BEGIN
  SELECT id INTO fallback_offer_id
  FROM "Offer"
  WHERE "workspaceId" = 'default'
  ORDER BY "isDefault" DESC, "updatedAt" DESC
  LIMIT 1;

  IF fallback_offer_id IS NULL AND EXISTS (SELECT 1 FROM "Campaign" WHERE "offerId" IS NULL) THEN
    fallback_offer_id := 'migration-default-offer';
    INSERT INTO "Offer" (
      "id",
      "workspaceId",
      "name",
      "serviceDescription",
      "coreProblems",
      "solutions",
      "isDefault",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      fallback_offer_id,
      '__migration__',
      'Migration Default Offer',
      'Bitte Angebot auswählen',
      '[]'::jsonb,
      '[]'::jsonb,
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT ("id") DO NOTHING;
  END IF;

  UPDATE "Campaign"
  SET "offerId" = fallback_offer_id
  WHERE "offerId" IS NULL;
END $$;

ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_offerId_fkey";
ALTER TABLE "Campaign" ALTER COLUMN "offerId" SET NOT NULL;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
