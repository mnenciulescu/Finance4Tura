import type { NavigateFunction, Location } from "react-router-dom";
import { TABS, tabForPath, type TabId } from "./navigation";

/**
 * Tab switching and history (proposal §5.1, §10.3).
 *
 * Per-tab stacks live in app state: each tab remembers the last location it
 * showed and its scroll position. Browser history only ever holds the active
 * tab's pushed screens and open overlays, which makes system back behave:
 *
 *  - switching tabs replaces the entry, except leaving Today, which pushes
 *    once — so there is always exactly one Today entry beneath the other tabs;
 *  - back at another tab's root therefore returns to Today;
 *  - back at Today's root leaves the app.
 */

const lastLocation: Partial<Record<TabId, string>> = {};
const scrollPos: Partial<Record<TabId, number>> = {};
/** history.state.idx of the Today entry beneath the other tabs. */
let todayIdx: number | null = null;

const historyIdx = (): number | null => {
  const st = window.history.state as { idx?: number } | null;
  return typeof st?.idx === "number" ? st.idx : null;
};

export const TAB_RESELECT_EVENT = "tab-reselect";

export function currentTab(location: Location): TabId {
  return tabForPath(location.pathname, (location.state as { ownerTab?: TabId } | null)?.ownerTab);
}

export function savedScroll(tab: TabId): number {
  return scrollPos[tab] ?? 0;
}

/**
 * Where the last tab switch went. Route changes render as a transition, so
 * while a lazy screen loads the URL is already there but the rendered
 * location (and the tab bar) still shows the previous tab. A second tap in
 * that window must start from the URL, or leaving Today would push twice.
 */
let pending: { pathname: string; search: string } | null = null;

/** Called by the tab bar once a location has rendered. */
export function syncRenderedLocation(location: Location) {
  if (pending && pending.pathname === location.pathname && pending.search === location.search) pending = null;
}

export function selectTab(target: TabId, rendered: Location, navigate: NavigateFunction) {
  const location: Location = pending ? { ...rendered, ...pending, state: null } : rendered;
  const go = (to: string, replace: boolean) => {
    const [pathname, query] = to.split("?");
    pending = { pathname, search: query ? `?${query}` : "" };
    navigate(to, { replace });
  };
  const from = currentTab(location);
  const def = TABS.find(t => t.id === target)!;
  const here = location.pathname + location.search;

  if (target === from) {
    // Re-selecting: pop to the tab's root, or at the root scroll to the top
    // (Money → Budget also jumps back to the current income period).
    if (location.pathname !== def.root || location.search) {
      go(def.root, true);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    lastLocation[target] = def.root;
    window.dispatchEvent(new CustomEvent(TAB_RESELECT_EVENT, { detail: target }));
    return;
  }

  // Remember where this tab was (only its own screens, not account screens).
  if (TABS.find(t => t.id === from)?.owns(location.pathname)) lastLocation[from] = here;
  scrollPos[from] = window.scrollY;

  const dest = lastLocation[target] ?? def.root;

  if (target === "today") {
    const idx = historyIdx();
    if (todayIdx != null && idx != null && idx > todayIdx) {
      pending = { pathname: "/", search: "" };
      navigate(todayIdx - idx);
    } else {
      go("/", true);
    }
    todayIdx = null;
    return;
  }

  if (from === "today") {
    todayIdx = historyIdx();
    go(dest, false);
  } else {
    go(dest, true);
  }
}

/** Test helper. */
export function __resetTabHistory() {
  for (const k of Object.keys(lastLocation)) delete lastLocation[k as TabId];
  for (const k of Object.keys(scrollPos)) delete scrollPos[k as TabId];
  todayIdx = null;
  pending = null;
}
