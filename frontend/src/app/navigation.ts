// Single source for the tab bar, the Money segments and the account sheet.

import type { IconName } from "../ui/icons/Icon";

export const ADMIN_USER = "nenciulescu";

export type TabId = "today" | "money" | "library" | "hq";

export interface TabDef {
  id: TabId;
  label: string;
  icon: IconName;
  root: string;
  /** Whether a pathname belongs to this tab's own screens. */
  owns: (pathname: string) => boolean;
}

export const TABS: TabDef[] = [
  { id: "today",   label: "Today",   icon: "today",   root: "/",        owns: p => p === "/" },
  { id: "money",   label: "Money",   icon: "money",   root: "/money",   owns: p => p === "/money" || p.startsWith("/money/") },
  { id: "library", label: "Library", icon: "library", root: "/library", owns: p => p === "/library" || p.startsWith("/library/") },
  { id: "hq",      label: "HQ",      icon: "hq",      root: "/hq",      owns: p => p === "/hq" || p.startsWith("/hq/") },
];

/** Screens pushed from the account sheet onto whichever tab opened them. */
export const ACCOUNT_SCREENS = ["/settings", "/backstage", "/admin"];

export function tabForPath(pathname: string, ownerTab?: TabId | null): TabId {
  const own = TABS.find(t => t.owns(pathname));
  if (own) return own.id;
  return ownerTab ?? "today";
}

export interface MoneySegment {
  id: "budget" | "split" | "stats" | "invest";
  label: string;
  path: string;
}

export const MONEY_SEGMENTS: MoneySegment[] = [
  { id: "budget", label: "Budget", path: "/money" },
  { id: "split",  label: "Split",  path: "/money/split" },
  { id: "stats",  label: "Stats",  path: "/money/stats" },
  { id: "invest", label: "Invest", path: "/money/invest" },
];

export interface AccountItem {
  to: string;
  label: string;
  icon: IconName;
  requires?: "backstage" | "admin";
}

export const ACCOUNT_ITEMS: AccountItem[] = [
  { to: "/settings",  label: "Settings",  icon: "gear" },
  { to: "/backstage", label: "Backstage", icon: "terminal", requires: "backstage" },
  { to: "/admin",     label: "Admin",     icon: "shield",   requires: "admin" },
];

/** Drops items the current user or app settings don't allow. */
export function visibleItems<T extends { requires?: string }>(
  items: T[],
  { backstageEnabled, username }: { backstageEnabled?: boolean; username?: string | null },
): T[] {
  return items.filter(item => {
    if (item.requires === "backstage") return !!backstageEnabled;
    if (item.requires === "admin") return username === ADMIN_USER;
    return true;
  });
}
