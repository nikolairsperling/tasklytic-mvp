"use client";

import {
  BarChart3,
  Folder,
  GitBranch,
  Globe,
  LayoutDashboard,
  Mail,
  CalendarClock,
  Search,
  Send,
  Sparkles,
  Settings,
  Upload,
  Users,
  X,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { adminNavGroups, type AdminNavItem } from "@/lib/admin-navigation";

export const NAV_ICONS: Record<AdminNavItem["key"], LucideIcon> = {
  overview: LayoutDashboard,
  leads: Users,
  leadLists: Folder,
  leadScout: Search,
  import: Upload,
  prospects: Users,
  targetGroups: Users,
  workflow: GitBranch,
  impact: Sparkles,
  landingpages: Globe,
  campaigns: Send,
  inbox: Mail,
  analytics: BarChart3,
  setup: LayoutDashboard,
  followUps: CalendarClock,
  offer: Sparkles,
  hotLeads: Search,
  contacts: Users,
  exclusions: Search,
  deletions: Search,
  assets: Folder,
  settings: Settings
};

export function Sidebar({
  open,
  onClose,
  appName = "Tasklytic",
  logoUrl
}: {
  open: boolean;
  onClose: () => void;
  appName?: string;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const drawerScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      drawerScrollRef.current?.scrollTo({ top: 0 });
    }
  }, [open]);

  return (
    <>
      <div
        className={`drawer-overlay md:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside
        className={`drawer-panel admin-sidebar border-r shadow-2xl transition-transform md:z-20 md:h-screen md:max-h-screen md:w-64 md:max-w-none md:translate-x-0 md:px-3 md:pt-5 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="drawer-header">
          <Link href="/admin" className="drawer-brand flex min-w-0 flex-1 items-center gap-3 text-inherit" onClick={onClose}>
            {logoUrl ? <img src={logoUrl} alt="" className="drawer-logo h-10 w-10 shrink-0 rounded-xl object-contain" /> : <span className="drawer-logo-fallback grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-sm font-semibold text-white">
              T
            </span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{appName}</span>
              <span className="block text-xs text-slate-400">Outreach</span>
            </span>
          </Link>
          <button
            type="button"
            className="btn-secondary grid h-10 w-10 shrink-0 place-items-center rounded-xl md:hidden"
            aria-label="Navigation schliessen"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div ref={drawerScrollRef} className="drawer-scroll">
          <nav className="space-y-5">
            {adminNavGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {group.label}
                </p>
                <div className="mt-2 space-y-1">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = NAV_ICONS[item.key];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        title={item.label}
                        aria-label={item.label}
                        className={`group flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          active
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-500 hover:bg-gray-100 hover:text-gray-700"
                        }`}
                      >
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-white/20 text-white" : "bg-white/10 text-slate-400 group-hover:text-gray-700"}`}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="block min-w-0 flex-1 truncate text-left text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
