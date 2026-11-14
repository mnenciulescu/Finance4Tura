import { useLocation } from "react-router-dom";
import { TABS, type TabId } from "./navigation";

/** Back target for screens pushed from the account sheet: the tab that opened them. */
export function useAccountBack() {
  const location = useLocation();
  const owner = (location.state as { ownerTab?: TabId } | null)?.ownerTab ?? "today";
  const tab = TABS.find(t => t.id === owner) ?? TABS[0];
  return { label: tab.label, to: tab.root };
}
