import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Nav } from "./components/Nav";
import { ScrollTrigger } from "./lib/gsap";
import { AboutPage } from "./pages/AboutPage";
import { AnalyzePage } from "./pages/AnalyzePage";
import { HomePage } from "./pages/HomePage";
import { MarketsPage } from "./pages/MarketsPage";
import { MethodologyPage, NotFoundPage } from "./pages/SimplePages";
import { StockPage } from "./pages/StockPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { Footer } from "./sections/Methodology";

const TITLES: Record<string, string> = {
  "/": "Folio — Portfolio Analytics",
  "/markets": "Markets — Folio",
  "/analyze": "Analyze a portfolio — Folio",
  "/watchlist": "Watchlist — Folio",
  "/methodology": "Methodology — Folio",
  "/about": "About — Folio",
};

/** New page → start at the top (unless following an #anchor) and re-measure scroll animations. */
function RouteEffects() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    // "instant": the site's CSS uses smooth scrolling, which would animate page changes.
    if (!hash) window.scrollTo({ top: 0, behavior: "instant" });
    if (TITLES[pathname]) document.title = TITLES[pathname];
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 100);
    return () => window.clearTimeout(id);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <RouteEffects />
      <Nav />
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/stock/:ticker" element={<StockPage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
