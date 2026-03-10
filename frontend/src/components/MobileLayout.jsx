import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

function IconDashboard() {
  return <svg width="22" height="22" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="5.5" height="5.5" rx="1.5"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5"/></svg>;
}
function IconExpense() {
  return <svg width="22" height="22" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,4 5,8.5 8.5,5.5 14,11.5"/><polyline points="10.5,11.5 14,11.5 14,8"/></svg>;
}
function IconIncome() {
  return <svg width="22" height="22" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,11 5,6.5 8.5,9.5 14,3.5"/><polyline points="10.5,3.5 14,3.5 14,7"/></svg>;
}
function IconStats() {
  return <svg width="22" height="22" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="9" width="3" height="5" rx="1"/><rect x="6" y="5" width="3" height="9" rx="1"/><rect x="11" y="2" width="3" height="12" rx="1"/></svg>;
}
function IconSettings() {
  return <svg width="22" height="22" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><line x1="1" y1="4.5" x2="14" y2="4.5"/><line x1="1" y1="10.5" x2="14" y2="10.5"/><circle cx="5" cy="4.5" r="1.8" fill="currentColor" stroke="none"/><circle cx="10" cy="10.5" r="1.8" fill="currentColor" stroke="none"/></svg>;
}

const tabs = [
  { to: "/",            label: "Home",    end: true, Icon: IconDashboard },
  { to: "/add-expense", label: "Expense", Icon: IconExpense },
  { to: "/add-income",  label: "Income",  Icon: IconIncome  },
  { to: "/statistics",  label: "Stats",   Icon: IconStats   },
  { to: "/settings",    label: "Settings",Icon: IconSettings},
];

export default function MobileLayout({ children }) {
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div style={s.shell}>
      {/* Top bar */}
      <header style={s.topBar}>
        <div style={s.brand}>
          <svg width="26" height="26" viewBox="0 0 34 34" fill="none">
            <circle cx="17" cy="17" r="16" fill="#16a34a"/>
            <rect x="7.5"  y="21" width="4" height="7"  rx="1.5" fill="white" opacity="0.95"/>
            <rect x="15"   y="16" width="4" height="12" rx="1.5" fill="white" opacity="0.95"/>
            <rect x="22.5" y="11" width="4" height="17" rx="1.5" fill="white" opacity="0.95"/>
            <polyline points="9.5,21 17,16 24.5,11" stroke="#86efac" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="9.5"  cy="21" r="2" fill="#86efac"/>
            <circle cx="17"   cy="16" r="2" fill="#86efac"/>
            <circle cx="24.5" cy="11" r="2" fill="#86efac"/>
          </svg>
          <span style={s.brandText}>Finance<span style={s.brandAccent}>4TURA</span></span>
        </div>
        <button style={s.avatar} onClick={() => setShowUserMenu(v => !v)}>
          {initials}
        </button>
        {showUserMenu && (
          <div style={s.userMenu}>
            <span style={s.userMenuName}>{user?.username}</span>
            <button style={s.signOutBtn} onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>

      {/* Page content */}
      <main style={s.main}>{children}</main>

      {/* Bottom tab bar */}
      <nav style={s.tabBar}>
        {tabs.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({ ...s.tab, color: isActive ? "var(--accent)" : "var(--text-muted)" })}
          >
            <Icon />
            <span style={s.tabLabel}>{label}</span>
          </NavLink>
        ))}
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
  topBar: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "0 16px",
    height:         "52px",
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
    position:     "absolute",
    top:          "56px",
    right:        "12px",
    background:   "var(--surface)",
    border:       "1px solid var(--border)",
    borderRadius: "10px",
    padding:      "12px 16px",
    display:      "flex",
    flexDirection:"column",
    gap:          "10px",
    boxShadow:    "0 4px 20px rgba(0,0,0,0.2)",
    zIndex:       200,
    minWidth:     "140px",
  },
  userMenuName: {
    fontSize:   "12px",
    color:      "var(--text-muted)",
    fontWeight: 500,
  },
  signOutBtn: {
    background:   "transparent",
    border:       "1px solid var(--border)",
    borderRadius: "7px",
    color:        "var(--text-muted)",
    fontSize:     "12px",
    padding:      "6px 12px",
    cursor:       "pointer",
    textAlign:    "left",
  },
  main: {
    flex:          1,
    overflow:      "hidden",
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
  },
  tab: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "3px",
    padding:        "8px 0",
    textDecoration: "none",
    transition:     "color 0.15s",
  },
  tabLabel: {
    fontSize:   "9px",
    fontWeight: 500,
  },
};
