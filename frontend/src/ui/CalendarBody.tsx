import {
  Button as AriaButton, Calendar, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader,
  CalendarHeaderCell, Heading, I18nProvider,
} from "react-aria-components";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { Icon } from "./icons/Icon";
import { haptic } from "../app/haptics";
import s from "./DatePicker.module.css";

const safeParse = (v: string | null | undefined): CalendarDate | null => {
  if (!v) return null;
  try { return parseDate(v); } catch { return null; }
};

/** React Aria calendar, Monday first (en-GB), opening on the slot's month. */
export default function CalendarBody({
  label, value, onPick, minValue, maxValue,
}: { label: string; value: string; onPick: (iso: string) => void; minValue?: string; maxValue?: string }) {
  const selected = safeParse(value);
  return (
    <I18nProvider locale="en-GB">
      <Calendar
        aria-label={label}
        value={selected}
        defaultFocusedValue={selected ?? undefined}
        onChange={d => { haptic("light"); onPick(d.toString()); }}
        firstDayOfWeek="mon"
        minValue={safeParse(minValue) ?? undefined}
        maxValue={safeParse(maxValue) ?? undefined}
        className={s.calendar}
      >
        <header className={s.head}>
          <Heading className={s.month} />
          <div className={s.steps}>
            <AriaButton slot="previous" className={s.step} aria-label="Previous month">
              <Icon name="chevronLeft" size={22} weight="semibold" />
            </AriaButton>
            <AriaButton slot="next" className={s.step} aria-label="Next month">
              <Icon name="chevronRight" size={22} weight="semibold" />
            </AriaButton>
          </div>
        </header>
        <CalendarGrid className={s.grid} weekdayStyle="short">
          <CalendarGridHeader>
            {day => <CalendarHeaderCell className={s.weekday}>{day}</CalendarHeaderCell>}
          </CalendarGridHeader>
          <CalendarGridBody>
            {date => <CalendarCell date={date} className={s.day} />}
          </CalendarGridBody>
        </CalendarGrid>
      </Calendar>
    </I18nProvider>
  );
}
