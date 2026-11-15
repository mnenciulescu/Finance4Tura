import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { haptic } from "../app/haptics";
import { Icon } from "./icons/Icon";
import s from "./PrivateValue.module.css";

/**
 * Hides a sensitive value (proposal §7.2).
 *
 * While hidden, the value is not rendered at all — a redaction capsule takes
 * its place — so it cannot be read from the DOM, the accessibility tree or a
 * text selection. Screen readers hear "Hidden amount".
 *
 *  - mode="toggle": follows `visible` (income amounts).
 *  - mode="hold":   shown only while a <RevealButton> of the same group is
 *                   held down; released, cancelled, or the app hidden → masked.
 */

const RevealContext = createContext<Record<string, boolean>>({});
const SetRevealContext = createContext<(group: string, on: boolean) => void>(() => {});

export function RevealScope({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const set = (group: string, on: boolean) => setRevealed(r => (r[group] === on ? r : { ...r, [group]: on }));
  return (
    <SetRevealContext.Provider value={set}>
      <RevealContext.Provider value={revealed}>{children}</RevealContext.Provider>
    </SetRevealContext.Provider>
  );
}

export interface PrivateValueProps {
  children: ReactNode;
  mode?: "toggle" | "hold";
  visible?: boolean;
  group?: string;
  /** Approximate width of the capsule, in characters. */
  chars?: number;
  className?: string;
}

export function PrivateValue({ children, mode = "toggle", visible, group = "default", chars = 6, className }: PrivateValueProps) {
  const revealed = useContext(RevealContext);
  const shown = mode === "hold" ? !!revealed[group] : !!visible;
  if (shown) return <span className={className}>{children}</span>;
  return (
    <span
      className={[s.redacted, className ?? ""].join(" ")}
      style={{ width: `${chars * 0.62}em` }}
      role="img"
      aria-label="Hidden amount"
      data-private="hidden"
    />
  );
}

/** Whether a hold-to-reveal group is revealed right now (for charts). */
// eslint-disable-next-line react-refresh/only-export-components
export const useRevealed = (group = "default") => !!useContext(RevealContext)[group];

/** Press-and-hold eye button that reveals every PrivateValue in its group. */
export function RevealButton({ group = "default", label = "Hold to reveal amounts" }: { group?: string; label?: string }) {
  const set = useContext(SetRevealContext);
  const revealed = useContext(RevealContext);
  const on = !!revealed[group];

  useEffect(() => {
    if (!on) return;
    const hide = () => set(group, false);
    const onVis = () => { if (document.visibilityState === "hidden") hide(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", hide);
    };
  }, [on, group, set]);

  const start = () => { haptic("light"); set(group, true); };
  const stop = () => set(group, false);

  return (
    <button
      type="button"
      className={[s.reveal, on ? s.revealOn : ""].join(" ")}
      aria-label={label}
      aria-pressed={on}
      title={label}
      onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); start(); }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onLostPointerCapture={stop}
      onMouseDown={start}
      onMouseUp={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onTouchCancel={stop}
      onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); start(); } }}
      onKeyUp={e => { if (e.key === " " || e.key === "Enter") stop(); }}
      onBlur={stop}
      onContextMenu={e => e.preventDefault()}
    >
      <Icon name={on ? "eye" : "eyeSlash"} size={20} weight="semibold" />
    </button>
  );
}
