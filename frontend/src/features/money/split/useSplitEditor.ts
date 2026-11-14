import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys, saveSplitOccurrences, setSplitOccurrencesLocal } from "../../../data/queries";
import { coverRest, normOccs, splitStats } from "../../../utils/split";
import { useToast } from "../../../ui/Toast";
import { haptic } from "../../../app/haptics";
import type { Occurrence, SplitPayment } from "../../../types";

const SAVE_DEBOUNCE = 600;
/** An amount counts as filled on its first keystroke, so the settle question waits for typing to stop. */
const ASK_DELAY = 700;

export interface PendingSettle {
  entryId: string;
  title: string;
  prevOccs: Occurrence[];
  ask: boolean;
}

export type SaveState = "saving" | "saved" | "error";

/**
 * Slot editing shared by Today and Money → Split (proposal §8.2, §8.5):
 *
 *  - edits show at once and save with a 600 ms debounce per entry, sending
 *    `{ occurrences }` only (never occurrenceCount);
 *  - filling the last empty slot holds the save and asks "Mark as settled?";
 *    confirming saves, cancelling restores the slot, clearing it again
 *    withdraws the question.
 */
export function useSplitEditor() {
  const qc = useQueryClient();
  const toast = useToast();
  const [pendingSettle, setPendingSettle] = useState<PendingSettle | null>(null);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const saveTimers = useRef<Record<string, number>>({});
  const askTimer = useRef<number | undefined>(undefined);
  const pendingRef = useRef<PendingSettle | null>(null);
  pendingRef.current = pendingSettle;

  useEffect(() => () => {
    window.clearTimeout(askTimer.current);
    Object.values(saveTimers.current).forEach(t => window.clearTimeout(t));
  }, []);

  const current = (id: string) => qc.getQueryData<SplitPayment[]>(keys.splits)?.find(p => p.splitPaymentId === id);

  const persist = useCallback((entryId: string, occurrences: Occurrence[]) => {
    window.clearTimeout(saveTimers.current[entryId]);
    setSaveState(s => ({ ...s, [entryId]: "saving" }));
    saveTimers.current[entryId] = window.setTimeout(() => {
      saveSplitOccurrences(entryId, occurrences)
        .then(() => setSaveState(s => ({ ...s, [entryId]: "saved" })))
        .catch((e: unknown) => {
          console.error(e);
          setSaveState(s => ({ ...s, [entryId]: "error" }));
          toast.show({ message: "Could not save the change.", tone: "negative" });
        });
    }, SAVE_DEBOUNCE);
  }, [toast]);

  const apply = useCallback((entry: SplitPayment, mapper: (occs: Occurrence[]) => Occurrence[]) => {
    const before = current(entry.splitPaymentId) ?? entry;
    const prevOccs = normOccs(before);
    const nextOccs = mapper(prevOccs);
    setSplitOccurrencesLocal(qc, entry.splitPaymentId, nextOccs);

    const wasComplete = splitStats(before).complete;
    const nowComplete = splitStats({ ...before, occurrences: nextOccs }).complete;

    if (nowComplete && !wasComplete) {
      window.clearTimeout(saveTimers.current[entry.splitPaymentId]);
      window.clearTimeout(askTimer.current);
      setPendingSettle(p => (p?.entryId === entry.splitPaymentId
        ? { ...p, ask: false }
        : { entryId: entry.splitPaymentId, title: before.title, prevOccs, ask: false }));
      askTimer.current = window.setTimeout(() => {
        haptic("warning");
        setPendingSettle(p => (p ? { ...p, ask: true } : p));
      }, ASK_DELAY);
      return;
    }

    if (pendingRef.current?.entryId === entry.splitPaymentId) {
      window.clearTimeout(askTimer.current);
      setPendingSettle(null);
    }
    persist(entry.splitPaymentId, nextOccs);
  }, [qc, persist]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOcc = (entry: SplitPayment, idx: number, value: string) =>
    apply(entry, occs => occs.map((o, i) => (i === idx ? { ...o, value } : o)));
  const fillRest = (entry: SplitPayment) => apply(entry, occs => coverRest(entry, occs));
  const clearAll = (entry: SplitPayment) => apply(entry, occs => occs.map(o => ({ ...o, value: "" })));

  const confirmSettle = () => {
    const p = pendingRef.current;
    window.clearTimeout(askTimer.current);
    setPendingSettle(null);
    if (!p) return;
    haptic("success");
    const entry = current(p.entryId);
    if (entry) persist(p.entryId, normOccs(entry));
  };

  const cancelSettle = () => {
    const p = pendingRef.current;
    window.clearTimeout(askTimer.current);
    setPendingSettle(null);
    if (!p) return;
    setSplitOccurrencesLocal(qc, p.entryId, p.prevOccs);
  };

  return { pendingSettle, saveState, setOcc, fillRest, clearAll, confirmSettle, cancelSettle };
}
