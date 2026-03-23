import { useState, useEffect, useMemo } from "react";
import { listBooks, createBook, updateBook, deleteBook } from "../api/booksAndDev";

const SOURCES = ["Book", "Voxa", "Udemy", "Other"];
const TYPES   = ["Book", "Audiobook", "Training", "Other"];
const RATINGS = [1, 2, 3, 4, 5];

function Stars({ value, onChange, readOnly }) {
  const [hover, setHover] = useState(null);
  return (
    <span style={{ display: "inline-flex", gap: "2px", cursor: readOnly ? "default" : "pointer" }}>
      {RATINGS.map(n => (
        <span
          key={n}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(null)}
          onClick={() => !readOnly && onChange && onChange(n === value ? null : n)}
          style={{ fontSize: "15px", color: n <= (hover ?? value ?? 0) ? "#f59e0b" : "var(--border)", lineHeight: 1 }}
        >★</span>
      ))}
    </span>
  );
}

function defaultForm() {
  return { name: "", source: "Book", type: "Book", author: "", title: "", dateCompleted: "", rating: null, comments: "" };
}

export default function BooksAndDev() {
  const [books, setBooks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [modalOpen, setModal]   = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(defaultForm());
  const [formErr, setFormErr]   = useState(null);
  const [saving, setSaving]     = useState(false);

  // filters
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

  function openAdd() {
    setEditing(null);
    setForm(defaultForm());
    setFormErr(null);
    setModal(true);
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
    setModal(true);
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
      setModal(false);
    } catch (e) {
      setFormErr(e?.response?.data?.message || e.message || "Error saving");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(book) {
    if (!window.confirm(`Delete "${book.title}"?`)) return;
    try {
      await deleteBook(book.bookId);
      setBooks(prev => prev.filter(b => b.bookId !== book.bookId));
    } catch (e) {
      window.alert("Failed to delete: " + (e?.response?.data?.message || e.message));
    }
  }

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })); }

  if (loading) return <div style={s.center}>Loading…</div>;
  if (error)   return <div style={{ ...s.center, color: "var(--danger)" }}>{error}</div>;

  return (
    <div style={s.root}>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <button style={s.btnPrimary} onClick={openAdd}>+ Add</button>
        <input
          style={s.searchInput}
          placeholder="Search title / author…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={s.sel} value={fName}   onChange={e => setFName(e.target.value)}>
          <option value="">All people</option>
          {names.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select style={s.sel} value={fType}   onChange={e => setFType(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={s.sel} value={fSource} onChange={e => setFSource(e.target.value)}>
          <option value="">All sources</option>
          {SOURCES.map(src => <option key={src} value={src}>{src}</option>)}
        </select>
        <select style={s.sel} value={fRating} onChange={e => setFRating(e.target.value)}>
          <option value="">All ratings</option>
          {RATINGS.map(r => <option key={r} value={r}>{"★".repeat(r)}</option>)}
        </select>
        <span style={s.count}>{filtered.length} entries</span>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {["Person","Type","Source","Author","Title","Completed","Rating","Comments",""].map(h => (
                <th key={h} style={{ ...s.th, ...(h === "Title" || h === "Author" ? { minWidth: "180px" } : {}) }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ ...s.td, textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>No entries found.</td></tr>
            )}
            {filtered.map(b => (
              <tr key={b.bookId} style={s.tr}>
                <td style={{ ...s.td, ...s.nowrap }}>{b.name || "—"}</td>
                <td style={{ ...s.td, ...s.nowrap }}>
                  <span style={{ ...s.badge, ...typeBadge(b.type) }}>{b.type || "—"}</span>
                </td>
                <td style={{ ...s.td, ...s.nowrap, color: "var(--text-muted)" }}>{b.source || "—"}</td>
                <td style={s.td}>{b.author || "—"}</td>
                <td style={{ ...s.td, fontWeight: 500 }}>{b.title}</td>
                <td style={{ ...s.td, ...s.nowrap, color: "var(--text-muted)" }}>{b.dateCompleted || "—"}</td>
                <td style={s.td}><Stars value={b.rating} readOnly /></td>
                <td style={{ ...s.td, color: "var(--text-muted)", fontSize: "12px", maxWidth: "200px" }}>{b.comments || ""}</td>
                <td style={{ ...s.td, ...s.nowrap }}>
                  <button style={s.btnIcon} onClick={() => openEdit(b)} title="Edit">✎</button>
                  <button style={{ ...s.btnIcon, color: "var(--danger)" }} onClick={() => handleDelete(b)} title="Delete">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={s.overlay} onClick={() => setModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>{editing ? "Edit Entry" : "Add Entry"}</span>
              <button style={s.closeBtn} onClick={() => setModal(false)}>✕</button>
            </div>

            {formErr && <div style={s.formError}>{formErr}</div>}

            <div style={s.formGrid}>
              <label style={s.label}>Person
                <input style={s.input} value={form.name} onChange={e => setF("name", e.target.value)} placeholder="e.g. Mihai" />
              </label>
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
              <label style={s.label}>Completed (YYYY-MM)
                <input style={s.input} value={form.dateCompleted} onChange={e => setF("dateCompleted", e.target.value)} placeholder="e.g. 2024-06" />
              </label>
              <label style={{ ...s.label, gridColumn: "1 / -1" }}>Author
                <input style={s.input} value={form.author} onChange={e => setF("author", e.target.value)} placeholder="Author name" />
              </label>
              <label style={{ ...s.label, gridColumn: "1 / -1" }}>Title *
                <input style={s.input} value={form.title} onChange={e => setF("title", e.target.value)} placeholder="Book / course title" />
              </label>
              <label style={{ ...s.label, gridColumn: "1 / -1" }}>Rating
                <div style={{ marginTop: "6px" }}>
                  <Stars value={form.rating} onChange={v => setF("rating", v)} />
                </div>
              </label>
              <label style={{ ...s.label, gridColumn: "1 / -1" }}>Comments
                <textarea style={{ ...s.input, minHeight: "70px", resize: "vertical" }} value={form.comments} onChange={e => setF("comments", e.target.value)} placeholder="Notes…" />
              </label>
            </div>

            <div style={s.modalFooter}>
              <button style={s.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
              <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function typeBadge(type) {
  if (type === "Audiobook") return { background: "#7c3aed22", color: "#7c3aed" };
  if (type === "Training")  return { background: "#0891b222", color: "#0891b2" };
  return { background: "var(--surface-2)", color: "var(--text-muted)" };
}

const s = {
  root: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
    gap:           "12px",
  },
  center: {
    display:        "flex",
    justifyContent: "center",
    alignItems:     "center",
    flex:           1,
    color:          "var(--text-muted)",
    fontSize:       "13px",
  },
  toolbar: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
    flexWrap:   "wrap",
    flexShrink: 0,
  },
  searchInput: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text)",
    fontSize:     "12px",
    padding:      "6px 10px",
    outline:      "none",
    width:        "180px",
  },
  sel: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text)",
    fontSize:     "12px",
    padding:      "6px 8px",
    outline:      "none",
  },
  count: {
    fontSize: "12px",
    color:    "var(--text-muted)",
    marginLeft: "4px",
  },
  tableWrap: {
    overflowY: "auto",
    flex:      1,
    minHeight: 0,
  },
  table: {
    width:          "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign:     "left",
    fontSize:      "11px",
    fontWeight:    600,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding:       "8px 12px",
    borderBottom:  "2px solid var(--border)",
    whiteSpace:    "nowrap",
    position:      "sticky",
    top:           0,
    background:    "var(--bg)",
  },
  tr: {
    borderBottom: "1px solid var(--border)",
  },
  td: {
    padding:       "9px 12px",
    fontSize:      "13px",
    color:         "var(--text)",
    verticalAlign: "middle",
  },
  nowrap: { whiteSpace: "nowrap" },
  badge: {
    fontSize:     "11px",
    fontWeight:   600,
    padding:      "2px 7px",
    borderRadius: "5px",
  },
  btnPrimary: {
    background:   "var(--accent)",
    border:       "none",
    borderRadius: "8px",
    color:        "#fff",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "6px 14px",
    cursor:       "pointer",
  },
  btnSecondary: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "6px 14px",
    cursor:       "pointer",
  },
  btnIcon: {
    background:   "transparent",
    border:       "none",
    borderRadius: "6px",
    color:        "var(--text-muted)",
    fontSize:     "14px",
    padding:      "3px 6px",
    cursor:       "pointer",
  },
  // Modal
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.45)",
    display:        "flex",
    justifyContent: "center",
    alignItems:     "center",
    zIndex:         1000,
  },
  modal: {
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "14px",
    width:        "520px",
    maxWidth:     "95vw",
    maxHeight:    "90vh",
    overflowY:    "auto",
    padding:      "24px",
    display:      "flex",
    flexDirection:"column",
    gap:          "16px",
  },
  modalHeader: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  modalTitle: {
    fontSize:   "15px",
    fontWeight: 700,
    color:      "var(--text)",
  },
  closeBtn: {
    background:   "transparent",
    border:       "none",
    fontSize:     "16px",
    color:        "var(--text-muted)",
    cursor:       "pointer",
    lineHeight:   1,
  },
  formGrid: {
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
    fontSize:     "13px",
    padding:      "7px 10px",
    outline:      "none",
    width:        "100%",
    boxSizing:    "border-box",
  },
  formError: {
    background:   "var(--error-bg, #fee2e2)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "var(--danger)",
    fontSize:     "12px",
    padding:      "8px 12px",
  },
  modalFooter: {
    display:        "flex",
    justifyContent: "flex-end",
    gap:            "8px",
  },
};
