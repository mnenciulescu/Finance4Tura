import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { getAuthToken } from "../api/client";
import { navGroups, accountItems, visibleItems } from "./navConfig";
import { TAB_ICON_COLORS, alpha } from "../utils/colors";

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
  const [lastPath, setLastPath] = useState(pathname);

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "?";
  const gates = { backstageEnabled: settings.backstageEnabled, username: user?.username };

  // Any route change closes the account menu — including on browser
  // back/forward, which no click handler sees.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setShowUserMenu(false);
  }

  const menuItems = visibleItems(accountItems, gates);

  function onTab(group) {
    navigate(group.to, group.state ? { state: group.state() } : undefined);
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
          <div style={s.userMenu} role="menu" aria-label="Account">
            <span style={s.userMenuName}>{user?.username}</span>
            <JwtTimer />
            <div style={s.menuItems}>
              {menuItems.map(item => {
                const { to, label, Icon } = item;
                const active = pathname === to || pathname.startsWith(`${to}/`);
                return (
                  <button
                    key={to}
                    role="menuitem"
                    style={{ ...s.menuItem, color: active ? "var(--accent)" : "var(--text)" }}
                    onClick={() => { setShowUserMenu(false); navigate(to); }}
                  >
                    <span style={{ ...s.menuIcon, color: active ? "var(--accent)" : "var(--text-muted)" }}>
                      <Icon size={20} />
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
            <button style={s.signOutBtn} role="menuitem" onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>

      <main style={s.main}>{children}</main>

      <nav style={s.tabBar} aria-label="Main">
        <div style={s.dock}>
          {navGroups.map(group => {
            const active = group.match(pathname);
            const tone   = TAB_ICON_COLORS[group.tone];
            return (
              <button
                key={group.id}
                onClick={() => onTab(group)}
                aria-label={group.label}
                aria-current={active ? "page" : undefined}
                style={s.tab}
              >
                <span
                  style={{
                    ...s.tabIcon,
                    ...(active ? { background: alpha(tone.main, 0.18) } : s.tabIconIdle),
                  }}
                >
                  <group.Icon size={30} />
                </span>
                <span
                  style={{
                    ...s.tabLabel,
                    color:      active ? tone.ink : "var(--text-muted)",
                    fontWeight: active ? 800 : 600,
                  }}
                >
                  {group.label}
                </span>
                <span
                  style={{
                    ...s.tabDot,
                    background: active ? tone.main : "transparent",
                  }}
                />
              </button>
            );
          })}
        </div>
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
  menuItems: {
    display:       "flex",
    flexDirection: "column",
    margin:        "0 calc(-1 * var(--sp-2))",
  },
  menuItem: {
    display:      "flex",
    alignItems:   "center",
    gap:          "var(--sp-3)",
    minHeight:    "44px",
    padding:      "0 var(--sp-2)",
    background:   "transparent",
    border:       "none",
    borderRadius: "var(--r-md)",
    fontFamily:   "inherit",
    fontSize:     "var(--fs-label)",
    fontWeight:   600,
    textAlign:    "left",
  },
  menuIcon: {
    display:    "flex",
    flexShrink: 0,
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
  // A floating dock rather than a strip welded to the viewport edge: it sits
  // on the canvas, inset from the sides, with the safe-area inset below it.
  tabBar: {
    flexShrink:    0,
    padding:       "var(--sp-2) var(--sp-3) calc(var(--sp-2) + env(safe-area-inset-bottom))",
    display:       "flex",
    justifyContent: "center",
    zIndex:        100,
  },
  dock: {
    display:      "flex",
    width:        "100%",
    maxWidth:     "var(--app-max-w)",
    background:   "var(--surface-deep)",
    borderRadius: "var(--r-xl)",
    boxShadow:    "var(--shadow-raised)",
    padding:      "var(--sp-2) var(--sp-1) var(--sp-1)",
  },
  tab: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "3px",
    padding:        "0 2px",
    minWidth:       0,
    minHeight:      "56px",
    border:         "none",
    background:     "transparent",
    fontFamily:     "inherit",
    cursor:         "pointer",
  },
  // Flat throughout: each icon sits in a capsule, and the active one is just
  // a solid tint of its own hue — no lift, glow or gradient. Idle icons keep
  // their colour but step back.
  tabIcon: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    width:          "58px",
    height:         "40px",
    borderRadius:   "var(--r-pill)",
    transition:     "background 180ms ease-out, opacity 180ms ease-out",
  },
  tabIconIdle: {
    opacity: 0.85,
  },
  tabLabel: {
    fontSize:      "var(--fs-caption)",
    lineHeight:    "var(--lh-caption)",
    whiteSpace:    "nowrap",
    letterSpacing: "0.01em",
    transition:    "color 180ms ease-out",
  },
  tabDot: {
    width:        "14px",
    height:       "3px",
    borderRadius: "var(--r-pill)",
    transition:   "background 180ms ease-out",
  },
};
