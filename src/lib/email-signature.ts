import { prisma } from "@/lib/prisma";

const allowedTags = new Set(["p", "br", "strong", "b", "em", "i", "u", "a", "span", "div", "table", "tbody", "tr", "td", "ul", "ol", "li"]);
const allowedAttributes = new Set(["href", "title", "style"]);

export function sanitizeSignatureHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<(\/?)([a-z0-9-]+)([^>]*)>/gi, (match, slash: string, tag: string, attrs: string) => {
      const normalizedTag = tag.toLowerCase();
      if (!allowedTags.has(normalizedTag)) {
        return "";
      }
      if (slash) {
        return `</${normalizedTag}>`;
      }
      const safeAttrs = Array.from(attrs.matchAll(/\s([a-zA-Z-]+)\s*=\s*("[^"]*"|'[^']*')/g))
        .filter(([, name]) => allowedAttributes.has(name.toLowerCase()))
        .map(([, name, value]) => ` ${name.toLowerCase()}=${value}`)
        .join("");
      return `<${normalizedTag}${safeAttrs}>`;
    });
}

export function appendSignature({
  bodyHtml,
  bodyText,
  signature
}: {
  bodyHtml?: string;
  bodyText: string;
  signature?: { html: string; plainText: string } | null;
}) {
  if (!signature) {
    return { html: bodyHtml, text: bodyText };
  }

  const text = [bodyText.trim(), signature.plainText.trim()].filter(Boolean).join("\n\n");
  const html = [bodyHtml?.trim(), sanitizeSignatureHtml(signature.html).trim()].filter(Boolean).join("<br><br>");
  return { html: html || undefined, text };
}

export async function getDefaultEmailSignature() {
  return prisma.emailSignature.findFirst({
    where: { isDefault: true },
    orderBy: { updatedAt: "desc" }
  });
}

export async function saveEmailSignature(input: {
  id?: string;
  name: string;
  html: string;
  plainText: string;
  isDefault?: boolean;
}) {
  const data = {
    name: input.name.trim() || "Standard Signatur",
    html: sanitizeSignatureHtml(input.html),
    plainText: input.plainText.trim(),
    isDefault: Boolean(input.isDefault)
  };

  if (data.isDefault) {
    await prisma.emailSignature.updateMany({ data: { isDefault: false } });
  }

  if (input.id) {
    return prisma.emailSignature.update({ where: { id: input.id }, data });
  }

  return prisma.emailSignature.create({ data });
}
