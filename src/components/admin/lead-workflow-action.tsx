"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type WorkflowAction = "enrich" | "landingpages" | "emails" | "send";

type ActionResult = {
  processed?: number;
  enriched?: number;
  invalid?: number;
  created?: number;
  generated?: number;
  sent?: number;
  skipped?: number;
  error?: string;
};

const labels: Record<WorkflowAction, { idle: string; loading: string }> = {
  enrich: { idle: "Leads anreichern", loading: "Leads werden angereichert..." },
  landingpages: { idle: "Landingpages erzeugen", loading: "Landingpages werden erzeugt..." },
  emails: { idle: "E-Mails generieren", loading: "E-Mails werden generiert..." },
  send: { idle: "Versand starten", loading: "Versand wird vorbereitet..." }
};

export function LeadWorkflowAction({ action, endpoint }: { action: WorkflowAction; endpoint: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function runAction() {
    setIsPending(true);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = (await response.json().catch(() => ({}))) as ActionResult;

      if (!response.ok) {
        throw new Error(data.error ?? "Aktion fehlgeschlagen.");
      }

      setMessage({ type: "success", text: formatResult(action, data) });
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Aktion fehlgeschlagen."
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={runAction}
        disabled={isPending}
        className="btn-primary rounded-full px-4 py-2 text-sm font-semibold shadow-sm"
      >
        {isPending ? labels[action].loading : labels[action].idle}
      </button>
      {message ? (
        <p className={`mt-3 text-sm ${message.type === "success" ? "text-emerald-700" : "text-red-700"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

function formatResult(action: WorkflowAction, data: ActionResult) {
  if (action === "enrich") {
    return `${data.processed ?? 0} Leads verarbeitet, ${data.enriched ?? 0} angereichert, ${data.invalid ?? 0} aussortiert.`;
  }

  if (action === "landingpages") {
    return `${data.created ?? data.processed ?? 0} Landingpages erzeugt.`;
  }

  if (action === "emails") {
    return `${data.generated ?? data.processed ?? 0} E-Mails generiert.`;
  }

  return `${data.sent ?? 0} E-Mails versendet, ${data.skipped ?? 0} übersprungen.`;
}
