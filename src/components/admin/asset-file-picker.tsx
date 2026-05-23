"use client";

import type { AssetFile } from "@prisma/client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AssetFileTypeName } from "@/lib/asset-files";

export function AssetFilePicker({
  label,
  type,
  onSelect
}: {
  label: string;
  type: AssetFileTypeName;
  onSelect: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<AssetFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const accept = type === "video" ? ".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" : ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

  useEffect(() => {
    fetch(`/api/assets/files?type=${type}`)
      .then((response) => response.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, [type]);

  function upload(file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      setMessage(null);
      const formData = new FormData();
      formData.set("type", type);
      formData.set("file", file);
      const response = await fetch("/api/assets/upload", { method: "POST", body: formData });
      const data = await response.json().catch(() => null) as (AssetFile & { error?: string; url?: string }) | null;
      if (!response.ok || !data) {
        setMessage(data?.error ?? "Upload fehlgeschlagen.");
        return;
      }
      const selectedUrl = data.url ?? data.publicUrl;
      setItems((current) => [{ ...data, publicUrl: selectedUrl }, ...current]);
      onSelect(selectedUrl);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <button type="button" disabled={isPending} onClick={() => inputRef.current?.click()} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
          Hochladen
        </button>
      </div>
      <input ref={inputRef} className="hidden" type="file" accept={accept} onChange={(event) => upload(event.target.files?.[0])} />
      {message ? <p className="mt-2 text-xs text-red-600">{message}</p> : null}
      <div className="mt-3 grid max-h-56 gap-2 overflow-auto">
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onSelect(item.publicUrl)} className="flex items-center gap-3 rounded-xl bg-white p-2 text-left shadow-sm">
            <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100">
              {item.type === "video" ? <video src={item.publicUrl} preload="metadata" className="h-full w-full object-cover" /> : <img src={item.publicUrl} alt="" className="h-full w-full object-contain" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-800">{item.originalName}</span>
              <span className="block truncate text-[11px] text-slate-500">{item.publicUrl}</span>
            </span>
          </button>
        ))}
        {items.length === 0 ? <p className="text-xs text-slate-500">Noch keine Dateien vorhanden.</p> : null}
      </div>
    </div>
  );
}
