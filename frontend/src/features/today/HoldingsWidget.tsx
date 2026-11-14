import { useMemo } from "react";
import { Dot, PrivateValue, RevealButton, Widget } from "../../ui";
import { PLATFORM_COLOR } from "../../theme/domainColors";
import { activePlatforms, latestByPlatform, toEUR } from "../../utils/money";
import { fmtDate, fmtNum } from "../../utils/format";
import type { FxRates, Snapshot } from "../../types";
import s from "./Today.module.css";

/**
 * Current holdings (proposal §8.2): every figure is masked until the eye
 * button is held down; releasing it — or the app going to the background —
 * masks them again. Nothing is persisted.
 */
export function HoldingsWidget({ snapshots, fx }: { snapshots: Snapshot[]; fx: FxRates | null }) {
  const rates = fx?.rates ?? null;
  const latest = useMemo(() => latestByPlatform(snapshots), [snapshots]);
  const platforms = useMemo(() => activePlatforms(snapshots), [snapshots]);
  const total = useMemo(
    () => Object.values(latest).reduce((sum, snap) => sum + toEUR(snap.amount, snap.currency, rates), 0),
    [latest, rates],
  );

  return (
    <Widget title="Holdings" icon="chartLine" action={snapshots.length > 0 ? <RevealButton group="holdings" /> : undefined}>
      {snapshots.length === 0 ? (
        <p className={s.muted}>No investment snapshots yet.</p>
      ) : (
        <>
          <div className={s.holdingTotal}>
            <span className={s.overline}>Total portfolio</span>
            <span className={s.holdingValue}>
              <PrivateValue mode="hold" group="holdings" chars={7}>{fmtNum(total)}</PrivateValue>
              <span className={s.holdingUnit}>EUR</span>
            </span>
          </div>
          <ul className={s.holdingList}>
            {platforms.map(p => {
              const snap = latest[p];
              const eur = snap ? toEUR(snap.amount, snap.currency, rates) : null;
              return (
                <li key={p} className={s.holdingRow} data-platform={p}>
                  <Dot color={PLATFORM_COLOR[p]} />
                  <span className={s.holdingName}>{p}</span>
                  <span className={s.holdingAmounts}>
                    <span className={s.holdingEur}>
                      {eur != null ? <PrivateValue mode="hold" group="holdings" chars={5}>{fmtNum(eur)}</PrivateValue> : "—"}
                    </span>
                    {snap && snap.currency !== "EUR" && (
                      <span className={s.holdingRaw}>
                        <PrivateValue mode="hold" group="holdings" chars={5}>{fmtNum(snap.amount)} {snap.currency}</PrivateValue>
                      </span>
                    )}
                  </span>
                  <span className={s.holdingDate}>{snap ? fmtDate(snap.date) : "—"}</span>
                </li>
              );
            })}
          </ul>
          <p className={s.footnote}>{fx?.updatedAt ? `FX rates from ${fmtDate(fx.updatedAt.slice(0, 10))}` : "No FX rates set"}</p>
        </>
      )}
    </Widget>
  );
}
