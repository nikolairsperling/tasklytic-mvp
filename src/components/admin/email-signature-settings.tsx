"use client";

import type { EmailSignature } from "@prisma/client";
import { useState, useTransition } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AssetFilePicker } from "@/components/admin/asset-file-picker";
import { AdminCard, PageHeader } from "@/components/admin/ui";

export function EmailSignatureSettings({ signature }: { signature: EmailSignature | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [html, setHtml] = useState(signature?.html ?? "<p>Viele Grüße<br>Tasklytic Team</p>");
  const [isDefault, setIsDefault] = useState(signature?.isDefault ?? true);

  function save(formData: FormData) {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/settings/email-signature", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: signature?.id,
          name: formData.get("name"),
          html,
          plainText: htmlToPlainText(html),
          isDefault
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(data?.error ?? "Signatur konnte nicht gespeichert werden.");
        return;
      }
      setMessage("Signatur gespeichert.");
    });
  }

  function insertImage(url: string) {
    setHtml((current) => `${current}\n<img src="${url}" alt="" style="max-width:160px;height:auto;" />`);
  }

  return (
    <div>
      <PageHeader
        title="E-Mail Signatur"
        description="Serverseitige Signatur für SMTP-Versand. Script-Tags und Event-Handler werden entfernt."
        backButton={<AdminBackButton href="/admin/settings" />}
      />
      <AdminCard>
        <form action={save} className="grid gap-4 lg:grid-cols-2">
          <label className="block space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-600">Name</span>
            <input name="name" defaultValue={signature?.name ?? "Standard Signatur"} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="flex min-h-11 items-center gap-3 lg:col-span-2">
            <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} className="h-4 w-4" />
            <span className="text-sm font-medium text-slate-600">Aktiv setzen</span>
          </label>
          <label className="block space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-600">HTML</span>
            <textarea value={html} onChange={(event) => setHtml(event.target.value)} rows={10} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm" />
          </label>
          <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
            <AssetFilePicker label="Logo in HTML-Signatur einfügen" type="logo" onSelect={insertImage} />
            <AssetFilePicker label="Bild in HTML-Signatur einfügen" type="image" onSelect={insertImage} />
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 lg:col-span-2">
            <p className="mb-3 text-sm font-semibold text-ink">Vorschau</p>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <button type="submit" disabled={isPending} className="btn-primary rounded-full px-4 py-3 text-sm font-semibold">
            Signatur speichern
          </button>
          {message ? <p className="self-center text-sm text-slate-600">{message}</p> : null}
        </form>
      </AdminCard>
    </div>
  );
}

function htmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
