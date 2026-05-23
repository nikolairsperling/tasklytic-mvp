import type { CallingSettingsPayload } from "@/lib/app-settings";

export function normalizePhoneNumber(value: string | null | undefined, defaultCountryDialCode = "+49") {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let normalized = trimmed.replace(/[^\d+]/g, "");
  if (!normalized) return null;

  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (normalized.startsWith("+")) {
    return normalized.replace(/(?!^)\+/g, "");
  }

  const dialCode = defaultCountryDialCode.startsWith("+")
    ? defaultCountryDialCode
    : `+${defaultCountryDialCode}`;
  const subscriber = normalized.replace(/^0+/, "");
  return `${dialCode}${subscriber}`;
}

export function buildTelHref(phone: string | null | undefined, settings?: Pick<CallingSettingsPayload, "defaultCountryDialCode"> | null) {
  const normalized = normalizePhoneNumber(phone, settings?.defaultCountryDialCode ?? "+49");
  return normalized ? `tel:${normalized}` : null;
}
