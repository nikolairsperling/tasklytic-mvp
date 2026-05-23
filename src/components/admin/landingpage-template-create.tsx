"use client";

import { useTransition } from "react";

export function LandingpageTemplateCreate() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch("/api/landingpage-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Neue Landingpage Vorlage" })
          });
          const template = await response.json();
          window.location.href = `/admin/landingpages/templates/${template.id}/builder`;
        });
      }}
      className="btn-primary rounded-xl px-4 py-2.5 text-sm font-medium"
    >
      + Neue Vorlage
    </button>
  );
}
