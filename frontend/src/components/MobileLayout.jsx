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
  const color = remaining <= 300 ? "var(--danger)"
              : remaining <= 600 ? "var(--warning-text)"
              : "var(--text-muted)";

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
    <div className="app-shell" style={s.shell}>
      <header style={s.topBar}>
        <div style={s.brand}>
          <img src="/app-icon.svg" alt="" style={s.brandMark} />
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
              <span style={{ ...s.tabIcon, ...(active ? s.tabIconActive : {}) }}>
                <group.Icon size={22} />
              </span>
              <span style={{ ...s.tabLabel, fontWeight: active ? 700 : 500 }}>{group.label}</span>
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
    padding:        "0 var(--sp-4)",
    paddingTop:     "env(safe-area-inset-top)",
    minHeight:      "56px",
    boxSizing:      "content-box",
    background:     "var(--topbar-bg)",
    flexShrink:     0,
    position:       "relative",
    zIndex:         100,
  },
  brand: {
    display:    "flex",
    alignItems: "center",
    gap:        "var(--sp-2)",
  },
  brandMark: {
    height:       30,
    width:        30,
    display:      "block",
    borderRadius:  "var(--r-md)",
  },
  brandText: {
    fontFamily:    "var(--font-display)",
    fontSize:      "var(--fs-h3)",
    fontWeight:    700,
    color:         "var(--text)",
    letterSpacing: "-0.01em",
  },
  // The active section name carries the accent; the wordmark itself does not.
  brandAccent: {
    fontWeight: 800,
    color:      "var(--accent)",
    marginLeft: "3px",
  },
  avatar: {
    width:          "40px",
    height:         "40px",
    borderRadius:   "50%",
    background:     "var(--avatar-bg)",
    border:         "none",
    color:          "var(--avatar-color)",
    fontFamily:     "var(--font-display)",
    fontSize:       "13px",
    fontWeight:     800,
    letterSpacing:  "0.02em",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  userMenu: {
    position:      "absolute",
    top:           "calc(60px + env(safe-area-inset-top))",
    right:         "var(--sp-3)",
    background:    "var(--surface)",
    borderRadius:  "var(--r-lg)",
    padding:       "var(--sp-4)",
    display:       "flex",
    flexDirection: "column",
    gap:           "var(--sp-3)",
    boxShadow:     "var(--shadow-card)",
    zIndex:        200,
    minWidth:      "190px",
  },
  userMenuName: {
    fontSize:   "var(--fs-label)",
    lineHeight: "var(--lh-label)",
    color:      "var(--text)",
    fontWeight: 700,
  },
  sessionRow: {
    fontSize:           "var(--fs-caption)",
    lineHeight:         "var(--lh-caption)",
    fontWeight:         600,
    fontVariantNumeric: "tabular-nums",
  },
  signOutBtn: {
    background:   "var(--surface-2)",
    color:        "var(--text)",
    border:       "none",
    borderRadius: "var(--r-pill)",
    padding:      "var(--sp-3) var(--sp-4)",
    fontSize:     "var(--fs-label)",
    fontWeight:   600,
    minHeight:    "44px",
  },
  main: {
    flex:          1,
    overflowY:     "auto",
    minHeight:     0,
    display:       "flex",
    flexDirection: "column",
  },
  // Sits on the deepest surface with a rounded top, so it reads as a panel the
  // content scrolls beneath rather than as a strip welded to the viewport.
  tabBar: {
    display:        "flex",
    background:     "var(--surface-deep)",
    borderRadius:   "var(--r-xl) var(--r-xl) 0 0",
    boxShadow:      "var(--shadow-card)",
    flexShrink:     0,
    paddingTop:     "var(--sp-2)",
    paddingBottom:  "calc(var(--sp-2) + env(safe-area-inset-bottom))",
    zIndex:         100,
  },
  tab: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "2px",
    padding:        "2px",
    minWidth:       0,
    minHeight:      "44px",
    border:         "none",
    background:     "transparent",
    fontFamily:     "inherit",
  },
  tabIcon: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    width:          "40px",
    height:         "28px",
    borderRadius:   "var(--r-pill)",
    transition:     "background 120ms ease-out",
  },
  tabIconActive: {
    background: "var(--accent-tint-bg)",
  },
  tabLabel: {
    fontSize:      "var(--fs-caption)",
    lineHeight:    "var(--lh-caption)",
    whiteSpace:    "nowrap",
    letterSpacing: "-0.01em",
  },
};
