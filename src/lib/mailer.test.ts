import { describe, expect, it } from "vitest";
import { getSmtpConfig } from "@/lib/mailer";

describe("getSmtpConfig", () => {
  it("validates and normalizes SMTP env values", () => {
    expect(
      getSmtpConfig({
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "465",
        SMTP_SECURE: "true",
        SMTP_USER: "user",
        SMTP_PASS: "pass",
        SMTP_FROM_EMAIL: "hello@example.com",
        SMTP_FROM_NAME: "Tasklytic"
      })
    ).toMatchObject({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: 465,
      SMTP_SECURE: true,
      SMTP_USER: "user",
      SMTP_FROM_EMAIL: "hello@example.com"
    });
  });

  it("rejects incomplete SMTP config", () => {
    expect(() => getSmtpConfig({})).toThrow();
  });
});
