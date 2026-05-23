"use client";

import type { VideoAsset } from "@prisma/client";
import { Upload } from "lucide-react";
import { type ChangeEvent, useCallback, useRef, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, EmptyState, PageHeader } from "@/components/admin/ui";
import { uploadVideo, type VideoUploadState } from "@/lib/video-upload-client";

export function VideoAssetManager({ initialItems }: { initialItems: VideoAsset[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<VideoUploadState>({ progress: 0, message: "", status: "idle" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadVideos = useCallback(() => {
    fetch("/api/assets/videos")
      .then((response) => response.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => undefined);
  }, []);

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
      setMessage("Bitte zuerst eine Videodatei auswählen.");
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
      setMessage("Video hochgeladen");
      setSelectedFile(null);
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

  function remove(id: string) {
    if (!window.confirm("Video wirklich löschen?")) return;
    startTransition(async () => {
      const response = await fetch(`/api/assets/videos/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(data?.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("Video gelöscht.");
    });
  }

  function rename(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/assets/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName })
      });
      const data = await response.json().catch(() => null) as (VideoAsset & { error?: string }) | null;
      if (!response.ok || !data) {
        setMessage(data?.error ?? "Umbenennen fehlgeschlagen.");
        return;
      }
      setItems((current) => current.map((item) => item.id === id ? data : item));
      setEditingId(null);
      setMessage("Video umbenannt.");
    });
  }

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
    setMessage("URL kopiert.");
  }

  return (
    <div>
      <PageHeader title="Videos" description="Videodateien hochladen und in Landingpages oder bei Leads verwenden." backButton={<AdminBackButton href="/admin/assets" />} />
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">Video hochladen</h2>
          {message ? <p role="status" className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p> : null}
          <div
            className="mt-4 grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectFile(event.dataTransfer.files[0]);
            }}
          >
            <div className="flex w-full min-w-0 flex-col items-center px-2">
              <p className="text-sm font-semibold text-ink">Video hier ablegen</p>
              <p className="mt-1 text-xs text-slate-500">MP4, WebM, MOV oder M4V bis 200 MB</p>
              {selectedFile ? <SelectedVideoFileDetails file={selectedFile} className="mt-3" /> : null}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isPending || uploadState.status === "uploading"}
                aria-label="Videodatei auswählen"
                className="mt-4 inline-flex min-w-[132px] max-w-full flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span className="text-center leading-tight">Auswählen</span>
              </button>
              <button
                type="button"
                onClick={upload}
                disabled={isPending || uploadState.status === "uploading"}
                className="btn-primary mt-3 inline-flex min-w-[132px] max-w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Hochladen
              </button>
              <input ref={inputRef} className="hidden" type="file" name="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v" onChange={onFileChange} />
            </div>
          </div>
          {uploadState.status !== "idle" ? (
            <div className="mt-4" role="status" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadState.progress}>
                <div className={`h-full rounded-full ${uploadState.status === "error" ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${uploadState.progress}%` }} />
              </div>
              <p className={`mt-2 text-sm ${uploadState.status === "error" ? "text-red-600" : "text-slate-600"}`}>{uploadState.message}</p>
            </div>
          ) : null}
        </AdminCard>
        <AdminCard>
          {items.length === 0 ? <EmptyState title="Noch keine Videos" description="Lade die erste Videodatei über den Upload-Bereich hoch." /> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <video src={item.url} controls preload="metadata" playsInline style={{ width: "100%", height: "auto" }} className="aspect-video bg-slate-950 object-contain" />
                  <div className="space-y-3 p-4">
                    {editingId === item.id ? (
                      <div className="flex gap-2">
                        <input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                        <button type="button" onClick={() => rename(item.id)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">OK</button>
                      </div>
                    ) : (
                      <div>
                        <p className="truncate text-sm font-semibold text-ink">{item.name || item.originalName}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{item.url}</p>
                        <p className="mt-1 text-xs text-slate-400">{Math.round(item.sizeBytes / 1024)} KB · {item.mimeType}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => copy(item.url)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">URL kopieren</button>
                      <button type="button" onClick={() => { setEditingId(item.id); setEditingName(item.name || item.originalName); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Umbenennen</button>
                      <button type="button" onClick={() => remove(item.id)} disabled={isPending} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Löschen</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}

function SelectedVideoFileDetails({ file, className = "" }: { file: File; className?: string }) {
  return (
    <div className={`max-w-full rounded-xl bg-white px-3 py-2 text-left text-xs text-slate-600 ${className}`}>
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
