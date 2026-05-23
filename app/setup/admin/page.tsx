import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { adminExists } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupAdminPage() {
  const hasAdmin = await adminExists();
  return (
    <main className="flex min-h-screen flex-col justify-start bg-slate-100">
      <div className="mx-auto w-full max-w-md px-4 py-6 pb-10">
        <div className="rounded-lg bg-white p-5 shadow-xl sm:p-6">
          <div className="mb-5">
            <span aria-label="Tasklytic Logo" className="grid h-12 w-12 place-items-center rounded-full bg-slate-950 text-lg font-bold text-white">T</span>
            <h1 className="mt-4 text-xl font-semibold text-slate-950">{hasAdmin ? "Admin wurde bereits eingerichtet" : "Ersten Admin anlegen"}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {hasAdmin ? "Die Ersteinrichtung ist gesperrt, weil bereits ein AdminUser existiert." : "Dieses Setup ist nur verfügbar, solange kein AdminUser existiert."}
            </p>
          </div>
          {hasAdmin ? (
            <Link href="/login" className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">
              Zu /login
            </Link>
          ) : (
            <AuthForm mode="setup" />
          )}
        </div>
      </div>
    </main>
  );
}
