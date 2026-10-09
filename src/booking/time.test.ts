import { describe, expect, it } from "vitest";
import { formatDuration, zonedToIso } from "./time";

describe("service time zone", () => {
  it("reads a wall-clock time as London time in summer and winter", () => {
    expect(zonedToIso("2026-07-01", "09:30")).toBe("2026-07-01T08:30:00.000Z");
    expect(zonedToIso("2026-12-01", "09:30")).toBe("2026-12-01T09:30:00.000Z");
  });

  it("formats durations", () => {
    expect(formatDuration(45 * 60)).toBe("45 min");
    expect(formatDuration(95 * 60)).toBe("1 h 35 min");
  });
});
