import { useEffect, useState } from "react";

/**
 * Height of the on-screen keyboard, in px (proposal §10.6).
 *
 * Android Chrome resizes the layout viewport itself
 * (`interactive-widget=resizes-content`), so the inset there is ~0. iPhone
 * does not, so the visual viewport shrinks while the layout viewport stays —
 * the difference is the keyboard. Sheets pad their bottom by this value, and
 * the focused field is scrolled into view.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

/** Scrolls a focused field into view once the keyboard has opened. */
export function scrollFieldIntoView(el: Element | null) {
  if (!el) return;
  window.setTimeout(() => {
    el.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, 300);
}
