import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ── Icons ────────────────────────────────────────────────────────────────────

function IconDashboard() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
      <rect x="1"   y="1"   width="5.5" height="5.5" rx="1.5"/>
      <rect x="8.5" y="1"   width="5.5" height="5.5" rx="1.5"/>
      <rect x="1"   y="8.5" width="5.5" height="5.5" rx="1.5"/>
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5"/>
    </svg>
  );
}

function IconIncome() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,11 5,6.5 8.5,9.5 14,3.5"/>
      <polyline points="10.5,3.5 14,3.5 14,7"/>
    </svg>
  );
}

function IconExpense() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,4 5,8.5 8.5,5.5 14,11.5"/>
      <polyline points="10.5,11.5 14,11.5 14,8"/>
    </svg>
  );
}

function IconStats() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
      <rect x="1"  y="9"  width="3" height="5" rx="1"/>
      <rect x="6"  y="5"  width="3" height="9" rx="1"/>
      <rect x="11" y="2"  width="3" height="12" rx="1"/>
    </svg>
  );
}

function IconBackstage() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="7.5" cy="7.5" r="2"/>
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.2 3.2l1.1 1.1M10.7 10.7l1.1 1.1M3.2 11.8l1.1-1.1M10.7 4.3l1.1-1.1"/>
    </svg>
  );
}

// ── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c74ff"/>
          <stop offset="100%" stopColor="#4a43c8"/>
        </linearGradient>
        <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#6c63ff" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* Outer ring */}
      <circle cx="17" cy="17" r="16" fill="url(#logoGrad)"/>
      <circle cx="17" cy="17" r="16" fill="url(#glowGrad)"/>
      {/* Bar chart */}
      <rect x="7.5"  y="21" width="4" height="7"  rx="1.5" fill="white" opacity="0.95"/>
      <rect x="15"   y="16" width="4" height="12" rx="1.5" fill="white" opacity="0.95"/>
      <rect x="22.5" y="11" width="4" height="17" rx="1.5" fill="white" opacity="0.95"/>
      {/* Trend line + dots */}
      <polyline
        points="9.5,21 17,16 24.5,11"
        stroke="#86efac" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="9.5"  cy="21" r="2" fill="#86efac"/>
      <circle cx="17"   cy="16" r="2" fill="#86efac"/>
      <circle cx="24.5" cy="11" r="2" fill="#86efac"/>
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

const links = [
  { to: "/",            label: "Dashboard",   end: true, Icon: IconDashboard },
  { to: "/add-income",  label: "Add Income",             Icon: IconIncome    },
  { to: "/add-expense", label: "Add Expense",            Icon: IconExpense   },
  { to: "/statistics",  label: "Statistics",             Icon: IconStats     },
  { to: "/backstage",   label: "Backstage",              Icon: IconBackstage },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Topbar() {
  const { user, signOut } = useAuth();
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <header style={s.bar}>
      {/* Brand */}
      <div style={s.brand}>
        <Logo />
        <div style={s.brandText}>
          <span style={s.brandName}>Finance</span>
          <span style={s.brandAccent}>4Tura</span>
        </div>
      </div>

      {/* Divider */}
      <div style={s.divider}/>

      {/* Navigation */}
      <nav style={s.nav}>
        {links.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              ...s.link,
              ...(isActive ? s.linkActive : {}),
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{ ...s.iconWrap, color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
                  <Icon/>
                </span>
                <span>{label}</span>
                {isActive && <span style={s.activeDot}/>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User area */}
      <div style={s.userArea}>
        <div style={s.avatar}>{initials}</div>
        <span style={s.username}>{user?.username}</span>
        <button style={s.signOutBtn} onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  bar: {
    position:       "sticky",
    top:            0,
    zIndex:         100,
    display:        "flex",
    alignItems:     "center",
    gap:            "12px",
    padding:        "0 24px",
    height:         "60px",
    background:     "rgba(26,29,39,0.97)",
    borderBottom:   "1px solid var(--border)",
    backdropFilter: "blur(12px)",
    boxShadow:      "0 1px 0 0 rgba(108,99,255,0.12), 0 4px 24px rgba(0,0,0,0.3)",
  },
  brand: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    flexShrink: 0,
    marginRight:"4px",
  },
  brandText: {
    display:       "flex",
    flexDirection: "column",
    lineHeight:    1.15,
  },
  brandName: {
    fontSize:   "11px",
    fontWeight: 400,
    color:      "var(--text-muted)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  brandAccent: {
    fontSize:      "15px",
    fontWeight:    700,
    color:         "var(--accent)",
    letterSpacing: "0.02em",
  },
  divider: {
    width:      "1px",
    height:     "24px",
    background: "var(--border)",
    flexShrink: 0,
    marginRight:"4px",
  },
  nav: {
    display:    "flex",
    alignItems: "center",
    gap:        "2px",
    flex:       1,
  },
  link: {
    display:        "flex",
    alignItems:     "center",
    gap:            "7px",
    position:       "relative",
    padding:        "7px 14px",
    borderRadius:   "9px",
    fontSize:       "13px",
    fontWeight:     500,
    color:          "var(--text-muted)",
    textDecoration: "none",
    transition:     "background 0.15s, color 0.15s",
    whiteSpace:     "nowrap",
  },
  linkActive: {
    background: "rgba(108,99,255,0.14)",
    color:      "var(--text)",
  },
  iconWrap: {
    display:    "flex",
    alignItems: "center",
    flexShrink: 0,
    transition: "color 0.15s",
  },
  activeDot: {
    position:     "absolute",
    bottom:       "3px",
    left:         "50%",
    transform:    "translateX(-50%)",
    width:        "16px",
    height:       "2px",
    borderRadius: "2px",
    background:   "var(--accent)",
    opacity:      0.7,
  },
  userArea: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    marginLeft: "auto",
    flexShrink: 0,
  },
  avatar: {
    width:           "28px",
    height:          "28px",
    borderRadius:    "50%",
    background:      "rgba(108,99,255,0.25)",
    border:          "1px solid rgba(108,99,255,0.4)",
    color:           "var(--accent)",
    fontSize:        "10px",
    fontWeight:      700,
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    letterSpacing:   "0.04em",
    flexShrink:      0,
  },
  username: {
    fontSize:  "12px",
    color:     "var(--text-muted)",
    maxWidth:  "120px",
    overflow:  "hidden",
    textOverflow: "ellipsis",
    whiteSpace:"nowrap",
  },
  signOutBtn: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "7px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    padding:      "4px 12px",
    cursor:       "pointer",
    transition:   "border-color 0.15s, color 0.15s",
    whiteSpace:   "nowrap",
  },
};
