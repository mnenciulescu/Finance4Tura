import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Book, Operation, Snapshot, SplitPayment } from "../../types";
import { NO_FILTERS, type Filters } from "../library/libraryMath";

/* ── URL state ────────────────────────────────────────────────────────────── */

/**
 * One query parameter of /one-page (tabs, period). Changes replace the
 * history entry, so Back closes dialogs and leaves the page instead of
 * walking through tab clicks. The default value is kept out of the URL.
 */
export function useParam(name: string, fallback: string): [string, (v: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(name) ?? fallback;
  const set = useCallback((v: string | null) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (v == null || v === fallback) next.delete(name);
      else next.set(name, v);
      return next;
    }, { replace: true });
  }, [name, fallback, setParams]);
  return [value, set];
}

/** A parameter restricted to known values; anything else reads as the fallback. */
export function useEnumParam<T extends string>(name: string, values: readonly T[], fallback: T): [T, (v: T) => void] {
  const [raw, set] = useParam(name, fallback);
  return [(values as readonly string[]).includes(raw) ? (raw as T) : fallback, set];
}

/* ── Page context ─────────────────────────────────────────────────────────── */

export type BlockId = "budget" | "split" | "invest" | "stats" | "library" | "hq";

export interface DeskForms {
  openSplit: (t: { entry?: SplitPayment }) => void;
  openBook: (t: { book?: Book; name?: string }) => void;
  openSnapshot: (t: { snap?: Snapshot; date?: string }) => void;
  openOperation: (t: { op?: Operation }) => void;
}

interface OnePageValue extends DeskForms {
  /** Library filters, shared by the Library block and Statistics → Library. */
  filters: Filters;
  setFilters: (f: Filters | ((f: Filters) => Filters)) => void;
  /** Scroll a block into view and flash it (cross-links between blocks). */
  focusBlock: (id: BlockId) => void;
}

export const OnePageContext = createContext<OnePageValue>({
  filters: NO_FILTERS,
  setFilters: () => {},
  focusBlock: () => {},
  openSplit: () => {},
  openBook: () => {},
  openSnapshot: () => {},
  openOperation: () => {},
});

export const useOnePage = () => useContext(OnePageContext);

/* ── Commands (keyboard shortcuts → blocks) ───────────────────────────────── */

export const PERIOD_EVENT = "onepage:period";
export const SEARCH_EVENT = "onepage:search";

/** Listen for a page command dispatched on window. */
export function useCommand<T>(event: string, handler: (detail: T) => void) {
  useEffect(() => {
    const on = (e: Event) => handler((e as CustomEvent<T>).detail);
    window.addEventListener(event, on);
    return () => window.removeEventListener(event, on);
  });
}

export const sendCommand = <T,>(event: string, detail?: T) => window.dispatchEvent(new CustomEvent(event, { detail }));

/* ── Layout ───────────────────────────────────────────────────────────────── */

const query = (q: string) => typeof window !== "undefined" && !!window.matchMedia?.(q).matches;

/** 3 columns from 1280 px, 2 from 1024 px, 1 below. */
export function useColumns(): 1 | 2 | 3 {
  const read = () => (query("(min-width: 1280px)") ? 3 : query("(min-width: 1024px)") ? 2 : 1);
  const [cols, setCols] = useState<1 | 2 | 3>(read);
  useEffect(() => {
    const onResize = () => setCols(read());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return cols;
}

/* ── Collapsed blocks (per browser) ───────────────────────────────────────── */

const COLLAPSED_KEY = "onePage.collapsed";

export function readCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "{}"); } catch { return {}; }
}
export function writeCollapsed(v: Record<string, boolean>) {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}
