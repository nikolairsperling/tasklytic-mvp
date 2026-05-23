"use client";

import type { VideoAsset } from "@prisma/client";

export type VideoUploadState = {
  progress: number;
  message: string;
  status: "idle" | "uploading" | "success" | "error";
};

export async function uploadVideo(file: File, onProgress: (percent: number) => void) {
  const formData = new FormData();
  formData.append("file", file, file.name);
  console.log("video upload form data", describeUploadFormData(formData));
  console.log("Uploading video to", "/api/assets/videos/upload");

  onProgress(5);

  return await new Promise<VideoAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(Math.max(5, Math.min(99, percent)));
    };
    xhr.onload = () => {
      const data = readJson(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300 && isObject(data) && data.success === true) {
        onProgress(100);
        resolve(normalizeUploadResponse(data));
        return;
      }
      reject(new Error(readUploadError(data)));
    };
    xhr.onerror = () => reject(new Error("Video konnte nicht hochgeladen werden."));
    xhr.open("POST", "/api/assets/videos/upload");
    xhr.send(formData);
  });
}

export async function uploadVideoAsset(file: File) {
  return uploadVideo(file, () => undefined);
}

export async function uploadVideoAssetWithProgress(
  file: File,
  callbacks: {
    onProgress: (state: VideoUploadState) => void;
    onSuccess: (asset: VideoAsset) => void;
    onError: (message: string) => void;
  }
) {
  callbacks.onProgress({ progress: 0, status: "uploading", message: "Upload läuft..." });
  try {
    const asset = await uploadVideo(file, (progress) => {
      callbacks.onProgress({ progress, status: "uploading", message: `Upload läuft... ${progress} %` });
    });
    callbacks.onProgress({ progress: 100, status: "success", message: "Video hochgeladen" });
    callbacks.onSuccess(asset);
  } catch (error) {
    callbacks.onError(error instanceof Error ? error.message : "Video konnte nicht hochgeladen werden.");
  }
}

function readJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readUploadError(data: unknown) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") return data.error;
  return "Video konnte nicht hochgeladen werden.";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeUploadResponse(data: Record<string, unknown>): VideoAsset {
  const asset = isObject(data.asset) ? data.asset : data;
  if (typeof asset.size === "number" && typeof asset.sizeBytes !== "number") {
    asset.sizeBytes = asset.size;
  }
  return asset as VideoAsset;
}

function describeUploadFormData(formData: FormData) {
  return Array.from(formData.entries()).map(([key, value]) => {
    if (value instanceof File) {
      return { key, kind: "file", name: value.name, type: value.type, size: value.size };
    }
    return { key, kind: "field", valueLength: value.length };
  });
}
