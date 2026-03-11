import { useState, useEffect } from "react";
import client from "../api/client";

const SOURCE_COLORS = {
  "The Verge":       "#fa4c00",
  "TechCrunch":      "#0aa84f",
  "MIT Tech Review": "#a00000",
  "VentureBeat":     "#2563eb",
  "Wired":           "#222222",
  "Google AI":       "#4285f4",
};

export default function AiNews() {
  const [articles, setArticles] = useState([]);
  const [failed,   setFailed]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    client.get("/ai-news")
      .then(r => { setArticles(r.data.articles); setFailed(r.data.failed ?? []); })
      .catch(err => setError(`Could not load AI news: ${err.response?.status ?? err.message}`))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>AI News</h1>
          <p style={s.subtitle}>
            Aggregated from The Verge · TechCrunch · MIT Tech Review · VentureBeat · Wired · Google AI
          </p>
        </div>
        <button style={{ ...s.refreshBtn, opacity: loading ? 0.6 : 1 }} onClick={load} disabled={loading}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {failed.length > 0 && !error && (
        <div style={s.warn}>
          Some sources could not be reached: {failed.join(" · ")}
        </div>
      )}

      {!error && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, width: "10%" }}>Date</th>
                <th style={{ ...s.th, width: "14%" }}>Source</th>
                <th style={{ ...s.th, width: "22%" }}>Title</th>
                <th style={{ ...s.th, width: "46%" }}>Summary</th>
                <th style={{ ...s.th, width: "8%", textAlign: "center" }}>Link</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i}>
                      <td style={s.td}><div style={{ ...s.skel, width: "70%" }} /></td>
                      <td style={s.td}><div style={{ ...s.skel, width: "60%" }} /></td>
                      <td style={s.td}><div style={{ ...s.skel, width: "80%" }} /></td>
                      <td style={s.td}><div style={{ ...s.skel, width: "95%" }} /></td>
                      <td style={s.td}><div style={{ ...s.skel, width: "50%", margin: "0 auto" }} /></td>
                    </tr>
                  ))
                : articles.map((a, i) => (
                    <tr key={i} style={s.row}>
                      <td style={{ ...s.td, ...s.dateCell }}>
                        {a.pubDate ? new Date(a.pubDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td style={s.td}>
                        <span style={{
                          ...s.sourceBadge,
                          background: (SOURCE_COLORS[a.source] ?? "#666") + "22",
                          color: SOURCE_COLORS[a.source] ?? "var(--text-muted)",
                          borderColor: (SOURCE_COLORS[a.source] ?? "#666") + "55",
                        }}>
                          {a.source}
                        </span>
                      </td>
                      <td style={{ ...s.td, ...s.titleCell }}>{a.title}</td>
                      <td style={s.td}>{a.summary || "—"}</td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <a href={a.link} target="_blank" rel="noopener noreferrer" style={s.link}>
                          Read →
                        </a>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    display:       "flex",
    flexDirection: "column",
    height:        "100%",
    gap:           "16px",
    minHeight:     0,
  },
  header: {
    display:        "flex",
    alignItems:     "flex-start",
    justifyContent: "space-between",
    flexShrink:     0,
  },
  title: {
    margin:     0,
    fontSize:   "20px",
    fontWeight: 600,
    color:      "var(--text)",
  },
  subtitle: {
    margin:    "3px 0 0",
    fontSize:  "11px",
    color:     "var(--text-muted)",
  },
  refreshBtn: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   500,
    padding:      "6px 14px",
    cursor:       "pointer",
    transition:   "border-color 0.15s, color 0.15s",
    flexShrink:   0,
  },
  error: {
    background:   "var(--error-bg)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "var(--error-text)",
    fontSize:     "13px",
    padding:      "10px 14px",
    flexShrink:   0,
  },
  warn: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    fontSize:     "11px",
    padding:      "8px 12px",
    flexShrink:   0,
  },
  tableWrap: {
    flex:         1,
    overflow:     "auto",
    border:       "1px solid var(--border)",
    borderRadius: "10px",
    minHeight:    0,
  },
  table: {
    width:          "100%",
    borderCollapse: "collapse",
    fontSize:       "13px",
    tableLayout:    "fixed",
  },
  th: {
    position:      "sticky",
    top:           0,
    background:    "var(--surface-2)",
    borderBottom:  "1px solid var(--border)",
    padding:       "10px 14px",
    textAlign:     "left",
    fontSize:      "11px",
    fontWeight:    600,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    zIndex:        1,
  },
  td: {
    padding:       "10px 14px",
    color:         "var(--text)",
    verticalAlign: "top",
    lineHeight:    1.5,
    borderBottom:  "1px solid var(--border)",
    wordBreak:     "break-word",
  },
  titleCell: {
    fontWeight: 500,
  },
  dateCell: {
    fontSize:   "12px",
    color:      "var(--text-muted)",
    whiteSpace: "nowrap",
  },
  sourceBadge: {
    display:      "inline-block",
    padding:      "2px 8px",
    borderRadius: "5px",
    border:       "1px solid",
    fontSize:     "11px",
    fontWeight:   600,
    whiteSpace:   "nowrap",
  },
  link: {
    color:          "var(--accent)",
    textDecoration: "none",
    fontWeight:     500,
    fontSize:       "12px",
  },
  skel: {
    height:       "14px",
    borderRadius: "6px",
    background:   "var(--surface-2)",
  },
  row: {
    transition: "background 0.1s",
  },
};
