import { describe, expect, it } from "vitest";
import { parseTestEmailPayload } from "@/lib/settings";
import { getEnvSmtpStatus } from "@/lib/smtp-settings";
import { GET as getSmtpSettings } from "../../app/api/settings/smtp/route";

describe("SMTP settings status", () => {
  it("detects complete SMTP configuration", () => {
    const status = getEnvSmtpStatus({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "user",
      SMTP_PASS: "secret",
      SMTP_FROM_EMAIL: "hello@example.com",
      SMTP_FROM_NAME: "Tasklytic"
    });

    expect(status.configured).toBe(true);
    expect(status.missingFields).toEqual([]);
    expect(status.values.SMTP_PASS_SET).toBe(true);
  });

  it("detects incomplete SMTP configuration", () => {
    const status = getEnvSmtpStatus({
      SMTP_HOST: "smtp.example.com"
    });

    expect(status.configured).toBe(false);
    expect(status.missingFields).toContain("SMTP_PASS");
  });

  it("does not expose cleartext SMTP passwords through the API", async () => {
    const originalPass = process.env.SMTP_PASS;
    process.env.SMTP_PASS = "super-secret";

    const response = await getSmtpSettings();
    const data = await response.json();

    expect(JSON.stringify(data)).not.toContain("super-secret");
    expect(data.values.SMTP_PASS_SET).toBe(true);

    if (originalPass === undefined) {
      delete process.env.SMTP_PASS;
    } else {
      process.env.SMTP_PASS = originalPass;
    }
  });
});

describe("test email payload", () => {
  it("validates recipient email addresses", () => {
    expect(parseTestEmailPayload({ to: "test@example.com" })).toEqual({ to: "test@example.com" });
    expect(() => parseTestEmailPayload({ to: "not-an-email" })).toThrow();
  });
});
