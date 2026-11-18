import { useEffect, useState } from "react";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#analyze", label: "Analyze" },
  { href: "#results", label: "Results" },
  { href: "#method", label: "Methodology" },
];

export function Nav({ hasResults }: { hasResults: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-out ${
        scrolled ? "border-b border-line bg-paper/[0.86] backdrop-blur-xl backdrop-saturate-150" : "border-b border-transparent"
      }`}
    >
      <nav className="page flex h-14 items-center justify-between" aria-label="Primary">
        <a href="#top" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0f0f0f" />
            <path d="M7 21.5 L13 15.5 L17 18.5 L25 10" fill="none" stroke="#f6f5f1" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Folio
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.filter((l) => l.href !== "#results" || hasResults).map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-full px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:text-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <a href="#analyze" className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-paper transition-colors hover:bg-black">
          Analyze
        </a>
      </nav>
    </header>
  );
}
