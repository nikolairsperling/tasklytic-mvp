"use client";

import type { ThemeMode } from "@/lib/app-settings";

export const adminThemeStorageKey = "tasklytic-theme";
export type EffectiveTheme = "light" | "dark";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(adminThemeStorageKey);
  return isThemeMode(value) ? value : null;
}

export function getSystemTheme(): EffectiveTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveEffectiveTheme(themeMode: ThemeMode, systemTheme: EffectiveTheme): EffectiveTheme {
  return themeMode === "system" ? systemTheme : themeMode;
}

export function storeThemeMode(themeMode: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(adminThemeStorageKey, themeMode);
}

export function applyThemeToDocument(effectiveTheme: EffectiveTheme, themeMode: ThemeMode) {
  if (typeof document === "undefined") return;
  const target = document.documentElement;
  target.dataset.theme = effectiveTheme;
  target.dataset.themeMode = themeMode;
  target.classList.remove("admin-light", "admin-dark", "theme-light", "theme-dark", "dark");
  target.classList.add("admin-theme", `admin-${effectiveTheme}`, `theme-${effectiveTheme}`);
}

export function clearThemeFromDocument() {
  if (typeof document === "undefined") return;
  const target = document.documentElement;
  delete target.dataset.theme;
  delete target.dataset.themeMode;
  target.classList.remove("admin-theme", "admin-light", "admin-dark", "theme-light", "theme-dark", "dark");
}
