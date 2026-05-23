import { describe, expect, it } from "vitest";
import { connectedAccountData, validateConnectedAccount } from "@/lib/connected-accounts";

describe("connected accounts", () => {
  it("normalizes optional provider and notes", () => {
    expect(connectedAccountData({
      name: "  Demo  ",
      type: " OpenAI ",
      provider: " ",
      notes: ""
    })).toEqual({
      name: "Demo",
      type: "OPENAI",
      provider: null,
      notes: null
    });
  });

  it("stores unknown account types as CUSTOM", () => {
    expect(connectedAccountData({
      name: "Demo",
      type: "bzgzg",
      provider: "gzgzg"
    })).toMatchObject({
      name: "Demo",
      type: "CUSTOM",
      provider: "gzgzg"
    });
  });

  it("requires a name", () => {
    expect(() => validateConnectedAccount({ name: "", type: "CUSTOM", provider: null, notes: null })).toThrow("Name ist erforderlich.");
  });
});
