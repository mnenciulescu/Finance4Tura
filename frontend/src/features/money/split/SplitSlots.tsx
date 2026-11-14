import { useState } from "react";
import { Alert, DatePickerSheet } from "../../../ui";
import { isFilled, normOccs } from "../../../utils/split";
import { fmtDate } from "../../../utils/format";
import { sanitizeAmountInput } from "../../../utils/parseAmount";
import type { SplitPayment } from "../../../types";
import type { PendingSettle } from "./useSplitEditor";
import s from "./Split.module.css";

/**
 * The slot grid: exactly `occurrenceCount` slots, two per row, each with an
 * index badge and nothing beside it. Amount slots are typed (17 px, decimal
 * keyboard); date slots open the app's calendar, which carries Clear.
 */
export function SplitSlots({ entry, onSetOcc }: { entry: SplitPayment; onSetOcc: (entry: SplitPayment, idx: number, value: string) => void }) {
  const [picker, setPicker] = useState<{ idx: number; value: string } | null>(null);
  const occs = normOccs(entry);
  const isAmount = entry.occurrenceType === "amount";

  return (
    <>
      <div className={s.slots} data-slots={occs.length}>
        {occs.map((occ, i) => {
          const filled = isFilled(occ);
          const label = `${entry.title} — installment ${i + 1}`;
          return (
            <div key={i} className={[s.slot, filled ? s.slotFilled : ""].join(" ")} data-slot={i}>
              <span className={s.slotIdx} aria-hidden="true">#{i + 1}</span>
              {isAmount ? (
                <input
                  className={s.slotInput}
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  value={String(occ.value ?? "")}
                  placeholder="0,00"
                  aria-label={label}
                  onChange={e => onSetOcc(entry, i, sanitizeAmountInput(e.target.value))}
                />
              ) : (
                <button
                  type="button"
                  className={s.slotButton}
                  aria-label={filled ? `${label}: ${occ.value}` : `${label}: pick a date`}
                  onClick={() => setPicker({ idx: i, value: String(occ.value ?? "") })}
                >
                  {filled ? fmtDate(String(occ.value)) : "Set date"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <DatePickerSheet
        isOpen={!!picker}
        onClose={() => setPicker(null)}
        label={picker ? `${entry.title} — installment ${picker.idx + 1}` : ""}
        value={picker?.value ?? ""}
        onPick={iso => { if (picker) onSetOcc(entry, picker.idx, iso); setPicker(null); }}
        onClear={() => { if (picker) onSetOcc(entry, picker.idx, ""); setPicker(null); }}
      />
    </>
  );
}

/** "Mark as settled?" — shown once the last empty slot has been filled. */
export function SettleAlert({
  pending, onConfirm, onCancel,
}: { pending: PendingSettle | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Alert
      isOpen={!!pending?.ask}
      onClose={onCancel}
      title="Mark as settled?"
      message={<>That was the last open slot on <strong>{pending?.title || "this entry"}</strong>. Confirming moves it into Settled.</>}
      actions={[
        { label: "Cancel", style: "cancel", onAction: onCancel },
        { label: "Mark Settled", style: "primary", onAction: onConfirm },
      ]}
    />
  );
}
