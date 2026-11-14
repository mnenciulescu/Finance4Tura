import { Button as AriaButton, Input, SearchField as AriaSearchField } from "react-aria-components";
import { Icon } from "./icons/Icon";
import s from "./Controls.module.css";

/* ── SearchField ──────────────────────────────────────────────────────────── */

export function SearchField({
  label = "Search", value, onChange, placeholder = "Search",
}: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <AriaSearchField aria-label={label} value={value} onChange={onChange} className={s.search}>
      <Icon name="search" size={18} className={s.searchIcon} />
      <Input className={s.searchInput} placeholder={placeholder} enterKeyHint="search" />
      {value && (
        <AriaButton className={s.searchClear} aria-label="Clear search">
          <Icon name="xmarkCircle" size={18} />
        </AriaButton>
      )}
    </AriaSearchField>
  );
}
