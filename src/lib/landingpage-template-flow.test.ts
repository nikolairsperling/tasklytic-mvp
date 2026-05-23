import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingpageTemplateBuilderPage from "../../app/admin/landingpages/templates/[id]/builder/page";
import LandingpageTemplatePreviewPage from "../../app/admin/landingpages/templates/[id]/preview/page";
import { POST as createTemplate } from "../../app/api/landingpage-templates/route";
import { DELETE, PATCH } from "../../app/api/landingpage-templates/[id]/route";
import { POST as duplicateTemplate } from "../../app/api/landingpage-templates/[id]/duplicate/route";
import { LandingpageGenerationChoice } from "@/components/admin/landingpage-generation-choice";
import { LandingpageTemplateManager } from "@/components/admin/landingpage-template-manager";
import { defaultLandingpageTemplate } from "@/lib/landingpage-templates";
import { prisma } from "@/lib/prisma";

describe.sequential("landingpage template management flow", () => {
  it("renders the main landingpage generation choice", () => {
    const html = renderToStaticMarkup(React.createElement(LandingpageGenerationChoice));
    expect(html).toContain("Was möchtest du generieren?");
    expect(html).toContain("Personalisierte Landingpages");
    expect(html).toContain("dynamischen Inhalten und QR-Codes");
  });

  it("template overview renders cards and actions", () => {
    const html = renderToStaticMarkup(React.createElement(LandingpageTemplateManager, {
      templates: [{
        id: "template_1",
        name: "Variante 1 LP",
        heroHeadline: "Version A",
        updatedAt: new Date("2026-05-06T12:00:00Z"),
        isDefault: false,
        bookingMode: "embedded_page"
      }]
    }));
    expect(html).toContain("Landing Page Vorlagen");
    expect(html).toContain("Verwalte deine Vorlagen für personalisierte Landing Pages.");
    expect(html).toContain("Neue Vorlage");
    expect(html).toContain("Variante 1 LP");
    expect(html).toContain("Tracking");
    expect(html).toContain("Cookie");
    expect(html).toContain("Direktbuchung");
    expect(html).toContain("Vorschau");
    expect(html).toContain("Bearbeiten");
    expect(html).toContain("Duplizieren");
    expect(html).toContain("Löschen");
  });

  it("preview modal copy and delete confirmation are implemented", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/admin/landingpage-template-manager.tsx"), "utf8");
    expect(source).toContain("Vorschau mit Beispiel-Lead");
    expect(source).toContain("So sieht deine Landingpage später für einen Endkunden aus.");
    expect(source).toContain("Es werden keine Credits verbraucht, kein Lead in deiner Datenbank angelegt und kein Tracking ausgelöst.");
    expect(source).toContain("https://tasklytic.dealsky.app/max-mustermann");
    expect(source).toContain("Vorschau in neuem Tab öffnen");
    expect(source).toContain("Diese Vorlage wirklich löschen?");
  });

  it("creates, edits, duplicates and deletes templates without duplicating prospects", async () => {
    const beforeProspects = await prisma.prospect.count();
    const createdResponse = await createTemplate(new Request("http://localhost/api/landingpage-templates", {
      method: "POST",
      body: JSON.stringify({ name: "Neue Landingpage Vorlage" })
    }));
    const created = await createdResponse.json();
    expect(createdResponse.status).toBe(201);
    expect(created.name).toBe("Neue Landingpage Vorlage");

    const patchResponse = await PATCH(new Request(`http://localhost/api/landingpage-templates/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Bearbeitete Landingpage Vorlage", heroHeadline: "Hallo {{firstName}}" })
    }), { params: Promise.resolve({ id: created.id }) });
    const patched = await patchResponse.json();
    expect(patchResponse.status).toBe(200);
    expect(patched.name).toBe("Bearbeitete Landingpage Vorlage");
    expect(patched.heroHeadline).toBe("Hallo {{firstName}}");

    const duplicateResponse = await duplicateTemplate(new Request(`http://localhost/api/landingpage-templates/${created.id}/duplicate`, { method: "POST" }), { params: Promise.resolve({ id: created.id }) });
    const duplicate = await duplicateResponse.json();
    expect(duplicateResponse.status).toBe(201);
    expect(duplicate.name).toBe("Bearbeitete Landingpage Vorlage Kopie");
    expect(duplicate.heroHeadline).toBe("Hallo {{firstName}}");
    expect(duplicate.id).not.toBe(created.id);

    await expect(prisma.prospect.count()).resolves.toBe(beforeProspects);

    const deleteDuplicateResponse = await DELETE(new Request(`http://localhost/api/landingpage-templates/${duplicate.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: duplicate.id }) });
    const deleteCreatedResponse = await DELETE(new Request(`http://localhost/api/landingpage-templates/${created.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: created.id }) });
    expect(deleteDuplicateResponse.status).toBe(200);
    expect(deleteCreatedResponse.status).toBe(200);
  });

  it("builder route opens the requested template", async () => {
    const template = await prisma.landingpageTemplate.create({
      data: { ...defaultLandingpageTemplate(), name: "Builder Ziel Vorlage", isDefault: false }
    });
    const element = await LandingpageTemplateBuilderPage({ params: Promise.resolve({ id: template.id }) });
    const editor = element as React.ReactElement<{ template: { name: string; id: string }; backHref: string }>;
    expect(editor.props.template.name).toBe("Builder Ziel Vorlage");
    expect(editor.props.template.id).toBe(template.id);
    expect(editor.props.backHref).toBe("/admin/landingpages/templates");
    await prisma.landingpageTemplate.delete({ where: { id: template.id } });
  });

  it("preview route renders the template with the fake lead and creates no prospect or tracking event", async () => {
    const template = await prisma.landingpageTemplate.create({
      data: {
        ...defaultLandingpageTemplate(),
        name: "Preview Vorlage",
        isDefault: false,
        heroHeadline: "Hallo {{firstName}} von {{companyName}}",
        heroBodyText: "{{painSummary}}",
        heroCtaUrl: "{{calendarUrl}}"
      }
    });
    const beforeProspects = await prisma.prospect.count();
    const beforeEvents = await prisma.prospectEvent.count();
    const element = await LandingpageTemplatePreviewPage({ params: Promise.resolve({ id: template.id }) });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain("Vorschau");
    expect(html).toContain("Hallo Max von Muster Spedition GmbH");
    expect(html).toContain("Bremen");
    expect(html).toContain("Viele Anfragen laufen über E-Mail, Telefon und Excel parallel.");
    expect(html).toContain("https://example.com/termin");
    expect(html).not.toContain("ProspectActivityTracker");
    expect(html).not.toContain("/api/events/track");
    await expect(prisma.prospect.count()).resolves.toBe(beforeProspects);
    await expect(prisma.prospectEvent.count()).resolves.toBe(beforeEvents);

    await prisma.landingpageTemplate.delete({ where: { id: template.id } });
  });

  it("preview route shows a clean message when the template is missing", async () => {
    const element = await LandingpageTemplatePreviewPage({ params: Promise.resolve({ id: "missing-template" }) });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain("Vorlage nicht gefunden.");
    expect(html).not.toContain("Application error");
  });
});
