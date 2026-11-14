import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../ui/icons/Icon";
import { haptic } from "./haptics";
import { TABS } from "./navigation";
import { currentTab, selectTab } from "./tabHistory";
import s from "./TabBar.module.css";

/** iOS tab bar: translucent material, edge to edge, label under icon. */
export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = currentTab(location);

  return (
    <nav className={s.bar} aria-label="Main">
      <div className={s.inner}>
        {TABS.map(tab => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              className={[s.tab, selected ? s.selected : ""].join(" ")}
              aria-current={selected ? "page" : undefined}
              onClick={() => { haptic("light"); selectTab(tab.id, location, navigate); }}
            >
              <Icon name={tab.icon} size={26} filled={selected} />
              <span className={s.label}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
