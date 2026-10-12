// Full-colour icons for the bottom bar. Each is a small layered illustration —
// gradient body, a shaded face, warm highlights — in its tab's own hue family
// (TAB_ICON_COLORS in utils/colors.js). They are drawn on a 32-unit grid and
// stay legible down to 24 px.
//
// Gradient ids come from useId(): the same icon can be on screen twice, and
// SVG ids are document-global, so a fixed id would make the second copy paint
// with the first one's gradient — or with nothing once that copy unmounts.

import { useId } from "react";
import { TAB_ICON_COLORS as C } from "../utils/colors";

const { light, gold, goldDeep, window: lit } = C.shared;

function Svg({ size, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

function Grad({ id, from, to, x2 = 0, y2 = 1 }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  );
}

export function TabIconHome({ size = 30 }) {
  const id = useId();
  const c = C.home;
  return (
    <Svg size={size}>
      <defs>
        <Grad id={`${id}b`} from={c.from} to={c.to} />
        <Grad id={`${id}r`} from={c.to} to={c.deep} />
      </defs>
      {/* chimney, behind the roof */}
      <rect x="20.6" y="5.2" width="3.6" height="7" rx="1" fill={c.deep} />
      {/* walls */}
      <path d="M6.8 14.6 16 6.9l9.2 7.7V25a3 3 0 0 1-3 3H9.8a3 3 0 0 1-3-3Z" fill={`url(#${id}b)`} />
      {/* roof, with an eave overhang */}
      <path d="M2.9 14.9 16 3.8l13.1 11.1a1.5 1.5 0 0 1-1.94 2.29L16 7.8 4.84 17.2A1.5 1.5 0 0 1 2.9 14.9Z" fill={`url(#${id}r)`} />
      {/* lit windows */}
      <rect x="9.3" y="16.2" width="3.6" height="3.6" rx="0.9" fill={lit} />
      <rect x="19.1" y="16.2" width="3.6" height="3.6" rx="0.9" fill={lit} />
      {/* arched door and knob */}
      <path d="M13.4 28v-6.1a2.6 2.6 0 0 1 5.2 0V28Z" fill={c.door} />
      <circle cx="17.2" cy="24.6" r="0.6" fill={gold} />
      {/* light along the left wall */}
      <path d="M8.6 16.4V24.6" stroke={light} strokeOpacity="0.45" strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  );
}

export function TabIconFinance({ size = 30 }) {
  const id = useId();
  const c = C.finance;
  return (
    <Svg size={size}>
      <defs>
        <Grad id={`${id}w`} from={c.from} to={c.to} />
        <Grad id={`${id}c`} from={gold} to={goldDeep} x2={1} />
      </defs>
      {/* coin rising out of the wallet */}
      <circle cx="21.8" cy="8.6" r="5.2" fill={`url(#${id}c)`} />
      <circle cx="21.8" cy="8.6" r="3.3" stroke={light} strokeOpacity="0.55" strokeWidth="1" />
      <path d="M21.8 6.9v3.4" stroke={light} strokeOpacity="0.8" strokeWidth="1.2" strokeLinecap="round" />
      {/* wallet back flap */}
      <path d="M5 11.2a3 3 0 0 1 3-3h10.5v4.6H5Z" fill={c.deep} />
      {/* wallet body */}
      <rect x="3.2" y="11" width="24.6" height="17" rx="4.2" fill={`url(#${id}w)`} />
      {/* clasp */}
      <rect x="18.6" y="16" width="10.6" height="7.2" rx="3.6" fill={c.deep} />
      <circle cx="22.6" cy="19.6" r="1.7" fill={gold} />
      {/* stitching and top sheen */}
      <path d="M6.4 24.6h9" stroke={light} strokeOpacity="0.4" strokeWidth="1.1" strokeLinecap="round" strokeDasharray="1.6 1.6" />
      <path d="M6.6 13.8h9.6" stroke={light} strokeOpacity="0.5" strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  );
}

export function TabIconBooks({ size = 30 }) {
  const id = useId();
  const c = C.books;
  return (
    <Svg size={size}>
      <defs>
        <Grad id={`${id}k`} from={c.from} to={c.to} />
      </defs>
      {/* sparkle */}
      <path d="M16 1.6l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9Z" fill={gold} />
      {/* cover, opened flat */}
      <path d="M2.8 9.6a1.6 1.6 0 0 1 1.9-1.6L16 10.2 27.3 8a1.6 1.6 0 0 1 1.9 1.6v15.2a1.6 1.6 0 0 1-1.3 1.6L16 28.6 4.1 26.4a1.6 1.6 0 0 1-1.3-1.6Z" fill={`url(#${id}k)`} />
      {/* pages */}
      <path d="M5.4 9.9 15.1 11.8v14.4l-9.7-1.9Z" fill={c.page} />
      <path d="M26.6 9.9 16.9 11.8v14.4l9.7-1.9Z" fill={c.pageShade} />
      {/* spine */}
      <path d="M16 11.4v16" stroke={c.deep} strokeWidth="1.1" strokeLinecap="round" />
      {/* lines of text */}
      <g stroke={c.line} strokeWidth="1.1" strokeLinecap="round">
        <path d="M7.6 14.2l5.3 1" />
        <path d="M7.6 17.2l5.3 1" />
        <path d="M7.6 20.2l3.6.7" />
        <path d="M19.1 15.2l3.4-.7" />
        <path d="M19.1 18.2l5.3-1" />
        <path d="M19.1 21.2l5.3-1" />
      </g>
      {/* bookmark ribbon */}
      <path d="M22.3 10.9v6.6l1.5-1.3 1.5 1.3v-7.2Z" fill={c.ribbon} />
    </Svg>
  );
}

export function TabIconHQ({ size = 30 }) {
  const id = useId();
  const c = C.hq;
  return (
    <Svg size={size}>
      <defs>
        <Grad id={`${id}t`} from={c.from} to={c.to} />
        <Grad id={`${id}d`} from={c.dropFrom} to={c.dropTo} />
      </defs>
      {/* annex, behind the tower */}
      <rect x="17.6" y="15" width="10.4" height="13" rx="2" fill={c.annex} />
      <rect x="21" y="18.4" width="3.4" height="2.6" rx="0.7" fill={lit} fillOpacity="0.9" />
      <rect x="21" y="23" width="3.4" height="2.6" rx="0.7" fill={lit} fillOpacity="0.55" />
      {/* tower */}
      <rect x="4.6" y="8.6" width="15" height="19.4" rx="2.2" fill={`url(#${id}t)`} />
      <rect x="3.6" y="6.6" width="17" height="3.6" rx="1.6" fill={c.deep} />
      {/* windows — some lit */}
      <rect x="7.6" y="12.6" width="3.2" height="3" rx="0.7" fill={lit} />
      <rect x="13.4" y="12.6" width="3.2" height="3" rx="0.7" fill={lit} fillOpacity="0.5" />
      <rect x="7.6" y="17.6" width="3.2" height="3" rx="0.7" fill={lit} fillOpacity="0.5" />
      <rect x="13.4" y="17.6" width="3.2" height="3" rx="0.7" fill={lit} />
      {/* door */}
      <rect x="10.1" y="22.6" width="4" height="5.4" rx="1.1" fill={c.door} />
      {/* water drop badge — HQ tracks meters */}
      <path d="M25.2 2.6s-4.3 4.9-4.3 7.6a4.3 4.3 0 0 0 8.6 0c0-2.7-4.3-7.6-4.3-7.6Z" fill={`url(#${id}d)`} />
      <ellipse cx="23.7" cy="10.1" rx="0.9" ry="1.4" fill={light} fillOpacity="0.75" />
    </Svg>
  );
}
