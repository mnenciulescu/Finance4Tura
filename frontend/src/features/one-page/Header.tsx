import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { IconButton, PullDownMenu, SegmentedControl, type MenuEntry } from "../../ui";
import { useAuth } from "../../context/AuthContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useTheme } from "../../theme/ThemeProvider";
import { availableYears, useIncomes } from "../../data/queries";
import { ACCOUNT_ITEMS, visibleItems } from "../../app/navigation";
import { formatRemaining, useSessionRemaining } from "../../app/AccountSheet";
import { YearMenu } from "../money/MoneyScreen";
import s from "./OnePage.module.css";

/**
 * One-Page header (§5.1): year, refresh, Light / Dark and the account menu.
 * Adding entries and the income-amount eye live in their blocks.
 */
export function Header({ onShortcuts }: { onShortcuts: () => void }) {
  const qc = useQueryClient();
  const fetching = useIsFetching() > 0;
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { settings } = useAppSettings();
  const { theme, setting, setSetting } = useTheme();
  const incomes = useIncomes();
  const remaining = useSessionRemaining();

  const account: MenuEntry[] = [
    { id: "who", label: `${user?.username ?? ""}${remaining != null ? ` · ${formatRemaining(remaining)}` : ""}`, icon: "person", disabled: true, onAction: () => {} },
    { id: "sep1", separator: true },
    ...visibleItems(ACCOUNT_ITEMS, { backstageEnabled: settings.backstageEnabled, username: user?.username })
      .filter(item => item.requires !== "desktop")
      .map(item => ({ id: item.to, label: item.label, icon: item.icon, navigates: true, onAction: () => navigate(item.to, { replace: true }) })),
    { id: "keys", label: "Keyboard Shortcuts", icon: "key", onAction: onShortcuts },
    ...(setting !== "auto" ? [{ id: "auto", label: "Use System Appearance", icon: "sparkle" as const, onAction: () => setSetting("auto") }] : []),
    { id: "mobile", label: "Open Mobile Layout", icon: "phone", navigates: true, onAction: () => navigate("/", { replace: true }) },
    { id: "sep2", separator: true },
    { id: "out", label: "Sign Out", icon: "signOut", destructive: true, onAction: signOut },
  ];

  return (
    <header className={s.header}>
      <div className={s.brand}>
        <span className={s.brandMark} aria-hidden="true">4</span>
        <span className={s.brandText}>4TURA Home</span>
        <span className={s.brandSub}>One-Page</span>
      </div>
      <YearMenu years={availableYears(incomes.data)} />
      <span className={s.flex} />
      <IconButton
        icon="refresh"
        label="Refresh"
        title="Refresh (R)"
        className={fetching ? s.spinning : undefined}
        onClick={() => qc.invalidateQueries()}
      />
      <SegmentedControl
        label="Appearance"
        value={theme}
        onChange={v => setSetting(v)}
        options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
        className={s.themeSwitch}
      />
      <PullDownMenu label="Account" icon="person" appearance="circle" items={account} />
    </header>
  );
}
