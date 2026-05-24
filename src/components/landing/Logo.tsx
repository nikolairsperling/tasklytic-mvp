import { existsSync } from "node:fs";
import path from "node:path";
import { defaultPublicLogoPath, landingBrandName, landingClassNames } from "@/styles/landing-design";

type LogoProps = {
  type?: "image" | "text";
  src?: string | null;
  alt?: string | null;
  width?: string | number | null;
  height?: string | number | null;
  href?: string | null;
  text?: string | null;
  className?: string;
  fallbackToPublicLogo?: boolean;
};

let publicLogoAvailable: boolean | null = null;

export function Logo({
  type,
  src,
  alt,
  width,
  height,
  href,
  text = landingBrandName,
  className,
  fallbackToPublicLogo = true
}: LogoProps) {
  const logoSrc = type === "text" ? null : resolveLogoSrc(src, fallbackToPublicLogo);
  const content = logoSrc ? (
    <img
      src={logoSrc}
      alt={alt || text || landingBrandName}
      loading="eager"
      decoding="async"
      className="h-auto max-h-9 w-auto max-w-[168px] object-contain sm:max-w-[210px]"
      style={{ width: normalizedSize(width), height: normalizedSize(height) }}
    />
  ) : (
    <span className="text-base font-extrabold tracking-normal text-slate-950 sm:text-lg">
      {text || landingBrandName}
    </span>
  );

  const classes = landingClassNames("inline-flex min-w-0 items-center", className);
  if (href) {
    return (
      <a href={href} className={classes} aria-label={alt || text || landingBrandName}>
        {content}
      </a>
    );
  }

  return <div className={classes}>{content}</div>;
}

export function resolveLogoSrc(src?: string | null, fallbackToPublicLogo = true) {
  const explicit = src?.trim();
  if (explicit) return explicit;
  if (!fallbackToPublicLogo) return null;
  if (hasPublicLogo()) return defaultPublicLogoPath;
  return null;
}

function hasPublicLogo() {
  if (publicLogoAvailable !== null) return publicLogoAvailable;
  try {
    publicLogoAvailable = existsSync(path.join(process.cwd(), "public", "logo.png"));
  } catch {
    publicLogoAvailable = false;
  }
  return publicLogoAvailable;
}

function normalizedSize(value: string | number | null | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value}px` : value;
}
