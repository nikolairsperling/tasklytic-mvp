import Link from "next/link";
import React, { type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  backButton
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  backButton?: ReactNode;
}) {
  return (
    <div className="lead-detail-header mb-6 flex w-full min-w-0 max-w-full flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0 max-w-full">
        {backButton ? <div className="mb-3">{backButton}</div> : null}
        <h2 className="break-words text-2xl font-semibold text-ink md:text-3xl">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl break-words text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="lead-actions page-header-actions">{action}</div> : null}
    </div>
  );
}

export function AdminCard({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`w-full min-w-0 max-w-full break-words rounded-2xl border border-slate-200 bg-white p-4 shadow-panel sm:p-6 ${className}`}>{children}</section>;
}

export function StatCard({
  label,
  value,
  helper,
  tone = "neutral",
  href
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "neutral" | "green" | "red" | "brand";
  href?: string;
}) {
  const toneClass = {
    neutral: "bg-slate-50 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    brand: "bg-accent/60 text-brand"
  }[tone];

  const content = (
      <div>
        <div className="flex min-h-[112px] flex-col justify-between gap-4">
          <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
          {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
          </div>
          {href ? (
            <span className={`inline-flex min-h-8 w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
              Ansehen <span aria-hidden="true">→</span>
            </span>
          ) : null}
        </div>
      </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block min-h-11 rounded-2xl outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label={`${label} ansehen`}
      >
        <AdminCard className="h-full cursor-pointer transition group-hover:-translate-y-0.5 group-hover:shadow-xl group-active:translate-y-0">
          {content}
        </AdminCard>
      </Link>
    );
  }

  return (
    <AdminCard>
      {content}
    </AdminCard>
  );
}

export function StatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "brand";
}) {
  const toneClass = {
    neutral: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    brand: "bg-accent/60 text-brand"
  }[tone];

  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  type = "button",
  disabled,
  onClick
}: {
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="btn-primary inline-flex min-h-11 max-w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium leading-tight shadow-sm"
    >
      {children}
    </button>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="btn-secondary inline-flex min-h-11 max-w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium leading-tight"
    >
      {children}
    </a>
  );
}

export const AdminPageHeader = PageHeader;
export const MetricCard = StatCard;

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="w-full min-w-0 max-w-full rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
      <h3 className="break-words text-lg font-semibold text-ink">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-xl break-words text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ActionButton({ children, onClick, type = "button" }: { children: ReactNode; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} className="btn-primary inline-flex min-h-11 max-w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold leading-tight">
      {children}
    </button>
  );
}

export function DataTable({ children }: { children: ReactNode }) {
  return <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border border-white/10 [-webkit-overflow-scrolling:touch]">{children}</div>;
}

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return (
    <div className="admin-tab-scroll">
      {tabs.map((tab) => (
        <button key={tab} type="button" onClick={() => onChange(tab)} className={`min-h-10 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${active === tab ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          {tab}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex w-full min-w-0 max-w-full flex-wrap gap-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">{children}</div>;
}

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}
