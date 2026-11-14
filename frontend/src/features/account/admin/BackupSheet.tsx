import { useEffect, useState } from "react";
import { Button, Icon, Notice, ScreenSkeleton, Sheet } from "../../../ui";
import { backupPreview, backupPrepare, backupRunTable } from "../../../api/adminBackup";
import s from "./Admin.module.css";

type RowStatus = "pending" | "running" | "ok" | "error";
interface Row { name: string; count: number; status: RowStatus; rows?: number; error?: string; }
interface State {
  phase: "loading" | "preview" | "running" | "done";
  folderName?: string;
  folderUrl?: string | null;
  folderError?: string;
  rows: Row[];
}

/** Backup ALL tables to Google Drive with per-table progress (same flow as before). */
export function BackupSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setState({ phase: "loading", rows: [] });
    backupPreview()
      .then((data: any) => setState({
        phase: "preview",
        folderName: data.folderName,
        folderUrl: null,
        rows: data.tables.map((t: any) => ({ name: t.name, count: t.count, error: t.error, status: t.error ? "error" : "pending" })),
      }))
      .catch((e: any) => { setError(e?.response?.data?.message || e?.message || "Preview failed"); setState(null); });
  }, [isOpen]);

  const run = async () => {
    if (!state) return;
    setState(st => st && { ...st, phase: "running" });
    let folderId: string;
    try {
      const prep: any = await backupPrepare();
      folderId = prep.folderId;
      setState(st => st && { ...st, folderName: prep.folderName, folderUrl: prep.folderUrl });
    } catch (e: any) {
      setState(st => st && { ...st, phase: "done", folderError: e?.response?.data?.message || e?.message || "Folder creation failed" });
      return;
    }
    for (const name of state.rows.map(r => r.name)) {
      setState(st => st && { ...st, rows: st.rows.map(r => (r.name === name ? { ...r, status: "running" } : r)) });
      const result: any = await backupRunTable(name, folderId).catch((e: any) => ({
        table: name, rows: 0, ok: false, error: e?.response?.data?.message || e?.message,
      }));
      setState(st => st && {
        ...st,
        rows: st.rows.map(r => (r.name === name ? { ...r, status: result.ok ? "ok" : "error", rows: result.rows, error: result.error } : r)),
      });
    }
    setState(st => st && { ...st, phase: "done" });
  };

  const running = state?.phase === "running";
  const title = !state || state.phase === "loading" || state.phase === "preview" ? "Back Up All Tables"
    : state.phase === "running" ? "Backup in progress…"
    : state.folderError ? "Backup failed"
    : state.rows.every(r => r.status === "ok") ? "Backup complete" : "Backup completed with errors";

  return (
    <Sheet isOpen={isOpen} onClose={() => { if (!running) onClose(); }} veto={() => running} title={title}>
      <div className={s.sheetBody}>
        {error && <Notice>{error}</Notice>}
        {state?.phase === "loading" && <ScreenSkeleton blocks={1} />}
        {state && state.phase !== "loading" && (
          <>
            {state.folderError && <Notice>{state.folderError}</Notice>}
            {state.phase === "preview" && (
              <p className={s.note}>Saves to Google Drive folder <strong>{state.folderName}</strong>. This exports data for <strong>all users</strong>.</p>
            )}
            {state.phase !== "preview" && state.folderName && (
              <p className={s.note}>
                Folder: <strong>{state.folderName}</strong>
                {state.folderUrl && <> · <a href={state.folderUrl} target="_blank" rel="noreferrer">Open in Drive</a></>}
              </p>
            )}
            {!state.folderError && (
              <ul className={s.backupRows}>
                {state.rows.map(r => (
                  <li key={r.name} className={s.backupRow}>
                    <span className={s.backupName}>{r.name}</span>
                    <span className={s.muted}>
                      {r.count === -1 ? "—" : r.status === "pending" || r.status === "running" ? r.count : r.rows ?? r.count} {state.phase === "preview" ? "items" : "rows"}
                    </span>
                    <span className={s.backupStatus} aria-label={r.status}>
                      {r.status === "running" ? <span className={s.spinner} /> :
                        r.status === "ok" ? <Icon name="checkCircle" size={20} className={s.ok} /> :
                        r.status === "error" ? <Icon name="warning" size={20} className={s.bad} /> :
                        <span className={s.muted}>—</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className={s.backupActions}>
              {state.phase === "preview" ? (
                <>
                  <Button variant="gray" size="large" block onClick={onClose}>Cancel</Button>
                  <Button variant="filled" size="large" block onClick={run}>Back Up Now</Button>
                </>
              ) : (
                <Button variant="filled" size="large" block disabled={running} onClick={onClose}>{running ? "Working…" : "Done"}</Button>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
