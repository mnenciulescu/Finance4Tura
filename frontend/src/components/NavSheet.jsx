import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const COL_WIDTH = "var(--app-max-w)";

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
                  <Icon size={22} />
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
    background:     "var(--backdrop)",
    display:        "flex",
    alignItems:     "flex-end",
    justifyContent: "center",
    zIndex:         700,
  },
  sheet: {
    background:    "var(--surface)",
    borderRadius:  "var(--r-xl) var(--r-xl) 0 0",
    width:         "100%",
    maxWidth:      COL_WIDTH,
    maxHeight:     "92dvh",
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
    boxShadow:     "var(--shadow-sheet)",
  },
  grabber: {
    width:        "36px",
    height:       "4px",
    borderRadius: "var(--r-pill)",
    background:   "var(--text-dim)",
    margin:       "var(--sp-2) auto 0",
    flexShrink:   0,
  },
  head: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "var(--sp-4) var(--sp-5) var(--sp-1)",
    flexShrink:     0,
  },
  title: {
    fontSize:      "var(--fs-overline)",
    lineHeight:    "var(--lh-overline)",
    fontWeight:    700,
    color:         "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "1.2px",
  },
  closeBtn: {
    background:     "var(--surface-2)",
    border:         "none",
    borderRadius:   "50%",
    color:          "var(--text-muted)",
    fontSize:       "13px",
    width:          "32px",
    height:         "32px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  body: {
    display:       "flex",
    flexDirection: "column",
    gap:           "var(--sp-1)",
    padding:       "var(--sp-3) var(--sp-3) calc(var(--sp-4) + env(safe-area-inset-bottom))",
    overflowY:     "auto",
    minHeight:     0,
  },
  row: {
    display:      "flex",
    alignItems:   "center",
    gap:          "var(--sp-3)",
    width:        "100%",
    minHeight:    "52px",
    padding:      "var(--sp-3)",
    borderRadius: "var(--r-md)",
    border:       "none",
    background:   "transparent",
    color:        "var(--text)",
    fontSize:     "var(--fs-body)",
    lineHeight:   "var(--lh-body)",
    fontWeight:   500,
    textAlign:    "left",
    fontFamily:   "inherit",
  },
  rowActive: {
    background: "var(--surface-2)",
    color:      "var(--accent)",
    fontWeight: 700,
  },
  icon: {
    display:    "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  dot: {
    width:        "8px",
    height:       "8px",
    borderRadius: "50%",
    background:   "var(--accent)",
    marginLeft:   "auto",
    flexShrink:   0,
  },
};
