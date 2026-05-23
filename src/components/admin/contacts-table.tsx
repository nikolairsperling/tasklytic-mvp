"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LandingpagePreviewActions } from "@/components/admin/landingpage-preview-actions";
import { StatusBadge } from "@/components/admin/ui";

export type ContactRow = {
  id: string;
  companyName: string;
  decisionMakerName: string | null;
  decisionMakerRole: string | null;
  decisionMakerEmail: string | null;
  city: string;
  status: string;
  slug: string | null;
  campaignStatus: string;
  canAddToCampaign: boolean;
  enriched: boolean;
  missingData: boolean;
};

export type ContactCampaignOption = {
  id: string;
  name: string;
};

export function ContactsTable({
  contacts,
  campaigns,
  appUrl
}: {
  contacts: ContactRow[];
  campaigns: ContactCampaignOption[];
  appUrl?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function addToCampaign(prospectId: string, campaignId: string) {
    const response = await fetch(`/api/campaigns/${campaignId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectIds: [prospectId] })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Prospect konnte nicht hinzugefügt werden.");
    }

    setMessage("Prospect wurde zur Kampagne hinzugefügt.");
    window.location.reload();
  }

  async function enrich(prospectId: string) {
    const response = await fetch(`/api/prospects/${prospectId}/enrich`, { method: "POST" });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Anreicherung fehlgeschlagen.");
    }
    setMessage("Anreicherung wurde ausgeführt. Vorschläge findest du im Prospect.");
    window.location.reload();
  }

  return (
    <div>
      {message ? (
        <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}
      <div className="space-y-3 md:hidden">
        {contacts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Keine Kontakte für diesen Filter.</div>
        ) : contacts.map((contact) => (
          <article key={contact.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-ink">{contact.companyName}</h2>
              <p className="mt-1 truncate text-sm text-slate-500">{contact.decisionMakerName ?? "k. A."}{contact.decisionMakerRole ? ` · ${contact.decisionMakerRole}` : ""}</p>
              <p className="mt-1 break-words text-sm text-slate-500">{contact.decisionMakerEmail ?? "k. A."}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge tone={contact.status === "contacted" ? "green" : "neutral"}>{contact.status}</StatusBadge>
              <StatusBadge tone={contact.campaignStatus === "nicht hinzugefügt" ? "neutral" : "brand"}>{contact.campaignStatus}</StatusBadge>
              <StatusBadge tone={contact.enriched ? "green" : contact.missingData ? "amber" : "neutral"}>
                {contact.enriched ? "angereichert" : contact.missingData ? "Daten fehlen" : "Basisdaten"}
              </StatusBadge>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Link href={`/admin/prospects?prospectId=${contact.id}`} className="rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700">
                Prospect öffnen
              </Link>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                disabled={isPending}
                onClick={() => startTransition(async () => {
                  try {
                    await enrich(contact.id);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Anreicherung fehlgeschlagen.");
                  }
                })}
              >
                anreichern
              </button>
              {contact.canAddToCampaign && campaigns.length > 0 ? (
                <select
                  className="w-full rounded-xl py-2 text-sm"
                  disabled={isPending}
                  defaultValue=""
                  onChange={(event) => {
                    const campaignId = event.target.value;
                    if (!campaignId) return;
                    startTransition(async () => {
                      try {
                        await addToCampaign(contact.id, campaignId);
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "Aktion fehlgeschlagen");
                      }
                    });
                  }}
                >
                  <option value="">zu Kampagne...</option>
                  {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                </select>
              ) : null}
              <LandingpagePreviewActions prospectId={contact.id} slug={contact.slug} appUrl={appUrl} />
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-slate-400">
            <tr>
              <th className="py-3">Firma</th>
              <th className="py-3">Ansprechpartner</th>
              <th className="py-3">Rolle</th>
              <th className="py-3">E-Mail</th>
              <th className="py-3">Stadt</th>
              <th className="py-3">Status</th>
              <th className="py-3">Landingpage</th>
              <th className="py-3">Kampagnenstatus</th>
              <th className="py-3">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-5 text-slate-500">
                  Keine Kontakte für diesen Filter.
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} className="align-top">
                  <td className="py-3 font-medium text-ink">{contact.companyName}</td>
                  <td className="py-3">{contact.decisionMakerName ?? "k. A."}</td>
                  <td className="py-3 text-slate-600">{contact.decisionMakerRole ?? "k. A."}</td>
                  <td className="py-3 text-slate-600">{contact.decisionMakerEmail ?? "k. A."}</td>
                  <td className="py-3">{contact.city}</td>
                  <td className="py-3">
                    <StatusBadge tone={contact.status === "contacted" ? "green" : "neutral"}>
                      {contact.status}
                    </StatusBadge>
                  </td>
                  <td className="py-3">
                    <LandingpagePreviewActions prospectId={contact.id} slug={contact.slug} appUrl={appUrl} />
                  </td>
                  <td className="py-3">
                    <StatusBadge tone={contact.campaignStatus === "nicht hinzugefügt" ? "neutral" : "brand"}>
                      {contact.campaignStatus}
                    </StatusBadge>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/prospects?prospectId=${contact.id}`}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        Prospect öffnen
                      </Link>
                      <StatusBadge tone={contact.enriched ? "green" : contact.missingData ? "amber" : "neutral"}>
                        {contact.enriched ? "angereichert" : contact.missingData ? "Daten fehlen" : "Basisdaten"}
                      </StatusBadge>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                        disabled={isPending}
                        onClick={() => startTransition(async () => {
                          try {
                            await enrich(contact.id);
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "Anreicherung fehlgeschlagen.");
                          }
                        })}
                      >
                        anreichern
                      </button>
                      {contact.canAddToCampaign && campaigns.length > 0 ? (
                        <select
                          className="w-44 rounded-xl py-2 text-xs"
                          disabled={isPending}
                          defaultValue=""
                          onChange={(event) => {
                            const campaignId = event.target.value;
                            if (!campaignId) {
                              return;
                            }
                            startTransition(async () => {
                              try {
                                await addToCampaign(contact.id, campaignId);
                              } catch (error) {
                                setMessage(error instanceof Error ? error.message : "Aktion fehlgeschlagen");
                              }
                            });
                          }}
                        >
                          <option value="">zu Kampagne...</option>
                          {campaigns.map((campaign) => (
                            <option key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
