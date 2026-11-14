import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Screen } from "../../app/Screen";
import { MONEY_SEGMENTS, type MoneySegment } from "../../app/navigation";
import { SegmentedTabs, PullDownMenu, type MenuEntry } from "../../ui";
import { useYear } from "../../context/YearContext";

/**
 * The Money tab (proposal §5.2): a large title with a segmented control —
 * Budget · Split · Stats · Invest — replacing the old hidden ⋮ menu. Segment
 * switches replace the history entry: they are views of one screen.
 */
export function MoneyScreen({
  segment, actions, subtitle, onRefresh, children,
}: {
  segment: MoneySegment["id"];
  actions?: ReactNode;
  subtitle?: ReactNode;
  onRefresh?: () => Promise<unknown> | void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Screen
      title="Money"
      subtitle={subtitle}
      actions={actions}
      onRefresh={onRefresh}
      accessory={
        <SegmentedTabs
          label="Money sections"
          value={segment}
          options={MONEY_SEGMENTS.map(s => ({ value: s.id, label: s.label }))}
          onChange={id => navigate(MONEY_SEGMENTS.find(s => s.id === id)!.path, { replace: true })}
        />
      }
    >
      {children}
    </Screen>
  );
}

/**
 * Year pull-down (shared YearContext with Stats). Lists the years that have
 * data, capped at the current year.
 */
export function YearMenu({ years }: { years: number[] }) {
  const { selectedYear, setSelectedYear } = useYear();
  const thisYear = new Date().getFullYear();
  const items: MenuEntry[] = [...years]
    .filter(y => y <= thisYear)
    .sort((a, b) => b - a)
    .map(y => ({ id: String(y), label: String(y), selected: y === selectedYear, onAction: () => setSelectedYear(y) }));
  return <PullDownMenu label={`Year: ${selectedYear}`} text={selectedYear} items={items} appearance="text" />;
}
