import { describe, expect, it } from "vitest";
import { exchangeDay, exchangeTime } from "./LivePanel";

describe("live quote time labels", () => {
  it("shows the exchange's own clock time and zone", () => {
    expect(exchangeTime("2026-11-26T15:28:00+05:30")).toBe("15:28 IST");
    expect(exchangeTime("2026-11-26T15:59:00-05:00")).toBe("15:59 ET");
    expect(exchangeTime("2026-11-26T08:00:00Z")).toBe("08:00 UTC");
    expect(exchangeTime("2026-11-26T08:00:00+09:00")).toBe("08:00 UTC+09:00");
  });

  it("uses the exchange's calendar date, not the viewer's", () => {
    expect(exchangeDay("2026-11-26T23:30:00-05:00")).toBe("26 Nov");
  });
});
