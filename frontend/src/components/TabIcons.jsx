// Duotone icons for the bottom bar, in the same language as the rest of the
// app: a rounded line drawing in currentColor — so it takes the theme's muted
// text colour when idle and its accent when active — over a soft fill in one
// Dusk anchor per tab (TAB_ICON_COLORS), with a small tan detail. Solid fills
// only; drawn on a 24-unit grid with a 1.7 stroke.

import { TAB_ICON_COLORS as C } from "../utils/colors";

const TINT = 0.5;   // opacity of the colour fill under the outline

function Svg({ size, children }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function TabIconHome({ size = 26 }) {
  return (
    <Svg size={size}>
      <path d="M5.5 10.2 12 4.6l6.5 5.6v8.8a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5Z" fill={C.home} fillOpacity={TINT} stroke="none" />
      <rect x="14.2" y="11.6" width="2.4" height="2.4" rx="0.6" fill={C.detail} stroke="none" />
      <path d="M3 11.2 12 3.5l9 7.7" />
      <path d="M5.5 9.6V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.6" />
      <path d="M10 20.5v-4.3a2 2 0 0 1 4 0v4.3" />
    </Svg>
  );
}

export function TabIconFinance({ size = 26 }) {
  return (
    <Svg size={size}>
      <rect x="3" y="7.5" width="18" height="12.5" rx="3" fill={C.finance} fillOpacity={TINT} stroke="none" />
      <path d="M6 7.5V6a2 2 0 0 1 2-2h7.5" />
      <rect x="3" y="7.5" width="18" height="12.5" rx="3" />
      <path d="M21 11.3h-3.6a2.45 2.45 0 0 0 0 4.9H21" />
      <circle cx="17.6" cy="13.75" r="1.1" fill={C.detail} stroke="none" />
    </Svg>
  );
}

export function TabIconBooks({ size = 26 }) {
  return (
    <Svg size={size}>
      <path d="M12 6.6C10 5.1 7 4.6 3.5 5.1v13.1c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5.1C17 4.6 14 5.1 12 6.6Z" fill={C.books} fillOpacity={TINT} stroke="none" />
      <path d="M15.6 5.2v5l1.4-1.1 1.4 1.1V5" fill={C.detail} stroke="none" />
      <path d="M12 6.6C10 5.1 7 4.6 3.5 5.1v13.1c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5.1C17 4.6 14 5.1 12 6.6Z" />
      <path d="M12 6.6v13.1" />
    </Svg>
  );
}

export function TabIconHQ({ size = 26 }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="10" height="16.5" rx="1.5" fill={C.hq} fillOpacity={TINT} stroke="none" />
      <path d="M17 12.4s-1.8 2-1.8 3.2a1.8 1.8 0 0 0 3.6 0c0-1.2-1.8-3.2-1.8-3.2Z" fill={C.detail} stroke="none" />
      <path d="M14 20.5V5.5A1.5 1.5 0 0 0 12.5 4h-7A1.5 1.5 0 0 0 4 5.5v15" />
      <path d="M14 9h4.5A1.5 1.5 0 0 1 20 10.5v10" />
      <path d="M2.5 20.5h19" />
      <path d="M7.3 8h.01M10.7 8h.01M7.3 11.5h.01M10.7 11.5h.01" strokeWidth="2.2" />
      <path d="M7.8 20.5v-3.2h2.4v3.2" />
    </Svg>
  );
}
