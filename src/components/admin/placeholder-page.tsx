import React from "react";
import Link from "next/link";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { AdminCard, EmptyState, PageHeader } from "@/components/admin/ui";

export function PlaceholderPage({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  backHref
}: {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  backHref?: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} backButton={backHref ? <AdminBackButton href={backHref} /> : undefined} />
      <AdminCard>
        <EmptyState
          title={`${title} ist vorbereitet`}
          description={description}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              {primaryHref ? <Link href={primaryHref} className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold">{primaryLabel}</Link> : null}
              {secondaryHref ? <Link href={secondaryHref} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200">{secondaryLabel}</Link> : null}
            </div>
          }
        />
      </AdminCard>
    </div>
  );
}
