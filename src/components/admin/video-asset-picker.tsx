"use client";

import type { VideoAsset } from "@prisma/client";
import { Library, Upload, X } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { uploadVideo, type VideoUploadState } from "@/lib/video-upload-client";

export function VideoAssetPicker({
  label,
  onSelect,
  onRemove,
  selectedUrl
}: {
  label: string;
  onSelect: (asset: VideoAsset) => void;
  onRemove?: () => void;
  selectedUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<VideoAsset[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<VideoUploadState>({ progress: 0, message: "", status: "idle" });
  const selectedAsset = items.find((item) => item.url === selectedUrl);

  const loadVideos = useCallback(() => {
    fetch("/api/assets/videos")
      .then((response) => response.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  function selectFile(file: File | undefined) {
    if (!file) {
      return;
    }
    console.log(file.name, file.type, file.size);
    setSelectedFile(file);
    setMessage(null);
    setUploadState({ progress: 0, message: "", status: "idle" });
  }

  async function upload() {
    if (!selectedFile) {
      setUploadState({ progress: 0, status: "error", message: "Bitte zuerst eine Videodatei auswählen." });
      setMessage(null);
      return;
    }
    setMessage(null);
    setUploadState({ progress: 0, message: "Upload läuft...", status: "uploading" });
    try {
      const asset = await uploadVideo(selectedFile, (progress) => {
        setUploadState({ progress, message: `Upload läuft... ${progress} %`, status: "uploading" });
      });
      setUploadState({ progress: 100, status: "success", message: "Video hochgeladen" });
      setItems((current) => [asset, ...current]);
      loadVideos();
      onSelect(asset);
      setSelectedFile(null);
      setMessage("Video hochgeladen");
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setUploadState((current) => ({ progress: current.progress, status: "error", message: error instanceof Error ? error.message : "Video konnte nicht hochgeladen werden." }));
      setMessage(null);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
    if (file) selectFile(file);
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 whitespace-normal break-normal text-xs font-semibold uppercase tracking-wide text-slate-500 [overflow-wrap:normal]">{label}</p>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Video entfernen"
              title="Video entfernen"
              className="inline-grid h-9 w-9 place-items-center rounded-lg bg-white text-red-600 shadow-sm hover:bg-red-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            disabled={uploadState.status === "uploading"}
            onClick={() => inputRef.current?.click()}
            aria-label="Videodatei auswählen"
            title="Videodatei auswählen"
            className="inline-flex min-h-9 min-w-[132px] max-w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span className="text-center leading-tight">Video hochladen</span>
          </button>
          <button
            type="button"
            disabled={uploadState.status === "uploading"}
            onClick={upload}
            className="inline-flex min-h-9 min-w-[112px] max-w-full items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hochladen
          </button>
        </div>
      </div>
      <input ref={inputRef} className="hidden" type="file" name="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v" onChange={onFileChange} />
      {selectedUrl ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{selectedAsset?.name || selectedAsset?.originalName || "Ausgewähltes Video"}</p>
              <p className="mt-1 break-all text-xs text-slate-500">{selectedUrl}</p>
            </div>
            {onRemove ? <button type="button" onClick={onRemove} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-600 hover:bg-red-50" aria-label="Video entfernen"><X className="h-4 w-4" /></button> : null}
          </div>
          <video src={selectedUrl} controls playsInline preload="metadata" className="mt-3 aspect-video w-full rounded-lg bg-slate-950 object-cover" />
        </div>
      ) : null}
      {selectedFile ? <SelectedVideoFileDetails file={selectedFile} /> : null}
      {uploadState.status !== "idle" ? (
        <div className="mt-3" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadState.progress}>
            <div className={`h-full rounded-full ${uploadState.status === "error" ? "bg-red-500" : "bg-[#6556ff]"}`} style={{ width: `${uploadState.progress}%` }} />
          </div>
          <p className={`mt-2 text-xs ${uploadState.status === "error" ? "text-red-600" : "text-slate-600"}`}>{uploadState.message}</p>
        </div>
      ) : null}
      {message ? <p role="status" className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Library className="h-4 w-4" /> Aus Mediathek wählen</div>
      <div className="mt-3 grid max-h-72 gap-3 overflow-auto sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className={`rounded-xl bg-white p-2 text-left shadow-sm ring-1 ${item.url === selectedUrl ? "ring-emerald-300" : "ring-transparent"}`}>
            <span className="grid aspect-video w-full place-items-center overflow-hidden rounded-lg bg-slate-100">
              <video src={item.url} playsInline preload="metadata" className="h-full w-full object-cover" />
            </span>
            <span className="mt-2 block min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-800">{item.name || item.originalName}</span>
              <span className="block truncate text-[11px] text-slate-500">{formatBytes(item.sizeBytes || 0)} · {item.mimeType || "video/*"}</span>
            </span>
            <button type="button" onClick={() => onSelect(item)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Auswählen</button>
          </div>
        ))}
        {items.length === 0 ? <p className="text-xs text-slate-500">Noch keine Videos vorhanden.</p> : null}
      </div>
    </div>
  );
}

function SelectedVideoFileDetails({ file }: { file: File }) {
  return (
    <div className="mt-2 max-w-full rounded-xl bg-white px-3 py-2 text-xs text-slate-600">
      <p className="truncate font-semibold text-slate-800">{file.name}</p>
      <p className="mt-1">{file.type || "MIME-Type fehlt"} · {formatBytes(file.size)}</p>
    </div>
  );
}

function formatBytes(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}
