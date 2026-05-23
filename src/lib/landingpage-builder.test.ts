import { describe, expect, it, vi } from "vitest";
import {
  addBuilderSection,
  addBuilderContainer,
  addBuilderElement,
  buildSavePayload,
  comparisonGridClass,
  deleteBuilderSection,
  devicePreviewClass,
  devicePreviewWidth,
  duplicateBuilderSection,
  moveBuilderSection,
  patchBuilderElement,
  patchBuilderElementStyle,
  patchBuilderText,
  reorderBuilderSections,
  resolveBuilderElement,
  sanitizeLandingpageSections,
  selectBuilderElement,
  updateElement
} from "@/lib/landingpage-builder";
import { addLandingpageSection, applyAddressFormVariants, defaultGlobalDesign, renderText, type LandingpageSection } from "@/lib/landingpage-templates";

function sections(): LandingpageSection[] {
  const withHero = addLandingpageSection([], "hero");
  const withCta = addLandingpageSection(withHero, "cta");
  return addLandingpageSection(withCta, "explainer_video");
}

describe("landingpage builder state", () => {
  it("selects an active element", () => {
    const active = selectBuilderElement({ sectionId: "s1", field: "headline", kind: "text" });
    expect(active).toEqual({ sectionId: "s1", field: "headline", kind: "text" });
  });

  it("updates hero headline in sectionsJson", () => {
    const current = sections();
    const next = patchBuilderText(current, { sectionId: current[0].id, field: "headline", kind: "text" }, "Neue Headline");
    const headline = next[0].containers?.flatMap((container) => container.columns.flatMap((column) => column.elements)).find((element) => element.props.field === "headline");
    expect(next[0].settings.headline).toBe("Neue Headline");
    expect(headline?.props.text).toBe("Neue Headline");
  });

  it("changes only the selected headline font size", () => {
    const current = sections();
    const active = resolveBuilderElement(current, { sectionId: current[0].id, field: "headline", kind: "text" });
    const next = patchBuilderElementStyle(current, active, { fontSize: 72, desktop: { fontSize: 72 } });
    const heroElements = next[0].containers?.flatMap((container) => container.columns.flatMap((column) => column.elements)) ?? [];
    const headline = heroElements.find((element) => element.props.field === "headline");
    const body = heroElements.find((element) => element.props.field === "bodyText");
    const button = heroElements.find((element) => element.type === "button");

    expect(headline?.style?.fontSize).toBe(72);
    expect((headline?.style?.desktop as Record<string, unknown>).fontSize).toBe(72);
    expect(body?.style?.fontSize).toBe(22);
    expect(button?.style?.fontSize).toBeUndefined();
  });

  it("changes only the selected body text font size", () => {
    const current = sections();
    const active = resolveBuilderElement(current, { sectionId: current[0].id, field: "bodyText", kind: "text" });
    const next = patchBuilderElementStyle(current, active, { fontSize: 18, desktop: { fontSize: 18 } });
    const heroElements = next[0].containers?.flatMap((container) => container.columns.flatMap((column) => column.elements)) ?? [];
    const headline = heroElements.find((element) => element.props.field === "headline");
    const body = heroElements.find((element) => element.props.field === "bodyText");
    const button = heroElements.find((element) => element.type === "button");

    expect(body?.style?.fontSize).toBe(18);
    expect(headline?.style?.fontSize).toBe(48);
    expect(button?.style?.fontSize).toBeUndefined();
  });

  it("changes only the selected element color and persists it in save payload", () => {
    const current = sections();
    const active = resolveBuilderElement(current, { sectionId: current[0].id, field: "bodyText", kind: "text" });
    const next = patchBuilderElementStyle(current, active, { color: "#667085" });
    const payload = buildSavePayload({ name: "Template", isDefault: true }, next, defaultGlobalDesign(), {});
    const savedHero = payload.sectionsJson[0] as LandingpageSection;
    const savedElements = savedHero.containers?.flatMap((container) => container.columns.flatMap((column) => column.elements)) ?? [];
    const body = savedElements.find((element) => element.props.field === "bodyText");
    const headline = savedElements.find((element) => element.props.field === "headline");

    expect(body?.style?.color).toBe("#667085");
    expect(headline?.style?.color).toBe("#111827");
  });

  it("updates a nested element recursively by id", () => {
    const current = sections();
    const parent = current[0].containers![0].columns[0].elements[0] as any;
    const nested = { id: "nested_headline", type: "headline", props: { text: "Nested" }, style: { color: "#111827" } };
    const withNested = [
      {
        ...current[0],
        containers: [
          {
            ...current[0].containers![0],
            columns: [
              {
                ...current[0].containers![0].columns[0],
                elements: [{ ...parent, children: [nested] }, ...current[0].containers![0].columns[0].elements.slice(1)]
              },
              ...current[0].containers![0].columns.slice(1)
            ]
          }
        ]
      },
      ...current.slice(1)
    ];

    const next = updateElement(withNested, "nested_headline", {
      props: { text: "Updated nested" },
      style: { color: "#ff0000", textAlign: "center" }
    });
    const updated = (next[0].containers![0].columns[0].elements[0] as any).children[0];

    expect(updated.props.text).toBe("Updated nested");
    expect(updated.style.color).toBe("#ff0000");
    expect(updated.style.textAlign).toBe("center");
    expect(next[0].containers![0].columns[0].elements[1].style?.color).toBe("#667085");
  });

  it("updates cta button text and url", () => {
    const current = sections();
    const cta = current[1];
    const withText = patchBuilderText(current, { sectionId: cta.id, field: "ctaText", kind: "button" }, "Jetzt buchen");
    const withUrl = patchBuilderElement(withText, { sectionId: cta.id, field: "ctaText", kind: "button" }, { ctaUrl: "https://cal.example" });
    const button = withUrl[1].containers?.flatMap((container) => container.columns.flatMap((column) => column.elements)).find((element) => element.type === "button");
    expect(withUrl[1].settings.ctaText).toBe("Jetzt buchen");
    expect(withUrl[1].settings.ctaUrl).toBe("https://cal.example");
    expect(button?.props.text).toBe("Jetzt buchen");
    expect(button?.props.href).toBe("https://cal.example");
  });

  it("updates cta button design on the selected button element", () => {
    const current = sections();
    const cta = current[1];
    const active = resolveBuilderElement(current, { sectionId: cta.id, field: "ctaText", kind: "button" });
    const next = patchBuilderElement(current, active, { buttonColor: "#ff0000", buttonBorderRadius: "28", buttonWidthMode: "full", buttonAnimation: "pulse" });
    const button = next[1].containers?.flatMap((container) => container.columns.flatMap((column) => column.elements)).find((element) => element.type === "button");
    expect(next[1].settings.buttonColor).toBe("#ff0000");
    expect(button?.props.backgroundColor).toBe("#ff0000");
    expect(button?.props.borderRadius).toBe("28");
    expect(button?.props.widthMode).toBe("full");
    expect(button?.props.animation).toBe("pulse");
  });

  it("saves video url changes", () => {
    const current = sections();
    const next = patchBuilderElement(current, { sectionId: current[2].id, field: "videoUrl", kind: "video" }, { videoUrl: "https://video.example" });
    expect(next[2].settings.videoUrl).toBe("https://video.example");
  });

  it("adds and selects a new section", () => {
    const result = addBuilderSection(sections(), "faq");
    expect(result.sections.at(-1)?.type).toBe("faq");
    expect(result.activeElement.sectionId).toBe(result.sections.at(-1)?.id);
  });

  it("creates FAQ headline, question, and answer as editable builder elements", () => {
    const current = addLandingpageSection([], "faq");
    const faq = current[0];
    const elements = faq.containers?.flatMap((container) => container.columns.flatMap((column) => column.elements)) ?? [];
    const headline = elements.find((element) => element.props.field === "headline");
    const question = elements.find((element) => element.props.itemList === "faqItems" && element.props.itemIndex === 0 && element.props.itemKey === "question");
    const answer = elements.find((element) => element.props.itemList === "faqItems" && element.props.itemIndex === 0 && element.props.itemKey === "answer");

    expect(headline).toMatchObject({ type: "headline", editable: true, props: { text: "FAQ" } });
    expect(question).toMatchObject({ type: "headline", editable: true, props: { text: "Frage" } });
    expect(answer).toMatchObject({ type: "text", editable: true, props: { text: "Antwort" } });
  });

  it("updates only the selected FAQ answer style and persists it", () => {
    const current = addLandingpageSection([], "faq");
    const faq = current[0];
    const active = resolveBuilderElement(current, { sectionId: faq.id, kind: "text", itemList: "faqItems", itemIndex: 0, itemKey: "answer" });
    const next = patchBuilderElementStyle(current, active, { color: "#ff0000", fontSize: 19, textAlign: "center", desktop: { fontSize: 19 } });
    const elements = next[0].containers?.flatMap((container) => container.columns.flatMap((column) => column.elements)) ?? [];
    const question = elements.find((element) => element.props.itemList === "faqItems" && element.props.itemKey === "question");
    const answer = elements.find((element) => element.props.itemList === "faqItems" && element.props.itemKey === "answer");
    const payload = buildSavePayload({ name: "Template", isDefault: true }, next, defaultGlobalDesign(), {});
    const savedAnswer = (payload.sectionsJson[0] as LandingpageSection).containers
      ?.flatMap((container) => container.columns.flatMap((column) => column.elements))
      .find((element) => element.props.itemList === "faqItems" && element.props.itemKey === "answer");

    expect(answer?.style?.color).toBe("#ff0000");
    expect(answer?.style?.fontSize).toBe(19);
    expect(answer?.style?.textAlign).toBe("center");
    expect(question?.style?.color).toBe("#111827");
    expect(savedAnswer?.style?.color).toBe("#ff0000");
  });

  it("deletes a section", () => {
    const current = sections();
    expect(deleteBuilderSection(current, current[0].id)).toHaveLength(2);
  });

  it("duplicates a section", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const current = sections();
    const result = duplicateBuilderSection(current, current[0].id);
    expect(result.sections).toHaveLength(4);
    expect(result.sections.at(-1)?.name).toContain("Kopie");
  });

  it("moves sections up and down", () => {
    const current = sections();
    const moved = moveBuilderSection(current, current[1].id, "up");
    expect(moved[0].type).toBe("cta");
  });

  it("saves reordered sections from drag and drop", () => {
    const current = sections();
    const moved = reorderBuilderSections(current, current[2].id, current[0].id);
    expect(moved.map((section) => section.type)).toEqual(["explainer_video", "hero", "cta"]);
    expect(moved.map((section) => section.order)).toEqual([1, 2, 3]);
  });

  it("maps device preview modes to visible width classes", () => {
    expect(devicePreviewClass("desktop")).toBe("max-w-[1200px]");
    expect(devicePreviewClass("tablet")).toBe("max-w-[768px]");
    expect(devicePreviewClass("mobile")).toBe("max-w-[390px]");
  });

  it("sets explicit mobile preview width", () => {
    expect(devicePreviewWidth("mobile")).toBe(390);
    expect(devicePreviewWidth("tablet")).toBe(768);
    expect(devicePreviewWidth("desktop")).toBe(1200);
  });

  it("creates containers and elements inside the builder structure", () => {
    const current = sections();
    const withContainer = addBuilderContainer(current, current[0].id, 2);
    const container = withContainer[0].containers?.at(-1);
    expect(container?.columns).toHaveLength(2);
    const withElement = addBuilderElement(withContainer, current[0].id, container!.id, container!.columns[0].id, "button");
    expect(withElement[0].containers?.at(-1)?.columns[0].elements.at(-1)?.type).toBe("button");
  });

  it("builds a save payload with sectionsJson and globalDesignJson", () => {
    const current = sections();
    const design = defaultGlobalDesign();
    const payload = buildSavePayload({ name: "Template", isDefault: true, addressForm: "sie" }, current, design, { heroHeadline: "Hallo" });
    expect(payload.sectionsJson).toHaveLength(current.length);
    expect(payload.sectionsJson[0].settings.headline).toBe(current[0].settings.headline);
    expect(payload.globalDesignJson).toBe(design);
    expect(payload.heroHeadline).toBe("Hallo");
    expect(payload.addressForm).toBe("sie");
    expect(payload.sectionsJson[0].containers?.[0].columns.length).toBeGreaterThan(0);
  });

  it("applies du/sie text variants immediately before rendering", () => {
    const settings = { headline: "Hallo", headlineDu: "Hallo {{firstName}}", headlineSie: "Hallo {{salutation}} {{lastName}}" };
    const prospect = { firstName: "Max", lastName: "Muster", salutation: "Herr", companyName: "Demo", city: "Berlin", businessFields: [] } as any;
    expect(renderText(applyAddressFormVariants(settings, "du").headline, prospect)).toBe("Hallo Max");
    expect(renderText(applyAddressFormVariants(settings, "sie").headline, prospect)).toBe("Hallo Herr Muster");
  });

  it("sanitizes scripts and invalid external links without breaking placeholders", () => {
    const current = sections().map((section, index) => index === 0
      ? { ...section, settings: { ...section.settings, headline: "<script>alert(1)</script>Hallo {{firstName}}", ctaUrl: "javascript:alert(1)" } }
      : section
    );
    const sanitized = sanitizeLandingpageSections(current);
    expect(sanitized[0].settings.headline).toBe("Hallo {{firstName}}");
    expect(sanitized[0].settings.ctaUrl).toBe("");
  });

  it("uses a one-column comparison grid on mobile and two columns from desktop breakpoint", () => {
    expect(comparisonGridClass()).toContain("grid-cols-1");
    expect(comparisonGridClass()).toContain("md:grid-cols-2");
  });
});
