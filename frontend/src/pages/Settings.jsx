import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const PRIVACY_KEY = "incomePrivacy";
export const getPrivacySetting = () => localStorage.getItem(PRIVACY_KEY) === "true";
export const setPrivacySetting = (val) => localStorage.setItem(PRIVACY_KEY, String(val));

const THEME_KEY = "appTheme";
const getStoredTheme = () => localStorage.getItem(THEME_KEY) ?? "light";
const applyThemeToDOM = (theme) => document.documentElement.setAttribute("data-theme", theme);
const saveTheme = (theme) => localStorage.setItem(THEME_KEY, theme);

const THEMES = [
  {
    id: "dark",
    label: "Dark",
    bg: "#1a1d27",
    surface: "#222535",
    border: "#2e3148",
    accent: "#16a34a",
    strip: "#86efac",
  },
  {
    id: "light",
    label: "Light",
    bg: "#f9fbf9",
    surface: "#eef2ee",
    border: "#c2d4c4",
    accent: "#15803d",
    strip: "#15803d",
  },
  {
    id: "amber",
    label: "Amber",
    bg: "#fffdf8",
    surface: "#f6ecd6",
    border: "#d4a845",
    accent: "#b45309",
    strip: "#b45309",
  },
];

function ThemeCard({ theme, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(theme.id)}
      style={{
        ...s.themeCard,
        ...(selected ? s.themeCardSelected : {}),
        borderColor: selected ? theme.accent : "var(--border)",
        boxShadow: selected ? `0 0 0 2px ${theme.accent}33` : "none",
      }}
    >
      {/* Mini app preview */}
      <div style={{ ...s.themePreviewBox, background: theme.bg }}>
        {/* Top bar */}
        <div style={{ ...s.themeTopbar, background: theme.surface, borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: theme.accent, opacity: 0.9 }} />
          <div style={{ display: "flex", gap: "4px" }}>
            <div style={{ width: "18px", height: "3px", borderRadius: "2px", background: theme.border }} />
            <div style={{ width: "12px", height: "3px", borderRadius: "2px", background: theme.border }} />
          </div>
        </div>
        {/* Content rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "5px 5px 3px" }}>
          {/* Accent strip */}
          <div style={{ height: "2px", borderRadius: "1px", background: theme.strip, width: "60%" }} />
          <div style={{ height: "3px", borderRadius: "2px", background: theme.border, width: "85%" }} />
          <div style={{ height: "3px", borderRadius: "2px", background: theme.border, width: "70%", opacity: 0.6 }} />
          <div style={{ height: "3px", borderRadius: "2px", background: theme.accent, width: "40%", opacity: 0.7 }} />
        </div>
      </div>
      {/* Label */}
      <span style={{ ...s.themeLabel, color: selected ? theme.accent : "var(--text-muted)" }}>
        {theme.label}
      </span>
      {selected && (
        <span style={{ ...s.themeCheck, color: theme.accent }}>✓</span>
      )}
    </button>
  );
}

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
  const [draftTheme,   setDraftTheme]   = useState(getStoredTheme());

  const handleThemeSelect = (theme) => {
    setDraftTheme(theme);
    applyThemeToDOM(theme);
  };

  const handleOk = () => {
    setPrivacySetting(draftPrivacy);
    saveTheme(draftTheme);
    navigate(-1);
  };

  const handleCancel = () => {
    applyThemeToDOM(getStoredTheme());
    navigate(-1);
  };

  return (
    <div style={s.outer}>
      <div style={s.card}>
        <h1 style={s.title}>Settings</h1>

        {/* Appearance */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Appearance</h2>

          <div style={s.settingInfo}>
            <span style={s.settingLabel}>Color Theme</span>
            <span style={s.settingDesc}>
              Choose a color theme for the application.
            </span>
          </div>
          <div style={s.themeRow}>
            {THEMES.map(theme => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                selected={draftTheme === theme.id}
                onSelect={handleThemeSelect}
              />
            ))}
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
    maxWidth:     "520px",
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
  themeRow: {
    display:   "flex",
    gap:       "12px",
    flexWrap:  "wrap",
  },
  themeCard: {
    position:     "relative",
    display:      "flex",
    flexDirection:"column",
    alignItems:   "center",
    gap:          "8px",
    padding:      "10px",
    background:   "var(--surface-2)",
    border:       "2px solid var(--border)",
    borderRadius: "12px",
    cursor:       "pointer",
    transition:   "border-color 0.15s, box-shadow 0.15s",
    minWidth:     "100px",
    flex:         "1 1 0",
  },
  themeCardSelected: {
    background: "var(--surface)",
  },
  themePreviewBox: {
    width:        "80px",
    height:       "54px",
    borderRadius: "7px",
    overflow:     "hidden",
    display:      "flex",
    flexDirection:"column",
    border:       "1px solid rgba(0,0,0,0.08)",
  },
  themeTopbar: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "4px 5px",
    flexShrink:     0,
  },
  themeLabel: {
    fontSize:   "12px",
    fontWeight: 600,
    transition: "color 0.15s",
  },
  themeCheck: {
    position:   "absolute",
    top:        "6px",
    right:      "8px",
    fontSize:   "11px",
    fontWeight: 700,
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
