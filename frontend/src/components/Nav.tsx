import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { SearchPalette } from "./SearchPalette";

const LINKS = [
  { to: "/markets", label: "Markets" },
  { to: "/analyze", label: "Analyze" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/methodology", label: "Methodology" },
  { to: "/about", label: "About" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  // Ctrl/⌘ + K or "/" opens search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const solid = scrolled || pathname !== "/" || menuOpen;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-out ${
          solid ? "border-b border-line bg-paper/[0.86] backdrop-blur-xl backdrop-saturate-150" : "border-b border-transparent"
        }`}
      >
        <nav className="page flex h-14 items-center justify-between gap-4" aria-label="Primary">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
            <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="7" fill="#0f0f0f" />
              <path d="M7 21.5 L13 15.5 L17 18.5 L25 10" fill="none" stroke="#f6f5f1" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Folio
          </Link>
          <ul className="hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1.5 text-[13px] transition-colors ${isActive ? "text-ink" : "text-ink-2 hover:text-ink"}`
                  }
                >
                  {({ isActive }) => (
                    <span className="relative">
                      {l.label}
                      {isActive && <span className="absolute -bottom-[7px] left-0 right-0 h-px bg-ink" />}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-full border border-line bg-white/60 px-3 py-1.5 text-[13px] text-ink-3 transition-colors hover:border-ink/25 hover:text-ink sm:w-56"
              aria-label="Search stocks"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="hidden flex-1 text-left sm:inline">Search stocks</span>
              <kbd className="hidden rounded border border-line px-1 text-[10px] sm:inline">Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/[0.05] lg:hidden"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d={menuOpen ? "M3 3l10 10M13 3L3 13" : "M2 5h12M2 11h12"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <Link to="/analyze" className="hidden rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-paper transition-colors hover:bg-black sm:inline-block">
              Analyze
            </Link>
          </div>
        </nav>
        {menuOpen && (
          <ul className="page border-t border-line pb-4 pt-2 lg:hidden">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} className={({ isActive }) => `block py-2.5 text-[15px] ${isActive ? "font-semibold" : "text-ink-2"}`}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </header>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
