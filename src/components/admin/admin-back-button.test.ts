import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminBackButton } from "@/components/admin/admin-back-button";
import { PageHeader } from "@/components/admin/ui";
import { PlaceholderPage } from "@/components/admin/placeholder-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

describe("AdminBackButton", () => {
  it("renders with the configured fallback href", () => {
    const html = renderToStaticMarkup(React.createElement(AdminBackButton, { href: "/admin/settings" }));

    expect(html).toContain('href="/admin/settings"');
    expect(html).toContain("Zurück");
  });

  it("renders inside page headers for subpages", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageHeader, {
        title: "SMTP Einstellungen",
        description: "Konfiguration",
        backButton: React.createElement(AdminBackButton, { href: "/admin/settings" })
      })
    );

    expect(html).toContain('href="/admin/settings"');
    expect(html).toContain("SMTP Einstellungen");
  });

  it("uses the correct fallback href for settings placeholder subpages", () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceholderPage, {
        title: "Tracking Einstellungen",
        description: "Tracking-Regeln",
        backHref: "/admin/settings"
      })
    );

    expect(html).toContain('href="/admin/settings"');
  });
});
