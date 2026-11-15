import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { useOverlayHistory } from "../app/overlays";
import { Icon } from "./icons/Icon";
import type { SheetProps } from "./Sheet";
import type { ActionSheetProps } from "./ActionSheet";
import type { SwipeAction } from "./SwipeActions";
import o from "./Overlays.module.css";
import d from "./Desk.module.css";

/*
 * Desktop presentations of the phone overlays (One-Page). Loaded only with
 * One-Page, so the PWA's first download does not grow. Behaviour is the
 * same as the phone versions — history entry, discard veto, Escape, scrim —
 * without the drag gestures.
 */

/** A Sheet shown as a centred dialog sized to its content: 520 px, or 760 px for a large content sheet. */
export function DeskSheet({
  isOpen, onClose, title, detent = "auto", header, hideTitle, veto, children, surface = "elevated", className,
}: SheetProps) {
  useOverlayHistory(isOpen, onClose, veto);
  const requestClose = () => { if (!veto?.()) onClose(); };
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={open => { if (!open) requestClose(); }}
      isDismissable
      className={[o.overlay, d.overlay].join(" ")}
    >
      {/* Forms (custom header) stay 520 px; large content sheets get 760 px. */}
      <Modal className={[d.modal, detent === "large" && !header ? d.large : ""].join(" ")}>
        <div className={[d.panel, surface === "grouped" ? d.grouped : "", className ?? ""].join(" ")} data-presentation="dialog">
          <Dialog className={o.dialog} aria-label={title}>
            {!header && (
              <button type="button" className={d.close} aria-label="Close" onClick={requestClose}>
                <Icon name="xmark" size={14} weight="semibold" />
              </button>
            )}
            {header ?? (!hideTitle && <Heading slot="title" className={[o.sheetTitle, d.title].join(" ")}>{title}</Heading>)}
            <div className={[o.sheetBody, d.body].join(" ")}>{children}</div>
          </Dialog>
        </div>
      </Modal>
    </ModalOverlay>
  );
}

/** An ActionSheet shown as a centred alert with stacked choices. */
export function DeskActionSheet({ isOpen, onClose, title, message, actions, cancelLabel = "Cancel" }: ActionSheetProps) {
  useOverlayHistory(isOpen, onClose);
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={open => { if (!open) onClose(); }}
      isDismissable
      className={[o.overlay, o.alertOverlay].join(" ")}
    >
      <Modal className={o.alertModal}>
        <Dialog className={[o.alert, d.choice].join(" ")} aria-label={title ?? "Choose an action"} role="alertdialog">
          {(title || message) && (
            <div className={o.alertBody}>
              {title && <Heading slot="title" className={o.alertTitle}>{title}</Heading>}
              {message && <p className={o.alertMessage}>{message}</p>}
            </div>
          )}
          <div className={[o.alertActions, o.alertStacked].join(" ")}>
            {actions.map(a => (
              <button
                key={a.label}
                type="button"
                className={[o.alertButton, a.destructive ? o.alertDestructive : ""].join(" ")}
                disabled={a.disabled}
                onClick={a.onAction}
              >
                {a.label}
              </button>
            ))}
            <button type="button" className={[o.alertButton, o.alertStrong].join(" ")} onClick={onClose}>{cancelLabel}</button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

const CONFIRM_MS = 4000;

/**
 * Swipe actions on a desktop row: trailing icon buttons that appear on hover
 * or keyboard focus. Destructive actions keep the two-step: the first click
 * arms "Confirm" for 4 s, the second performs it.
 */
export function DeskRowActions({ actions, children }: { actions: SwipeAction[]; children: ReactNode }) {
  const [armed, setArmed] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const press = (i: number) => {
    const a = actions[i];
    if (a.destructive && armed !== i) {
      setArmed(i);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setArmed(null), CONFIRM_MS);
      return;
    }
    setArmed(null);
    a.onAction();
  };

  return (
    <div className={d.row} data-armed={armed != null || undefined}>
      {children}
      <div className={d.rowActions}>
        {actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            className={[d.rowAction, a.destructive ? d.rowDestructive : "", armed === i ? d.rowArmed : ""].join(" ")}
            title={a.label}
            aria-label={armed === i ? (a.confirmLabel ?? `Confirm ${a.label}`) : a.label}
            onClick={e => { e.stopPropagation(); press(i); }}
          >
            {a.icon && <Icon name={a.icon} size={16} weight="semibold" />}
            {armed === i && <span>Confirm</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
