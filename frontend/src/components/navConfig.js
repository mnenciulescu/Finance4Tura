// Single source for the bottom bar and its sheets. Groups mirror the grouping
// the desktop top bar used, so the two stayed conceptually the same when the
// desktop layout was removed.
//
// A group either navigates straight to `to`, or opens a sheet listing `items`.
// `match` decides whether the group's tab renders active for a given pathname.

import {
  IconHome, IconFinance, IconEvolve, IconHQ, IconSystem,
  IconDashboard, IconIncome, IconExpense, IconSplit, IconStats,
  IconInvestments, IconSettings, IconBackstage, IconAdmin,
} from "./navIcons";

export const ADMIN_USER = "nenciulescu";

const financeRoutes = [
  "/finance", "/add-income", "/add-expense",
  "/split-payments", "/statistics", "/investments",
];

export const navGroups = [
  {
    id: "home",
    label: "Home",
    Icon: IconHome,
    to: "/",
    match: p => p === "/",
  },
  {
    id: "finance",
    label: "Finance",
    Icon: IconFinance,
    items: [
      // Resets the Dashboard to the current income column, as the desktop
      // Finance dropdown did.
      { to: "/finance", label: "Dashboard", Icon: IconDashboard, state: () => ({ resetDashboard: Date.now() }) },
      { to: "/add-income",     label: "Add Income",  Icon: IconIncome      },
      { to: "/add-expense",    label: "Add Expense", Icon: IconExpense     },
      { to: "/split-payments", label: "Split Pay",   Icon: IconSplit       },
      { to: "/statistics",     label: "Statistics",  Icon: IconStats       },
      { to: "/investments",    label: "Investments", Icon: IconInvestments },
    ],
    match: p => financeRoutes.some(r => p === r || p.startsWith(`${r}/`)),
  },
  {
    id: "evolve",
    label: "Evolve",
    Icon: IconEvolve,
    to: "/books-and-dev",
    match: p => p.startsWith("/books-and-dev"),
  },
  {
    id: "hq",
    label: "HQ",
    Icon: IconHQ,
    to: "/headquarters",
    match: p => p.startsWith("/headquarters"),
  },
  {
    id: "system",
    label: "System",
    Icon: IconSystem,
    items: [
      { to: "/settings",  label: "Settings",  Icon: IconSettings  },
      { to: "/backstage", label: "Backstage", Icon: IconBackstage, requires: "backstage" },
      { to: "/admin",     label: "Admin",     Icon: IconAdmin,     requires: "admin"     },
    ],
    match: p => ["/settings", "/backstage", "/admin"].some(r => p.startsWith(r)),
  },
];

// Drops sheet items the current user or app settings don't allow.
export function visibleItems(group, { backstageEnabled, username }) {
  if (!group.items) return [];
  return group.items.filter(item => {
    if (item.requires === "backstage") return backstageEnabled;
    if (item.requires === "admin")     return username === ADMIN_USER;
    return true;
  });
}
