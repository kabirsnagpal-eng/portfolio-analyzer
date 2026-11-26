import { useCallback, useSyncExternalStore } from "react";

/**
 * Watchlist stored in this browser (localStorage). No account needed; it stays
 * on this device. Syncs across components and browser tabs.
 */
export interface WatchItem {
  ticker: string;
  name: string;
  added: string; // ISO date
}

const KEY = "folio.watchlist.v1";
const EVENT = "folio-watchlist";
let cache: WatchItem[] | null = null;

function read(): WatchItem[] {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed.filter((x) => x && typeof x.ticker === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: WatchItem[]) {
  cache = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full or blocked: keep the in-memory copy for this session */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: WatchItem[] = [];

export function useWatchlist() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  const has = useCallback((ticker: string) => items.some((i) => i.ticker === ticker), [items]);
  const toggle = useCallback((ticker: string, name: string) => {
    const cur = read();
    write(
      cur.some((i) => i.ticker === ticker)
        ? cur.filter((i) => i.ticker !== ticker)
        : [...cur, { ticker, name, added: new Date().toLocaleDateString("en-CA") }],
    );
  }, []);
  const remove = useCallback((ticker: string) => write(read().filter((i) => i.ticker !== ticker)), []);
  return { items, has, toggle, remove };
}
