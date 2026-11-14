import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Widget } from "../../ui";
import { BOOK_TYPE_COLOR } from "../../theme/domainColors";
import { MONTH_ABBR } from "../../utils/format";
import type { Book } from "../../types";
import s from "./Today.module.css";

const BOOK_TYPES = ["Book", "Audiobook", "Training", "Other"];

/** Persons (alphabetical) × types with entries; each cell the latest entry. */
export function LibraryWidget({ books }: { books: Book[] }) {
  const navigate = useNavigate();

  const latest = useMemo(() => {
    const map: Record<string, Book> = {};
    for (const b of books) {
      const key = `${b.name || "Unknown"}|${b.type || "Other"}`;
      if (!map[key] || (b.dateCompleted || "") > (map[key].dateCompleted || "")) map[key] = b;
    }
    return map;
  }, [books]);

  const persons = useMemo(() => [...new Set(books.map(b => b.name || "Unknown"))].sort(), [books]);

  // Only types with an entry, most recently completed first.
  const types = useMemo(() => {
    const newest: Record<string, string> = {};
    for (const b of books) {
      const t = b.type || "Other";
      if ((b.dateCompleted || "") >= (newest[t] ?? "")) newest[t] = b.dateCompleted || "";
    }
    return BOOK_TYPES.filter(t => newest[t] !== undefined).sort((a, b) => newest[b].localeCompare(newest[a]));
  }, [books]);

  const month = (ym: string) => (ym ? `${MONTH_ABBR[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : "");

  return (
    <Widget
      title="Library"
      icon="library"
      action={<Button variant="plain" size="small" onClick={() => navigate("/library")}>See All</Button>}
    >
      {books.length === 0 ? (
        <p className={s.muted}>No books or trainings yet.</p>
      ) : (
        <div className={s.libraryScroll}>
          <table className={s.libraryGrid} aria-label="Latest entry per person and type">
            <thead>
              <tr>
                <th scope="col"><span className="visually-hidden">Person</span></th>
                {types.map(t => (
                  <th key={t} scope="col">
                    <span className={s.typeHead} style={{ color: BOOK_TYPE_COLOR[t] }}>{t}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {persons.map(p => (
                <tr key={p}>
                  <th scope="row" className={s.person}>{p}</th>
                  {types.map(t => {
                    const b = latest[`${p}|${t}`];
                    return (
                      <td key={t} className={s.cell}>
                        {b ? (
                          <>
                            <span className={s.cellTitle} title={b.title}>{b.title}</span>
                            <span className={s.cellMonth}>{month(b.dateCompleted)}</span>
                          </>
                        ) : <span className={s.cellEmpty}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Widget>
  );
}
