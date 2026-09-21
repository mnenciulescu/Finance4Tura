import { useState, useEffect, useMemo, useRef } from "react";
import { listBooks, createBook, updateBook, deleteBook } from "../api/booksAndDev";

const COL_WIDTH = "430px";

const SOURCES = ["Book", "Voxa", "Udemy", "Other"];
const TYPES   = ["Book", "Audiobook", "Training", "Other"];
const RATINGS = [1, 2, 3, 4, 5];

function Stars({ value, onChange, readOnly, size = 15 }) {
  return (
    <span style={{ display: "inline-flex", gap: "2px", cursor: readOnly ? "default" : "pointer" }}>
      {RATINGS.map(n => (
        <span
          key={n}
          onClick={e => {
            if (readOnly || !onChange) return;
            e.stopPropagation();
            onChange(n === value ? null : n);
          }}
          style={{ fontSize: `${size}px`, color: n <= (value ?? 0) ? "#f59e0b" : "var(--border)", lineHeight: 1 }}
        >★</span>
      ))}
    </span>
  );
}

function typeBadge(type) {
  if (type === "Audiobook") return { background: "#7c3aed22", color: "#7c3aed" };
  if (type === "Training")  return { background: "#0891b222", color: "#0891b2" };
  return { background: "var(--surface-2)", color: "var(--text-muted)" };
}

function defaultForm() {
  return { name: "", source: "Book", type: "Book", author: "", title: "", dateCompleted: "", rating: null, comments: "" };
}

// Two-step inline confirm, reverting after 4s — the pattern the rest of the app uses.
function DeleteButton({ onConfirm }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function click(e) {
    e.stopPropagation();
    if (armed) {
      clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 4000);
  }

  return (
    <button style={{ ...s.btnGhost, ...(armed ? s.btnArmed : { color: "var(--danger)" }) }} onClick={click}>
      {armed ? "Tap to confirm" : "Delete"}
    </button>
  );
}

export default function BooksAndDev() {
  const [books, setBooks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [sheetOpen, setSheet]   = useState(false);
  const [filterOpen, setFilter] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(defaultForm());
  const [formErr, setFormErr]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [expanded, setExpanded] = useState({});

  const [fName,   setFName]   = useState("");
  const [fSource, setFSource] = useState("");
  const [fType,   setFType]   = useState("");
  const [fRating, setFRating] = useState("");
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    listBooks()
      .then(setBooks)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const names = useMemo(() => [...new Set(books.map(b => b.name).filter(Boolean))].sort(), [books]);

  const filtered = useMemo(() => {
    return books.filter(b => {
      if (fName   && b.name   !== fName)   return false;
      if (fSource && b.source !== fSource) return false;
      if (fType   && b.type   !== fType)   return false;
      if (fRating && String(b.rating) !== fRating) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(b.title  || "").toLowerCase().includes(q) &&
            !(b.author || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [books, fName, fSource, fType, fRating, search]);

  const activeFilters = [fName, fSource, fType, fRating, search].filter(Boolean).length;

  function clearFilters() {
    setFName(""); setFSource(""); setFType(""); setFRating(""); setSearch("");
  }

  function openAdd() {
    setEditing(null);
    setForm(defaultForm());
    setFormErr(null);
    setSheet(true);
  }

  function openEdit(book) {
    setEditing(book);
    setForm({
      name:          book.name || "",
      source:        book.source || "Book",
      type:          book.type || "Book",
      author:        book.author || "",
      title:         book.title || "",
      dateCompleted: book.dateCompleted || "",
      rating:        book.rating ?? null,
      comments:      book.comments || "",
    });
    setFormErr(null);
    setSheet(true);
  }

  async function handleSave() {
    setFormErr(null);
    if (!form.title.trim()) { setFormErr("Title is required"); return; }
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateBook(editing.bookId, form);
        setBooks(prev => prev.map(b => b.bookId === editing.bookId ? updated : b));
      } else {
        const created = await createBook(form);
        setBooks(prev => [created, ...prev]);
      }
      setSheet(false);
    } catch (e) {
      setFormErr(e?.response?.data?.message || e.message || "Error saving");
    } finally {
      setSaving(false);
    }
  }

  async function handleRatingChange(book, newRating) {
    setBooks(prev => prev.map(b => b.bookId === book.bookId ? { ...b, rating: newRating } : b));
    try {
      const updated = await updateBook(book.bookId, { ...book, rating: newRating });
      setBooks(prev => prev.map(b => b.bookId === book.bookId ? updated : b));
    } catch {
      setBooks(prev => prev.map(b => b.bookId === book.bookId ? { ...b, rating: book.rating } : b));
    }
  }

  async function handleDelete(book) {
    try {
      await deleteBook(book.bookId);
      setBooks(prev => prev.filter(b => b.bookId !== book.bookId));
    } catch (e) {
      setError("Failed to delete: " + (e?.response?.data?.message || e.message));
    }
  }

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })); }
  const toggle = id => setExpanded(m => ({ ...m, [id]: !m[id] }));

  return (
    <div style={s.page}>
      <div style={s.column}>

        <div style={s.header}>
          <div style={{ minWidth: 0 }}>
            <h2 style={s.title}>Books &amp; Development</h2>
            <p style={s.subtitle}>
              {filtered.length} of {books.length} entr{books.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <button style={s.btnPrimary} onClick={openAdd}>+ New</button>
        </div>

        <div style={s.filterRow}>
          <button style={s.filterBtn} onClick={() => setFilter(true)}>
            Filters{activeFilters > 0 && <span style={s.filterCount}>{activeFilters}</span>}
          </button>
          {activeFilters > 0 && (
            <button style={s.btnGhost} onClick={clearFilters}>Clear</button>
          )}
        </div>

        {loading ? (
          <div style={s.empty}>Loading…</div>
        ) : error ? (
          <div style={{ ...s.empty, color: "var(--danger)" }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>No entries found.</div>
        ) : (
          <div style={s.list}>
            {filtered.map(b => {
              const open = !!expanded[b.bookId];
              return (
                <div key={b.bookId} style={s.card}>
                  <button style={s.cardHead} onClick={() => toggle(b.bookId)}>
                    <div style={s.cardHeadMain}>
                      <span style={s.cardTitle}>{b.title}</span>
                      {b.author && <span style={s.cardAuthor}>{b.author}</span>}
                      <div style={s.cardMeta}>
                        <span style={{ ...s.badge, ...typeBadge(b.type) }}>{b.type || "—"}</span>
                        <Stars value={b.rating} onChange={v => handleRatingChange(b, v)} size={14} />
                        <span style={s.flexFill} />
                        <span style={s.cardDate}>{b.dateCompleted || "—"}</span>
                      </div>
                    </div>
                    <span style={{ ...s.chevron, transform: open ? "rotate(180deg)" : "none" }}>⌄</span>
                  </button>

                  {open && (
                    <div style={s.cardBody}>
                      <div style={s.detailRow}>
                        <span style={s.detailKey}>Person</span>
                        <span style={s.detailVal}>{b.name || "—"}</span>
                      </div>
                      <div style={s.detailRow}>
                        <span style={s.detailKey}>Source</span>
                        <span style={s.detailVal}>{b.source || "—"}</span>
                      </div>
                      {b.comments && (
                        <div style={s.comments}>{b.comments}</div>
                      )}
                      <div style={s.cardActions}>
                        <button style={s.btnGhost} onClick={() => openEdit(b)}>Edit</button>
                        <DeleteButton onConfirm={() => handleDelete(b)} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter sheet */}
      {filterOpen && (
        <div style={s.overlay} onClick={() => setFilter(false)}>
          <div style={s.sheet} onClick={e => e.stopPropagation()}>
            <div style={s.grabber} />
            <div style={s.sheetHead}>
              <span style={s.sheetTitle}>Filters</span>
              <button style={s.closeBtn} onClick={() => setFilter(false)}>✕</button>
            </div>
            <div style={s.sheetBody}>
              <label style={s.label}>Search
                <input style={s.input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Title or author…" />
              </label>
              <label style={s.label}>Person
                <select style={s.input} value={fName} onChange={e => setFName(e.target.value)}>
                  <option value="">All people</option>
                  {names.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label style={s.label}>Type
                <select style={s.input} value={fType} onChange={e => setFType(e.target.value)}>
                  <option value="">All types</option>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={s.label}>Source
                <select style={s.input} value={fSource} onChange={e => setFSource(e.target.value)}>
                  <option value="">All sources</option>
                  {SOURCES.map(src => <option key={src} value={src}>{src}</option>)}
                </select>
              </label>
              <label style={s.label}>Rating
                <select style={s.input} value={fRating} onChange={e => setFRating(e.target.value)}>
                  <option value="">All ratings</option>
                  {RATINGS.map(r => <option key={r} value={r}>{"★".repeat(r)}</option>)}
                </select>
              </label>
            </div>
            <div style={s.sheetFoot}>
              <button style={s.btnSecondary} onClick={clearFilters}>Clear all</button>
              <button style={s.btnPrimary} onClick={() => setFilter(false)}>
                Show {filtered.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / edit sheet */}
      {sheetOpen && (
        <div style={s.overlay} onClick={() => setSheet(false)}>
          <div style={s.sheet} onClick={e => e.stopPropagation()}>
            <div style={s.grabber} />
            <div style={s.sheetHead}>
              <span style={s.sheetTitle}>{editing ? "Edit Entry" : "Add Entry"}</span>
              <button style={s.closeBtn} onClick={() => setSheet(false)}>✕</button>
            </div>

            <div style={s.sheetBody}>
              {formErr && <div style={s.formError}>{formErr}</div>}

              <label style={s.label}>Title *
                <input style={s.input} value={form.title} onChange={e => setF("title", e.target.value)} placeholder="Book / course title" />
              </label>
              <label style={s.label}>Author
                <input style={s.input} value={form.author} onChange={e => setF("author", e.target.value)} placeholder="Author name" />
              </label>
              <label style={s.label}>Person
                <input style={s.input} value={form.name} onChange={e => setF("name", e.target.value)} placeholder="e.g. Mihai" />
              </label>
              <div style={s.row2}>
                <label style={s.label}>Type
                  <select style={s.input} value={form.type} onChange={e => setF("type", e.target.value)}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label style={s.label}>Source
                  <select style={s.input} value={form.source} onChange={e => setF("source", e.target.value)}>
                    {SOURCES.map(src => <option key={src} value={src}>{src}</option>)}
                  </select>
                </label>
              </div>
              <label style={s.label}>Completed (YYYY-MM)
                <input style={s.input} value={form.dateCompleted} onChange={e => setF("dateCompleted", e.target.value)} placeholder="e.g. 2024-06" />
              </label>
              <label style={s.label}>Rating
                <div style={{ marginTop: "4px" }}>
                  <Stars value={form.rating} onChange={v => setF("rating", v)} size={22} />
                </div>
              </label>
              <label style={s.label}>Comments
                <textarea style={{ ...s.input, minHeight: "70px", resize: "vertical" }} value={form.comments} onChange={e => setF("comments", e.target.value)} placeholder="Notes…" />
              </label>
            </div>

            <div style={s.sheetFoot}>
              <button style={s.btnSecondary} onClick={() => setSheet(false)}>Cancel</button>
              <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    display:        "flex",
    justifyContent: "center",
    alignItems:     "flex-start",
    flex:           1,
    minHeight:      0,
  },
  column: {
    width:         "100%",
    maxWidth:      COL_WIDTH,
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
  },
  header: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "12px",
    flexShrink:     0,
    padding:        "12px 14px",
    borderBottom:   "1px solid var(--border)",
  },
  title:    { margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--text)" },
  subtitle: { margin: "2px 0 0", fontSize: "11px", color: "var(--text-muted)" },

  filterRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
    padding:    "10px 14px 0",
    flexShrink: 0,
  },
  filterBtn: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          "6px",
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "9px",
    color:        "var(--text)",
    fontSize:     "13px",
    fontWeight:   500,
    padding:      "8px 14px",
    cursor:       "pointer",
    fontFamily:   "inherit",
  },
  filterCount: {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    minWidth:       "17px",
    height:         "17px",
    borderRadius:   "9px",
    background:     "var(--accent)",
    color:          "#fff",
    fontSize:       "10px",
    fontWeight:     700,
    padding:        "0 5px",
  },

  list: {
    display:       "flex",
    flexDirection: "column",
    gap:           "8px",
    padding:       "10px 14px 18px",
    overflowY:     "auto",
    flex:          1,
    minHeight:     0,
  },
  card: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "12px",
    overflow:     "hidden",
  },
  cardHead: {
    display:    "flex",
    alignItems: "flex-start",
    gap:        "10px",
    width:      "100%",
    padding:    "11px 13px",
    background: "transparent",
    border:     "none",
    textAlign:  "left",
    cursor:     "pointer",
    fontFamily: "inherit",
  },
  cardHeadMain: {
    display:       "flex",
    flexDirection: "column",
    gap:           "3px",
    flex:          1,
    minWidth:      0,
  },
  cardTitle: {
    fontSize:   "14px",
    fontWeight: 600,
    color:      "var(--text)",
  },
  cardAuthor: {
    fontSize: "12px",
    color:    "var(--text-muted)",
  },
  cardMeta: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
    marginTop:  "4px",
  },
  flexFill: { flex: 1 },
  cardDate: {
    fontSize:           "11px",
    color:              "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  chevron: {
    color:      "var(--text-muted)",
    fontSize:   "13px",
    lineHeight: 1,
    flexShrink: 0,
    transition: "transform 0.15s",
    marginTop:  "2px",
  },
  cardBody: {
    borderTop:     "1px solid var(--border)",
    padding:       "11px 13px",
    display:       "flex",
    flexDirection: "column",
    gap:           "8px",
  },
  detailRow: {
    display:        "flex",
    justifyContent: "space-between",
    gap:            "12px",
    fontSize:       "12px",
  },
  detailKey: { color: "var(--text-muted)" },
  detailVal: { color: "var(--text)", fontWeight: 500 },
  comments: {
    fontSize:     "12px",
    color:        "var(--text-muted)",
    lineHeight:   1.5,
    background:   "var(--surface-2)",
    borderRadius: "8px",
    padding:      "8px 10px",
    whiteSpace:   "pre-wrap",
  },
  cardActions: {
    display:        "flex",
    justifyContent: "flex-end",
    gap:            "8px",
    paddingTop:     "2px",
  },

  badge: {
    fontSize:     "10px",
    fontWeight:   600,
    padding:      "2px 7px",
    borderRadius: "5px",
    flexShrink:   0,
  },
  empty: {
    padding:   "40px 14px",
    textAlign: "center",
    color:     "var(--text-muted)",
    fontSize:  "13px",
  },

  btnPrimary: {
    background:   "var(--accent)",
    border:       "none",
    borderRadius: "9px",
    color:        "#fff",
    fontSize:     "13px",
    fontWeight:   600,
    padding:      "9px 16px",
    cursor:       "pointer",
    flexShrink:   0,
    fontFamily:   "inherit",
  },
  btnSecondary: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "9px",
    color:        "var(--text-muted)",
    fontSize:     "13px",
    fontWeight:   600,
    padding:      "9px 16px",
    cursor:       "pointer",
    fontFamily:   "inherit",
  },
  btnGhost: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "7px 13px",
    cursor:       "pointer",
    fontFamily:   "inherit",
  },
  btnArmed: {
    background:  "var(--danger)",
    borderColor: "var(--danger)",
    color:       "#fff",
  },

  // ── Sheets ────────────────────────────────────────────────────────────────
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.55)",
    display:        "flex",
    alignItems:     "flex-end",
    justifyContent: "center",
    zIndex:         500,
  },
  sheet: {
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderRadius:  "16px 16px 0 0",
    width:         "100%",
    maxWidth:      COL_WIDTH,
    maxHeight:     "92dvh",
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
    boxShadow:     "0 -6px 40px rgba(0,0,0,0.45)",
  },
  grabber: {
    width:        "38px",
    height:       "4px",
    borderRadius: "2px",
    background:   "var(--border)",
    margin:       "8px auto 0",
    flexShrink:   0,
  },
  sheetHead: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "14px 18px 0",
    flexShrink:     0,
  },
  sheetTitle: { fontSize: "15px", fontWeight: 700, color: "var(--text)" },
  closeBtn: {
    background: "transparent",
    border:     "none",
    color:      "var(--text-muted)",
    fontSize:   "15px",
    cursor:     "pointer",
    padding:    "6px 8px",
  },
  sheetBody: {
    display:       "flex",
    flexDirection: "column",
    gap:           "13px",
    padding:       "14px 18px 18px",
    overflowY:     "auto",
    minHeight:     0,
  },
  sheetFoot: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "10px",
    padding:             "12px 18px calc(16px + env(safe-area-inset-bottom))",
    borderTop:           "1px solid var(--border)",
    flexShrink:          0,
  },
  row2: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "12px",
  },
  label: {
    display:       "flex",
    flexDirection: "column",
    gap:           "5px",
    fontSize:      "11px",
    fontWeight:    600,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text)",
    fontSize:     "16px",
    padding:      "9px 11px",
    outline:      "none",
    width:        "100%",
    boxSizing:    "border-box",
    fontFamily:   "inherit",
  },
  formError: {
    background:   "var(--error-bg, #fee2e2)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "var(--danger)",
    fontSize:     "12px",
    padding:      "8px 12px",
  },
};
