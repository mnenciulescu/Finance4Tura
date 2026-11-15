import { useMemo, useState } from "react";
import { Button } from "../../ui";
import { fmtDate } from "../../utils/format";
import type { HqEntry, HqTemplate } from "../../types";
import { byDateDesc } from "./hqMath";
import s from "./Hq.module.css";

/** Read-only entries of a template, newest first: `limit`, then Show N More. */
export function ReadList({ template, entries, limit = 5 }: { template: HqTemplate; entries: HqEntry[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const sorted = useMemo(
    () => entries.filter(e => e.templateId === template.templateId).sort(byDateDesc),
    [entries, template.templateId],
  );
  if (sorted.length === 0) return <p className={s.muted}>No entries yet.</p>;
  const visible = all ? sorted : sorted.slice(0, limit);
  return (
    <>
      <ul className={s.readList}>
        {visible.map(e => (
          <li key={e.entryId} className={s.readItem}>
            <span className={s.readDate}>{fmtDate(e.date)}</span>
            <span className={s.readValues}>
              {(template.parameters || []).map(p => {
                const v = (e.values || []).find(x => x.parameterId === p.parameterId)?.value;
                const shown = v === null || v === undefined || v === "" ? "—" : p.type === "boolean" ? (v ? "✓" : "—") : String(v);
                return <span key={p.parameterId ?? p.title}><span className={s.readKey}>{p.title}</span> {shown}{p.unit && shown !== "—" ? ` ${p.unit}` : ""}</span>;
              })}
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > limit && (
        <Button variant="plain" size="small" onClick={() => setAll(v => !v)}>
          {all ? "Show Less" : `Show ${sorted.length - limit} More`}
        </Button>
      )}
    </>
  );
}
