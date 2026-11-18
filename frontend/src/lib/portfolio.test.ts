import { describe, expect, it } from "vitest";
import { costWeights, defaultDraft, equalWeights, parseNumber, switchMode, toRequest, totalWeight, validateDraft } from "./portfolio";
import { formatCurrency, formatPercent, formatPoints, formatRatio } from "./format";

const today = new Date("2026-06-01T00:00:00Z");

describe("validateDraft", () => {
  it("accepts the default example portfolio", () => {
    const r = validateDraft(defaultDraft(today), today);
    expect(r.valid).toBe(true);
    expect(r.totalWeight).toBe(100);
  });

  it("rejects weights that do not total 100%", () => {
    const d = defaultDraft(today);
    d.holdings[0].weight = "50";
    const r = validateDraft(d, today);
    expect(r.valid).toBe(false);
    expect(r.formErrors[0]).toContain("110%");
  });

  it("tolerates tiny floating residue", () => {
    const d = defaultDraft(today);
    d.holdings = d.holdings.map((h, i) => ({ ...h, weight: ["33.333", "33.333", "33.334"][i] }));
    expect(validateDraft(d, today).valid).toBe(true);
  });

  it("flags duplicate and malformed tickers per row", () => {
    const d = defaultDraft(today);
    d.holdings[1].ticker = "reliance.ns";
    d.holdings[2].ticker = "bad ticker";
    const r = validateDraft(d, today);
    expect(r.holdingErrors[d.holdings[1].id].ticker).toBe("Duplicate ticker");
    expect(r.holdingErrors[d.holdings[2].id].ticker).toBe("Not a valid symbol");
  });

  it("validates dates and numeric fields", () => {
    const d = defaultDraft(today);
    d.endDate = "2027-01-01";
    d.initialInvestment = "0";
    d.riskFreeRate = "abc";
    const r = validateDraft(d, today);
    expect(r.fieldErrors.endDate).toBeDefined();
    expect(r.fieldErrors.initialInvestment).toBeDefined();
    expect(r.fieldErrors.riskFreeRate).toBeDefined();
  });
});

describe("toRequest", () => {
  it("converts percentages to fractions and normalises tickers", () => {
    const d = defaultDraft(today);
    d.holdings[0].ticker = " reliance.ns ";
    d.initialInvestment = "1,00,000";
    const req = toRequest(d);
    expect(req.holdings[0]).toEqual({ ticker: "RELIANCE.NS", weight: 0.4 });
    expect(req.initial_investment).toBe(100000);
    expect(req.risk_free_rate).toBeCloseTo(0.065);
  });
});

describe("shares mode", () => {
  const sharesDraft = () => {
    const d = defaultDraft(today);
    d.mode = "shares";
    // 30 × 1250 = 37,500 ; 10 × 3400 = 34,000 ; 20 × 1500 = 30,000 ; total 1,01,500
    const inputs: [string, string][] = [["30", "1250"], ["10", "3400"], ["20", "1500"]];
    d.holdings = d.holdings.map((h, i) => ({ ...h, weight: "", shares: inputs[i][0], price: inputs[i][1] }));
    return d;
  };

  it("derives weights from cost and uses total cost as the initial investment", () => {
    const d = sharesDraft();
    const r = validateDraft(d, today);
    expect(r.valid).toBe(true);
    expect(r.totalCost).toBe(101500);
    const req = toRequest(d);
    expect(req.initial_investment).toBe(101500);
    expect(req.holdings.map((h) => h.weight)).toEqual([37500 / 101500, 34000 / 101500, 30000 / 101500]);
    expect(req.holdings.reduce((s, h) => s + h.weight, 0)).toBeCloseTo(1, 12);
    expect(costWeights(d.holdings)[0]).toBeCloseTo(0.3695, 4);
  });

  it("validates shares and price per row and ignores the weight fields", () => {
    const d = sharesDraft();
    d.holdings[0].shares = "0";
    d.holdings[1].price = "";
    d.initialInvestment = "";
    const r = validateDraft(d, today);
    expect(r.holdingErrors[d.holdings[0].id].shares).toBe("Must be above 0");
    expect(r.holdingErrors[d.holdings[1].id].price).toBe("Enter a price");
    expect(r.fieldErrors.initialInvestment).toBeUndefined();
    expect(r.formErrors).toEqual([]);
  });

  it("switching to weights carries cost shares and total across", () => {
    const w = switchMode(sharesDraft(), "weights");
    expect(w.mode).toBe("weights");
    expect(w.initialInvestment).toBe("101500");
    expect(w.holdings.map((h) => h.weight)).toEqual(["36.95", "33.5", "29.55"]);
    expect(validateDraft(w, today).valid).toBe(true);
  });
});

describe("helpers", () => {
  it("equalWeights always sums to exactly 100", () => {
    for (const n of [1, 3, 6, 7, 11]) {
      const total = equalWeights(n).reduce((s, w) => s + Number(w), 0);
      expect(Math.round(total * 100) / 100).toBe(100);
    }
  });
  it("parseNumber strips formatting", () => {
    expect(parseNumber("₹ 1,00,000")).toBe(100000);
    expect(parseNumber("")).toBeNaN();
    expect(totalWeight([{ id: "a", ticker: "A", weight: "x", shares: "", price: "" }])).toBe(0);
  });
  it("formats numbers for display", () => {
    expect(formatCurrency(100000)).toBe("₹1,00,000");
    expect(formatPercent(0.1234)).toBe("12.34%");
    expect(formatPercent(-0.05, 1)).toBe("−5.0%");
    expect(formatPercent(0.05, 1, true)).toBe("+5.0%");
    expect(formatPoints(0.0523)).toBe("+5.23 pp");
    expect(formatRatio(null)).toBe("Not defined");
  });
});
