ALTER TABLE "ConnectedAccount"
  ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT,
  ALTER COLUMN "provider" DROP NOT NULL;

DROP TYPE IF EXISTS "ConnectedAccountType";
