import { describe, expect, it } from "vitest";
import { canSendCampaignNow, getNextAllowedCampaignSendAt } from "@/lib/scheduling";

describe("canSendCampaignNow", () => {
  it("blocks before scheduledStartAt", () => {
    expect(
      canSendCampaignNow(
        { scheduledStartAt: new Date("2026-05-01T10:00:00Z"), weekdaysOnly: false, manualGoApproved: true, sendingStatus: "scheduled" },
        new Date("2026-05-01T09:00:00Z")
      ).allowed
    ).toBe(false);
  });

  it("blocks outside send window", () => {
    expect(
      canSendCampaignNow(
        { timezone: "Europe/Berlin", sendWindowStart: "08:30", sendWindowEnd: "17:30", weekdaysOnly: false, manualGoApproved: true, sendingStatus: "scheduled" },
        new Date("2026-04-27T05:00:00Z")
      ).allowed
    ).toBe(false);
  });

  it("blocks weekends when weekdaysOnly is true", () => {
    expect(
      canSendCampaignNow(
        { timezone: "Europe/Berlin", weekdaysOnly: true, manualGoApproved: true, sendingStatus: "scheduled" },
        new Date("2026-04-25T10:00:00Z")
      ).allowed
    ).toBe(false);
  });

  it("blocks until manual go is approved", () => {
    expect(canSendCampaignNow({ manualGoApproved: false, sendingStatus: "scheduled" }, new Date("2026-04-27T10:00:00Z")).allowed).toBe(false);
  });

  it("blocks when sendingStatus is draft", () => {
    expect(
      canSendCampaignNow(
        {
          manualGoApproved: true,
          sendingStatus: "draft",
          scheduledStartAt: new Date("2026-04-27T08:00:00Z"),
          timezone: "UTC",
          sendWindowStart: "08:00",
          sendWindowEnd: "18:00",
          weekdaysOnly: false
        },
        new Date("2026-04-27T10:00:00Z")
      ).allowed
    ).toBe(false);
  });

  it("allows sending after go and valid time rules", () => {
    expect(
      canSendCampaignNow(
        { manualGoApproved: true, scheduledStartAt: new Date("2026-04-27T08:00:00Z"), timezone: "Europe/Berlin", sendWindowStart: "08:00", sendWindowEnd: "18:00", weekdaysOnly: false, sendingStatus: "scheduled" },
        new Date("2026-04-27T10:00:00Z")
      ).allowed
    ).toBe(true);
  });

  it("moves the next send to the start of the current window", () => {
    expect(
      getNextAllowedCampaignSendAt(
        { timezone: "UTC", sendWindowStart: "09:00", sendWindowEnd: "17:00", weekdaysOnly: false, manualGoApproved: true, sendingStatus: "scheduled" },
        new Date("2026-04-27T08:00:00Z")
      ).toISOString()
    ).toBe("2026-04-27T09:00:00.000Z");
  });

  it("moves the next send to the next weekday when weekends are blocked", () => {
    expect(
      getNextAllowedCampaignSendAt(
        { timezone: "Europe/Berlin", sendWindowStart: "08:00", sendWindowEnd: "18:00", weekdaysOnly: true, manualGoApproved: true, sendingStatus: "scheduled" },
        new Date("2026-04-25T10:00:00Z")
      ).toISOString()
    ).toBe("2026-04-27T06:00:00.000Z");
  });
});
