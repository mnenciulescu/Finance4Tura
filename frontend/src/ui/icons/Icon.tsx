import type { ReactNode, SVGProps } from "react";

/**
 * The app's icon set (proposal §3.5): original glyphs drawn to read like iOS
 * symbols — 24-unit grid, rounded caps and joins, 1.75 stroke — in
 * currentColor only, so they follow theme and state. Tab icons have filled
 * variants for the selected state.
 */

type Glyph = { line: ReactNode; fill?: ReactNode };

const G: Record<string, Glyph> = {
  // ── Tabs ──────────────────────────────────────────────────────────────────
  today: {
    line: <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="3.5" />
      <path d="M3.5 9.5h17M8 3v3M16 3v3" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </>,
    fill: <>
      <path d="M7 4.5h10a3.5 3.5 0 0 1 3.5 3.5v1.5h-17V8A3.5 3.5 0 0 1 7 4.5Z" fill="currentColor" />
      <path d="M3.5 10.5h17V17a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17Z" fill="currentColor" fillOpacity="0.35" stroke="none" />
      <rect x="3.5" y="4.5" width="17" height="16" rx="3.5" />
      <path d="M8 3v3M16 3v3" />
      <circle cx="12" cy="15.5" r="1.8" fill="currentColor" stroke="none" />
    </>,
  },
  money: {
    line: <>
      <rect x="3" y="6.5" width="18" height="13" rx="3" />
      <path d="M6 6.5V5.8A2 2 0 0 1 8 3.8h8" />
      <path d="M21 11h-3.5a2.25 2.25 0 0 0 0 4.5H21" />
    </>,
    fill: <>
      <rect x="3" y="6.5" width="18" height="13" rx="3" fill="currentColor" stroke="none" />
      <path d="M6 6.5V5.8A2 2 0 0 1 8 3.8h8" />
      <path d="M21 11h-3.5a2.25 2.25 0 0 0 0 4.5H21" stroke="var(--bg-grouped)" />
      <circle cx="17.6" cy="13.25" r="1" fill="var(--bg-grouped)" stroke="none" />
    </>,
  },
  library: {
    line: <>
      <path d="M12 6.2C10 4.8 7 4.3 3.5 4.8v13.6c3.5-.5 6.5 0 8.5 1.4 2-1.4 5-1.9 8.5-1.4V4.8C17 4.3 14 4.8 12 6.2Z" />
      <path d="M12 6.2v13.6" />
    </>,
    fill: <>
      <path d="M12 6.2C10 4.8 7 4.3 3.5 4.8v13.6c3.5-.5 6.5 0 8.5 1.4 2-1.4 5-1.9 8.5-1.4V4.8C17 4.3 14 4.8 12 6.2Z" fill="currentColor" />
      <path d="M12 6.2v13.6" stroke="var(--bg-grouped)" />
    </>,
  },
  hq: {
    line: <>
      <path d="M4 20.5V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14.5" />
      <path d="M14 9.5h4a2 2 0 0 1 2 2v9" />
      <path d="M2.5 20.5h19" />
      <path d="M7.5 8h.01M10.5 8h.01M7.5 11.5h.01M10.5 11.5h.01M7.5 15h.01M10.5 15h.01" strokeWidth="2.4" />
    </>,
    fill: <>
      <path d="M4 20.5V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14.5Z" fill="currentColor" />
      <path d="M14 9.5h4a2 2 0 0 1 2 2v9h-6Z" fill="currentColor" fillOpacity="0.45" />
      <path d="M2.5 20.5h19" />
      <path d="M7.5 8h.01M10.5 8h.01M7.5 11.5h.01M10.5 11.5h.01M7.5 15h.01M10.5 15h.01" strokeWidth="2.4" stroke="var(--bg-grouped)" />
    </>,
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  plus:        { line: <path d="M12 5v14M5 12h14" /> },
  plusCircle:  { line: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8.5v7M8.5 12h7" /></> },
  ellipsis:    { line: <><circle cx="6" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18" cy="12" r="1.3" fill="currentColor" /></> },
  ellipsisCircle: { line: <><circle cx="12" cy="12" r="8.5" /><circle cx="8.2" cy="12" r="0.9" fill="currentColor" /><circle cx="12" cy="12" r="0.9" fill="currentColor" /><circle cx="15.8" cy="12" r="0.9" fill="currentColor" /></> },
  chevronRight: { line: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" /> },
  chevronLeft:  { line: <path d="M14.5 5.5 8 12l6.5 6.5" /> },
  chevronDown:  { line: <path d="m5.5 9.5 6.5 6.5 6.5-6.5" /> },
  chevronUp:    { line: <path d="m5.5 14.5 6.5-6.5 6.5 6.5" /> },
  chevronUpDown: { line: <path d="m8 9.5 4-4 4 4M8 14.5l4 4 4-4" /> },
  xmark:       { line: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /> },
  xmarkCircle: { line: <><circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none" /><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" stroke="var(--bg-elevated)" /></> },
  check:       { line: <path d="m5 12.5 4.5 4.5L19 7.5" /> },
  checkCircle: { line: <><circle cx="12" cy="12" r="8.5" /><path d="m8 12.3 2.8 2.8L16.3 9.5" /></> },
  trash:       { line: <><path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" /><path d="M6.5 6.5l.8 12.2A2 2 0 0 0 9.3 20.5h5.4a2 2 0 0 0 2-1.8l.8-12.2" /><path d="M10 10.5v6M14 10.5v6" /></> },
  pencil:      { line: <><path d="M15.5 4.5l4 4L9 19H5v-4Z" /><path d="M13.5 6.5l4 4" /></> },
  copy:        { line: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></> },
  refresh:     { line: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></> },
  undo:        { line: <><path d="M9 7.5 5 11.5l4 4" /><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" /></> },
  download:    { line: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" /></> },
  share:       { line: <><path d="M12 3.5v11M8 7.5l4-4 4 4" /><path d="M8 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" /></> },
  filter:      { line: <path d="M4.5 7h15M7.5 12h9M10.5 17h3" /> },
  search:      { line: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></> },
  signOut:     { line: <><path d="M14 4.5H7.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" /><path d="M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" /></> },

  // ── Objects ───────────────────────────────────────────────────────────────
  eye:         { line: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></> },
  eyeSlash:    { line: <><path d="M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.4 7.3A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4.4-1.1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M4 4l16 16" /></> },
  calendar:    { line: <><rect x="3.5" y="4.5" width="17" height="16" rx="3" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /></> },
  clock:       { line: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></> },
  gear:        { line: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" /><circle cx="12" cy="12" r="6.6" /></> },
  shield:      { line: <><path d="M12 3 5 5.8v5.6c0 4.4 3 8.1 7 9.6 4-1.5 7-5.2 7-9.6V5.8Z" /><path d="m9 12 2.2 2.2L15.5 10" /></> },
  terminal:    { line: <><rect x="3" y="4.5" width="18" height="15" rx="3" /><path d="m7 9.5 3 2.5-3 2.5M12.5 15h4.5" /></> },
  person:      { line: <><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></> },
  wallet:      { line: <><rect x="3" y="6.5" width="18" height="13" rx="3" /><path d="M21 11h-3.5a2.25 2.25 0 0 0 0 4.5H21" /></> },
  book:        { line: <><path d="M5.5 19V5.5a2 2 0 0 1 2-2h11v14h-11a2 2 0 0 0-2 2 2 2 0 0 0 2 2h11" /></> },
  building:    { line: <><path d="M4 20.5V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14.5M14 9.5h4a2 2 0 0 1 2 2v9M2.5 20.5h19" /></> },
  drop:        { line: <path d="M12 3.5S6 10 6 14a6 6 0 0 0 12 0c0-4-6-10.5-6-10.5Z" /> },
  star:        { line: <path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z" /> },
  starFill:    { line: <path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z" fill="currentColor" /> },
  chartBar:    { line: <><path d="M4.5 20.5h15" /><rect x="5.5" y="11" width="3" height="7" rx="1" /><rect x="10.5" y="6" width="3" height="12" rx="1" /><rect x="15.5" y="13.5" width="3" height="4.5" rx="1" /></> },
  chartLine:   { line: <><path d="M4.5 20.5h15" /><path d="m4.5 16 5-5 3.5 3.5 6.5-7" /><path d="M15.5 7.5h4v4" /></> },
  split:       { line: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17M12 12l6-6" /></> },
  arrowUp:     { line: <path d="M12 19.5v-15M6.5 10 12 4.5 17.5 10" /> },
  arrowDown:   { line: <path d="M12 4.5v15M6.5 14l5.5 5.5 5.5-5.5" /> },
  arrowUpRight: { line: <path d="M7 17 17 7M9 7h8v8" /> },
  info:        { line: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8h.01" strokeWidth="2.2" /></> },
  warning:     { line: <><path d="M10.3 4.6 3 17.5a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4.5M12 17.2h.01" strokeWidth="2.2" /></> },
  wifiSlash:   { line: <><path d="M2.5 8.8a14 14 0 0 1 4.3-2.6M10 5.4A14 14 0 0 1 21.5 8.8M5.5 12.3a9 9 0 0 1 3.4-2M14.6 10.6a9 9 0 0 1 3.9 1.7M9 15.8a4.5 4.5 0 0 1 6 0" /><path d="M12 19.5h.01" strokeWidth="2.6" /><path d="M4 4l16 16" /></> },
  message:     { line: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5Z" /> },
  key:         { line: <><circle cx="8" cy="15.5" r="4" /><path d="m10.8 12.7 8.7-8.7M16.5 7l2.5 2.5M14 9.5l2 2" /></> },
  sparkle:     { line: <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M18 6l-2.6 2.6M8.6 15.4 6 18" /> },
  hand:        { line: <><path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14" /><path d="M8 13V11a1.5 1.5 0 0 0-3 0v3.5a7 7 0 0 0 7 7h.5a5.5 5.5 0 0 0 5.5-5.5V14" /></> },
  phone:       { line: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></> },
  database:    { line: <><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" /></> },
  globe:       { line: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5Z" /></> },
  location:    { line: <><path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></> },
  list:        { line: <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" /> },
  reorder:     { line: <path d="M5 9h14M5 15h14" /> },
};

export type IconName = keyof typeof G | "today" | "money" | "library" | "hq";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  /** Stroke weight: regular 1.75, semibold 2.2. */
  weight?: "regular" | "semibold";
  /** Use the filled variant where one exists (selected tab). */
  filled?: boolean;
  title?: string;
}

export function Icon({ name, size = 24, weight = "regular", filled = false, title, ...rest }: IconProps) {
  const glyph = G[name];
  if (!glyph) return null;
  const body = filled && glyph.fill ? glyph.fill : glyph.line;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight === "semibold" ? 2.2 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
}

