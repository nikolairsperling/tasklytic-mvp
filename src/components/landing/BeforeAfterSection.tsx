import { CheckCircle2, XCircle } from "lucide-react";
import type { RenderedLandingpageSection } from "@/lib/landingpage-templates";
import { elementStyleByField } from "@/lib/landingpage-style";
import { landingDesignTokens } from "@/styles/landing-design";

type BeforeAfterSectionProps = {
  section: RenderedLandingpageSection;
};

export function BeforeAfterSection({ section }: BeforeAfterSectionProps) {
  const settings = section.settings;
  const beforeItems = settings.leftItems ?? settings.beforeItems ?? [];
  const afterItems = settings.rightItems ?? settings.afterItems ?? [];
  const headlineStyle = elementStyleByField(section, "headline", "desktop", { textColor: landingDesignTokens.colors.ink, fontFamily: settings.fontFamily, fontWeight: 800, lineHeight: 1.15 });
  const subheadlineStyle = elementStyleByField(section, "subheadline", "desktop", { textColor: landingDesignTokens.colors.muted, fontFamily: settings.fontFamily, lineHeight: 1.6 });

  return (
    <div className="mx-auto" style={{ maxWidth: landingDesignTokens.layout.maxWidth }}>
      <div className="max-w-3xl">
        <h2 className="break-words text-3xl font-extrabold leading-tight text-slate-950 sm:text-4xl" style={headlineStyle}>
          {settings.headline || "Vorher und nachher"}
        </h2>
        {settings.subheadline ? (
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg" style={subheadlineStyle}>
            {settings.subheadline}
          </p>
        ) : null}
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        <CompareCard title={settings.leftTitle || "Vorher"} items={beforeItems} tone="before" />
        <CompareCard title={settings.rightTitle || "Nachher"} items={afterItems} tone="after" />
      </div>
    </div>
  );
}

function CompareCard({ title, items, tone }: { title: string; items: string[]; tone: "before" | "after" }) {
  const safeItems = Array.isArray(items) ? items : [];
  const isAfter = tone === "after";

  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-6">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${isAfter ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
          aria-hidden="true"
        >
          {isAfter ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        </span>
        <h3 className="min-w-0 text-lg font-extrabold text-slate-950">{title}</h3>
      </div>

      <ul className="mt-5 space-y-3">
        {safeItems.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-600 sm:text-[15px]">
            <span
              className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full ${isAfter ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              aria-hidden="true"
            >
              {isAfter ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
