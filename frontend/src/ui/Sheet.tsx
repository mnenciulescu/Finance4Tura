import { lazy, Suspense, useRef, useState, type ReactNode } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { m, useDragControls, useMotionValue, type PanInfo } from "motion/react";
import { settle } from "./settle";
import { useOverlayHistory } from "../app/overlays";
import { useKeyboardInset } from "../app/useKeyboardInset";
import { ActionSheet } from "./ActionSheet";
import { useIsDesk } from "./layout";
import s from "./Overlays.module.css";

const DeskSheet = /* @__PURE__ */ lazy(() => import("./DeskOverlays").then(m => ({ default: m.DeskSheet })));

/* ── Sheet ────────────────────────────────────────────────────────────────── */

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name; shown as the heading unless `header` replaces it. */
  title: string;
  /** "auto" fits the content (up to the large height); "large" fills it. */
  detent?: "auto" | "large";
  /** Custom header row (FormSheet's Cancel / Title / Save). */
  header?: ReactNode;
  hideTitle?: boolean;
  /** Return true to block a dismissal (scrim, Escape, drag, system back). */
  veto?: () => boolean;
  children: ReactNode;
  /** Sheet surface: elevated (default) or grouped (forms with inset lists). */
  surface?: "elevated" | "grouped";
  className?: string;
}

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 600;

/**
 * Bottom sheet (proposal §6.6). React Aria supplies the modal behaviour —
 * focus trap, focus restore, Escape, scrim dismissal, screen-reader semantics;
 * Motion supplies drag-to-dismiss from the grabber / header; the overlay
 * manager ties it to history so system back closes it.
 */
export function Sheet(props: SheetProps) {
  const desk = useIsDesk();
  if (desk) return <Suspense fallback={null}><DeskSheet {...props} /></Suspense>;
  return <PhoneSheet {...props} />;
}

function PhoneSheet({
  isOpen, onClose, title, detent = "auto", header, hideTitle, veto, children, surface = "elevated", className,
}: SheetProps) {
  const y = useMotionValue(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const [dragDismissed, setDragDismissed] = useState(false);
  const keyboard = useKeyboardInset();

  const requestClose = () => {
    if (veto?.()) {
      settle(sheetRef.current, y, 0);
      return;
    }
    onClose();
  };

  useOverlayHistory(isOpen, onClose, veto);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const shouldClose = info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY;
    if (shouldClose && !veto?.()) {
      setDragDismissed(true);
      settle(sheetRef.current, y, window.innerHeight, 220).then(() => {
        onClose();
        y.set(0);
        setDragDismissed(false);
      });
      return;
    }
    settle(sheetRef.current, y, 0);
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={open => { if (!open) requestClose(); }}
      isDismissable
      className={[s.overlay, s.sheetOverlay, dragDismissed ? s.noExit : ""].join(" ")}
    >
      <Modal className={[s.sheetModal, detent === "large" ? s.large : "", dragDismissed ? s.noExit : ""].join(" ")}>
        <m.div
          ref={sheetRef}
          className={[s.sheet, surface === "grouped" ? s.grouped : "", className ?? ""].join(" ")}
          style={{ y, paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboard}px)` }}
          drag="y"
          dragControls={controls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0.06, bottom: 1 }}
          dragMomentum={false}
          onDragEnd={onDragEnd}
        >
          <Dialog className={s.dialog} aria-label={title}>
            <div className={s.dragZone} onPointerDown={e => controls.start(e)}>
              <div className={s.grabber} aria-hidden="true" />
              {header ?? (!hideTitle && (
                <Heading slot="title" className={s.sheetTitle}>{title}</Heading>
              ))}
            </div>
            <div className={s.sheetBody}>{children}</div>
          </Dialog>
        </m.div>
      </Modal>
    </ModalOverlay>
  );
}

/* ── FormSheet ────────────────────────────────────────────────────────────── */

export interface FormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Called on Save / Add; the sheet stays open until the caller closes it. */
  onSubmit: () => void;
  submitLabel?: string;
  canSubmit?: boolean;
  submitting?: boolean;
  /** Unsaved changes: closing asks "Discard Changes / Keep Editing". */
  isDirty?: boolean;
  children: ReactNode;
}

/** A large sheet with an iOS nav bar: Cancel · Title · Save. */
export function FormSheet({
  isOpen, onClose, title, onSubmit, submitLabel = "Save", canSubmit = true, submitting, isDirty, children,
}: FormSheetProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  const veto = () => {
    if (!dirtyRef.current) return false;
    setConfirmDiscard(true);
    return true;
  };

  const cancel = () => {
    if (veto()) return;
    onClose();
  };

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        detent="large"
        surface="grouped"
        veto={veto}
        header={
          <div className={s.formBar}>
            <button type="button" className={s.barButton} onClick={cancel}>Cancel</button>
            <Heading slot="title" className={s.formTitle}>{title}</Heading>
            <button
              type="button"
              className={[s.barButton, s.barButtonStrong].join(" ")}
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
              aria-busy={submitting || undefined}
            >
              {submitting ? "Saving…" : submitLabel}
            </button>
          </div>
        }
      >
        <form
          className={s.form}
          noValidate
          onSubmit={e => { e.preventDefault(); if (canSubmit && !submitting) onSubmit(); }}
        >
          {children}
          {/* Lets the keyboard's Go / Enter submit. */}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Sheet>
      <ActionSheet
        isOpen={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard changes?"
        actions={[
          { label: "Discard Changes", destructive: true, onAction: () => { setConfirmDiscard(false); dirtyRef.current = false; onClose(); } },
        ]}
        cancelLabel="Keep Editing"
      />
    </>
  );
}
