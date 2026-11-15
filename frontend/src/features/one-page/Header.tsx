import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { IconButton, PullDownMenu, SegmentedControl, type MenuEntry } from "../../ui";
import { useAuth } from "../../context/AuthContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { usePrivacy } from "../../context/PrivacyContext";
import { useTheme } from "../../theme/ThemeProvider";
import { availableYears, useIncomes } from "../../data/queries";
import { ACCOUNT_ITEMS, visibleItems } from "../../app/navigation";
import { formatRemaining, useSessionRemaining } from "../../app/AccountSheet";
import { YearMenu } from "../money/MoneyScreen";
import { useForms } from "../money/forms/FormsContext";
import { useOnePage } from "./state";
import s from "./OnePage.module.css";

/**
 * One-Page header (§5.1): year, refresh, income privacy, + New, Light / Dark,
 * and the account menu.
 */
export function Header({ onShortcuts }: { onShortcuts: () => void }) {
  const qc = useQueryClient();
  const fetching = useIsFetching() > 0;
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { settings } = useAppSettings();
  const { incomeVisible, setIncomeVisible } = usePrivacy();
  const { theme, setting, setSetting } = useTheme();
  const { openExpense, openIncome } = useForms();
  const { openSplit, openBook, openSnapshot, openOperation } = useOnePage();
  const incomes = useIncomes();
  const remaining = useSessionRemaining();

  const account: MenuEntry[] = [
    { id: "who", label: `${user?.username ?? ""}${remaining != null ? ` · ${formatRemaining(remaining)}` : ""}`, icon: "person", disabled: true, onAction: () => {} },
    { id: "sep1", separator: true },
    ...visibleItems(ACCOUNT_ITEMS, { backstageEnabled: settings.backstageEnabled, username: user?.username })
      .filter(item => item.requires !== "desktop")
      .map(item => ({ id: item.to, label: item.label, icon: item.icon, onAction: () => navigate(item.to) })),
    { id: "keys", label: "Keyboard Shortcuts", icon: "key", onAction: onShortcuts },
    ...(setting !== "auto" ? [{ id: "auto", label: "Use System Appearance", icon: "sparkle" as const, onAction: () => setSetting("auto") }] : []),
    { id: "mobile", label: "Open Mobile Layout", icon: "phone", onAction: () => navigate("/") },
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
      <IconButton
        icon={incomeVisible ? "eye" : "eyeSlash"}
        label={incomeVisible ? "Hide income amounts" : "Show income amounts"}
        title="Income amounts (H)"
        onClick={() => setIncomeVisible(!incomeVisible)}
      />
      <PullDownMenu
        label="New"
        icon="plus"
        appearance="circle"
        items={[
          { id: "expense", label: "New Expense", icon: "wallet", onAction: () => openExpense({}) },
          { id: "income", label: "New Income", icon: "arrowDown", onAction: () => openIncome({}) },
          { id: "sep", separator: true },
          { id: "split", label: "New Split Payment", icon: "split", onAction: () => openSplit({}) },
          { id: "snap", label: "New Snapshot", icon: "chartLine", onAction: () => openSnapshot({}) },
          { id: "op", label: "New Operation", icon: "arrowUpRight", onAction: () => openOperation({}) },
          { id: "book", label: "New Library Entry", icon: "book", onAction: () => openBook({}) },
        ]}
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
