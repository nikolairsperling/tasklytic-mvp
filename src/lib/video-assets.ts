import { access, copyFile, mkdir, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { buildAssetFileName } from "@/lib/asset-files";
import { prisma } from "@/lib/prisma";

const execFileAsync = promisify(execFile);

const videoMimeTypes = new Map([
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
  ["video/x-m4v", ".m4v"]
]);
const videoExtensions = [".mp4", ".webm", ".mov", ".m4v"];
const videoMimeTypesByExtension = new Map([
  [".mp4", "video/mp4"],
  [".m4v", "video/mp4"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"]
]);

const maxVideoBytes = 200 * 1024 * 1024;

export class VideoUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "VideoUploadError";
    this.status = status;
  }
}

export function validateVideoUpload(input: { originalName: string; mimeType: string; sizeBytes: number }) {
  const extension = path.extname(input.originalName).toLowerCase();
  const mimeType = resolveVideoMimeType(input.originalName, input.mimeType);
  const expectedExtension = videoMimeTypes.get(mimeType);

  if (!extension || !videoExtensions.includes(extension)) throw new VideoUploadError("Dateityp nicht erlaubt.");
  if (input.sizeBytes <= 0) throw new VideoUploadError("Datei ist leer.");
  if (input.sizeBytes > maxVideoBytes) throw new VideoUploadError("Video ist größer als 200 MB.");
  if (!mimeType.startsWith("video/")) throw new VideoUploadError("Dateityp nicht erlaubt.");
  if (!expectedExtension) return { extension };
  if (mimeType === "video/mp4" && ![".mp4", ".m4v"].includes(extension)) throw new VideoUploadError("Dateityp nicht erlaubt.");
  if (mimeType !== "video/mp4" && extension !== expectedExtension) throw new VideoUploadError("Dateityp nicht erlaubt.");
  return { extension, mimeType };
}

export function resolveVideoMimeType(originalName: string, mimeType: string | null | undefined) {
  const extension = path.extname(originalName).toLowerCase();
  const normalized = String(mimeType ?? "").trim().toLowerCase();
  if (!normalized || normalized === "application/octet-stream") return videoMimeTypesByExtension.get(extension) ?? normalized;
  return normalized;
}

export function assertVideoAssetUrl(url: string) {
  const clean = url.trim();
  if (!clean || clean.startsWith("/uploads/images/")) throw new VideoUploadError("Video URL muss auf eine Videodatei zeigen.");
  const extension = path.extname(clean.split("?")[0] ?? "").toLowerCase();
  if (!videoExtensions.includes(extension)) throw new VideoUploadError("Dateityp nicht erlaubt.");
  return clean;
}

export function sanitizeVideoName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .trim()
    .slice(0, 120);
}

export function getVideoUploadDirectory() {
  return path.join(process.cwd(), "public", "uploads", "videos");
}

export function getVideoPublicUrl(filename: string) {
  return `/uploads/videos/${filename}`;
}

export async function saveVideoAssetUpload(file: File) {
  if (!(file instanceof File)) throw new VideoUploadError("Keine Datei unter FormData-Key file gefunden.");
  const validation = validateVideoUpload({ originalName: file.name, mimeType: file.type, sizeBytes: file.size });
  const outputExtension = validation.extension === ".m4v" ? ".m4v" : ".mp4";
  const filename = buildAssetFileName(outputExtension);
  const baseFilename = filename.replace(new RegExp(`${outputExtension}$`, "i"), "");
  const mobileFilename = `${baseFilename}-mobile${outputExtension}`;
  const webmFilename = `${baseFilename}.webm`;
  const posterFilename = `${baseFilename}-poster.jpg`;
  const sourceFilename = `${baseFilename}-source${validation.extension}`;
  const directory = getVideoUploadDirectory();
  const sourcePath = path.join(directory, sourceFilename);
  const filePath = path.join(directory, filename);
  const mobilePath = path.join(directory, mobileFilename);
  const webmPath = path.join(directory, webmFilename);
  const posterPath = path.join(directory, posterFilename);
  try {
    await mkdir(directory, { recursive: true });
  } catch {
    throw new VideoUploadError("Upload-Verzeichnis konnte nicht erstellt werden.", 500);
  }
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  try {
    await writeFile(sourcePath, buffer);
    const optimized = await optimizeVideoUpload({ sourcePath, desktopPath: filePath, mobilePath, webmPath, posterPath });
    if (!optimized) {
      await copyFile(sourcePath, filePath);
      await copyFile(sourcePath, mobilePath);
      await writeFile(posterPath, fallbackPosterBytes());
    }
    await unlink(sourcePath).catch(() => undefined);
  } catch {
    throw new VideoUploadError("Datei konnte nicht gespeichert werden.", 500);
  }
  const originalName = sanitizeVideoName(path.basename(file.name)) || `video${validation.extension}`;
  try {
    return await prisma.videoAsset.create({
      data: {
        name: sanitizeVideoName(originalName.replace(/\.[^.]+$/, "")) || "Video",
        filename,
        originalName,
        url: getVideoPublicUrl(filename),
        mobileUrl: getVideoPublicUrl(mobileFilename),
        webmUrl: await exists(webmPath) ? getVideoPublicUrl(webmFilename) : null,
        mimeType: "video/mp4",
        sizeBytes: buffer.byteLength,
        thumbnailUrl: getVideoPublicUrl(posterFilename)
      }
    });
  } catch {
    throw new VideoUploadError("VideoAsset konnte nicht gespeichert werden.", 500);
  }
}

async function optimizeVideoUpload(paths: { sourcePath: string; desktopPath: string; mobilePath: string; webmPath: string; posterPath: string }) {
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", paths.sourcePath,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-movflags", "+faststart",
      "-pix_fmt", "yuv420p",
      "-vf", "scale='min(1280,iw)':-2",
      "-c:a", "aac",
      "-b:a", "128k",
      paths.desktopPath
    ]);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", paths.sourcePath,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "25",
      "-movflags", "+faststart",
      "-pix_fmt", "yuv420p",
      "-vf", "scale='min(720,iw)':-2",
      "-c:a", "aac",
      "-b:a", "96k",
      paths.mobilePath
    ]);
    await execFileAsync("ffmpeg", ["-y", "-i", paths.sourcePath, "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "4", paths.posterPath]);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", paths.sourcePath,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-c:v", "libvpx-vp9",
      "-crf", "34",
      "-b:v", "0",
      "-vf", "scale='min(720,iw)':-2",
      "-c:a", "libopus",
      "-b:a", "96k",
      paths.webmPath
    ]).catch(() => undefined);
    return true;
  } catch (error) {
    console.warn("ffmpeg video optimization skipped", error);
    return false;
  }
}

async function exists(filePath: string) {
  return access(filePath).then(() => true).catch(() => false);
}

function fallbackPosterBytes() {
  return Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Amf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z", "base64");
}

export async function deleteVideoAsset(id: string) {
  const asset = await prisma.videoAsset.delete({ where: { id } });
  const filenames = [
    asset.filename,
    asset.mobileUrl?.split("/").pop(),
    asset.webmUrl?.split("/").pop(),
    asset.thumbnailUrl?.split("/").pop()
  ].filter(Boolean) as string[];
  for (const filename of filenames) {
    const directory = getVideoUploadDirectory();
    const resolved = path.resolve(directory, filename);
    if (resolved.startsWith(path.resolve(directory) + path.sep)) {
      await unlink(resolved).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  return asset;
}
