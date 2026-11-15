import { useState } from "react";
import { Button } from "./Button";
import s from "./ShowMore.module.css";

export interface ShowMoreProps {
  /** How many are visible now. */
  shown: number;
  total: number;
  /** The collapsed count; Show Less returns to it. */
  initial: number;
  /** How many each Show More adds. */
  step: number;
  onChange: (shown: number) => void;
  /** Offer Show All when more than two steps remain. */
  allowAll?: boolean;
}

/**
 * Show N More · Show Less (· Show All) under a long list. Nothing renders
 * when the list fits in the collapsed count.
 */
export function ShowMore({ shown, total, initial, step, onChange, allowAll }: ShowMoreProps) {
  if (total <= initial) return null;
  const visible = Math.min(shown, total);
  const left = total - visible;
  return (
    <div className={s.row}>
      {visible > initial && <Button variant="gray" size="medium" onClick={() => onChange(initial)}>Show Less</Button>}
      {left > 0 && (
        <Button variant="gray" size="medium" onClick={() => onChange(visible + step)}>
          Show {Math.min(step, left)} More <span className={s.count}>{visible}/{total}</span>
        </Button>
      )}
      {allowAll && left > step * 2 && (
        <Button variant="plain" size="medium" onClick={() => onChange(total)}>Show All</Button>
      )}
    </div>
  );
}

/**
 * Visible count for a list, reset to `initial` whenever `scope` changes
 * (another period, tab or filter).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useShowMore(initial: number, scope: string): [number, (n: number) => void] {
  const [state, setState] = useState({ scope, n: initial });
  const n = state.scope === scope ? state.n : initial;
  return [n, (next: number) => setState({ scope, n: next })];
}
