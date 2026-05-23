"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, DataTable, EmptyState, PageHeader } from "@/components/admin/ui";

type FieldOption = { label: string; value: string };
type Field = { name: string; label: string; type?: string; textarea?: boolean; options?: FieldOption[]; required?: boolean };
type AssetItem = Record<string, unknown> & { id: string };
type AssetListResponse = AssetItem[] | { items?: AssetItem[]; error?: string; message?: string };
type Notice = { tone: "success" | "error"; text: string } | null;
type LoadStatus = { loading: boolean; error: string | null };
type AiEmailVariant = { label: string; subject: string; bodyText: string };
type AiEmailForm = {
  targetAudience: string;
  offer: string;
  tone: string;
  addressForm: "du" | "sie";
  goal: string;
  length: "kurz" | "mittel" | "ausführlich";
  variantCount: number;
};

const defaultAiEmailForm: AiEmailForm = {
  targetAudience: "",
  offer: "",
  tone: "",
  addressForm: "sie",
  goal: "",
  length: "kurz",
  variantCount: 1
};

function formValues(fields: Field[], formData: FormData) {
  return Object.fromEntries(fields.map((field) => [field.name, String(formData.get(field.name) ?? "").trim()]));
}

function responseMessage(status: number, data: { error?: string; message?: string } | null) {
  return `HTTP ${status}: ${data?.error ?? data?.message ?? "Unbekannter Fehler."}`;
}

function validationMessage(fields: Field[], values: Record<string, string>) {
  const missing = fields.filter((field) => field.required && !values[field.name]).map((field) => field.label);
  if (missing.length === 0) return null;
  if (missing.includes("Name") && missing.includes("Typ")) return "Name und Typ sind erforderlich.";
  return `${missing.join(" und ")} ${missing.length === 1 ? "ist" : "sind"} erforderlich.`;
}

async function readResponse(response: Response) {
  return await response.json().catch(() => null) as (AssetItem & { error?: string; message?: string }) | null;
}

function extractItems(data: AssetListResponse | null) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return null;
}

function FieldControl({
  field,
  value,
  onChange
}: {
  field: Field;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const commonProps = {
    name: field.name,
    required: field.required,
    value,
    onChange: onChange ? (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(event.currentTarget.value) : undefined
  };

  if (field.options) {
    return (
      <select {...commonProps}>
        <option value="">Auswählen</option>
        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  if (field.textarea) return <textarea {...commonProps} rows={4} />;
  return <input {...commonProps} type={field.type ?? "text"} />;
}

export function AssetListManager({
  title,
  description,
  endpoint,
  fields,
  items,
  itemLabel = "Eintrag",
  enableEmailTemplateAi = false
}: {
  title: string;
  description: string;
  endpoint: string;
  fields: Field[];
  items: Array<Record<string, unknown>>;
  itemLabel?: string;
  enableEmailTemplateAi?: boolean;
}) {
  const [list, setList] = useState<AssetItem[]>(items.map((item) => ({ ...item, id: String(item.id) })));
  const [notice, setNotice] = useState<Notice>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>({ loading: false, error: null });
  const [isCreating, setIsCreating] = useState(false);
  const [formValuesState, setFormValuesState] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.name, ""])));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [aiOpen, setAiOpen] = useState(false);
  const [aiForm, setAiForm] = useState<AiEmailForm>(defaultAiEmailForm);
  const [aiVariants, setAiVariants] = useState<AiEmailVariant[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<Notice>(null);

  useEffect(() => {
    let active = true;
    setLoadStatus({ loading: true, error: null });
    reloadList()
      .then(() => {
        if (active) setLoadStatus({ loading: false, error: null });
      })
      .catch((error) => {
        console.error("Asset list load failed", error);
        if (active) {
          setLoadStatus({
            loading: false,
            error: error instanceof Error ? error.message : "Einträge konnten nicht geladen werden."
          });
        }
      });
    return () => {
      active = false;
    };
  }, [endpoint]);

  async function reloadList() {
    const response = await fetch(endpoint);
    const data = await response.json().catch(() => null) as AssetListResponse | null;
    const items = extractItems(data);
    if (!response.ok || !items) {
      console.error("Asset list reload failed", { status: response.status, data });
      throw new Error(responseMessage(response.status, Array.isArray(data) ? null : data));
    }
    setList(items.map((item) => ({ ...item, id: String(item.id) })));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = formValues(fields, new FormData(form));
    const error = validationMessage(fields, values);
    if (error) {
      setNotice({ tone: "error", text: error });
      return;
    }

    setIsCreating(true);
    setNotice(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const data = await readResponse(response);
      if (!response.ok || !data) {
        console.error("Asset create failed", { status: response.status, data });
        setNotice({ tone: "error", text: responseMessage(response.status, data) });
        return;
      }
      form.reset();
      setFormValuesState(Object.fromEntries(fields.map((field) => [field.name, ""])));
      await reloadList();
      setNotice({ tone: "success", text: `${itemLabel} erstellt.` });
    } catch (error) {
      console.error("Asset create failed", error);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : `${itemLabel} konnte nicht erstellt werden.` });
    } finally {
      setIsCreating(false);
    }
  }

  async function generateAiVariants(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAiBusy(true);
    setAiNotice(null);
    try {
      const response = await fetch("/api/assets/email-templates/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm)
      });
      const data = await response.json().catch(() => null) as { variants?: AiEmailVariant[]; error?: string; message?: string } | null;
      if (!response.ok || !data?.variants) {
        console.error("Email template AI generation failed", { status: response.status, data });
        setAiNotice({ tone: "error", text: responseMessage(response.status, data ?? null) });
        return;
      }
      setAiVariants(data.variants);
      setAiNotice({ tone: "success", text: `${data.variants.length} Variante${data.variants.length === 1 ? "" : "n"} erzeugt.` });
    } catch (error) {
      console.error("Email template AI generation failed", error);
      setAiNotice({ tone: "error", text: error instanceof Error ? error.message : "KI-Vorlagen konnten nicht erzeugt werden." });
    } finally {
      setAiBusy(false);
    }
  }

  function updateAiVariant(index: number, patch: Partial<AiEmailVariant>) {
    setAiVariants((current) => current.map((variant, currentIndex) => currentIndex === index ? { ...variant, ...patch } : variant));
  }

  function applyAiVariant(variant: AiEmailVariant) {
    setFormValuesState((current) => ({
      ...current,
      name: current.name || variant.subject,
      subject: variant.subject,
      body: variant.bodyText,
      category: current.category || "KI"
    }));
    setAiOpen(false);
    setNotice({ tone: "success", text: "Variante ins Formular übernommen." });
  }

  async function saveAiVariant(variant: AiEmailVariant) {
    setAiBusy(true);
    setAiNotice(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: variant.subject,
          subject: variant.subject,
          body: variant.bodyText,
          category: "KI"
        })
      });
      const data = await readResponse(response);
      if (!response.ok || !data) {
        console.error("Email template AI save failed", { status: response.status, data });
        setAiNotice({ tone: "error", text: responseMessage(response.status, data) });
        return;
      }
      await reloadList();
      setAiNotice({ tone: "success", text: "Variante als Vorlage gespeichert." });
    } catch (error) {
      console.error("Email template AI save failed", error);
      setAiNotice({ tone: "error", text: error instanceof Error ? error.message : "Variante konnte nicht gespeichert werden." });
    } finally {
      setAiBusy(false);
    }
  }

  function startEdit(item: AssetItem) {
    setEditingId(item.id);
    setEditValues(Object.fromEntries(fields.map((field) => [field.name, String(item[field.name] ?? "")])));
    setNotice(null);
  }

  async function saveEdit(id: string) {
    const error = validationMessage(fields, editValues);
    if (error) {
      setNotice({ tone: "error", text: error });
      return;
    }

    setBusyId(id);
    setNotice(null);
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues)
      });
      const data = await readResponse(response);
      if (!response.ok || !data) {
        console.error("Asset update failed", { status: response.status, data });
        setNotice({ tone: "error", text: responseMessage(response.status, data) });
        return;
      }
      setList((current) => current.map((item) => item.id === id ? { ...data, id: String(data.id) } : item));
      setEditingId(null);
      setNotice({ tone: "success", text: `${itemLabel} gespeichert.` });
    } catch (error) {
      console.error("Asset update failed", error);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : `${itemLabel} konnte nicht gespeichert werden.` });
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(id: string) {
    setBusyId(id);
    setNotice(null);
    try {
      const response = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
      const data = response.status === 204 ? null : await readResponse(response);
      if (!response.ok) {
        console.error("Asset delete failed", { status: response.status, data });
        setNotice({ tone: "error", text: responseMessage(response.status, data) });
        return;
      }
      setList((current) => current.filter((item) => item.id !== id));
      setNotice({ tone: "success", text: `${itemLabel} gelöscht.` });
    } catch (error) {
      console.error("Asset delete failed", error);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : `${itemLabel} konnte nicht gelöscht werden.` });
    } finally {
      setBusyId(null);
    }
  }

  const noticeClass = notice?.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";

  return (
    <div>
      <PageHeader title={title} description={description} backButton={<AdminBackButton href="/admin/assets" />} />
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <AdminCard>
          <h2 className="text-lg font-semibold text-ink">Neu erstellen</h2>
          {notice ? <p className={`mt-3 rounded-xl p-3 text-sm ${noticeClass}`}>{notice.text}</p> : null}
          <form className="mt-4 space-y-4" onSubmit={submit}>
            {fields.map((field) => (
              <label key={field.name} className="block space-y-2">
                <span className="text-sm font-medium text-slate">{field.label}</span>
                <FieldControl field={field} value={formValuesState[field.name] ?? ""} onChange={(value) => setFormValuesState((current) => ({ ...current, [field.name]: value }))} />
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <button disabled={isCreating} className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold">
                {isCreating ? "Erstellt..." : "Erstellen"}
              </button>
              {enableEmailTemplateAi ? (
                <button type="button" onClick={() => { setAiOpen(true); setAiNotice(null); }} className="btn-secondary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold">
                  Mit KI generieren
                </button>
              ) : null}
            </div>
          </form>
        </AdminCard>
        <AdminCard>
          {loadStatus.error ? <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadStatus.error}</p> : null}
          {loadStatus.loading ? <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Einträge werden geladen...</p> : null}
          {list.length === 0 ? <EmptyState title="Noch keine Einträge" description="Erstelle den ersten Asset-Eintrag links im Formular." /> : (
            <>
              <div className="space-y-3 md:hidden">
                {list.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {fields.slice(0, 4).map((field) => (
                      <div key={field.name} className="mb-3 min-w-0 last:mb-0">
                        <p className="text-xs text-slate-400">{field.label}</p>
                        {editingId === item.id ? (
                          <FieldControl field={field} value={editValues[field.name] ?? ""} onChange={(value) => setEditValues((current) => ({ ...current, [field.name]: value }))} />
                        ) : (
                          <p className="break-words text-sm font-medium text-ink">{String(item[field.name] ?? "") || "leer"}</p>
                        )}
                      </div>
                    ))}
                    <p className="mt-3 text-xs text-slate-500">{item.createdAt ? new Date(String(item.createdAt)).toLocaleDateString("de-DE") : ""}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {editingId === item.id ? (
                        <>
                          <button type="button" disabled={busyId === item.id} onClick={() => saveEdit(item.id)} className="btn-primary rounded-xl px-3 py-2 text-xs font-semibold">Speichern</button>
                          <button type="button" disabled={busyId === item.id} onClick={() => setEditingId(null)} className="btn-secondary rounded-xl px-3 py-2 text-xs font-semibold">Abbrechen</button>
                        </>
                      ) : (
                        <button type="button" disabled={busyId === item.id} onClick={() => startEdit(item)} className="btn-secondary rounded-xl px-3 py-2 text-xs font-semibold">Bearbeiten</button>
                      )}
                      <button type="button" disabled={busyId === item.id} onClick={() => removeItem(item.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Löschen</button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden md:block">
                <DataTable>
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      <tr>{fields.slice(0, 4).map((field) => <th key={field.name} className="p-3">{field.label}</th>)}<th className="p-3">Erstellt</th><th className="p-3">Aktionen</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.map((item) => (
                        <tr key={item.id}>
                          {fields.slice(0, 4).map((field) => (
                            <td key={field.name} className="p-3 align-top">
                              {editingId === item.id ? (
                                <FieldControl field={field} value={editValues[field.name] ?? ""} onChange={(value) => setEditValues((current) => ({ ...current, [field.name]: value }))} />
                              ) : (
                                <span className="break-words">{String(item[field.name] ?? "")}</span>
                              )}
                            </td>
                          ))}
                          <td className="p-3 align-top">{item.createdAt ? new Date(String(item.createdAt)).toLocaleDateString("de-DE") : ""}</td>
                          <td className="p-3 align-top">
                            <div className="flex flex-wrap gap-2">
                              {editingId === item.id ? (
                                <>
                                  <button type="button" disabled={busyId === item.id} onClick={() => saveEdit(item.id)} className="btn-primary rounded-xl px-3 py-2 text-xs font-semibold">Speichern</button>
                                  <button type="button" disabled={busyId === item.id} onClick={() => setEditingId(null)} className="btn-secondary rounded-xl px-3 py-2 text-xs font-semibold">Abbrechen</button>
                                </>
                              ) : (
                                <button type="button" disabled={busyId === item.id} onClick={() => startEdit(item)} className="btn-secondary rounded-xl px-3 py-2 text-xs font-semibold">Bearbeiten</button>
                              )}
                              <button type="button" disabled={busyId === item.id} onClick={() => removeItem(item.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Löschen</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
              </div>
            </>
          )}
        </AdminCard>
      </div>
      {enableEmailTemplateAi && aiOpen ? (
        <div className="ai-modal-backdrop">
          <div className="ai-modal">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">E-Mail-Vorlage mit KI generieren</h2>
                <p className="mt-1 text-sm text-slate-500">Die KI erzeugt nur Vorlagen. Es wird keine E-Mail gesendet.</p>
              </div>
              <button type="button" onClick={() => setAiOpen(false)} className="btn-secondary rounded-xl px-3 py-2 text-sm font-semibold">Abbrechen</button>
            </div>
            {aiNotice ? <p className={`mt-4 rounded-xl p-3 text-sm ${aiNotice.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{aiNotice.text}</p> : null}
            <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={generateAiVariants}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">Zielgruppe</span>
                <input value={aiForm.targetAudience} onChange={(event) => setAiForm((current) => ({ ...current, targetAudience: event.target.value }))} placeholder="Speditionen und Logistikunternehmen" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">Angebot</span>
                <input value={aiForm.offer} onChange={(event) => setAiForm((current) => ({ ...current, offer: event.target.value }))} placeholder="z. B. automatisierte Lead-Qualifizierung" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">Tonalität</span>
                <input value={aiForm.tone} onChange={(event) => setAiForm((current) => ({ ...current, tone: event.target.value }))} placeholder="direkt, sachlich, nicht werblich" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">Du-Form / Sie-Form</span>
                <select value={aiForm.addressForm} onChange={(event) => setAiForm((current) => ({ ...current, addressForm: event.target.value as AiEmailForm["addressForm"] }))}>
                  <option value="sie">Sie-Form</option>
                  <option value="du">Du-Form</option>
                </select>
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-600">Ziel der E-Mail</span>
                <input required value={aiForm.goal} onChange={(event) => setAiForm((current) => ({ ...current, goal: event.target.value }))} placeholder="z. B. kurzen Ersttermin anstoßen" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">Länge</span>
                <select value={aiForm.length} onChange={(event) => setAiForm((current) => ({ ...current, length: event.target.value as AiEmailForm["length"] }))}>
                  <option value="kurz">kurz</option>
                  <option value="mittel">mittel</option>
                  <option value="ausführlich">ausführlich</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">Anzahl Varianten</span>
                <input type="number" min={1} max={5} value={aiForm.variantCount} onChange={(event) => setAiForm((current) => ({ ...current, variantCount: Number(event.target.value) }))} />
              </label>
              <div className="md:col-span-2">
                <button disabled={aiBusy} className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold">
                  {aiBusy ? "Generiert..." : "Generieren"}
                </button>
              </div>
            </form>
            {aiVariants.length > 0 ? (
              <div className="mt-6 grid gap-4">
                {aiVariants.map((variant, index) => (
                  <article key={`${variant.label}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-ink">{variant.label}</p>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium text-slate-600">Betreff</span>
                      <input value={variant.subject} onChange={(event) => updateAiVariant(index, { subject: event.target.value })} />
                    </label>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium text-slate-600">Text</span>
                      <textarea rows={7} value={variant.bodyText} onChange={(event) => updateAiVariant(index, { bodyText: event.target.value })} />
                    </label>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" disabled={aiBusy} onClick={() => applyAiVariant(variant)} className="btn-secondary rounded-xl px-3 py-2 text-xs font-semibold">Ins Formular übernehmen</button>
                      <button type="button" disabled={aiBusy} onClick={() => saveAiVariant(variant)} className="btn-primary rounded-xl px-3 py-2 text-xs font-semibold">Als Vorlage speichern</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
