import { afterEach, describe, expect, it } from "vitest";
import { GET, PATCH } from "../../app/api/settings/legal/route";
import { getLegalLink } from "@/lib/legal-settings";
import { prisma } from "@/lib/prisma";

afterEach(async () => {
  await prisma.appSettings.deleteMany({ where: { id: "default" } });
});

describe("legal settings", () => {
  it("saves and loads legal content and external links", async () => {
    const response = await PATCH(new Request("http://localhost/api/settings/legal", {
      method: "PATCH",
      body: JSON.stringify({
        imprintMode: "external",
        imprintUrl: "https://example.com/impressum",
        imprintContent: "",
        privacyMode: "content",
        privacyUrl: "",
        privacyContent: "Datenschutz Inhalt",
        cookiesMode: "content",
        cookiesUrl: "",
        cookiesContent: "Cookie Inhalt"
      })
    }));

    expect(response.status).toBe(200);

    const loadedResponse = await GET();
    const loaded = await loadedResponse.json() as {
      imprintMode: "external" | "content";
      imprintUrl: string | null;
      imprintContent: string;
      privacyMode: "external" | "content";
      privacyUrl: string | null;
      privacyContent: string;
      cookiesMode: "external" | "content";
      cookiesUrl: string | null;
      cookiesContent: string;
    };

    expect(loaded.imprintMode).toBe("external");
    expect(loaded.imprintUrl).toBe("https://example.com/impressum");
    expect(loaded.privacyContent).toBe("Datenschutz Inhalt");
    expect(getLegalLink(loaded, "impressum")).toEqual({ href: "https://example.com/impressum", external: true });
    expect(getLegalLink(loaded, "datenschutz")).toEqual({ href: "/legal/datenschutz", external: false });
  });
});
