import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { getAuthToken } from "../api/client";
import NavSheet from "./NavSheet";
import { navGroups, visibleItems } from "./navConfig";

// ── JWT expiry timer ─────────────────────────────────────────────────────────

function getTokenExp() {
  try {
    const token = getAuthToken();
    if (!token) return null;
    return JSON.parse(atob(token.split(".")[1])).exp ?? null;
  } catch {
    return null;
  }
}

function JwtTimer() {
  const [remaining, setRemaining] = useState(() => {
    const exp = getTokenExp();
    return exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : null;
  });

  useEffect(() => {
    const tick = () => {
      const exp = getTokenExp();
      setRemaining(exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : null);
    };
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  if (remaining === null) return null;

  const totalMins = Math.floor(remaining / 60);
  const hours = Math.floor(totalMins / 60);
  const mins  = totalMins % 60;
  const label = hours > 0 ? `${hours}h:${String(mins).padStart(2, "0")}m` : `${mins}m`;
  const color = remaining <= 300 ? "var(--danger)" : remaining <= 600 ? "#f59e0b" : "var(--text-muted)";

  return (
    <span style={{ ...s.sessionRow, color }}>
      Session ends in {label}
    </span>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

export default function MobileLayout({ children }) {
  const { user, signOut } = useAuth();
  const { settings } = useAppSettings();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const [lastPath, setLastPath] = useState(pathname);

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "?";
  const gates = { backstageEnabled: settings.backstageEnabled, username: user?.username };

  // Any route change closes whatever is open, so a sheet never outlives its
  // page — including on browser back/forward, which no click handler sees.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpenGroup(null);
    setShowUserMenu(false);
  }

  const groups = navGroups
    .map(g => (g.items ? { ...g, items: visibleItems(g, gates) } : g))
    .filter(g => !g.items || g.items.length > 0);

  const sheetGroup = groups.find(g => g.id === openGroup) ?? null;

  function onTab(group) {
    if (group.items) setOpenGroup(v => (v === group.id ? null : group.id));
    else {
      setOpenGroup(null);
      navigate(group.to);
    }
  }

  return (
    <div style={s.shell}>
      <header style={s.topBar}>
        <div style={s.brand}>
          <img src="/app-icon.svg" alt="" style={{ height: 30, width: 30, display: "block", borderRadius: 8 }} />
          <span style={s.brandText}>4TURA<span style={s.brandAccent}> Home</span></span>
        </div>
        <button style={s.avatar} onClick={() => setShowUserMenu(v => !v)} aria-label="Account">
          {initials}
        </button>
        {showUserMenu && (
          <div style={s.userMenu}>
            <span style={s.userMenuName}>{user?.username}</span>
            <JwtTimer />
            <button style={s.signOutBtn} onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>

      <main style={s.main}>{children}</main>

      {sheetGroup && (
        <NavSheet
          title={sheetGroup.label}
          items={sheetGroup.items}
          onClose={() => setOpenGroup(null)}
        />
      )}

      <nav style={s.tabBar}>
        {groups.map(group => {
          const active = group.match(pathname) || openGroup === group.id;
          return (
            <button
              key={group.id}
              onClick={() => onTab(group)}
              aria-label={group.label}
              aria-current={group.match(pathname) ? "page" : undefined}
              style={{ ...s.tab, color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              <group.Icon />
              <span style={s.tabLabel}>{group.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const s = {
  shell: {
    display:       "flex",
    flexDirection: "column",
    height:        "100dvh",
    overflow:      "hidden",
  },
  // viewport-fit=cover lets content run under the notch, so the bar pads itself
  // down by the inset rather than using a fixed height.
  topBar: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "0 16px",
    paddingTop:     "env(safe-area-inset-top)",
    minHeight:      "52px",
    boxSizing:      "content-box",
    background:     "var(--topbar-bg)",
    borderBottom:   "1px solid var(--topbar-border)",
    flexShrink:     0,
    position:       "relative",
    zIndex:         100,
  },
  brand: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
  },
  brandText: {
    fontSize:   "15px",
    fontWeight: 400,
    color:      "var(--text-muted)",
  },
  brandAccent: {
    fontWeight: 700,
    color:      "var(--badge-text)",
    marginLeft: "2px",
  },
  avatar: {
    width:          "32px",
    height:         "32px",
    borderRadius:   "50%",
    background:     "var(--avatar-bg)",
    border:         "1px solid var(--avatar-border)",
    color:          "var(--avatar-color)",
    fontSize:       "11px",
    fontWeight:     700,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    cursor:         "pointer",
  },
  userMenu: {
    position:      "absolute",
    top:           "calc(56px + env(safe-area-inset-top))",
    right:         "12px",
    background:    "var(--surface)",
    border:        "1px solid var(--border)",
    borderRadius:  "10px",
    padding:       "12px 16px",
    display:       "flex",
    flexDirection: "column",
    gap:           "10px",
    boxShadow:     "0 4px 20px rgba(0,0,0,0.2)",
    zIndex:        200,
    minWidth:      "170px",
  },
  userMenuName: {
    fontSize:   "12px",
    color:      "var(--text-muted)",
    fontWeight: 500,
  },
  sessionRow: {
    fontSize:           "11px",
    fontWeight:         600,
    fontVariantNumeric: "tabular-nums",
    letterSpacing:      "0.02em",
  },
  main: {
    flex:          1,
    overflowY:     "auto",
    minHeight:     0,
    display:       "flex",
    flexDirection: "column",
  },
  tabBar: {
    display:        "flex",
    borderTop:      "1px solid var(--border)",
    background:     "var(--topbar-bg)",
    backdropFilter: "blur(12px)",
    flexShrink:     0,
    paddingBottom:  "env(safe-area-inset-bottom)",
    zIndex:         100,
  },
  tab: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "3px",
    padding:        "8px 2px",
    minWidth:       0,
    border:         "none",
    background:     "transparent",
    cursor:         "pointer",
    fontFamily:     "inherit",
    transition:     "color 0.15s",
  },
  tabLabel: {
    fontSize:      "9px",
    fontWeight:    500,
    whiteSpace:    "nowrap",
    letterSpacing: "-0.01em",
  },
};
