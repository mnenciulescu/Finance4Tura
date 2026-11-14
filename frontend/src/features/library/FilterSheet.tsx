import { Button, List, Picker, Sheet } from "../../ui";
import { SOURCES, TYPES, type Filters } from "./libraryMath";
import f from "../money/forms/Forms.module.css";
import s from "./Library.module.css";

const ANY = "__any__";
const opts = (values: string[]) => [{ value: ANY, label: "Any" }, ...values.map(v => ({ value: v, label: v }))];

/** Person, type, source and rating filters. Search lives in the screen's search field. */
export function FilterSheet({
  isOpen, onClose, filters, names, onChange,
}: { isOpen: boolean; onClose: () => void; filters: Filters; names: string[]; onChange: (f: Filters) => void }) {
  const set = (k: keyof Filters, v: string) => onChange({ ...filters, [k]: v === ANY ? "" : v });
  const val = (v: string) => v || ANY;
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Filters" surface="grouped">
      <div className={f.groups}>
        <List aria-label="Filters">
          <Picker label="Person" value={val(filters.name)} options={opts(names)} onChange={v => set("name", v)} />
          <Picker label="Type" value={val(filters.type)} options={opts(TYPES)} onChange={v => set("type", v)} />
          <Picker label="Source" value={val(filters.source)} options={opts(SOURCES)} onChange={v => set("source", v)} />
          <Picker
            label="Rating"
            value={val(filters.rating)}
            options={[{ value: ANY, label: "Any" }, ...[5, 4, 3, 2, 1].map(n => ({ value: String(n), label: "★".repeat(n) }))]}
            onChange={v => set("rating", v)}
          />
        </List>
        <div className={s.sheetActions}>
          <Button variant="gray" size="large" block onClick={() => onChange({ ...filters, name: "", type: "", source: "", rating: "" })}>
            Clear All
          </Button>
          <Button variant="filled" size="large" block onClick={onClose}>Done</Button>
        </div>
      </div>
    </Sheet>
  );
}
