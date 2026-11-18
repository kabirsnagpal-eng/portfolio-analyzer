import { useEffect, useId, useRef, useState } from "react";

interface Props {
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
  dark?: boolean;
}

/**
 * Small "i" button revealing an explanation. Opens on hover, focus or tap;
 * closes on Escape or outside click. Content is linked via aria-describedby.
 */
export function InfoTip({ label, children, align = "left", dark = false }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <span
      ref={wrap}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`grid h-[18px] w-[18px] place-items-center rounded-full border text-[10px] font-semibold italic leading-none transition-colors ${
          dark
            ? "border-white/25 text-night-mute hover:border-white/60 hover:text-night-text"
            : "border-ink/20 text-ink-3 hover:border-ink/50 hover:text-ink"
        }`}
        style={{ fontFamily: "Georgia, serif" }}
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute top-[calc(100%+10px)] z-30 w-[min(300px,80vw)] rounded-lg bg-ink px-4 py-3 text-left text-[13px] font-normal normal-case leading-relaxed tracking-normal text-paper shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)] transition-all duration-200 ease-out ${
          align === "right" ? "right-0" : "left-0"
        } ${open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}
      >
        {children}
      </span>
    </span>
  );
}
