import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { useOverlayHistory } from "../app/overlays";
import { haptic } from "../app/haptics";
import s from "./Overlays.module.css";

export interface ActionSheetAction {
  label: string;
  onAction: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}

/**
 * iOS action sheet: a bottom-anchored group of choices plus a separate
 * Cancel. Used for the series choice, edit scope and discarding changes.
 */
export function ActionSheet({ isOpen, onClose, title, message, actions, cancelLabel = "Cancel" }: ActionSheetProps) {
  useOverlayHistory(isOpen, onClose);
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={open => { if (!open) onClose(); }}
      isDismissable
      className={[s.overlay, s.sheetOverlay].join(" ")}
    >
      <Modal className={s.actionModal}>
        <Dialog className={s.actionDialog} aria-label={title ?? "Choose an action"}>
          <div className={s.actionGroup}>
            {(title || message) && (
              <div className={s.actionHead}>
                {title && <Heading slot="title" className={s.actionTitle}>{title}</Heading>}
                {message && <p className={s.actionMessage}>{message}</p>}
              </div>
            )}
            {actions.map(a => (
              <button
                key={a.label}
                type="button"
                className={[s.actionButton, a.destructive ? s.actionDestructive : ""].join(" ")}
                disabled={a.disabled}
                onClick={() => { if (a.destructive) haptic("warning"); a.onAction(); }}
              >
                {a.label}
              </button>
            ))}
          </div>
          <button type="button" className={[s.actionGroup, s.actionButton, s.actionCancel].join(" ")} onClick={onClose}>
            {cancelLabel}
          </button>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
