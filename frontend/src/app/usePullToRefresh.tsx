import { useEffect, useRef, useState } from "react";
import { openOverlayCount } from "./overlays";
import { haptic } from "./haptics";
import s from "./PullToRefresh.module.css";

const TRIGGER = 64;
const MAX = 110;

/**
 * Pull-to-refresh on the document scroller (proposal §10.7).
 *
 * `overscroll-behavior: none` disables both the iOS rubber band and Chrome's
 * own pull-to-refresh, so this indicator is the only one, on every platform.
 */
export function usePullToRefresh(onRefresh?: () => Promise<unknown> | void) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const cb = useRef(onRefresh);
  const pullRef = useRef(0);
  const busy = useRef(false);
  cb.current = onRefresh;
  const enabled = !!onRefresh;

  useEffect(() => {
    if (!enabled) return;
    let startY: number | null = null;
    let active = false;
    let fired = false;

    const set = (v: number) => { pullRef.current = v; setPull(v); };

    const onStart = (e: TouchEvent) => {
      if (busy.current || window.scrollY > 0 || openOverlayCount() > 0 || e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      active = true;
      fired = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!active || startY == null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) { set(0); if (dy < 0) active = false; return; }
      if (e.cancelable) e.preventDefault();
      const next = Math.min(MAX, dy * 0.5);
      if (next >= TRIGGER && !fired) { fired = true; haptic("light"); }
      set(next);
    };
    const onEnd = async () => {
      if (!active) return;
      active = false;
      startY = null;
      if (pullRef.current >= TRIGGER && cb.current) {
        busy.current = true;
        setRefreshing(true);
        set(48);
        try { await cb.current(); } finally {
          busy.current = false;
          setRefreshing(false);
          set(0);
        }
      } else {
        set(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);

  const progress = Math.min(1, pull / TRIGGER);
  const indicator = enabled ? (
    <div
      className={s.ptr}
      style={{ height: pull, transition: pull === 0 || refreshing ? "height 250ms cubic-bezier(.2,.8,.2,1)" : "none" }}
      aria-hidden={!refreshing}
      role={refreshing ? "status" : undefined}
      aria-label={refreshing ? "Refreshing" : undefined}
    >
      <span
        className={[s.spinner, refreshing ? s.spinning : ""].join(" ")}
        style={{ opacity: progress, transform: `rotate(${progress * 270}deg)` }}
      />
    </div>
  ) : null;

  return { indicator, bind: {}, refreshing };
}
