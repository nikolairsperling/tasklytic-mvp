import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SettingsPage from "../../app/admin/settings/page";
import { flattenAdminNav, getActiveAdminItem } from "@/lib/admin-navigation";

describe("admin navigation", () => {
  it("contains the funnel sidebar sections", () => {
    const labels = flattenAdminNav().map((item) => item.label);
    expect(labels).toContain("Übersicht");
    expect(labels).toContain("Leads finden");
    expect(labels).toContain("Wiedervorlagen");
    expect(labels).toContain("Workflow");
    expect(labels).toContain("Impact Studio");
    expect(labels).toContain("Landingpages");
    expect(labels).toContain("Kampagnen");
    expect(labels).toContain("Inbox");
    expect(labels).toContain("Analytics");
    expect(labels).toContain("Assets");
    expect(labels).toContain("Einstellungen");
  });

  it("uses icon keys for every item instead of letter fallbacks", () => {
    const keys = flattenAdminNav().map((item) => item.key);
    expect(keys).toContain("overview");
    expect(keys).toContain("leadScout");
    expect(keys).toContain("landingpages");
    expect(flattenAdminNav().every((item) => !("icon" in item))).toBe(true);
  });

  it("detects nested active items", () => {
    expect(getActiveAdminItem("/admin").label).toBe("Übersicht");
    expect(getActiveAdminItem("/admin/dashboard").label).toBe("Übersicht");
    expect(getActiveAdminItem("/admin/landingpages/templates").label).toBe("Landingpages");
    expect(getActiveAdminItem("/admin/campaigns?id=1").label).toBe("Kampagnen");
    expect(getActiveAdminItem("/admin/settings/smtp").label).toBe("Einstellungen");
    expect(getActiveAdminItem("/admin/assets/briefvorlagen").label).toBe("Assets");
    expect(getActiveAdminItem("/admin/assets/email-templates").label).toBe("Assets");
  });

  it("points landingpage navigation to existing app routes", () => {
    const routes = ["/admin/landingpages", "/admin/landingpages/templates", "/admin/assets/landingpages"];
    for (const route of routes) {
      const routePath = join(process.cwd(), "app", ...route.split("/").filter(Boolean), "page.tsx");
      expect(existsSync(routePath), route).toBe(true);
    }
  });

  it("keeps setup routes reachable through existing app routes", () => {
    const routes = [
      "/admin/follow-ups",
      "/admin/settings/smtp",
      "/admin/settings/email",
      "/admin/settings/email-signature",
      "/admin/settings/clickup",
      "/admin/settings/openai",
      "/admin/settings/heygen",
      "/admin/settings/mailbox",
      "/admin/settings/integrations",
      "/admin/settings/app",
      "/admin/settings/design",
      "/admin/settings/booking",
      "/admin/settings/legal",
      "/admin/settings/tracking",
      "/admin/settings/calling",
      "/admin/settings/voice-ai",
      "/admin/assets/accounts",
      "/admin/assets/briefvorlagen",
      "/admin/assets/email-templates",
      "/admin/assets/videos",
      "/admin/assets/images",
      "/admin/assets/messages",
      "/admin/assets/landingpages",
      "/admin/assets/booking"
    ];

    for (const route of routes) {
      const routePath = join(process.cwd(), "app", ...route.split("/").filter(Boolean), "page.tsx");
      expect(existsSync(routePath), route).toBe(true);
    }
  });

  it("shows the requested settings entry points", () => {
    const html = renderToStaticMarkup(React.createElement(SettingsPage));

    for (const label of ["E-Mail", "E-Mail Signatur", "ClickUp", "OpenAI", "HeyGen", "Rechtliches", "Design", "Calling", "Voice-KI"]) {
      expect(html).toContain(label);
    }
  });
});
