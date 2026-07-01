import { describe, expect, it } from "vitest";
import { derivePresenceStatus } from "./supabaseData";

describe("derivePresenceStatus", () => {
  it("returns today for a check-in from the current day", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");
    expect(derivePresenceStatus("2026-07-01T10:00:00.000Z", now)).toBe("today");
  });

  it("returns yesterday for a check-in from the previous day", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");
    expect(derivePresenceStatus("2026-06-30T10:00:00.000Z", now)).toBe("yesterday");
  });

  it("returns few-days for older check-ins", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");
    expect(derivePresenceStatus("2026-06-25T10:00:00.000Z", now)).toBe("few-days");
  });
});
