import type { ReactNode } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { useOverlayHistory } from "../app/overlays";
import s from "./Overlays.module.css";

export interface AlertAction {
  label: string;
  onAction: () => void;
  style?: "default" | "cancel" | "destructive" | "primary";
  disabled?: boolean;
}

export interface AlertProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: ReactNode;
  /** Extra content between the message and the buttons (e.g. a password field). */
  children?: ReactNode;
  actions: AlertAction[];
  /** Error line shown above the buttons. */
  error?: string | null;
}

/**
 * Centred iOS alert: title, message, up to three buttons. Two buttons sit side
 * by side; three stack. Dismissing it (scrim, Escape, system back) is the same
 * as the cancel action.
 */
export function Alert({ isOpen, onClose, title, message, children, actions, error }: AlertProps) {
  useOverlayHistory(isOpen, onClose);
  const stacked = actions.length > 2;
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={open => { if (!open) onClose(); }}
      isDismissable
      className={[s.overlay, s.alertOverlay].join(" ")}
    >
      <Modal className={s.alertModal}>
        <Dialog role="alertdialog" className={s.alert} aria-label={title}>
          <div className={s.alertBody}>
            <Heading slot="title" className={s.alertTitle}>{title}</Heading>
            {message && <div className={s.alertMessage}>{message}</div>}
            {children}
            {error && <p className={s.alertError} role="alert">{error}</p>}
          </div>
          <div className={[s.alertActions, stacked ? s.alertStacked : ""].join(" ")}>
            {actions.map(a => (
              <button
                key={a.label}
                type="button"
                className={[
                  s.alertButton,
                  a.style === "destructive" ? s.alertDestructive : "",
                  a.style === "primary" || a.style === "destructive" ? s.alertStrong : "",
                ].join(" ")}
                disabled={a.disabled}
                onClick={a.onAction}
              >
                {a.label}
              </button>
            ))}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
