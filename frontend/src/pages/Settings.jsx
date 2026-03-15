import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { syncSP500 } from "../api/investments";

export const PRIVACY_KEY = "incomePrivacy";
export const getPrivacySetting = () => localStorage.getItem(PRIVACY_KEY) === "true";
export const setPrivacySetting = (val) => localStorage.setItem(PRIVACY_KEY, String(val));

const THEME_KEY = "appTheme";
const getTheme = () => localStorage.getItem(THEME_KEY) ?? "light";
const applyTheme = (theme) => {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
};

function Toggle({ value, onChange }) {
  return (
    <button
      style={{ ...s.toggle, ...(value ? s.toggleOn : s.toggleOff) }}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      <span style={{ ...s.thumb, transform: value ? "translateX(20px)" : "translateX(2px)" }} />
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [draftPrivacy, setDraftPrivacy] = useState(getPrivacySetting());
  const [draftTheme,   setDraftTheme]   = useState(getTheme());

  // SP500 sync
  const [syncLog,     setSyncLog]     = useState(null);   // null = idle; string[] = running/done
  const [syncVisible, setSyncVisible] = useState(0);
  const [syncing,     setSyncing]     = useState(false);
  const syncDoneRef = useRef(false);

  const handleSyncSP500 = () => {
    if (syncing) return;
    syncDoneRef.current = false;
    setSyncing(true);
    setSyncLog(["Checking S&P 500 database..."]);
    setSyncVisible(1);

    syncSP500()
      .then(({ log }) => {
        setSyncLog(["Checking S&P 500 database...", ...log]);
        syncDoneRef.current = true;
        setSyncing(false);
      })
      .catch(e => {
        setSyncLog(prev => [...(prev ?? []), `Error: ${e.message}`]);
        syncDoneRef.current = true;
        setSyncing(false);
      });
  };

  // Animate log lines one by one
  useEffect(() => {
    if (!syncLog || syncVisible >= syncLog.length) return;
    const t = setTimeout(() => setSyncVisible(v => v + 1), 80);
    return () => clearTimeout(t);
  }, [syncLog, syncVisible]);

  const handleThemeToggle = (isLight) => {
    const next = isLight ? "light" : "dark";
    setDraftTheme(next);
    applyTheme(next); // live preview
  };

  const handleOk = () => {
    setPrivacySetting(draftPrivacy);
    applyTheme(draftTheme);
    navigate(-1);
  };

  const handleCancel = () => {
    // revert live preview
    applyTheme(getTheme());
    navigate(-1);
  };

  return (
    <div style={s.outer}>
      <div style={s.card}>
        <h1 style={s.title}>Settings</h1>

        {/* Appearance */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Appearance</h2>

          <div style={s.settingRow}>
            <div style={s.settingInfo}>
              <span style={s.settingLabel}>Light Theme</span>
              <span style={s.settingDesc}>
                Switch between Dark (default) and Light color theme.
              </span>
            </div>
            <Toggle value={draftTheme === "light"} onChange={handleThemeToggle} />
          </div>
        </section>

        {/* Privacy */}
        <section style={{ ...s.section, marginTop: "24px" }}>
          <h2 style={s.sectionTitle}>Privacy</h2>

          <div style={s.settingRow}>
            <div style={s.settingInfo}>
              <span style={s.settingLabel}>Income Amounts Visibility</span>
              <span style={s.settingDesc}>
                When enabled, income amounts are visible in column headers. Disabled by default.
              </span>
            </div>
            <Toggle value={draftPrivacy} onChange={setDraftPrivacy} />
          </div>
        </section>

        {/* Data */}
        <section style={{ ...s.section, marginTop: "24px" }}>
          <h2 style={s.sectionTitle}>Data</h2>

          <div style={s.settingRow}>
            <div style={s.settingInfo}>
              <span style={s.settingLabel}>Get latest S&amp;P 500 data</span>
              <span style={s.settingDesc}>
                Fetches missing monthly S&amp;P 500 closing prices from Yahoo Finance
                and stores them in the database.
              </span>
            </div>
            <button
              style={{ ...s.btnOk, opacity: syncing ? 0.6 : 1, cursor: syncing ? "not-allowed" : "pointer" }}
              onClick={handleSyncSP500}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Run"}
            </button>
          </div>

          {syncLog && (
            <div style={s.logPanel}>
              {syncLog.slice(0, syncVisible).map((line, i) => {
                const color = /stored|done|already up to date/i.test(line) ? "#22c55e"
                  : /error|failed/i.test(line) ? "#ef4444"
                  : /fetching|checking/i.test(line) ? "#f59e0b"
                  : "#94a3b8";
                return <div key={i} style={{ color, marginBottom: 2 }}>{line}</div>;
              })}
              {syncVisible < syncLog.length && <span style={{ color: "#f59e0b" }}>▋</span>}
            </div>
          )}
        </section>

        <div style={s.actions}>
          <button style={s.btnCancel} onClick={handleCancel}>Cancel</button>
          <button style={s.btnOk}     onClick={handleOk}>OK</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  outer: {
    display:        "flex",
    flex:           1,
    alignItems:     "flex-start",
    justifyContent: "center",
    paddingTop:     "40px",
  },
  card: {
    width:        "100%",
    maxWidth:     "480px",
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "14px",
    padding:      "28px 32px",
    boxShadow:    "0 4px 32px rgba(0,0,0,0.15)",
  },
  title: {
    fontSize:     "18px",
    fontWeight:   700,
    color:        "var(--text)",
    marginBottom: "24px",
  },
  section: {
    display:       "flex",
    flexDirection: "column",
    gap:           "16px",
  },
  sectionTitle: {
    fontSize:      "11px",
    fontWeight:    600,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    paddingBottom: "8px",
    borderBottom:  "1px solid var(--border)",
  },
  settingRow: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "16px",
  },
  settingInfo: {
    display:       "flex",
    flexDirection: "column",
    gap:           "4px",
    flex:          1,
  },
  settingLabel: {
    fontSize:   "13px",
    fontWeight: 600,
    color:      "var(--text)",
  },
  settingDesc: {
    fontSize:   "12px",
    color:      "var(--text-muted)",
    lineHeight: 1.5,
  },
  toggle: {
    position:     "relative",
    width:        "44px",
    height:       "24px",
    borderRadius: "12px",
    border:       "none",
    cursor:       "pointer",
    flexShrink:   0,
    transition:   "background 0.2s",
    padding:      0,
  },
  toggleOn: {
    background: "var(--accent)",
  },
  toggleOff: {
    background: "var(--border)",
  },
  thumb: {
    position:     "absolute",
    top:          "2px",
    width:        "20px",
    height:       "20px",
    borderRadius: "50%",
    background:   "#fff",
    transition:   "transform 0.2s",
    display:      "block",
  },
  logPanel: {
    background:   "#0f172a",
    borderRadius: "8px",
    padding:      "14px 18px",
    fontFamily:   "'Courier New', Courier, monospace",
    fontSize:     "12px",
    lineHeight:   1.7,
    display:      "flex",
    flexDirection: "column",
  },
  actions: {
    display:        "flex",
    justifyContent: "flex-end",
    gap:            "10px",
    marginTop:      "28px",
    paddingTop:     "16px",
    borderTop:      "1px solid var(--border)",
  },
  btnCancel: {
    background:   "transparent",
    color:        "var(--text-muted)",
    border:       "1px solid var(--border)",
    borderRadius: "8px",
    padding:      "8px 20px",
    fontWeight:   500,
    fontSize:     "13px",
    cursor:       "pointer",
  },
  btnOk: {
    background:   "var(--accent)",
    color:        "#fff",
    border:       "none",
    borderRadius: "8px",
    padding:      "8px 24px",
    fontWeight:   600,
    fontSize:     "13px",
    cursor:       "pointer",
  },
};
