import { useState, useEffect } from "react";
import client from "../api/client";
import useIsMobile from "../hooks/useIsMobile";

export default function AiNews() {
  const isMobile = useIsMobile();
  const [googleNews, setGoogleNews] = useState([]);
  const [techReview, setTechReview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    client.get("/ai-news")
      .then(res => {
        setGoogleNews(res.data.googleNews || []);
        setTechReview(res.data.techReview || []);
      })
      .catch(() => setError("Failed to load feeds."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={s.page}>
      <div style={s.toolbar}>
        <button style={s.refreshBtn} onClick={load} disabled={loading}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
        {!loading && !error && (
          <span style={s.count}>{googleNews.length + techReview.length} articles</span>
        )}
      </div>

      {error && (
        <div style={s.errorBox}>
          {error}{" "}
          <button style={s.retryBtn} onClick={load}>Retry</button>
        </div>
      )}

      {loading && (
        <div style={s.spinWrap}><div style={s.spinner} /></div>
      )}

      {!loading && !error && (
        <div style={s.blocks}>
          <FeedBlock
            title="AI News"
            articles={googleNews}
            isMobile={isMobile}
            showSource
          />
          <FeedBlock
            title="MIT Technology Review"
            articles={techReview}
            isMobile={isMobile}
            showSource={false}
          />
        </div>
      )}
    </div>
  );
}

function FeedBlock({ title, articles, isMobile, showSource }) {
  return (
    <div style={s.block}>
      <div style={s.blockHeader}>{title}</div>

      {articles.length === 0 && (
        <div style={s.empty}>No articles found.</div>
      )}

      {articles.length > 0 && (
        isMobile ? (
          <div style={s.cardList}>
            {articles.map((a, i) => (
              <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" style={s.card}>
                <div style={s.cardDate}>{a.date}</div>
                <div style={s.cardTitle}>{a.title}</div>
                {showSource && a.source && <div style={s.cardSource}>{a.source}</div>}
              </a>
            ))}
          </div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={{ ...s.th, width: "70%" }}>Title</th>
                  {showSource && <th style={s.th}>Source</th>}
                </tr>
              </thead>
              <tbody>
                {articles.map((a, i) => (
                  <tr key={i} style={s.tr}>
                    <td style={{ ...s.td, ...s.dateCell }}>{a.date}</td>
                    <td style={s.td}>
                      <a href={a.link} target="_blank" rel="noopener noreferrer" style={s.link}>
                        {a.title}
                      </a>
                    </td>
                    {showSource && <td style={{ ...s.td, ...s.sourceCell }}>{a.source}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

const s = {
  page: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
    gap:           "12px",
    overflowY:     "auto",
  },
  toolbar: {
    display:    "flex",
    alignItems: "center",
    gap:        "12px",
    flexShrink: 0,
  },
  refreshBtn: {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    fontWeight:   600,
    padding:      "6px 14px",
    cursor:       "pointer",
  },
  count: {
    fontSize: "12px",
    color:    "var(--text-muted)",
  },
  errorBox: {
    background:   "var(--error-bg)",
    border:       "1px solid var(--danger)",
    borderRadius: "8px",
    color:        "var(--error-text)",
    fontSize:     "13px",
    padding:      "10px 14px",
    display:      "flex",
    alignItems:   "center",
    gap:          "10px",
  },
  retryBtn: {
    background:   "transparent",
    border:       "1px solid var(--danger)",
    borderRadius: "6px",
    color:        "var(--danger)",
    fontSize:     "12px",
    padding:      "3px 10px",
    cursor:       "pointer",
  },
  spinWrap: {
    display:        "flex",
    justifyContent: "center",
    padding:        "60px 0",
  },
  spinner: {
    width:        "36px",
    height:       "36px",
    border:       "3px solid var(--border)",
    borderTop:    "3px solid var(--accent)",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
  },
  empty: {
    textAlign: "center",
    color:     "var(--text-muted)",
    fontSize:  "13px",
    padding:   "20px 0",
  },
  blocks: {
    display:       "flex",
    flexDirection: "column",
    gap:           "24px",
    flex:          1,
    minHeight:     0,
  },
  block: {
    display:       "flex",
    flexDirection: "column",
    minHeight:     0,
  },
  blockHeader: {
    fontSize:      "11px",
    fontWeight:    700,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom:  "8px",
    flexShrink:    0,
  },
  tableWrap: {
    overflowY: "auto",
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
    padding:       "10px 12px",
    fontSize:      "13px",
    color:         "var(--text)",
    verticalAlign: "top",
  },
  dateCell: {
    whiteSpace: "nowrap",
    color:      "var(--text-muted)",
    fontSize:   "12px",
    width:      "100px",
  },
  sourceCell: {
    color:      "var(--text-muted)",
    fontSize:   "12px",
    whiteSpace: "nowrap",
  },
  link: {
    color:          "var(--text)",
    textDecoration: "none",
    lineHeight:     1.4,
  },
  // ── Mobile cards ──
  cardList: {
    display:       "flex",
    flexDirection: "column",
    gap:           "8px",
  },
  card: {
    display:        "block",
    background:     "var(--surface)",
    border:         "1px solid var(--border)",
    borderRadius:   "10px",
    padding:        "12px 14px",
    textDecoration: "none",
  },
  cardDate: {
    fontSize:     "11px",
    color:        "var(--text-muted)",
    marginBottom: "4px",
  },
  cardTitle: {
    fontSize:   "14px",
    fontWeight: 500,
    color:      "var(--text)",
    lineHeight: 1.4,
  },
  cardSource: {
    fontSize:  "11px",
    color:     "var(--accent)",
    marginTop: "5px",
    fontWeight: 500,
  },
};
