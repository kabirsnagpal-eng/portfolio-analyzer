/** Display formatting. Pure functions; all inputs are decimal fractions unless noted. */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const price = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,00,000 (Indian digit grouping). */
export function formatCurrency(value: number): string {
  return inr.format(Math.round(value));
}

/** ₹1.25 L / ₹3.4 Cr style for tight spaces. */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹${inrCompact.format(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${inrCompact.format(abs / 1e5)} L`;
  return `${sign}${inr.format(Math.round(abs))}`;
}

export function formatPrice(value: number): string {
  return price.format(value);
}

/** 0.1234 -> "12.34%"; signed adds "+" for positives. Uses a true minus sign. */
export function formatPercent(value: number, digits = 2, signed = false): string {
  if (!Number.isFinite(value)) return "—";
  const pct = (value * 100).toFixed(digits);
  const isZero = Number(pct) === 0;
  if (value < 0 && !isZero) return `−${pct.slice(1)}%`;
  return `${signed && !isZero ? "+" : ""}${isZero ? (0).toFixed(digits) : pct}%`;
}

/** Percentage points: 0.052 -> "+5.20 pp". */
export function formatPoints(value: number, digits = 2): string {
  return formatPercent(value, digits, true).replace("%", " pp");
}

export function formatRatio(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "Not defined";
  return value < 0 ? `−${Math.abs(value).toFixed(digits)}` : value.toFixed(digits);
}

const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** "2024-03-15" -> "15 Mar 2024" (parsed as UTC to avoid timezone day shifts). */
export function formatDate(iso: string): string {
  return longDate.format(new Date(`${iso}T00:00:00Z`));
}

export function formatMonthYear(iso: string): string {
  return monthYear.format(new Date(`${iso}T00:00:00Z`));
}

export function toneOf(value: number): "gain" | "loss" | "flat" {
  if (value > 1e-12) return "gain";
  if (value < -1e-12) return "loss";
  return "flat";
}
