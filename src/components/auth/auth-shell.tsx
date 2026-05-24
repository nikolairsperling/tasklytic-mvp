import Link from "next/link";
import type { ReactNode } from "react";
import { resolveLogoSrc } from "@/components/landing/Logo";

type AuthShellProps = {
  appName?: string | null;
  logoUrl?: string | null;
  iconUrl?: string | null;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

type AuthNoticeProps = {
  tone?: "warning" | "info" | "success";
  title: string;
  children?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
};

export function AuthShell({
  appName = "Tasklytic",
  logoUrl,
  iconUrl,
  eyebrow,
  title,
  description,
  children
}: AuthShellProps) {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-card" aria-labelledby="auth-page-title">
          <AuthLogo appName={appName} logoUrl={logoUrl} iconUrl={iconUrl} />
          <div className="auth-heading">
            {eyebrow ? <p className="auth-eyebrow">{eyebrow}</p> : null}
            <h1 id="auth-page-title">{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

export function AuthNotice({
  tone = "info",
  title,
  children,
  actionHref,
  actionLabel
}: AuthNoticeProps) {
  return (
    <div className={`auth-notice auth-notice-${tone}`}>
      <span className="auth-notice-icon" aria-hidden="true" />
      <div className="auth-notice-content">
        <p className="auth-notice-title">{title}</p>
        {children ? <div className="auth-notice-body">{children}</div> : null}
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="auth-secondary-button">
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function AuthLogo({
  appName,
  logoUrl,
  iconUrl
}: {
  appName?: string | null;
  logoUrl?: string | null;
  iconUrl?: string | null;
}) {
  const brandName = appName?.trim() || "Tasklytic";
  const resolvedLogo = resolveLogoSrc(logoUrl || iconUrl);

  return (
    <div className="auth-brand" aria-label={brandName}>
      {resolvedLogo ? (
        <img src={resolvedLogo} alt={brandName} className="auth-brand-image" />
      ) : (
        <span className="auth-brand-wordmark">{brandName}</span>
      )}
    </div>
  );
}
