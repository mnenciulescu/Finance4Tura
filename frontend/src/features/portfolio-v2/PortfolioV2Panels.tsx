import { useState, type ReactNode } from "react";
import { ActionSheet, Badge, Button, Dot, Icon, PrivateValue, Sheet, SwipeActions, useIsDesk, useToast } from "../../ui";
import { fmtDate, fmtNum } from "../../utils/format";
import type { Pv2Asset, Pv2Run } from "../../types";
import { useDeletePv2Asset } from "./data";
import { platformsOf, TYPE_LABEL, type PlatformSummary } from "./pv2Math";
import s from "./PortfolioV2.module.css";

const H = ({ children, chars = 6 }: { children: ReactNode; chars?: number }) => (
  <PrivateValue mode="hold" group="holdings" chars={chars}>{children}</PrivateValue>
);
const fmtUnits = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 6 });

/* ── Last snapshot ────────────────────────────────────────────────────────── */

/**
 * The last snapshot per platform; a row expands to its assets. On the phone
 * (`heading={false}` under a ListSection) the badges sit under the name so
 * the value keeps its width at 360 px.
 */
export function LatestSnapshot({ platforms, colors, heading = true }: { platforms: PlatformSummary[]; colors: Record<string, string>; heading?: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const desk = useIsDesk();
  if (platforms.length === 0) return null;
  return (
    <section aria-label="Last snapshot">
      {heading && <div className={s.sectionHead}><span>Last snapshot</span></div>}
      <ul className={[s.list, desk ? "" : s.phoneList].join(" ")}>
        {platforms.map(p => {
          const isOpen = !!open[p.platform];
          const badges = (p.missing > 0 || p.stale > 0) && (
            <span className={s.badges}>
              {p.missing > 0 && <Badge color="var(--status-warning)">{p.missing} unpriced</Badge>}
              {p.stale > 0 && <Badge color="var(--status-warning)">{p.stale} stale</Badge>}
            </span>
          );
          return (
            <li key={p.platform} data-platform={p.platform}>
              <button type="button" className={s.rowButton} aria-expanded={isOpen} onClick={() => setOpen(m => ({ ...m, [p.platform]: !isOpen }))}>
                <Icon name="chevronRight" size={12} weight="semibold" className={s.chevron} style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                <Dot color={colors[p.platform]} />
                <span className={s.rowMain}>
                  <span className={s.rowTitle}>{p.platform}</span>
                  <span className={s.rowSub}>
                    {p.imported && p.rows.length === 0
                      ? <>Imported history · {p.latestPriceDate ? fmtDate(p.latestPriceDate) : ""}</>
                      : <>{p.rows.length} asset{p.rows.length === 1 ? "" : "s"} · {p.latestPriceDate ? fmtDate(p.latestPriceDate) : "no prices yet"}{p.imported ? " · imported" : ""}</>}
                  </span>
                  {!desk && badges}
                </span>
                {desk && badges}
                <span className={s.rowEnd}>
                  <span className={s.rowValue}><H>{fmtNum(p.valueEUR)}</H> EUR</span>
                  <span className={s.rowSub}>{p.share.toFixed(1)}%</span>
                </span>
              </button>
              {isOpen && (
                <ul className={s.assets} aria-label={`${p.platform} assets`}>
                  {p.rows.map(({ asset, snap, stale }) => (
                    <li key={asset.assetId} className={s.asset} data-asset={asset.assetId}>
                      <div className={s.assetTop}>
                        <span className={s.assetName} title={asset.name}>{asset.symbol ? `${asset.symbol} · ` : ""}{asset.name}</span>
                        <span className={s.rowValue}>{snap ? <><H>{fmtNum(snap.valueEUR)}</H> EUR</> : "—"}</span>
                      </div>
                      {snap ? (
                        <span className={s.assetDetail}>
                          <span className={s.calc}>
                            {fmtUnits(snap.asset.units)} × <H chars={5}>{fmtNum(snap.unitPrice ?? 0)}</H> {snap.currency}
                          </span>
                          <span className={stale ? s.warnText : undefined}>Price {fmtDate(snap.latestPriceDate)}{stale ? " · stale" : ""}</span>
                          <span>Searched {fmtDate(new Date(snap.generatedAt).toLocaleDateString("en-CA"))}</span>
                          {snap.confidence === "secondary" && <span>Secondary source</span>}
                          {snap.flagged && <span className={s.warnText}>Check price</span>}
                          {snap.sources.map((src, i) => (
                            <a key={i} className={s.sourceLink} href={src.url} target="_blank" rel="noreferrer noopener" title={src.url}>
                              {src.publisher || hostOf(src.url)}
                            </a>
                          ))}
                        </span>
                      ) : <span className={s.warnText}>No price yet — generate a snapshot.</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/* ── Assets ───────────────────────────────────────────────────────────────── */

/**
 * The asset list, Total first per platform; swipe (hover on One-Page) to Edit
 * or Remove. `embedded`: the caller provides the heading, the collapse and Add
 * (the phone's ListSection), so only the list renders.
 */
export function AssetsArea({
  assets, onAdd, onEdit, embedded,
}: {
  assets: Pv2Asset[];
  onAdd: (platform?: string) => void;
  onEdit: (a: Pv2Asset) => void;
  embedded?: boolean;
}) {
  const [openState, setOpen] = useState(false);
  const open = embedded || openState;
  const [confirm, setConfirm] = useState<Pv2Asset | null>(null);
  const del = useDeletePv2Asset();
  const toast = useToast();
  const priced = assets.filter(a => a.type !== "Total");
  const platforms = platformsOf(assets);

  const remove = (mode: "archive" | "delete") => {
    const asset = confirm;
    setConfirm(null);
    if (!asset) return;
    del.mutate({ asset, mode }, {
      onSuccess: () => toast.show({ message: mode === "archive" ? "Asset archived" : "Asset deleted", icon: "trash" }),
      onError: (e: any) => toast.show({ message: e?.response?.data?.message || "Could not remove the asset.", tone: "negative" }),
    });
  };

  return (
    <section aria-label="Assets">
      {!embedded && (
        <button type="button" className={s.areaToggle} aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <Icon name="chevronRight" size={12} weight="semibold" className={s.chevron} style={{ transform: open ? "rotate(90deg)" : "none" }} />
          <span>Assets</span>
          <span className={s.meta}>{priced.length} · {platforms.length} platform{platforms.length === 1 ? "" : "s"}</span>
        </button>
      )}
      {open && (
        <>
          {!embedded && (
            <div className={s.areaActions}>
              <Button variant="tinted" size="small" icon="plus" onClick={() => onAdd()}>Add Asset</Button>
            </div>
          )}
          {assets.length === 0 ? <p className={s.empty}>No assets yet. Add one to start.</p> : (
            <ul className={[s.list, embedded ? s.phoneList : ""].join(" ")} aria-label="Asset list">
              {platforms.map(platform => {
                const rows = assets.filter(a => a.platform === platform)
                  .sort((a, b) => Number(b.type === "Total") - Number(a.type === "Total") || a.order - b.order || a.name.localeCompare(b.name));
                return [
                  <li key={`h-${platform}`} className={s.groupLabel}>{platform}</li>,
                  ...rows.map(a => (
                    <li key={a.assetId}>
                      <SwipeActions
                        actions={[
                          { label: "Edit", icon: "pencil", onAction: () => onEdit(a) },
                          { label: "Remove", icon: "trash", destructive: true, onAction: () => setConfirm(a) },
                        ]}
                      >
                        <div className={[s.assetRow, a.active === false ? s.archived : ""].join(" ")} data-asset-row={a.assetId}>
                          <span className={s.rowMain}>
                            <span className={s.rowTitle}>{a.type === "Total" ? "Platform total" : `${a.symbol ? `${a.symbol} · ` : ""}${a.name}`}</span>
                            <span className={s.rowSub}>
                              {a.type === "Total" ? "Computed after each run" : (
                                <>{TYPE_LABEL[a.type]} · {fmtUnits(a.units)} units · {a.currency}{a.isin ? ` · ${a.isin}` : ""}{a.active === false ? " · archived" : ""}</>
                              )}
                            </span>
                          </span>
                        </div>
                      </SwipeActions>
                    </li>
                  )),
                ];
              })}
            </ul>
          )}
        </>
      )}
      <ActionSheet
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.type === "Total" ? `Delete the ${confirm.platform} Total?` : `Remove ${confirm?.name ?? "asset"}?`}
        message={confirm?.type === "Total" ? "Its snapshots are deleted too." : "Archive keeps its price history; Delete removes the asset and all its snapshots."}
        actions={[
          ...(confirm && confirm.type !== "Total" && confirm.active !== false ? [{ label: "Archive (Keep History)", onAction: () => remove("archive") }] : []),
          { label: "Delete Asset and Snapshots", destructive: true, onAction: () => remove("delete") },
        ]}
      />
    </section>
  );
}

/* ── Run history ──────────────────────────────────────────────────────────── */

const RUN_LABEL: Record<Pv2Run["status"], string> = {
  running: "Running", completed: "Completed", completed_with_errors: "With issues", failed: "Failed", cancelled: "Cancelled",
};

export function RunHistory({ isOpen, runs, onOpenRun, onClose }: { isOpen: boolean; runs: Pv2Run[]; onOpenRun: (id: string) => void; onClose: () => void }) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Snapshot Runs">
      {runs.length === 0 ? <p className={s.empty}>No runs yet.</p> : (
        <ul className={s.history}>
          {runs.map(r => (
            <li key={r.runId}>
              <button type="button" className={s.rowButton} onClick={() => onOpenRun(r.runId)}>
                <span className={s.rowMain}>
                  <span className={s.rowTitle}>{new Date(r.startedAt).toLocaleString()}</span>
                  <span className={s.rowSub}>
                    {r.summary ? `${r.summary.updated} updated · ${r.summary.noNewData} no new data · ${r.summary.notFound} not found · ${r.summary.failed} failed` : `${r.items.length} items`}
                  </span>
                </span>
                <Badge color={r.status === "completed" ? "var(--status-positive)" : r.status === "running" ? "var(--tint)" : "var(--status-warning)"}>{RUN_LABEL[r.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
