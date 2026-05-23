import { describe, expect, it } from "vitest";
import { GET as getEmailSettings, PATCH as patchEmailSettings } from "../../app/api/settings/email/route";
import { POST as testEmailConnection } from "../../app/api/settings/email/test-connection/route";
import { decryptSecret, encryptSecret, saveSmtpSettings } from "@/lib/smtp-settings";
import { prisma } from "@/lib/prisma";

describe("stored SMTP settings", () => {
  it("encrypts and decrypts SMTP passwords", () => {
    const encrypted = encryptSecret("secret-password", "test-secret");
    expect(encrypted).not.toContain("secret-password");
    expect(decryptSecret(encrypted, "test-secret")).toBe("secret-password");
  });

  it("does not overwrite an existing password with an empty password", async () => {
    const originalSecret = process.env.SMTP_SETTINGS_SECRET;
    process.env.SMTP_SETTINGS_SECRET = "test-secret";

    await prisma.smtpSettings.deleteMany({ where: { id: "default" } });
    await saveSmtpSettings({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      user: "user",
      password: "first-password",
      fromEmail: "from@example.com",
      fromName: "Tasklytic",
      dailyLimit: 42
    });
    const first = await prisma.smtpSettings.findUniqueOrThrow({ where: { id: "default" } });

    await saveSmtpSettings({
      host: "smtp2.example.com",
      port: 587,
      secure: false,
      user: "user",
      password: "",
      fromEmail: "from@example.com",
      fromName: "Tasklytic",
      dailyLimit: 25
    });
    const second = await prisma.smtpSettings.findUniqueOrThrow({ where: { id: "default" } });

    expect(second.encryptedPassword).toBe(first.encryptedPassword);
    expect(second.dailyLimit).toBe(25);

    await prisma.smtpSettings.deleteMany({ where: { id: "default" } });
    if (originalSecret === undefined) {
      delete process.env.SMTP_SETTINGS_SECRET;
    } else {
      process.env.SMTP_SETTINGS_SECRET = originalSecret;
    }
  });

  it("saves and loads SMTP settings through the email API without returning passwords", async () => {
    const originalSecret = process.env.SMTP_SETTINGS_SECRET;
    process.env.SMTP_SETTINGS_SECRET = "test-secret";
    await prisma.smtpSettings.deleteMany({ where: { id: "default" } });

    const response = await patchEmailSettings(new Request("http://localhost/api/settings/email", {
      method: "PATCH",
      body: JSON.stringify({
        host: "smtp.example.com",
        port: 465,
        secure: true,
        user: "smtp-user",
        password: "stored-password",
        fromEmail: "sender@example.com",
        fromName: "Sender",
        replyToEmail: "reply@example.com",
        dailyLimit: 37
      })
    }));
    const body = await response.json();
    const loadResponse = await getEmailSettings();
    const loaded = await loadResponse.json();

    expect(response.status).toBe(200);
    expect(body.values.SMTP_PASS_SET).toBe(true);
    expect(body.values.EMAIL_MAX_EMAILS_PER_DAY).toBe("37");
    expect(JSON.stringify(body)).not.toContain("stored-password");
    expect(JSON.stringify(loaded)).not.toContain("stored-password");

    await prisma.smtpSettings.deleteMany({ where: { id: "default" } });
    if (originalSecret === undefined) delete process.env.SMTP_SETTINGS_SECRET;
    else process.env.SMTP_SETTINGS_SECRET = originalSecret;
  });

  it("returns a clean SMTP connection error when configuration is missing", async () => {
    const originals = {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_SECURE: process.env.SMTP_SECURE,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
      SMTP_FROM_NAME: process.env.SMTP_FROM_NAME
    };
    await prisma.smtpSettings.deleteMany({ where: { id: "default" } });
    for (const key of Object.keys(originals)) delete process.env[key];

    const response = await testEmailConnection();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBeTruthy();

    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
});
