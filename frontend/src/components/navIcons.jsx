// Line icons for the Dashboard's Finance menu and the account menu. The bottom
// bar has its own full-colour set in TabIcons.jsx.

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function svg(size) {
  return { width: size, height: size, viewBox: "0 0 15 15" };
}

export function IconDashboard({ size = 24 }) {
  return (
    <svg {...svg(size)} fill="currentColor">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" />
    </svg>
  );
}

export function IconIncome({ size = 24 }) {
  return (
    <svg {...svg(size)} {...stroke}>
      <polyline points="1,11 5,6.5 8.5,9.5 14,3.5" />
      <polyline points="10.5,3.5 14,3.5 14,7" />
    </svg>
  );
}

export function IconExpense({ size = 24 }) {
  return (
    <svg {...svg(size)} {...stroke}>
      <polyline points="1,4 5,8.5 8.5,5.5 14,11.5" />
      <polyline points="10.5,11.5 14,11.5 14,8" />
    </svg>
  );
}

export function IconSplit({ size = 24 }) {
  return (
    <svg {...svg(size)} {...stroke}>
      <line x1="1" y1="7.5" x2="5" y2="7.5" />
      <polyline points="5,4.5 8.5,7.5 5,10.5" />
      <line x1="8.5" y1="4" x2="14" y2="4" />
      <line x1="8.5" y1="11" x2="14" y2="11" />
    </svg>
  );
}

export function IconStats({ size = 24 }) {
  return (
    <svg {...svg(size)} fill="currentColor">
      <rect x="1" y="9" width="3" height="5" rx="1" />
      <rect x="6" y="5" width="3" height="9" rx="1" />
      <rect x="11" y="2" width="3" height="12" rx="1" />
    </svg>
  );
}

export function IconInvestments({ size = 24 }) {
  return (
    <svg {...svg(size)} {...stroke}>
      <polyline points="1,12 4,8.5 7,10 11,5 14,3" />
      <polyline points="11,3 14,3 14,6" />
      <line x1="1" y1="14" x2="14" y2="14" />
    </svg>
  );
}

export function IconBooks({ size = 24 }) {
  return (
    <svg {...svg(size)} {...stroke}>
      <rect x="2" y="1" width="8" height="11" rx="1" />
      <line x1="5" y1="4" x2="7" y2="4" />
      <line x1="5" y1="6.5" x2="7" y2="6.5" />
      <path d="M10 3 L13 3.5 L11 13 L8 12.5" />
    </svg>
  );
}

export function IconSettings({ size = 24 }) {
  return (
    <svg {...svg(size)} {...stroke}>
      <line x1="1" y1="4.5" x2="14" y2="4.5" />
      <line x1="1" y1="10.5" x2="14" y2="10.5" />
      <circle cx="5" cy="4.5" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10.5" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBackstage({ size = 24 }) {
  return (
    <svg {...svg(size)} {...stroke}>
      <circle cx="7.5" cy="7.5" r="2" />
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.2 3.2l1.1 1.1M10.7 10.7l1.1 1.1M3.2 11.8l1.1-1.1M10.7 4.3l1.1-1.1" />
    </svg>
  );
}

export function IconAdmin({ size = 24 }) {
  return (
    <svg {...svg(size)} {...stroke}>
      <circle cx="7.5" cy="5" r="2.5" />
      <path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M10 8.5l1.5 1 1-1.5" />
    </svg>
  );
}


