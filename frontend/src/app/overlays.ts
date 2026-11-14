import { useEffect, useRef } from "react";

/**
 * Overlay stack mirrored in browser history (proposal §10.3).
 *
 * Every sheet, alert, action sheet and menu registers here while open:
 *
 *  1. Opening pushes a history entry (same URL, router state preserved).
 *  2. System back (Android button / gesture, browser back) pops that entry;
 *     the popstate closes the top overlay only.
 *  3. Closing from the UI (Cancel, scrim, drag, Save) calls history.back() so
 *     history and UI stay in step. A counter swallows the popstate we caused.
 *  4. An overlay can veto a back press (dirty form): the entry is re-pushed
 *     and the overlay's own veto handler runs (e.g. "Discard changes?").
 *  5. An overlay that leads to a navigation must call `consume()` first and
 *     then navigate with `replace: true`: the overlay's entry becomes the new
 *     screen instead of being popped (which would undo the navigation).
 *
 * Installed iPhone PWAs have no system back, so on iPhone only the app's own
 * controls drive this — through the same code path.
 */

interface Entry {
  id: number;
  close: () => void;
  veto?: () => boolean;
  consumed: boolean;
}

const stack: Entry[] = [];
let nextId = 1;
let swallow = 0;
let listening = false;

function onPopState() {
  if (swallow > 0) {
    swallow--;
    return;
  }
  const top = stack[stack.length - 1];
  if (!top) return;
  if (top.veto?.()) {
    // Keep the overlay open: restore the entry the back press removed.
    pushEntry(top.id);
    return;
  }
  stack.pop();
  top.consumed = true;
  top.close();
}

function ensureListener() {
  if (listening || typeof window === "undefined") return;
  window.addEventListener("popstate", onPopState);
  listening = true;
}

function pushEntry(id: number) {
  try {
    const state = (window.history.state && typeof window.history.state === "object") ? window.history.state : {};
    window.history.pushState({ ...state, __overlay: id }, "");
  } catch {
    /* sandboxed history — overlays still work, just without back support */
  }
}

/** Number of overlays currently open (used by the tab bar and tests). */
export const openOverlayCount = () => stack.length;

/**
 * Registers an overlay while `isOpen` is true. `onClose` is called when the
 * system back closes it; when the UI closes it (isOpen → false), the history
 * entry is removed automatically.
 *
 * `veto`, if given, is consulted on back presses: return true to keep the
 * overlay open (and show a confirmation of your own).
 */
export function useOverlayHistory(isOpen: boolean, onClose: () => void, veto?: () => boolean) {
  const closeRef = useRef(onClose);
  const vetoRef = useRef(veto);
  const entryRef = useRef<Entry | null>(null);

  useEffect(() => {
    closeRef.current = onClose;
    vetoRef.current = veto;
  });

  useEffect(() => {
    if (!isOpen) return;
    ensureListener();
    const entry: Entry = {
      id: nextId++,
      close: () => closeRef.current(),
      veto: () => !!vetoRef.current?.(),
      consumed: false,
    };
    stack.push(entry);
    entryRef.current = entry;
    pushEntry(entry.id);

    return () => {
      entryRef.current = null;
      const idx = stack.indexOf(entry);
      if (idx !== -1) stack.splice(idx, 1);
      if (entry.consumed) return;
      entry.consumed = true;
      // Closed by the UI (or unmounted): drop the history entry we pushed.
      swallow++;
      try {
        window.history.back();
      } catch {
        swallow--;
      }
    };
  }, [isOpen]);

  /** Call before navigating away from inside the overlay (then navigate with replace). */
  return {
    consume: () => {
      const e = entryRef.current;
      if (e) e.consumed = true;
    },
  };
}

/** Test helper: forget every overlay (between tests). */
export function __resetOverlays() {
  stack.length = 0;
  swallow = 0;
}
