CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "themeMode" TEXT NOT NULL DEFAULT 'dark',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LandingpageTemplate"
ADD COLUMN "sectionsJson" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "globalDesignJson" JSONB NOT NULL DEFAULT '{}';
