"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

type ReportDownloadButtonProps = {
  landingpageId: string;
  slug: string;
  initialReportUrl?: string | null;
  readyText: string;
  missingText: string;
  className?: string;
  style?: CSSProperties;
};

export function ReportDownloadButton({
  landingpageId,
  slug,
  initialReportUrl,
  readyText,
  missingText,
  className,
  style
}: ReportDownloadButtonProps) {
  const [reportUrl, setReportUrl] = useState(initialReportUrl ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (reportUrl) {
      void trackReportEvent(slug, "report_downloaded", reportUrl);
      window.open(reportUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setIsGenerating(true);
    setError("");
    try {
      const response = await fetch(`/api/landingpages/${encodeURIComponent(landingpageId)}/generate-report`, {
        method: "POST"
      });
      const body = await response.json().catch(() => null) as { reportUrl?: string; error?: string } | null;
      if (!response.ok || !body?.reportUrl) {
        throw new Error(body?.error ?? "Report konnte nicht generiert werden.");
      }
      setReportUrl(body.reportUrl);
      void trackReportEvent(slug, "report_opened", body.reportUrl);
      window.open(body.reportUrl, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report konnte nicht generiert werden.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="max-w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={isGenerating}
        className={className}
        style={style}
      >
        {isGenerating ? "PDF wird erstellt..." : reportUrl ? readyText : missingText}
      </button>
      {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

async function trackReportEvent(slug: string, type: "report_opened" | "report_downloaded", reportUrl: string) {
  if (!slug) return;
  if (typeof window !== "undefined" && window.localStorage.getItem("tasklytic-cookie-consent") !== "accepted") return;
  try {
    await fetch("/api/events/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, type, meta: { reportUrl } }),
      keepalive: true
    });
  } catch {
    // Report access must not depend on tracking.
  }
}
