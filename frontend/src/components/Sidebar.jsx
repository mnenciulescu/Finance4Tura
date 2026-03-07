import { NavLink } from "react-router-dom";

const links = [
  { to: "/",            label: "Dashboard",   end: true },
  { to: "/add-income",  label: "Add Income"              },
  { to: "/add-expense", label: "Add Expense"             },
  { to: "/statistics",  label: "Statistics"              },
  { to: "/backstage",   label: "Backstage"               },
];

export default function Topbar() {
  return (
    <header style={s.bar}>
      <span style={s.brand}>Finance4Tura</span>
      <nav style={s.nav}>
        {links.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActive : {}) })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

const s = {
  bar: {
    position:       "sticky",
    top:            0,
    zIndex:         100,
    display:        "flex",
    alignItems:     "center",
    gap:            "32px",
    padding:        "0 32px",
    height:         "56px",
    background:     "var(--surface)",
    borderBottom:   "1px solid var(--border)",
  },
  brand: {
    fontSize:      "15px",
    fontWeight:    700,
    color:         "var(--accent)",
    letterSpacing: "0.02em",
    whiteSpace:    "nowrap",
  },
  nav: {
    display: "flex",
    gap:     "4px",
  },
  link: {
    padding:        "6px 14px",
    borderRadius:   "8px",
    fontSize:       "14px",
    fontWeight:     500,
    color:          "var(--text-muted)",
    textDecoration: "none",
    transition:     "background 0.15s, color 0.15s",
  },
  linkActive: {
    background: "var(--surface-2)",
    color:      "var(--text)",
  },
};
