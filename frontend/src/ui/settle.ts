import type { MotionValue } from "motion/react";

/**
 * Moves a dragged element to `to` with a CSS transition instead of Motion's
 * animation engine (keeps that engine out of the first download). Motion
 * writes the motion value into the inline transform; the transition animates it.
 */
export function settle(node: HTMLElement | null, value: MotionValue<number>, to: number, ms = 260): Promise<void> {
  return new Promise(resolve => {
    if (!node) { value.set(to); resolve(); return; }
    node.style.transition = `transform ${ms}ms cubic-bezier(0.32, 0.72, 0, 1)`;
    value.set(to);
    window.setTimeout(() => {
      node.style.transition = "";
      resolve();
    }, ms + 20);
  });
}
