import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const COL_WIDTH = "430px";

export default function NavSheet({ title, items, onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function go({ to, state }) {
    navigate(to, state ? { state: state() } : undefined);
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <div style={s.grabber} />

        <div style={s.head}>
          <span style={s.title}>{title}</span>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={s.body}>
          {items.map(item => {
            const { to, label, Icon } = item;
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <button
                key={to}
                style={{ ...s.row, ...(active ? s.rowActive : {}) }}
                onClick={() => go(item)}
              >
                <span style={{ ...s.icon, color: active ? "var(--accent)" : "var(--text-muted)" }}>
                  <Icon size={18} />
                </span>
                <span>{label}</span>
                {active && <span style={s.dot} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.55)",
    display:        "flex",
    alignItems:     "flex-end",
    justifyContent: "center",
    zIndex:         700,
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
  head: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "14px 18px 0",
    flexShrink:     0,
  },
  title: {
    fontSize:      "11px",
    fontWeight:    700,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  closeBtn: {
    background: "transparent",
    border:     "none",
    color:      "var(--text-muted)",
    fontSize:   "15px",
    cursor:     "pointer",
    padding:    "6px 8px",
  },
  body: {
    display:       "flex",
    flexDirection: "column",
    gap:           "2px",
    padding:       "10px 12px calc(16px + env(safe-area-inset-bottom))",
    overflowY:     "auto",
    minHeight:     0,
  },
  row: {
    display:        "flex",
    alignItems:     "center",
    gap:            "12px",
    width:          "100%",
    padding:        "13px 12px",
    borderRadius:   "10px",
    border:         "none",
    background:     "transparent",
    color:          "var(--text)",
    fontSize:       "14px",
    fontWeight:     500,
    textAlign:      "left",
    cursor:         "pointer",
    fontFamily:     "inherit",
  },
  rowActive: {
    background: "var(--surface-2)",
    color:      "var(--accent)",
    fontWeight: 600,
  },
  icon: {
    display:    "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  dot: {
    width:        "6px",
    height:       "6px",
    borderRadius: "50%",
    background:   "var(--accent)",
    marginLeft:   "auto",
    flexShrink:   0,
  },
};
