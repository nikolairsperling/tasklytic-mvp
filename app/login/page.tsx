import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { adminExists, getSessionFromCookies } from "@/lib/auth";
import { readDesignSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const hasAdmin = await adminExists();
  if (await getSessionFromCookies()) redirect("/admin");
  const settings = await readDesignSettings();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-6 sm:py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          {settings.iconUrl || settings.logoUrl ? (
            <img src={settings.iconUrl || settings.logoUrl || ""} alt="Tasklytic" className="h-12 w-12 rounded-full object-contain ring-1 ring-slate-200" />
          ) : (
            <span aria-label="Tasklytic Logo" className="grid h-12 w-12 place-items-center rounded-full bg-slate-950 text-lg font-bold text-white">T</span>
          )}
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Tasklytic</h1>
            <p className="text-sm text-slate-500">Admin Login</p>
          </div>
        </div>
        {!hasAdmin ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Noch kein Admin angelegt</p>
            <Link href="/setup/admin" className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-4 font-semibold text-white">
              Ersten Admin erstellen
            </Link>
          </div>
        ) : null}
        <AuthForm mode="login" />
        {!hasAdmin ? (
          <Link href="/setup/admin" className="mt-4 inline-flex w-full items-center justify-center text-sm font-semibold text-slate-700">
            Ersten Admin erstellen
          </Link>
        ) : null}
      </div>
    </main>
  );
}
