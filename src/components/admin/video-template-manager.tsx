"use client";

import type { VideoTemplate } from "@prisma/client";
import { useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { PageHeader } from "@/components/admin/ui";

export function VideoTemplateManager({ templates }: { templates: VideoTemplate[] }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage(null);
      const payload = Object.fromEntries(formData.entries());
      const response = await fetch("/api/videos/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(data?.error ?? "Template konnte nicht gespeichert werden.");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Templates"
        description="Provider sind vorbereitet. V1 ruft nur den Mock-Provider auf."
        backButton={<AdminBackButton href="/admin/assets" />}
      />

      <form action={submit} className="grid gap-4 rounded-3xl bg-white p-6 shadow-panel md:grid-cols-2">
        <Field label="Name" name="name" required />
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate">Provider</span>
          <select name="provider" defaultValue="mock">
            {["mock", "heygen", "tavus", "synthesia", "custom"].map((provider) => <option key={provider} value={provider}>{provider}</option>)}
          </select>
        </label>
        <Field label="Provider Template ID" name="providerTemplateId" />
        <Field label="Default Thumbnail URL" name="defaultThumbnailUrl" type="url" />
        <label className="block space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate">Default Prompt</span>
          <textarea name="defaultScriptPrompt" rows={4} />
        </label>
        <label className="flex items-center gap-3 text-sm font-medium text-slate">
          <input type="checkbox" name="isActive" defaultChecked /> Aktiv
        </label>
        <div className="flex justify-end md:col-span-2">
          <button disabled={isPending} className="btn-primary rounded-full px-5 py-3 text-sm font-semibold">Template speichern</button>
        </div>
        {message ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{message}</p> : null}
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <div key={template.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{template.name}</h2>
                <p className="mt-1 text-xs text-slate-500">{template.provider}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${template.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{template.isActive ? "aktiv" : "inaktiv"}</span>
            </div>
            {template.provider !== "mock" ? <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-700">Provider vorbereitet, noch nicht verbunden.</p> : null}
            {template.defaultScriptPrompt ? <p className="mt-4 line-clamp-4 text-sm text-slate-600">{template.defaultScriptPrompt}</p> : null}
          </div>
        ))}
        {templates.length === 0 ? <p className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-panel">Noch keine Video Templates.</p> : null}
      </div>
    </div>
  );
}

function Field({ label, name, required, type = "text" }: { label: string; name: string; required?: boolean; type?: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <input name={name} type={type} required={required} />
    </label>
  );
}
