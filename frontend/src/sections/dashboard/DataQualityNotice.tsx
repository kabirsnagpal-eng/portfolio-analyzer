import { useState } from "react";
import type { DataQuality } from "../../types/api";

const LABEL = {
  complete: "Complete data",
  adjusted: "Data adjusted",
  incomplete: "Incomplete data",
} as const;

/** Discloses every cleaning step applied to the price data. Never hidden when something was changed. */
export function DataQualityNotice({ quality }: { quality: DataQuality }) {
  const [open, setOpen] = useState(quality.status === "incomplete");
  if (quality.warnings.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-ink-3">
        <span className="h-1.5 w-1.5 rounded-full bg-gain" aria-hidden="true" />
        {LABEL.complete} — every security had a price on every aligned trading day.
      </p>
    );
  }
  const incomplete = quality.status === "incomplete";
  return (
    <div className={`rounded-lg border px-5 py-4 text-[13px] ${incomplete ? "border-loss/25 bg-loss/[0.04]" : "border-line bg-paper-2/60"}`} role={incomplete ? "alert" : "status"}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2 font-medium">
          <span aria-hidden="true" className={incomplete ? "text-loss" : "text-ink-3"}>{incomplete ? "▲" : "●"}</span>
          {LABEL[quality.status]}
          <span className="font-normal text-ink-3">
            · {quality.warnings.length} note{quality.warnings.length > 1 ? "s" : ""}
          </span>
        </span>
        <span className="text-ink-3">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-ink-2">
          {quality.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
