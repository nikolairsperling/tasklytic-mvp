import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("letter template action menu", () => {
  it("uses a compact anchored dropdown with outside-click handling", () => {
    const source = readFileSync(join(process.cwd(), "src/components/admin/letter-template-manager.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

    expect(source).toContain("action-menu-wrapper");
    expect(source).toContain("action-menu");
    expect(source).toContain("aria-haspopup=\"menu\"");
    expect(source).toContain("role=\"menu\"");
    expect(source).toContain("document.addEventListener(\"pointerdown\"");
    expect(source).toContain("document.addEventListener(\"keydown\"");
    expect(source).toContain("ActionMenuAlignment");
    expect(source).toContain("getBoundingClientRect");
    expect(source).toContain("action-menu-${actionMenuAlignment}");
    expect(source).toContain("Ansehen");
    expect(source).toContain("Als eigene Vorlage kopieren");
    expect(source).toContain("Bearbeiten");
    expect(source).not.toContain("<details");
    expect(source).not.toContain("<summary");

    expect(css).toContain(".admin-theme .action-menu-wrapper");
    expect(css).toContain("position: relative;");
    expect(css).toContain(".admin-theme .action-menu");
    expect(css).toContain("position: absolute;");
    expect(css).toContain("top: calc(100% + 8px);");
    expect(css).toContain("left: 50%;");
    expect(css).toContain("transform: translateX(-50%);");
    expect(css).toContain(".admin-theme .action-menu-left");
    expect(css).toContain(".admin-theme .action-menu-right");
    expect(css).toContain("right: 0;");
    expect(css).toContain("z-index: 1000;");
    expect(css).toContain("max-width: min(92vw, calc(100vw - 32px), 320px);");
    expect(css).toContain("white-space: nowrap;");
    expect(css).toContain("@media (max-width: 420px)");
  });
});
