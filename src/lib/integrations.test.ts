import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as testOpenAiRoute } from "../../app/api/settings/integrations/openai/test/route";
import { GET as getClickUpRoute, PATCH as patchClickUpRoute } from "../../app/api/settings/clickup/route";
import { POST as testClickUpRoute } from "../../app/api/settings/clickup/test/route";
import { POST as createClickUpTestTaskRoute } from "../../app/api/settings/clickup/test-task/route";
import {
  createClickUpTaskForLead,
  getEffectiveOpenAiApiKey,
  getSafeIntegrationSettings,
  saveClickUpSettings,
  saveOpenAiSettings,
  saveSlackSettings,
  testOpenAiConnection
} from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

const originalIntegrationSecret = process.env.INTEGRATION_SETTINGS_SECRET;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalSmtpSecret = process.env.SMTP_SETTINGS_SECRET;

async function resetOpenAiSettings() {
  await prisma.integrationSettings.deleteMany({ where: { type: "openai" } });
  if (originalIntegrationSecret === undefined) delete process.env.INTEGRATION_SETTINGS_SECRET;
  else process.env.INTEGRATION_SETTINGS_SECRET = originalIntegrationSecret;
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
  if (originalSmtpSecret === undefined) delete process.env.SMTP_SETTINGS_SECRET;
  else process.env.SMTP_SETTINGS_SECRET = originalSmtpSecret;
}

describe.sequential("integration settings", () => {
  afterEach(async () => {
    await resetOpenAiSettings();
  });

  it("does not expose Slack webhook secrets", async () => {
    const original = process.env.INTEGRATION_SETTINGS_SECRET;
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    await prisma.integrationSettings.deleteMany({ where: { type: "slack" } });
    await saveSlackSettings({ enabled: true, webhookUrl: "https://hooks.slack.com/services/test/test/test" });
    const safe = await getSafeIntegrationSettings();
    expect(JSON.stringify(safe)).not.toContain("hooks.slack.com");
    expect(safe.slack.webhookSet).toBe(true);
    await prisma.integrationSettings.deleteMany({ where: { type: "slack" } });
    if (original === undefined) delete process.env.INTEGRATION_SETTINGS_SECRET;
    else process.env.INTEGRATION_SETTINGS_SECRET = original;
  });

  it("does not expose ClickUp tokens", async () => {
    const original = process.env.INTEGRATION_SETTINGS_SECRET;
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    await saveClickUpSettings({ enabled: true, apiToken: "pk_secret_token", teamId: "t", listId: "l" });
    const safe = await getSafeIntegrationSettings();
    expect(JSON.stringify(safe)).not.toContain("pk_secret_token");
    expect(safe.clickup.tokenSet).toBe(true);
    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    if (original === undefined) delete process.env.INTEGRATION_SETTINGS_SECRET;
    else process.env.INTEGRATION_SETTINGS_SECRET = original;
  });

  it("saves and loads ClickUp settings without exposing tokens", async () => {
    const original = process.env.INTEGRATION_SETTINGS_SECRET;
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });

    const response = await patchClickUpRoute(new Request("http://localhost/api/settings/clickup", {
      method: "PATCH",
      body: JSON.stringify({
        enabled: true,
        apiToken: "pk_clickup_secret",
        teamId: "team-1",
        spaceId: "space-1",
        folderId: "folder-1",
        listId: "list-1",
        defaultAssignee: "assignee-1"
      })
    }));
    const body = await response.json();
    const loadResponse = await getClickUpRoute();
    const loaded = await loadResponse.json();

    expect(response.status).toBe(200);
    expect(body.tokenSet).toBe(true);
    expect(loaded.config).toMatchObject({ teamId: "team-1", spaceId: "space-1", folderId: "folder-1", listId: "list-1", defaultAssignee: "assignee-1" });
    expect(JSON.stringify(loaded)).not.toContain("pk_clickup_secret");

    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    if (original === undefined) delete process.env.INTEGRATION_SETTINGS_SECRET;
    else process.env.INTEGRATION_SETTINGS_SECRET = original;
  });

  it("can trigger a ClickUp test task", async () => {
    const original = process.env.INTEGRATION_SETTINGS_SECRET;
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    await saveClickUpSettings({ enabled: true, apiToken: "pk_clickup_secret", listId: "list-1", defaultAssignee: "123" });
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "task-1" })
    });
    vi.stubGlobal("fetch", fetcher);

    const response = await createClickUpTestTaskRoute();
    const body = await response.json();
    const createCall = fetcher.mock.calls.find(([url]) => String(url).endsWith("/task"));

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("https://api.clickup.com/api/v2/list/list-1", expect.objectContaining({ headers: { Authorization: "pk_clickup_secret" } }));
    expect(createCall).toEqual(["https://api.clickup.com/api/v2/list/list-1/task", expect.objectContaining({ method: "POST" })]);
    expect(JSON.stringify(createCall?.[1].body)).not.toContain("pk_clickup_secret");

    vi.unstubAllGlobals();
    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    if (original === undefined) delete process.env.INTEGRATION_SETTINGS_SECRET;
    else process.env.INTEGRATION_SETTINGS_SECRET = original;
  });

  it("tests ClickUp by loading the configured list and returns the clear success message", async () => {
    const original = process.env.INTEGRATION_SETTINGS_SECRET;
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    await saveClickUpSettings({ enabled: true, apiToken: "pk_clickup_secret", teamId: "90152208000", listId: "901523299248" });
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "901523299248", name: "Leads" })
    });
    vi.stubGlobal("fetch", fetcher);

    const response = await testClickUpRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.message).toBe("ClickUp verbunden: Liste gefunden");
    expect(fetcher).toHaveBeenCalledWith("https://api.clickup.com/api/v2/list/901523299248", expect.objectContaining({ headers: { Authorization: "pk_clickup_secret" } }));
    expect(JSON.stringify(body)).not.toContain("pk_clickup_secret");

    vi.unstubAllGlobals();
    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    if (original === undefined) delete process.env.INTEGRATION_SETTINGS_SECRET;
    else process.env.INTEGRATION_SETTINGS_SECRET = original;
  });

  it("creates a ClickUp task for a new lead using first status and custom fields", async () => {
    const original = process.env.INTEGRATION_SETTINGS_SECRET;
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    await saveClickUpSettings({ enabled: true, apiToken: "pk_clickup_secret", listId: "list-1" });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ statuses: [{ status: "open" }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ fields: [{ id: "field-email", name: "E-Mail" }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ tasks: [], last_page: true }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: "task-1" }) });

    await createClickUpTaskForLead({
      companyName: "Example GmbH",
      decisionMakerName: "Erika Muster",
      firstName: null,
      lastName: null,
      decisionMakerEmail: "ERIKA@example.com",
      companyEmail: null,
      phone: null,
      companyPhone: null,
      decisionMakerPhone: "+49 421 123 456",
      source: "Website",
      enrichmentNotes: "Neue Anfrage"
    }, fetcher as never);
    const createCall = fetcher.mock.calls.find(([url]) => String(url).endsWith("/task"));
    const payload = JSON.parse(String(createCall?.[1].body));

    expect(payload.name).toBe("Example GmbH");
    expect(payload.status).toBe("open");
    expect(payload.description).toContain("E-Mail: ERIKA@example.com");
    expect(payload.custom_fields).toEqual([{ id: "field-email", value: "ERIKA@example.com" }]);

    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    if (original === undefined) delete process.env.INTEGRATION_SETTINGS_SECRET;
    else process.env.INTEGRATION_SETTINGS_SECRET = original;
  });

  it("updates an existing ClickUp lead instead of creating a duplicate when email matches", async () => {
    const original = process.env.INTEGRATION_SETTINGS_SECRET;
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    await saveClickUpSettings({ enabled: true, apiToken: "pk_clickup_secret", listId: "list-1" });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ statuses: [{ status: "open" }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ fields: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          tasks: [{ id: "task-1", name: "Existing", description: "E-Mail: erika@example.com\nFirma: Example GmbH" }],
          last_page: true
        })
      })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: "task-1" }) });

    await createClickUpTaskForLead({
      companyName: "Example GmbH",
      decisionMakerName: "Erika Muster",
      firstName: null,
      lastName: null,
      decisionMakerEmail: "ERIKA@example.com",
      companyEmail: null,
      phone: null,
      companyPhone: null,
      decisionMakerPhone: null,
      source: "Website",
      enrichmentNotes: null
    }, fetcher as never);

    expect(fetcher.mock.calls.some(([url]) => String(url) === "https://api.clickup.com/api/v2/list/list-1/task")).toBe(false);
    expect(fetcher).toHaveBeenCalledWith("https://api.clickup.com/api/v2/task/task-1", expect.objectContaining({ method: "PUT" }));

    await prisma.integrationSettings.deleteMany({ where: { type: "clickup" } });
    if (original === undefined) delete process.env.INTEGRATION_SETTINGS_SECRET;
    else process.env.INTEGRATION_SETTINGS_SECRET = original;
  });

  it("uses the stored OpenAI key before the env fallback", async () => {
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    process.env.OPENAI_API_KEY = "sk-env";
    await prisma.integrationSettings.deleteMany({ where: { type: "openai" } });
    await saveOpenAiSettings({ enabled: true, apiKey: "sk-db" });
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await testOpenAiConnection(fetcher as never);

    expect(await getEffectiveOpenAiApiKey()).toBe("sk-db");
    expect(fetcher).toHaveBeenCalledWith("https://api.openai.com/v1/models", {
      headers: { Authorization: "Bearer sk-db" }
    });
  });

  it("falls back to OPENAI_API_KEY when no OpenAI key is stored", async () => {
    process.env.OPENAI_API_KEY = "sk-env";
    await prisma.integrationSettings.deleteMany({ where: { type: "openai" } });
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    expect(await getEffectiveOpenAiApiKey()).toBe("sk-env");
    await testOpenAiConnection(fetcher as never);
    expect(fetcher).toHaveBeenCalledWith("https://api.openai.com/v1/models", {
      headers: { Authorization: "Bearer sk-env" }
    });
  });

  it("does not expose OpenAI keys in safe settings", async () => {
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    process.env.OPENAI_API_KEY = "sk-env";
    await prisma.integrationSettings.deleteMany({ where: { type: "openai" } });
    await saveOpenAiSettings({ enabled: true, apiKey: "sk-db" });

    const safe = await getSafeIntegrationSettings();

    expect(safe.openai).toEqual({ enabled: true, keySet: true, source: "db" });
    expect(JSON.stringify(safe)).not.toContain("sk-db");
    expect(JSON.stringify(safe)).not.toContain("sk-env");
  });

  it("keeps the existing OpenAI key when saving an empty field", async () => {
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    process.env.OPENAI_API_KEY = "sk-env";
    await prisma.integrationSettings.deleteMany({ where: { type: "openai" } });
    await saveOpenAiSettings({ enabled: true, apiKey: "sk-db" });
    await saveOpenAiSettings({ enabled: true, apiKey: "" });

    expect(await getEffectiveOpenAiApiKey()).toBe("sk-db");
  });

  it("reports an OpenAI test error when no key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    await prisma.integrationSettings.deleteMany({ where: { type: "openai" } });

    const response = await testOpenAiRoute();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("OpenAI API Key fehlt");
    expect(JSON.stringify(body)).not.toContain("sk-");
  });

  it("saves and tests OpenAI without SMTP_SETTINGS_SECRET", async () => {
    process.env.INTEGRATION_SETTINGS_SECRET = "integration-secret";
    delete process.env.SMTP_SETTINGS_SECRET;
    delete process.env.OPENAI_API_KEY;
    await prisma.integrationSettings.deleteMany({ where: { type: "openai" } });

    await saveOpenAiSettings({ enabled: true, apiKey: "sk-db" });
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    expect(await getEffectiveOpenAiApiKey()).toBe("sk-db");
    await testOpenAiConnection(fetcher as never);
    expect(fetcher).toHaveBeenCalledWith("https://api.openai.com/v1/models", {
      headers: { Authorization: "Bearer sk-db" }
    });
  });

  it("uses a concrete integration secret error for OpenAI saves", async () => {
    delete process.env.INTEGRATION_SETTINGS_SECRET;
    process.env.SMTP_SETTINGS_SECRET = "smtp-secret-should-not-be-used";
    await prisma.integrationSettings.deleteMany({ where: { type: "openai" } });

    await expect(saveOpenAiSettings({ enabled: true, apiKey: "sk-db" })).rejects.toThrow(
      "INTEGRATION_SETTINGS_SECRET fehlt in der Server-Konfiguration."
    );
  });
});
