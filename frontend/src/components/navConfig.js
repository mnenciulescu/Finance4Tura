// Single source for the bottom bar, the Dashboard's Finance menu and the
// account menu.
//
// Every tab navigates straight to `to`, passing `state()` when it has one.
// `match` decides whether the tab renders active for a given pathname.
//
// The Finance pages are not listed under the tab: they live in the ⋮ menu on
// the Dashboard header, listed by `financeItems`. Settings, Backstage and Admin
// live in the account menu behind the avatar, listed by `accountItems`.

import {
  IconHome, IconFinance, IconEvolve, IconHQ,
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
    to: "/finance",
    // Opens the Dashboard on the current income column, even when it is
    // already showing another one.
    state: () => ({ resetDashboard: Date.now() }),
    match: p => financeRoutes.some(r => p === r || p.startsWith(`${r}/`)),
  },
  {
    id: "books",
    label: "Books",
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
];

export const financeItems = [
  { to: "/finance",        label: "Dashboard",   Icon: IconDashboard, state: () => ({ resetDashboard: Date.now() }) },
  { to: "/add-income",     label: "Add Income",  Icon: IconIncome      },
  { to: "/add-expense",    label: "Add Expense", Icon: IconExpense     },
  { to: "/split-payments", label: "Split Pay",   Icon: IconSplit       },
  { to: "/statistics",     label: "Statistics",  Icon: IconStats       },
  { to: "/investments",    label: "Investments", Icon: IconInvestments },
];

export const accountItems = [
  { to: "/settings",  label: "Settings",  Icon: IconSettings  },
  { to: "/backstage", label: "Backstage", Icon: IconBackstage, requires: "backstage" },
  { to: "/admin",     label: "Admin",     Icon: IconAdmin,     requires: "admin"     },
];

// Drops items the current user or app settings don't allow.
export function visibleItems(items = [], { backstageEnabled, username }) {
  return items.filter(item => {
    if (item.requires === "backstage") return backstageEnabled;
    if (item.requires === "admin")     return username === ADMIN_USER;
    return true;
  });
}
