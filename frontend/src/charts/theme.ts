/**
 * Chart tokens. Categorical slots follow the validated order in the dataviz
 * reference palette (blue, orange, aqua, yellow, magenta, green, violet, red)
 * and are assigned by entity position, never cycled; holdings beyond eight are
 * folded into "Other". The benchmark is a recessive warm grey so the
 * portfolio always reads as the primary series.
 */
export const CHART = {
  portfolio: "#2a78d6",
  benchmark: "#8b8880",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  tick: "#8b8880",
  surface: "#f6f5f1",
  ink: "#0f0f0f",
  episode: "rgba(15,15,15,0.045)",
};

export const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const OTHER_COLOR = "#c3c2b7";

/**
 * Explicit x-axis ticks so labels never repeat: the first trading day of each
 * year for long ranges, or of each quarter for short ones. Thinned to at most
 * `max` labels.
 */
export function dateTicks(dates: string[], max = 8): { ticks: string[]; format: (d: string) => string } {
  if (dates.length < 2) return { ticks: dates, format: (d) => d };
  const years = (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / (365.25 * 86_400_000);
  const byYear = years > 2.5;
  const keyOf = (d: string) => (byYear ? d.slice(0, 4) : `${d.slice(0, 4)}-${Math.floor((Number(d.slice(5, 7)) - 1) / 3)}`);
  const ticks: string[] = [];
  let prev = keyOf(dates[0]);
  for (const d of dates) {
    const k = keyOf(d);
    if (k !== prev) ticks.push(d);
    prev = k;
  }
  const step = Math.ceil(ticks.length / max);
  const thinned = ticks.filter((_, i) => i % step === 0);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  return {
    ticks: thinned,
    format: byYear ? (d) => d.slice(0, 4) : (d) => month.format(new Date(`${d}T00:00:00Z`)),
  };
}

export const TICK_STYLE = { fill: CHART.tick, fontSize: 11, fontFamily: '"Inter Tight", system-ui, sans-serif' };
