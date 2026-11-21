import { useMemo } from "react";
import { Dot, PrivateValue, RevealButton, Skeleton, Widget } from "../../ui";
import { fmtDate, fmtNum, todayIso } from "../../utils/format";
import { usePv2Assets, usePv2Snapshots } from "../portfolio-v2/data";
import { platformColor, platformsOf, summarize } from "../portfolio-v2/pv2Math";
import s from "./Today.module.css";

/**
 * Current holdings from Portfolio v2 (proposal §8.2): the portfolio total in
 * EUR and each held platform's latest Total. Every figure is masked until the
 * eye button is held down; releasing it — or the app going to the
 * background — masks them again. Nothing is persisted. Lazy-loaded so the
 * Portfolio v2 code stays out of the first download.
 */
export default function HoldingsWidget() {
  const assets = usePv2Assets();
  const snaps = usePv2Snapshots();
  const assetList = useMemo(() => assets.data ?? [], [assets.data]);
  const today = todayIso();
  const summary = useMemo(() => summarize(assetList, snaps.data ?? [], today), [assetList, snaps.data, today]);
  const colors = useMemo(() => Object.fromEntries(platformsOf(assetList).map((p, i) => [p, platformColor(p, i)])), [assetList]);
  const empty = summary.platforms.length === 0;

  return (
    <Widget title="Holdings" icon="chartLine" action={empty ? undefined : <RevealButton group="holdings" />}>
      {assets.isPending || snaps.isPending ? <Skeleton height={120} /> : assets.isError || snaps.isError ? (
        <p className={s.muted}>Could not load the portfolio.</p>
      ) : empty ? (
        <p className={s.muted}>No portfolio snapshots yet.</p>
      ) : (
        <>
          <div className={s.holdingTotal}>
            <span className={s.overline}>Total portfolio</span>
            <span className={s.holdingValue}>
              <PrivateValue mode="hold" group="holdings" chars={7}>{fmtNum(summary.totalEUR)}</PrivateValue>
              <span className={s.holdingUnit}>EUR</span>
            </span>
          </div>
          <ul className={s.holdingList}>
            {summary.platforms.map(p => (
              <li key={p.platform} className={s.holdingRow} data-platform={p.platform}>
                <Dot color={colors[p.platform]} />
                <span className={s.holdingName}>{p.platform}</span>
                <span className={s.holdingAmounts}>
                  <span className={s.holdingEur}>
                    <PrivateValue mode="hold" group="holdings" chars={5}>{fmtNum(p.valueEUR)}</PrivateValue>
                  </span>
                </span>
                <span className={s.holdingDate}>{p.latestPriceDate ? fmtDate(p.latestPriceDate) : "—"}</span>
              </li>
            ))}
          </ul>
          {summary.lastGeneratedAt && (
            <p className={s.footnote}>Last snapshot {fmtDate(new Date(summary.lastGeneratedAt).toLocaleDateString("en-CA"))}</p>
          )}
        </>
      )}
    </Widget>
  );
}
