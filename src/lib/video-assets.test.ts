import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { GET } from "../../app/api/assets/videos/route";
import { PATCH, DELETE } from "../../app/api/assets/videos/[id]/route";
import { POST as uploadVideo } from "../../app/api/assets/videos/upload/route";
import { prisma } from "@/lib/prisma";
import { assertVideoAssetUrl, resolveVideoMimeType, validateVideoUpload } from "@/lib/video-assets";
import { addLandingpageSection, defaultSectionSettings, renderLandingpageSections } from "@/lib/landingpage-templates";

function file(name: string, type: string, size = 12) {
  return new File([new Uint8Array(size)], name, { type });
}

async function upload(uploadedFile: File) {
  const form = new FormData();
  form.append("file", uploadedFile, uploadedFile.name);
  return uploadVideo(new Request("http://localhost/api/assets/videos/upload", { method: "POST", body: form }));
}

async function uploadedAsset(response: Response) {
  const body = await response.json();
  return body.asset ?? body;
}

const prospect = {
  id: "p1",
  slug: "demo",
  landingpageTemplateId: null,
  companyName: "Demo GmbH",
  city: "Berlin",
  country: "DE",
  businessFields: [],
  openDispatcherJob: false,
  personalVideoStatus: "none" as const,
  status: "draft" as const,
  createdAt: new Date(),
  updatedAt: new Date()
} as any;

describe.sequential("video asset uploads", () => {
  it("accepts mp4 uploads and stores VideoAsset metadata", async () => {
    const response = await upload(file("intro.mp4", "video/mp4"));
    const body = await uploadedAsset(response);

    expect(response.status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.filename).toMatch(/\.mp4$/);
    expect(body.originalName).toBe("intro.mp4");
    expect(body.url).toMatch(/^\/uploads\/videos\/.+\.mp4$/);
    expect(body.mimeType).toBe("video/mp4");
    expect(body.sizeBytes).toBe(12);
    expect(body.size).toBe(12);
    expect(existsSync(path.join(process.cwd(), "public", "uploads", "videos", body.filename))).toBe(true);

    await DELETE(new Request(`http://localhost/api/assets/videos/${body.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: body.id }) });
  });

  it("creates the video upload folder automatically", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/video-assets.ts"), "utf8");
    expect(source).toContain('path.join(process.cwd(), "public", "uploads", "videos")');
    expect(source).toContain("await mkdir(directory, { recursive: true })");
  });

  it("accepts m4v uploads with video mime types", async () => {
    const response = await upload(file("intro.m4v", "video/mp4"));
    const body = await uploadedAsset(response);

    expect(response.status).toBe(201);
    expect(body.filename).toMatch(/\.m4v$/);
    expect(body.url).toMatch(/^\/uploads\/videos\/.+\.m4v$/);
    expect(body.mimeType).toBe("video/mp4");

    await DELETE(new Request(`http://localhost/api/assets/videos/${body.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: body.id }) });
  });

  it("stores octet-stream mp4 uploads as video/mp4", async () => {
    const response = await upload(file("octet.mp4", "application/octet-stream"));
    const body = await uploadedAsset(response);

    expect(response.status).toBe(201);
    expect(body.mimeType).toBe("video/mp4");
    expect(body.sizeBytes).toBeGreaterThan(0);
    expect(body.url).toMatch(/^\/uploads\/videos\/.+\.mp4$/);

    await DELETE(new Request(`http://localhost/api/assets/videos/${body.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: body.id }) });
  });

  it("resolves browser fallback mime types from video extensions", () => {
    expect(resolveVideoMimeType("x.mp4", "application/octet-stream")).toBe("video/mp4");
    expect(resolveVideoMimeType("x.webm", "")).toBe("video/webm");
    expect(resolveVideoMimeType("x.mov", "application/octet-stream")).toBe("video/quicktime");
  });

  it("accepts valid video extensions when Safari omits the mime type", () => {
    expect(validateVideoUpload({ originalName: "x.mov", mimeType: "", sizeBytes: 20 }).extension).toBe(".mov");
  });

  it("rejects invalid video types", () => {
    expect(() => validateVideoUpload({ originalName: "x.html", mimeType: "text/html", sizeBytes: 20 })).toThrow("Dateityp nicht erlaubt.");
    expect(() => validateVideoUpload({ originalName: "x.jpg", mimeType: "image/jpeg", sizeBytes: 20 })).toThrow("Dateityp nicht erlaubt.");
    expect(() => assertVideoAssetUrl("/uploads/images/demo.jpg")).toThrow("Video URL muss auf eine Videodatei zeigen.");
  });

  it("rejects oversized videos", () => {
    expect(() => validateVideoUpload({ originalName: "x.mp4", mimeType: "video/mp4", sizeBytes: 200 * 1024 * 1024 + 1 })).toThrow("Video ist größer als 200 MB.");
  });

  it("lists, renames and deletes uploaded videos", async () => {
    const response = await upload(file("library.webm", "video/webm"));
    const created = await uploadedAsset(response);
    const listResponse = await GET();
    const list = await listResponse.json();
    expect(list.some((item: { id: string }) => item.id === created.id)).toBe(true);

    const patchResponse = await PATCH(new Request(`http://localhost/api/assets/videos/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Neue Demo" })
    }), { params: Promise.resolve({ id: created.id }) });
    const renamed = await patchResponse.json();
    expect(renamed.name).toBe("Neue Demo");

    const deleted = await DELETE(new Request(`http://localhost/api/assets/videos/${created.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: created.id }) });
    expect(deleted.status).toBe(204);
    await expect(prisma.videoAsset.findUnique({ where: { id: created.id } })).resolves.toBeNull();
  });

  it("builder video selection persists videoAssetId and videoUrl into sections", () => {
    const sections = addLandingpageSection([], "video");
    const selected = sections.map((section) => ({
      ...section,
      settings: { ...section.settings, videoAssetId: "video_1", videoUrl: "/uploads/videos/demo.mp4" }
    }));
    expect(selected[0].settings.videoAssetId).toBe("video_1");
    expect(selected[0].settings.videoUrl).toBe("/uploads/videos/demo.mp4");
  });

  it("video elements default to controls enabled and autoplay disabled", () => {
    const settings = defaultSectionSettings("video");
    expect(settings.controls).toBe(true);
    expect(settings.autoplay).toBe(false);
  });

  it("frontend video upload posts FormData to the video upload route", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/video-upload-client.ts"), "utf8");
    expect(source).toContain("export async function uploadVideo(file: File, onProgress: (percent: number) => void)");
    expect(source).toContain('formData.append("file", file, file.name)');
    expect(source).toContain('console.log("Uploading video to", "/api/assets/videos/upload")');
    expect(source).toContain("new XMLHttpRequest()");
    expect(source).toContain("xhr.upload.onprogress");
    expect(source).toContain('xhr.open("POST", "/api/assets/videos/upload")');
    expect(source).toContain("xhr.send(formData)");
    expect(source).toContain("Upload läuft");
    expect(source).not.toContain("Upload läuft... 0 %");
    expect(source).not.toContain("\"Content-Type\"");
    expect(source).toContain("data.error");
    expect(source).toContain("Video konnte nicht hochgeladen werden.");
  });

  it("frontend video upload reports empty file selections", () => {
    const managerSource = readFileSync(path.join(process.cwd(), "src/components/admin/video-asset-manager.tsx"), "utf8");
    const pickerSource = readFileSync(path.join(process.cwd(), "src/components/admin/video-asset-picker.tsx"), "utf8");
    expect(managerSource).toContain("const [selectedFile, setSelectedFile] = useState<File | null>(null)");
    expect(managerSource).toContain("console.log(file.name, file.type, file.size)");
    expect(managerSource).toContain("const file = event.target.files?.[0]");
    expect(managerSource).toContain("Bitte zuerst eine Videodatei auswählen.");
    expect(pickerSource).toContain("const [selectedFile, setSelectedFile] = useState<File | null>(null)");
    expect(pickerSource).toContain("console.log(file.name, file.type, file.size)");
    expect(pickerSource).toContain("const file = event.target.files?.[0]");
    expect(pickerSource).toContain("Bitte zuerst eine Videodatei auswählen.");
  });

  it("video picker renders remove and upload icon controls", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/admin/video-asset-picker.tsx"), "utf8");
    expect(source).toContain('aria-label="Video entfernen"');
    expect(source).toContain('title="Video entfernen"');
    expect(source).toContain("<X ");
    expect(source).not.toContain(">Entfernen</button>");
    expect(source).toContain('aria-label="Videodatei auswählen"');
    expect(source).toContain("Hochladen");
    expect(source).toContain("<Upload ");
  });

  it("video picker shows upload progress and backend errors", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/admin/video-asset-picker.tsx"), "utf8");
    expect(source).toContain('role="progressbar"');
    expect(source).toContain("disabled={uploadState.status === \"uploading\"}");
    expect(source).toContain("setUploadState((current) => ({ progress: current.progress, status: \"error\", message: error instanceof Error ? error.message : \"Video konnte nicht hochgeladen werden.\" }))");
  });

  it("does not expose FormData parser errors for json uploads", async () => {
    const response = await uploadVideo(new Request("http://localhost/api/assets/videos/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "x" })
    }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("Keine Datei unter FormData-Key file gefunden.");
    expect(body.receivedKeys).toEqual([]);
  });

  it("landingpage section rendering keeps uploaded video URLs", () => {
    const sections = addLandingpageSection([], "video").map((section) => ({
      ...section,
      settings: { ...section.settings, videoUrl: "/uploads/videos/demo.mp4" }
    }));
    const rendered = renderLandingpageSections({
      id: "t1",
      createdAt: new Date(),
      updatedAt: new Date(),
      sectionsJson: sections,
      globalDesignJson: {},
      primaryColor: "#111827",
      accentColor: "#14b8a6",
      defaultCtaUrl: null,
      bookingMode: "embedded_page"
    } as any, prospect);
    expect(rendered[0].settings.videoUrl).toBe("/uploads/videos/demo.mp4");
  });

  it("builder preview, template preview and live landingpage use shared VideoPreview", () => {
    const builderSource = readFileSync(path.join(process.cwd(), "src/components/admin/visual-landingpage-template-editor.tsx"), "utf8");
    const templatePreviewSource = readFileSync(path.join(process.cwd(), "app/admin/landingpages/templates/[id]/preview/page.tsx"), "utf8");
    const liveSource = readFileSync(path.join(process.cwd(), "app/p/[slug]/page.tsx"), "utf8");
    const sharedSource = readFileSync(path.join(process.cwd(), "src/components/landing/video-preview.tsx"), "utf8");
    const propsSource = readFileSync(path.join(process.cwd(), "src/lib/landingpage/video-preview-props.ts"), "utf8");

    expect(builderSource).toContain('from "@/components/landing/video-preview"');
    expect(builderSource).toContain('from "@/lib/landingpage/video-preview-props"');
    expect(templatePreviewSource).toContain('from "@/components/landing/video-preview"');
    expect(templatePreviewSource).toContain('from "@/lib/landingpage/video-preview-props"');
    expect(liveSource).toContain('from "@/components/landing/video-preview"');
    expect(liveSource).toContain('from "@/lib/landingpage/video-preview-props"');
    expect(propsSource).not.toContain('"use client"');
    expect(propsSource).toContain("export function videoPreviewPropsFromSettings");
    expect(sharedSource).toContain('className="video-frame"');
    expect(sharedSource).toContain("borderRadius = 24");
    expect(sharedSource).toContain('backgroundColor = "transparent"');
    expect(sharedSource).toContain("Video konnte nicht geladen werden");
    expect(sharedSource).toContain("URL prüfen");
    expect(sharedSource).toContain("console.error");
    expect(sharedSource).toContain("border-radius: 18px !important");
  });
});
