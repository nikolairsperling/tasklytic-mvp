"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AdminBackButton({
  href,
  label = "Zurück",
  showLabel = true
}: {
  href: string;
  label?: string;
  showLabel?: boolean;
}) {
  const router = useRouter();

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(href);
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-label={label}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {showLabel ? <span>{label}</span> : null}
    </Link>
  );
}
