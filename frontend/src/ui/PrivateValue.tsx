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

/**
 * Masks every <Amount> below it (One-Page's money eye). Nothing provides it on
 * the phone, so shared Budget / Stats components render amounts as before.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const AmountMaskContext = createContext(false);
// eslint-disable-next-line react-refresh/only-export-components
export const useAmountsMasked = () => useContext(AmountMaskContext);

/** An amount that is redacted while an AmountMaskContext says so. */
export function Amount({ children, chars = 5, className }: { children: ReactNode; chars?: number; className?: string }) {
  const masked = useContext(AmountMaskContext);
  if (!masked) return className ? <span className={className}>{children}</span> : <>{children}</>;
  return <PrivateValue visible={false} chars={chars} className={className}>{children}</PrivateValue>;
}

/** Whether a hold-to-reveal group is revealed right now (for charts). */
// eslint-disable-next-line react-refresh/only-export-components
export const useRevealed = (group = "default") => !!useContext(RevealContext)[group];

/**
 * Eye button that reveals every PrivateValue in its group. By default it is
 * press-and-hold; `toggle` makes it a flag — a click shows, the next click
 * hides (One-Page). Either way the values are masked again when the page is
 * hidden, and a held reveal also ends when the window loses focus.
 */
export function RevealButton({
  group = "default", label, toggle = false,
}: { group?: string; label?: string; toggle?: boolean }) {
  const set = useContext(SetRevealContext);
  const revealed = useContext(RevealContext);
  const on = !!revealed[group];

  useEffect(() => {
    if (!on) return;
    const hide = () => set(group, false);
    const onVis = () => { if (document.visibilityState === "hidden") hide(); };
    document.addEventListener("visibilitychange", onVis);
    if (!toggle) window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (!toggle) window.removeEventListener("blur", hide);
    };
  }, [on, group, set, toggle]);

  if (toggle) {
    const text = label ?? (on ? "Hide amounts" : "Show amounts");
    return (
      <button
        type="button"
        className={[s.reveal, on ? s.revealOn : ""].join(" ")}
        aria-label={text}
        aria-pressed={on}
        title={text}
        onClick={() => { haptic("light"); set(group, !on); }}
      >
        <Icon name={on ? "eye" : "eyeSlash"} size={20} weight="semibold" />
      </button>
    );
  }
  return <HoldRevealButton group={group} label={label ?? "Hold to reveal amounts"} on={on} set={set} />;
}

function HoldRevealButton({ group, label, on, set }: { group: string; label: string; on: boolean; set: (group: string, on: boolean) => void }) {
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
