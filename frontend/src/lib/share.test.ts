import { describe, expect, it } from "vitest";
import { queryToDraft, requestToQuery } from "./share";
import { toRequest, validateDraft } from "./portfolio";

const today = new Date("2026-11-27T00:00:00Z");

describe("share links", () => {
  it("round-trips an analysis request through the URL", () => {
    const req = {
      holdings: [
        { ticker: "RELIANCE.NS", weight: 0.4 },
        { ticker: "TCS.NS", weight: 0.3 },
        { ticker: "INFY.NS", weight: 0.3 },
      ],
      start_date: "2021-11-26",
      end_date: "2026-11-26",
      benchmark: "^NSEI",
      initial_investment: 250000,
      risk_free_rate: 0.07,
      live: true,
    };
    const parsed = queryToDraft(new URLSearchParams(requestToQuery(req)), today)!;
    expect(parsed.autoRun).toBe(true);
    expect(validateDraft(parsed.draft, today).valid).toBe(true);
    const back = toRequest(parsed.draft);
    expect(back.holdings).toEqual(req.holdings);
    expect(back).toMatchObject({ start_date: "2021-11-26", end_date: "2026-11-26", benchmark: "^NSEI", initial_investment: 250000 });
    expect(back.risk_free_rate).toBeCloseTo(0.07);
  });

  it("opens the analyzer with a single stock from ?add=", () => {
    const parsed = queryToDraft(new URLSearchParams("add=hdfcbank.ns"), today)!;
    expect(parsed.draft.holdings.map((h) => [h.ticker, h.weight])).toEqual([["HDFCBANK.NS", "100"]]);
    expect(parsed.autoRun).toBe(false);
  });

  it("ignores links without holdings and malformed values", () => {
    expect(queryToDraft(new URLSearchParams("start=2020-01-01"), today)).toBeNull();
    const parsed = queryToDraft(new URLSearchParams("h=A.NS:50,BAD,B.NS:x,C.NS:50&start=yesterday"), today)!;
    expect(parsed.draft.holdings.map((h) => h.ticker)).toEqual(["A.NS", "C.NS"]);
    expect(parsed.draft.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
