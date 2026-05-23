import crypto from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const assetFileTypes = ["image", "logo", "video"] as const;
export type AssetFileTypeName = (typeof assetFileTypes)[number];

const imageMimeTypes = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"]
]);

const videoMimeTypes = new Map([
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"]
]);

const maxImageBytes = 5 * 1024 * 1024;
const maxVideoBytes = 200 * 1024 * 1024;

export function isAssetFileType(value: unknown): value is AssetFileTypeName {
  return typeof value === "string" && assetFileTypes.includes(value as AssetFileTypeName);
}

export function validateAssetUpload(input: {
  type: unknown;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  if (!isAssetFileType(input.type)) {
    throw new Error("Ungültiger Asset-Typ.");
  }

  const extension = path.extname(input.originalName).toLowerCase();
  const allowed = input.type === "video" ? videoMimeTypes : imageMimeTypes;
  const maxBytes = input.type === "video" ? maxVideoBytes : maxImageBytes;
  const expectedExtension = allowed.get(input.mimeType);

  if (!expectedExtension) {
    throw new Error("Dateityp ist nicht erlaubt.");
  }
  if (!extension || !Array.from(allowed.values()).includes(extension) && !(input.mimeType === "image/jpeg" && extension === ".jpeg")) {
    throw new Error("Dateiendung ist nicht erlaubt.");
  }
  if (input.sizeBytes <= 0) {
    throw new Error("Datei ist leer.");
  }
  if (input.sizeBytes > maxBytes) {
    throw new Error(input.type === "video" ? "Video ist größer als 200 MB." : "Bild ist größer als 5 MB.");
  }

  return {
    type: input.type,
    extension: input.mimeType === "image/jpeg" && extension === ".jpeg" ? ".jpg" : expectedExtension,
    maxBytes
  };
}

export function buildAssetFileName(extension: string) {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
}

export function getAssetUploadDirectory(type: AssetFileTypeName) {
  return path.join(process.cwd(), "public", "uploads", type === "image" ? "images" : type === "logo" ? "logos" : "videos");
}

export function getAssetPublicUrl(type: AssetFileTypeName, fileName: string) {
  const folder = type === "image" ? "images" : type === "logo" ? "logos" : "videos";
  return `/uploads/${folder}/${fileName}`;
}

export async function saveAssetUpload(input: { file: File; type: AssetFileTypeName }) {
  const validation = validateAssetUpload({
    type: input.type,
    originalName: input.file.name,
    mimeType: input.file.type,
    sizeBytes: input.file.size
  });
  const fileName = buildAssetFileName(validation.extension);
  const directory = getAssetUploadDirectory(input.type);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), Buffer.from(await input.file.arrayBuffer()));

  return prisma.assetFile.create({
    data: {
      type: input.type,
      originalName: path.basename(input.file.name),
      fileName,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      publicUrl: getAssetPublicUrl(input.type, fileName)
    }
  });
}

export async function deleteAssetFile(id: string) {
  const asset = await prisma.assetFile.delete({ where: { id } });
  const directory = getAssetUploadDirectory(asset.type);
  const resolved = path.resolve(directory, asset.fileName);
  if (resolved.startsWith(path.resolve(directory) + path.sep)) {
    await unlink(resolved).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  return asset;
}
