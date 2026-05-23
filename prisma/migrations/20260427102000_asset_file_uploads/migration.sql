CREATE TYPE "AssetFileType" AS ENUM ('image', 'logo', 'video');

CREATE TABLE "AssetFile" (
    "id" TEXT NOT NULL,
    "type" "AssetFileType" NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssetFile_type_createdAt_idx" ON "AssetFile"("type", "createdAt");
