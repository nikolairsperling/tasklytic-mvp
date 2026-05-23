import type { DesignSettingsPayload } from "@/lib/app-settings";

export type AdminFont = NonNullable<DesignSettingsPayload["selectedFont"]>;

export function fontCssVariable(font: AdminFont | DesignSettingsPayload["fontFamily"] | undefined) {
  if (font === "Lato") return "var(--font-secondary)";
  if (font === "Poppins") return "var(--font-display)";
  if (font === "Serif") return "Georgia, serif";
  if (font === "Mono") return "ui-monospace, SFMono-Regular, Menlo, monospace";
  if (font === "System") return "system-ui, sans-serif";
  return "var(--font-primary)";
}

export function fontStack(font: AdminFont | DesignSettingsPayload["fontFamily"] | undefined) {
  return `${fontCssVariable(font)}, system-ui, sans-serif`;
}
