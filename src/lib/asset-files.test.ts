import { describe, expect, it } from "vitest";
import { DELETE } from "../../app/api/assets/files/[id]/route";
import { POST } from "../../app/api/assets/upload/route";
import { validateAssetUpload } from "@/lib/asset-files";
import { prisma } from "@/lib/prisma";

function file(name: string, type: string, size = 12) {
  return new File([new Uint8Array(size)], name, { type });
}

async function upload(type: string, uploadedFile: File) {
  const form = new FormData();
  form.set("type", type);
  form.set("file", uploadedFile);
  return POST(new Request("http://localhost/api/assets/upload", { method: "POST", body: form }));
}

describe.sequential("asset file uploads", () => {
  it("accepts png, jpg and webp image uploads", () => {
    expect(validateAssetUpload({ type: "image", originalName: "a.png", mimeType: "image/png", sizeBytes: 20 }).extension).toBe(".png");
    expect(validateAssetUpload({ type: "image", originalName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 20 }).extension).toBe(".jpg");
    expect(validateAssetUpload({ type: "image", originalName: "a.webp", mimeType: "image/webp", sizeBytes: 20 }).extension).toBe(".webp");
  });

  it("accepts mp4 and webm video uploads", () => {
    expect(validateAssetUpload({ type: "video", originalName: "a.mp4", mimeType: "video/mp4", sizeBytes: 20 }).extension).toBe(".mp4");
    expect(validateAssetUpload({ type: "video", originalName: "a.webm", mimeType: "video/webm", sizeBytes: 20 }).extension).toBe(".webm");
  });

  it("rejects wrong MIME types", () => {
    expect(() => validateAssetUpload({ type: "image", originalName: "x.png", mimeType: "text/html", sizeBytes: 20 })).toThrow("Dateityp");
  });

  it("rejects oversized files", () => {
    expect(() => validateAssetUpload({ type: "image", originalName: "x.png", mimeType: "image/png", sizeBytes: 5 * 1024 * 1024 + 1 })).toThrow("5 MB");
    expect(() => validateAssetUpload({ type: "video", originalName: "x.mp4", mimeType: "video/mp4", sizeBytes: 200 * 1024 * 1024 + 1 })).toThrow("200 MB");
  });

  it("creates the correct publicUrl for uploads", async () => {
    const response = await upload("image", file("logo.png", "image/png"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.publicUrl).toMatch(/^\/uploads\/images\/.+\.png$/);

    await prisma.assetFile.delete({ where: { id: body.id } });
  });

  it("delete removes the DB entry", async () => {
    const response = await upload("video", file("clip.webm", "video/webm"));
    const created = await response.json();

    const deleted = await DELETE(new Request(`http://localhost/api/assets/files/${created.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: created.id }) });

    expect(deleted.status).toBe(204);
    await expect(prisma.assetFile.findUnique({ where: { id: created.id } })).resolves.toBeNull();
  });
});
