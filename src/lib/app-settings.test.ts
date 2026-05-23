import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PATCH } from "../../app/api/settings/app/route";
import {
  appendOpenTrackingPixel,
  buildTrackingClickUrl,
  DEFAULT_APP_SETTINGS,
  readCallingSettings,
  readDesignSettings,
  readTrackingSettings,
  resolveEmailTracking,
  saveAppSettings,
  saveCallingSettings,
  saveDesignSettings,
  saveTrackingSettings,
  type AppSettingsPayload
} from "@/lib/app-settings";

function createMemoryStore(initial: Partial<AppSettingsPayload> | null = null) {
  let settings = initial;
  return {
    appSettings: {
      findUnique: async () => settings,
      upsert: async (args: { create: AppSettingsPayload; update: AppSettingsPayload }) => {
        settings = { ...settings, ...args.update };
        return settings ?? args.create;
      }
    }
  };
}

describe("app settings theme mode", () => {
  it("reads system mode as default when no settings are stored", async () => {
    const store = createMemoryStore();

    await expect(readDesignSettings(store)).resolves.toMatchObject({ themeMode: "system" });
  });

  it("saves themeMode in the settings store", async () => {
    const store = createMemoryStore(DEFAULT_APP_SETTINGS);

    await expect(saveAppSettings({ themeMode: "light" }, store)).resolves.toMatchObject({ themeMode: "light" });
    await expect(readDesignSettings(store)).resolves.toMatchObject({ themeMode: "light" });
  });

  it("rejects invalid themeMode values", async () => {
    await expect(saveAppSettings({ themeMode: "blue" })).rejects.toThrow();
  });

  it("returns 400 for invalid theme toggle API payloads", async () => {
    const response = await PATCH(new Request("http://localhost/api/settings/app", {
      method: "PATCH",
      body: JSON.stringify({ themeMode: "invalid" })
    }));

    expect(response.status).toBe(400);
  });

  it("saves and loads tracking settings", async () => {
    const store = createMemoryStore(DEFAULT_APP_SETTINGS);

    await saveTrackingSettings({
      openTrackingEnabled: false,
      clickTrackingEnabled: true,
      trackingDomain: "tracking.example.com",
      appendUtmParams: true,
      utmSource: "crm",
      utmMedium: "email",
      utmCampaign: "spring",
      privacyNoticeText: "Wir messen Interaktionen.",
      trackingConsentMode: "consent_required"
    }, store);

    await expect(readTrackingSettings(store)).resolves.toMatchObject({
      openTrackingEnabled: false,
      clickTrackingEnabled: true,
      trackingDomain: "tracking.example.com",
      appendUtmParams: true,
      utmCampaign: "spring",
      trackingConsentMode: "consent_required"
    });
  });

  it("saves and loads design settings", async () => {
    const store = createMemoryStore(DEFAULT_APP_SETTINGS);

    await saveDesignSettings({
      themeMode: "system",
      primaryColor: "#ff0000",
      accentColor: "#00ff00",
      backgroundColor: "#ffffff",
      textColor: "#111111",
      buttonRadius: 8,
      cardRadius: 10,
      selectedFont: "Lato",
      fontFamily: "Lato",
      logoUrl: "https://example.com/logo.svg",
      faviconUrl: "https://example.com/favicon.ico"
    }, store);

    await expect(readDesignSettings(store)).resolves.toMatchObject({
      themeMode: "system",
      primaryColor: "#ff0000",
      selectedFont: "Lato",
      fontFamily: "Lato",
      logoUrl: "https://example.com/logo.svg"
    });
  });

  it("keeps light theme when design settings are saved without themeMode", async () => {
    const store = createMemoryStore({ ...DEFAULT_APP_SETTINGS, themeMode: "light" });

    await saveDesignSettings({ primaryColor: "#111111" }, store);

    await expect(readDesignSettings(store)).resolves.toMatchObject({
      themeMode: "light",
      primaryColor: "#111111"
    });
  });

  it("keeps theme persistence isolated in localStorage and save handlers do not force dark", () => {
    const shellSource = readFileSync("src/components/admin/shell/admin-shell.tsx", "utf8");
    const offerSource = readFileSync("app/admin/setup/offers/page.tsx", "utf8");
    const campaignSource = readFileSync("src/components/admin/campaign-manager.tsx", "utf8");
    const prospectSource = readFileSync("src/components/admin/prospect-crm-panel.tsx", "utf8");

    const themeSource = readFileSync("src/lib/admin-theme.ts", "utf8");

    expect(themeSource).toContain("tasklytic-theme");
    expect(themeSource).toContain("window.localStorage.setItem(adminThemeStorageKey, themeMode)");
    expect(offerSource).not.toContain('themeMode: "dark"');
    expect(campaignSource).not.toContain('themeMode: "dark"');
    expect(prospectSource).not.toContain('themeMode: "dark"');
  });

  it("saves and loads calling settings", async () => {
    const store = createMemoryStore(DEFAULT_APP_SETTINGS);

    await saveCallingSettings({
      ownPhoneNumber: "+49 30 123456",
      defaultCountryDialCode: "49",
      callProviderMode: "sip"
    }, store);

    await expect(readCallingSettings(store)).resolves.toMatchObject({
      ownPhoneNumber: "+49 30 123456",
      defaultCountryDialCode: "+49",
      callProviderMode: "sip"
    });
  });

  it("removes tracking pixel and click wrapping when tracking is disabled", () => {
    const settings = {
      ...DEFAULT_APP_SETTINGS,
      trackingConsentMode: "disabled" as const
    };
    const tracking = resolveEmailTracking(settings, true);
    const html = appendOpenTrackingPixel("<p>Hallo</p>", tracking.openEnabled ? "open-token" : undefined, settings);

    expect(tracking.openEnabled).toBe(false);
    expect(tracking.clickEnabled).toBe(false);
    expect(html).toBe("<p>Hallo</p>");
  });

  it("creates tracking pixel and click wrapping when tracking is enabled", () => {
    const settings = {
      ...DEFAULT_APP_SETTINGS,
      trackingDomain: "tracking.example.com"
    };
    const tracking = resolveEmailTracking(settings, true);
    const html = appendOpenTrackingPixel("<p>Hallo</p>", tracking.openEnabled ? "open-token" : undefined, settings);
    const clickUrl = tracking.clickEnabled ? buildTrackingClickUrl("click-token", settings) : "";

    expect(html).toContain("https://tracking.example.com/api/track/open/open-token");
    expect(clickUrl).toBe("https://tracking.example.com/api/track/click/click-token");
  });

  it("rejects invalid color values", async () => {
    await expect(saveDesignSettings({ primaryColor: "red" })).rejects.toThrow();
  });
});
