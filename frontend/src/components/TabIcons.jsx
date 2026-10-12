// Flat, two-tone icons for the bottom bar. Every shape is a single solid fill
// — no gradients, shading, highlights or shadows — in its tab's own hue
// (TAB_ICON_COLORS in utils/colors.js), with a shared gold accent. Drawn on a
// 32-unit grid with simple geometry so they stay crisp down to 24 px.

import { TAB_ICON_COLORS as C } from "../utils/colors";

const { gold, goldDeep, window: lit } = C.shared;

function Svg({ size, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export function TabIconHome({ size = 30 }) {
  const c = C.home;
  return (
    <Svg size={size}>
      {/* chimney */}
      <rect x="20.5" y="5" width="4" height="7" rx="1" fill={c.deep} />
      {/* walls */}
      <path d="M6.5 14.5 16 6.6l9.5 7.9V25.5a2.5 2.5 0 0 1-2.5 2.5H9a2.5 2.5 0 0 1-2.5-2.5Z" fill={c.main} />
      {/* roof */}
      <path d="M2.6 15.1 16 3.6l13.4 11.5a1.6 1.6 0 0 1-2.08 2.43L16 7.8 4.68 17.53A1.6 1.6 0 0 1 2.6 15.1Z" fill={c.deep} />
      {/* windows */}
      <rect x="9.2" y="16.2" width="3.8" height="3.8" rx="1" fill={lit} />
      <rect x="19" y="16.2" width="3.8" height="3.8" rx="1" fill={lit} />
      {/* door and knob */}
      <path d="M13.3 28v-6a2.7 2.7 0 0 1 5.4 0v6Z" fill={c.door} />
      <circle cx="17.3" cy="24.7" r="0.7" fill={gold} />
    </Svg>
  );
}

export function TabIconFinance({ size = 30 }) {
  const c = C.finance;
  return (
    <Svg size={size}>
      {/* coin */}
      <circle cx="21.8" cy="8.4" r="5.2" fill={gold} />
      <circle cx="21.8" cy="8.4" r="3.2" fill={goldDeep} />
      <rect x="21.1" y="6.4" width="1.4" height="4" rx="0.7" fill={gold} />
      {/* back flap */}
      <path d="M5 11.5a3.3 3.3 0 0 1 3.3-3.3h10.2v4.9H5Z" fill={c.deep} />
      {/* wallet */}
      <rect x="3.2" y="11" width="24.6" height="17" rx="4.2" fill={c.main} />
      {/* clasp */}
      <rect x="18.6" y="16" width="10.6" height="7.2" rx="3.6" fill={c.deep} />
      <circle cx="22.6" cy="19.6" r="1.7" fill={gold} />
      {/* card slot */}
      <rect x="6.4" y="14" width="8.6" height="1.6" rx="0.8" fill={c.deep} />
    </Svg>
  );
}

export function TabIconBooks({ size = 30 }) {
  const c = C.books;
  return (
    <Svg size={size}>
      {/* sparkle */}
      <path d="M16 1.4l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1Z" fill={gold} />
      {/* cover, opened flat */}
      <path d="M2.8 9.6a1.6 1.6 0 0 1 1.9-1.6L16 10.2 27.3 8a1.6 1.6 0 0 1 1.9 1.6v15.2a1.6 1.6 0 0 1-1.3 1.6L16 28.6 4.1 26.4a1.6 1.6 0 0 1-1.3-1.6Z" fill={c.main} />
      {/* pages */}
      <path d="M5.4 9.9 15.1 11.8v14.4l-9.7-1.9Z" fill={c.page} />
      <path d="M26.6 9.9 16.9 11.8v14.4l9.7-1.9Z" fill={c.pageShade} />
      {/* spine */}
      <rect x="15.4" y="11.4" width="1.2" height="16" rx="0.6" fill={c.deep} />
      {/* lines of text */}
      <g stroke={c.line} strokeWidth="1.2" strokeLinecap="round">
        <path d="M7.6 14.2l5.3 1" />
        <path d="M7.6 17.2l5.3 1" />
        <path d="M7.6 20.2l3.6.7" />
        <path d="M19.1 18.2l5.3-1" />
        <path d="M19.1 21.2l5.3-1" />
      </g>
      {/* bookmark ribbon */}
      <path d="M22 10.9v6.8l1.6-1.4 1.6 1.4v-7.4Z" fill={c.ribbon} />
    </Svg>
  );
}

export function TabIconHQ({ size = 30 }) {
  const c = C.hq;
  return (
    <Svg size={size}>
      {/* annex */}
      <rect x="17.6" y="15" width="10.4" height="13" rx="2" fill={c.annex} />
      <rect x="21" y="18.4" width="3.4" height="2.6" rx="0.7" fill={c.main} />
      <rect x="21" y="23" width="3.4" height="2.6" rx="0.7" fill={c.main} />
      {/* tower */}
      <rect x="4.6" y="8.6" width="15" height="19.4" rx="2.2" fill={c.main} />
      <rect x="3.6" y="6.6" width="17" height="3.6" rx="1.6" fill={c.deep} />
      {/* windows */}
      <rect x="7.6" y="12.6" width="3.2" height="3" rx="0.7" fill={lit} />
      <rect x="13.4" y="12.6" width="3.2" height="3" rx="0.7" fill={c.deep} />
      <rect x="7.6" y="17.6" width="3.2" height="3" rx="0.7" fill={c.deep} />
      <rect x="13.4" y="17.6" width="3.2" height="3" rx="0.7" fill={lit} />
      {/* door */}
      <rect x="10.1" y="22.6" width="4" height="5.4" rx="1.1" fill={c.door} />
      {/* water drop — HQ tracks meters */}
      <path d="M25.2 2.6s-4.3 4.9-4.3 7.6a4.3 4.3 0 0 0 8.6 0c0-2.7-4.3-7.6-4.3-7.6Z" fill={c.drop} />
    </Svg>
  );
}
