import { useState } from "react";
import { Button, Notice, Sheet, useToast } from "../../ui";
import { SUPPORTED_CURRENCIES } from "../../utils/money";
import { useImportPv2Assets } from "./data";
import { mapRows, readFirstSheet, type ImportRow } from "./xlsx";
import s from "./PortfolioV2.module.css";

interface PlanResult { create: number; update: number; errors: { row: number; errors: Record<string, string> }[] }

/**
 * Import assets from an .xlsx (§5.1): read in the browser, preview with
 * editable currencies, a dry run on the server, then the import. Matching
 * rows (platform + ISIN / symbol / name) update existing assets.
 */
export function ImportSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const imp = useImportPv2Assets();
  const toast = useToast();

  const reset = () => { setRows(null); setFileName(""); setError(null); setPlan(null); };
  const close = () => { reset(); onClose(); };

  const onFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    try {
      const grid = await readFirstSheet(await file.arrayBuffer());
      const mapped = mapRows(grid);
      if (mapped.error) { setError(mapped.error); return; }
      if (mapped.rows.length === 0) { setError("The sheet has no asset rows."); return; }
      setRows(mapped.rows);
    } catch (e: any) {
      setError(e?.message || "Could not read the file.");
    }
  };

  const body = () => (rows ?? []).map(({ line: _line, ...r }) => ({
    ...r, symbol: r.symbol || null, isin: r.isin || null, name: r.name || null,
  }));

  const check = () => imp.mutate({ rows: body(), dryRun: true }, {
    onSuccess: (d: any) => setPlan({ create: d.create, update: d.update, errors: d.errors ?? [] }),
    onError: (e: any) => setError(e?.response?.data?.message || "The check failed."),
  });
  const run = () => imp.mutate({ rows: body(), dryRun: false }, {
    onSuccess: (d: any) => {
      toast.show({ message: `Imported · ${d.create} new, ${d.update} updated`, tone: "positive" });
      close();
    },
    onError: (e: any) => setError(e?.response?.data?.message || "The import failed."),
  });

  const rowErrors = new Map((plan?.errors ?? []).map(e => [e.row, Object.values(e.errors).join("; ")]));
  const setCurrency = (i: number, c: string) => { setPlan(null); setRows(rs => rs!.map((r, j) => (j === i ? { ...r, currency: c } : r))); };

  return (
    <Sheet isOpen={isOpen} onClose={close} title="Import Assets from Excel" detent="large">
      <div className={s.importBody}>
        <p className={s.meta}>
          The first sheet needs a header row with <strong>Platform</strong> and <strong>Type</strong>, and optionally Symbol, Name,
          Units, ISIN and Currency. Units are read exactly as stored. Rows that match an existing asset (same platform and
          ISIN, symbol or name) update it; every platform gets its Total.
        </p>
        <input
          className={s.file}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Excel file"
          onChange={e => onFile(e.target.files?.[0])}
        />
        {error && <Notice>{error}</Notice>}
        {rows && (
          <>
            <p className={s.meta}>{fileName}: {rows.length} rows. Check each currency; it is a guess where the sheet has none.</p>
            <div className={s.previewWrap}>
              <table className={s.runTable} aria-label="Import preview">
                <thead>
                  <tr><th scope="col">Row</th><th scope="col">Platform</th><th scope="col">Type</th><th scope="col">Symbol</th><th scope="col">Name</th><th scope="col" className={s.num}>Units</th><th scope="col">ISIN</th><th scope="col">Currency</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={rowErrors.has(i) ? s.rowError : undefined}>
                      <td>{r.line}</td>
                      <td>{r.platform}</td>
                      <td>{r.type}</td>
                      <td>{r.symbol}</td>
                      <td>{r.name}{rowErrors.has(i) && <div>{rowErrors.get(i)}</div>}</td>
                      <td className={s.num}>{r.units ?? ""}</td>
                      <td>{r.isin}</td>
                      <td>
                        {/^total$/i.test(r.type) ? "EUR" : (
                          <select className={s.select} aria-label={`Currency, row ${r.line}`} value={r.currency} onChange={e => setCurrency(i, e.target.value)}>
                            {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {plan && (
              plan.errors.length
                ? <Notice>{plan.errors.length} row{plan.errors.length === 1 ? "" : "s"} need fixing in the file.</Notice>
                : <Notice tone="info">Ready: {plan.create} to create (platform Totals included), {plan.update} to update.</Notice>
            )}
            <div className={s.footer}>
              <span />
              <Button variant="gray" size="small" onClick={close}>Cancel</Button>
              {plan && plan.errors.length === 0
                ? <Button variant="filled" size="small" icon="download" loading={imp.isPending} onClick={run}>Import {plan.create + plan.update}</Button>
                : <Button variant="tinted" size="small" loading={imp.isPending} onClick={check}>Check</Button>}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
