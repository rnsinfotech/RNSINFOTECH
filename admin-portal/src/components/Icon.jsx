import React from "react";

/**
 * Icon — same dependency-free, stroke-based line-icon approach as the
 * storefront's src/components/Icon.jsx, so the two products share a visual
 * language. Includes every path the admin nav/pages need, copied from the
 * storefront set plus a handful of admin-only additions (home, layout,
 * percent, inbox, warehouse, gear) that the storefront had no use for.
 *
 * Usage: <Icon name="grid" size={18} />
 */
const PATHS = {
  home: <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z" />,
  display: (
    <>
      <rect x="2.5" y="4" width="19" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
      <path d="M9 9l3 3 3-5" />
    </>
  ),
  tablet: (
    <>
      <rect x="2" y="4" width="20" height="14" rx="1.5" />
      <circle cx="17" cy="11" r="1.4" />
      <path d="M5 20l3-4 2.5 2.5L14 14l3 4" />
    </>
  ),
  pen: (
    <>
      <path d="M14 4l6 6-10.5 10.5H3V14L14 4z" />
      <path d="M12 6l6 6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>
  ),
  package: (
    <>
      <path d="M12 2.5l9 5v9l-9 5-9-5v-9l9-5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9.5" />
    </>
  ),
  tag: (
    <>
      <path d="M11.5 3H4v7.5L13.5 20 21 12.5 11.5 3z" />
      <circle cx="8" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  layers: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  warehouse: (
    <>
      <path d="M3 10.5L12 4l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1v-9.5z" />
      <path d="M9 21v-7h6v7" />
    </>
  ),
  truck: (
    <>
      <rect x="1.5" y="6" width="13" height="9" rx="1" />
      <path d="M14.5 9.5H18l3.5 3.5V15h-7z" />
      <circle cx="6" cy="17.5" r="1.6" />
      <circle cx="17.5" cy="17.5" r="1.6" />
    </>
  ),
  creditCard: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="1.8" />
      <path d="M2.5 10h19" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c1.3-4 4-6 7.5-6s6.2 2 7.5 6" />
    </>
  ),
  message: <path d="M3 4.5h18v12H8.5L4 20.5V16.5H3v-12z" />,
  send: <path d="M21 3L10.5 13.5M21 3l-6.5 18-4-8-8-4L21 3z" />,
  shield: <path d="M12 2.5l7 3v5.2c0 5-3 8.4-7 10.3-4-1.9-7-5.3-7-10.3V5.5l7-3z" />,
  headset: <path d="M4 13v-1a8 8 0 0116 0v1M4 13v4a2 2 0 002 2h1v-6H5a1 1 0 00-1 1zm16 0v4a2 2 0 01-2 2h-1v-6h1a1 1 0 011 1z" />,
  disc: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  chip: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M9 3.5V7M12 3.5V7M15 3.5V7M9 17v3.5M12 17v3.5M15 17v3.5M3.5 9H7M3.5 12H7M3.5 15H7M17 9h3.5M17 12h3.5M17 15h3.5" />
    </>
  ),
  layout: (
    <>
      <rect x="2.5" y="3.5" width="19" height="17" rx="1.8" />
      <path d="M2.5 8.5h19M8.5 8.5V21" />
    </>
  ),
  star: <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.7L12 2.5z" />,
  percent: (
    <>
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
      <path d="M18.5 5.5l-13 13" />
    </>
  ),
  fileText: (
    <>
      <path d="M6 2.5h9l5 5V21a1 1 0 01-1 1H6a1 1 0 01-1-1V3.5a1 1 0 011-1z" />
      <path d="M14.5 2.5V8h5.5M8 12.5h8M8 16h8M8 9h3" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.7 6.3l-1.7 1.7M8 16l-1.7 1.7M17.7 17.7L16 16M8 8L6.3 6.3" />
    </>
  ),
  sliders: <path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1M9 4v4M17 10v4M13 16v4" />,
  bell: (
    <>
      <path d="M18 16v-5a6 6 0 00-12 0v5l-2 3h16l-2-3z" />
      <path d="M10 19a2 2 0 004 0" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.7-4.7" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12l5 5L19 8" />,
  edit: <path d="M14.5 4.5l5 5L8 21H3v-5L14.5 4.5z" />,
  trash: <path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  filter: <path d="M3 5h18M6 12h12M10 19h4" />,
  refresh: <path d="M20 11A8 8 0 105.5 16.5M20 11V5M20 11h-6M4 13a8 8 0 0014.5 5.5M4 13v6M4 13h6" />,
  alert: (
    <>
      <path d="M12 2.5l10.5 18.5H1.5L12 2.5z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 6.5V12l4 2.2" />
    </>
  ),
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  inbox: (
    <>
      <path d="M3 12.5h5l1.8 3h4.4l1.8-3h5" />
      <path d="M5.5 5.5h13l2.5 7v7a1 1 0 01-1 1h-16a1 1 0 01-1-1v-7l2.5-7z" />
    </>
  ),
  image: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <circle cx="8.5" cy="10" r="1.8" />
      <path d="M3 17.5l5.5-5.5 3.5 3.5 3-3 6 6" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  mapPin: (
    <>
      <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
    </>
  ),
};

export default function Icon({ name, size = 20, strokeWidth = 1.5, className = "", style }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
