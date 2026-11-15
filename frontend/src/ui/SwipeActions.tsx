import { lazy, Suspense, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { m, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { settle } from "./settle";
import { haptic } from "../app/haptics";
import { Icon, type IconName } from "./icons/Icon";
import { useIsDesk } from "./layout";
import s from "./SwipeActions.module.css";

const DeskRowActions = /* @__PURE__ */ lazy(() => import("./DeskOverlays").then(m => ({ default: m.DeskRowActions })));

export interface SwipeAction {
  label: string;
  icon?: IconName;
  onAction: () => void;
  destructive?: boolean;
  /** Label shown on the armed second step (destructive only). */
  confirmLabel?: string;
}

const ACTION_W = 76;
const CONFIRM_MS = 4000;
const OPEN_EVENT = "swipe-actions-open";

/**
 * Swipe left to reveal trailing actions (proposal §6.3, §9.2).
 *
 * Destructive actions keep the app's two-step safety: the first tap turns
 * "Delete" into "Confirm Delete" for 4 s, the second tap deletes. A full
 * swipe lands on that armed state — it never deletes directly. Every action
 * is also reachable without swiping (context menu, edit sheet).
 */
export function SwipeActions({ actions, children, disabled }: { actions: SwipeAction[]; children: ReactNode; disabled?: boolean }) {
  const id = useId();
  const desk = useIsDesk();
  const x = useMotionValue(0);
  // The action panel is invisible at rest, so it never bleeds through the
  // anti-aliased edge of a rounded card.
  const panelOpacity = useTransform(x, v => (v < -0.5 ? 1 : 0));
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState<number | null>(null);
  const armTimer = useRef<number | undefined>(undefined);
  const width = actions.length * ACTION_W;

  const close = () => {
    setOpen(false);
    setArmed(null);
    window.clearTimeout(armTimer.current);
    settle(contentRef.current, x, 0, 220);
  };
  const openTo = (armIndex: number | null = null) => {
    setOpen(true);
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    settle(contentRef.current, x, -width - (armIndex != null ? 24 : 0), 220);
    if (armIndex != null) arm(armIndex);
  };
  const arm = (i: number) => {
    haptic("warning");
    setArmed(i);
    window.clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => setArmed(null), CONFIRM_MS);
  };

  // Only one row open at a time.
  useEffect(() => {
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== id && open) close(); };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  });
  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const rowW = ref.current?.offsetWidth ?? 320;
    const destructiveIdx = actions.findIndex(a => a.destructive);
    if (info.offset.x < -rowW * 0.6 && destructiveIdx !== -1) { openTo(destructiveIdx); return; }
    if (x.get() < -width / 2 || info.velocity.x < -500) openTo();
    else close();
  };

  const press = (i: number) => {
    const a = actions[i];
    if (a.destructive && armed !== i) { arm(i); return; }
    close();
    a.onAction();
  };

  if (disabled || actions.length === 0) return <>{children}</>;
  // One-Page: hover actions instead of the swipe gesture.
  if (desk) return <Suspense fallback={children}><DeskRowActions actions={actions}>{children}</DeskRowActions></Suspense>;

  return (
    <div ref={ref} className={s.container}>
      <m.div className={s.actions} style={{ width: width + 24, opacity: panelOpacity }} aria-hidden={!open}>
        {actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            tabIndex={open ? 0 : -1}
            className={[s.action, a.destructive ? s.destructive : s.neutral, armed === i ? s.armed : ""].join(" ")}
            onClick={() => press(i)}
          >
            {a.icon && armed !== i && <Icon name={a.icon} size={20} weight="semibold" />}
            <span>{armed === i ? (a.confirmLabel ?? `Confirm ${a.label}`) : a.label}</span>
          </button>
        ))}
      </m.div>
      <m.div
        ref={contentRef}
        className={s.content}
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -width - 80, right: 0 }}
        dragElastic={{ left: 0.2, right: 0.02 }}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        onClickCapture={e => {
          if (open) { e.stopPropagation(); e.preventDefault(); close(); }
        }}
      >
        {children}
      </m.div>
    </div>
  );
}
