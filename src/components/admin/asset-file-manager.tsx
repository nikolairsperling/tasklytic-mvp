"use client";

import type { AssetFile } from "@prisma/client";
import { useRef, useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, EmptyState, PageHeader } from "@/components/admin/ui";
import type { AssetFileTypeName } from "@/lib/asset-files";

export function AssetFileManager({
  title,
  description,
  type,
  initialItems
}: {
  title: string;
  description: string;
  type: AssetFileTypeName;
  initialItems: AssetFile[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const accept = type === "video" ? ".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" : ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

  function upload(file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      setMessage(null);
      const formData = new FormData();
      formData.set("type", type);
      formData.set("file", file);
      const response = await fetch("/api/assets/upload", { method: "POST", body: formData });
      const data = await response.json().catch(() => null) as (AssetFile & { error?: string }) | null;
      if (!response.ok || !data) {
        setMessage(data?.error ?? "Upload fehlgeschlagen.");
        return;
      }
      setItems((current) => [data, ...current]);
      setMessage("Upload abgeschlossen.");
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/assets/files/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(data?.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("Asset gelöscht.");
    });
  }

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
    setMessage("URL kopiert.");
  }

  return (
    <div>
      <PageHeader title={title} description={description} backButton={<AdminBackButton href="/admin/assets" />} />
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">Datei hochladen</h2>
          {message ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p> : null}
          <div
            className="mt-4 grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              upload(event.dataTransfer.files[0]);
            }}
          >
            <div>
              <p className="text-sm font-semibold text-ink">Datei hier ablegen</p>
              <p className="mt-1 text-xs text-slate-500">{type === "video" ? "MP4, WebM oder MOV bis 200 MB" : "PNG, JPG oder WebP bis 5 MB"}</p>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={isPending} className="btn-primary mt-4 rounded-xl px-4 py-2 text-sm font-semibold">
                Upload auswählen
              </button>
              <input ref={inputRef} className="hidden" type="file" accept={accept} onChange={(event) => upload(event.target.files?.[0])} />
            </div>
          </div>
        </AdminCard>
        <AdminCard>
          {items.length === 0 ? <EmptyState title="Noch keine Dateien" description="Lade die erste Datei über den Upload-Bereich hoch." /> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="grid aspect-video place-items-center bg-slate-100">
                    {item.type === "video" ? (
                      <video src={item.publicUrl} controls preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      <img src={item.publicUrl} alt={item.originalName} className="h-full w-full object-contain p-3" />
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="truncate text-sm font-semibold text-ink">{item.originalName}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{item.publicUrl}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => copy(item.publicUrl)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">URL kopieren</button>
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
