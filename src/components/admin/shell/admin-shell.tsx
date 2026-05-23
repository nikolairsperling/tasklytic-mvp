"use client";

import Link from "next/link";
import { Folder, LayoutDashboard, Mail, Send, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { Component, useEffect, useState } from "react";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/components/app-version-client";
import { Sidebar } from "@/components/admin/shell/sidebar";
import { Topbar } from "@/components/admin/shell/topbar";
import { FetchDiagnostics } from "@/components/admin/system/fetch-diagnostics";
import type { DesignSettingsPayload, ThemeMode } from "@/lib/app-settings";
import { applyThemeToDocument, getSystemTheme, isThemeMode, readStoredTheme, resolveEffectiveTheme, storeThemeMode } from "@/lib/admin-theme";
import { fontStack } from "@/lib/fonts";

const bottomItems = [
  { href: "/admin/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/admin/campaigns", label: "Kampagnen", icon: Send },
  { href: "/admin/inbox", label: "Inbox", icon: Mail },
  { href: "/admin/prospects", label: "Leads", icon: Users },
  { href: "/admin/assets", label: "Assets", icon: Folder }
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminShellBoundary>
      <AdminShellContent>{children}</AdminShellContent>
    </AdminShellBoundary>
  );
}

class AdminShellBoundary extends Component<{ children: ReactNode }, { hasError: boolean; chunkError: boolean }> {
  state = { hasError: false, chunkError: false };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, chunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: unknown) {
    console.error("[admin-shell]", error);
  }

  render() {
    if (this.state.hasError) {
      return this.state.chunkError ? <AdminShellChunkFallback /> : <AdminShellFallback />;
    }
    return this.props.children;
  }
}

function AdminShellChunkFallback() {
  useEffect(() => {
    void recoverFromChunkLoadError();
  }, []);

  return (
    <div className="admin-theme admin-light flex h-screen w-full max-w-full flex-col overflow-hidden bg-slate-50 font-sans text-slate-900">
      <main className="admin-main flex w-full min-w-0 max-w-full flex-1 items-center justify-center overflow-y-auto overflow-x-hidden px-4 py-6">
        <section className="w-full max-w-md rounded-2xl bg-white p-5 text-center shadow-panel sm:p-6">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <h2 className="mt-5 text-lg font-semibold text-ink">Tasklytic wird aktualisiert...</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Komponenten werden neu geladen.</p>
          <button type="button" onClick={() => void recoverFromChunkLoadError()} className="btn-primary mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold">
            Jetzt aktualisieren
          </button>
        </section>
      </main>
    </div>
  );
}

function AdminShellFallback() {
  return (
    <div className="admin-theme admin-light flex h-screen w-full max-w-full flex-col overflow-hidden bg-slate-50 font-sans text-slate-900">
      <header className="admin-header admin-topbar sticky top-0 z-[100] w-full max-w-full border-b px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur md:py-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-sm font-semibold text-white">T</span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Tasklytic Admin</p>
            <h1 className="truncate text-xl font-semibold text-ink md:text-2xl">Bereich nicht geladen</h1>
          </div>
        </div>
      </header>
      <main className="admin-main flex w-full min-w-0 max-w-full flex-1 items-center justify-center overflow-y-auto overflow-x-hidden px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-6 sm:px-5 md:pb-8 lg:px-8">
        <section className="w-full max-w-md rounded-2xl bg-white p-5 text-center shadow-panel sm:p-6">
          <h2 className="text-lg font-semibold text-ink">Dieser Bereich konnte nicht geladen werden.</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold">
              Neu laden
            </button>
            <Link href="/admin/dashboard" className="btn-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold">
              Zur Übersicht
            </Link>
          </div>
        </section>
      </main>
      <nav className="mobile-bottom-nav admin-bottom-nav fixed inset-x-0 bottom-0 z-[100] grid h-[calc(76px+env(safe-area-inset-bottom))] grid-cols-5 gap-1 border-t p-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[10px] font-medium leading-tight text-slate-300 hover:bg-gray-100 hover:text-gray-700">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function AdminShellContent({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme() ?? "system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemTheme());
  const [designSettings, setDesignSettings] = useState<DesignSettingsPayload | null>(null);
  const pathname = usePathname();
  const isBuilderRoute = pathname.includes("/admin/landingpages/builder") || pathname.includes("/admin/landingpages/templates/") && pathname.includes("/builder");
  const effectiveTheme = resolveEffectiveTheme(themeMode, systemTheme);

  useEffect(() => {
    applyThemeToDocument(effectiveTheme, themeMode);
  }, [effectiveTheme, themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/app")
      .then((response) => response.json())
      .then((data: Partial<DesignSettingsPayload>) => {
        if (active && isThemeMode(data.themeMode)) {
          setThemeMode(readStoredTheme() ?? data.themeMode ?? "system");
          setDesignSettings(data as DesignSettingsPayload);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleDesignUpdate(event: Event) {
      const data = (event as CustomEvent<DesignSettingsPayload>).detail;
      if (isThemeMode(data?.themeMode)) {
        setThemeMode(data.themeMode);
        storeThemeMode(data.themeMode);
        setDesignSettings(data);
      }
    }

    window.addEventListener("tasklytic-design-settings-updated", handleDesignUpdate);
    return () => window.removeEventListener("tasklytic-design-settings-updated", handleDesignUpdate);
  }, []);

  function toggleTheme() {
    const nextTheme: ThemeMode = effectiveTheme === "dark" ? "light" : "dark";
    applyThemeToDocument(nextTheme, nextTheme);
    setThemeMode(nextTheme);
    storeThemeMode(nextTheme);
    fetch("/api/settings/app", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeMode: nextTheme })
    }).catch(() => undefined);
  }

  return (
    <div className={`admin-theme admin-${effectiveTheme} h-screen w-full max-w-full overflow-hidden`} style={buildAdminStyle(designSettings)}>
      <FetchDiagnostics />
      {isBuilderRoute ? null : <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} appName={designSettings?.appName} logoUrl={designSettings?.logoUrl ?? designSettings?.iconUrl} />}
      <div className={`flex h-screen min-w-0 max-w-full flex-col ${isBuilderRoute ? "" : "md:pl-64"}`}>
        {isBuilderRoute ? null : <Topbar pathname={pathname} themeMode={effectiveTheme} onThemeToggle={toggleTheme} onMenuClick={() => setSidebarOpen(true)} appName={designSettings?.appName} logoUrl={designSettings?.logoUrl ?? designSettings?.iconUrl} />}
        <main className={isBuilderRoute ? "w-full min-w-0 max-w-full flex-1 overflow-hidden" : "admin-main w-full min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 sm:px-5 md:pb-8 md:pt-5 lg:px-8"}>{children}</main>
      </div>
      {isBuilderRoute ? null : <nav className="mobile-bottom-nav admin-bottom-nav fixed inset-x-0 bottom-0 z-[100] grid h-[calc(76px+env(safe-area-inset-bottom))] grid-cols-5 gap-1 border-t p-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {bottomItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || item.href === "/admin/dashboard" && pathname === "/admin";
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[10px] font-medium leading-tight ${
                active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>}
    </div>
  );
}

function buildAdminStyle(settings: DesignSettingsPayload | null): CSSProperties | undefined {
  if (!settings) return undefined;
  return {
    "--admin-brand": settings.primaryColor,
    "--admin-accent": settings.accentColor,
    "--admin-button-radius": `${settings.buttonRadius}px`,
    "--admin-card-radius": `${settings.cardRadius}px`,
    "--admin-font-family": fontStack(settings.selectedFont ?? settings.fontFamily)
  } as CSSProperties;
}
