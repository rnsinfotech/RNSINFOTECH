import React from "react";

/**
 * Icon — a small, dependency-free icon set drawn as line SVGs.
 * Kept intentionally plain (stroke-based, currentColor) so it reads
 * as technical/schematic rather than decorative.
 *
 * Usage: <Icon name="chip" size={20} />
 */
const PATHS = {
  shield: (
    <path d="M12 2.5l7 3v5.2c0 5-3 8.4-7 10.3-4-1.9-7-5.3-7-10.3V5.5l7-3z" />
  ),
  truck: (
    <>
      <rect x="1.5" y="6" width="13" height="9" rx="1" />
      <path d="M14.5 9.5H18l3.5 3.5V15h-7z" />
      <circle cx="6" cy="17.5" r="1.6" />
      <circle cx="17.5" cy="17.5" r="1.6" />
    </>
  ),
  headset: (
    <path d="M4 13v-1a8 8 0 0116 0v1M4 13v4a2 2 0 002 2h1v-6H5a1 1 0 00-1 1zm16 0v4a2 2 0 01-2 2h-1v-6h1a1 1 0 011 1z" />
  ),
  layers: (
    <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />
  ),
  network: (
    <path d="M12 3v4M12 17v4M4 12h4M16 12h4M6.5 6.5l2.8 2.8M17.5 6.5l-2.8 2.8M6.5 17.5l2.8-2.8M17.5 17.5l-2.8-2.8M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0" />
  ),
  camera: (
    <>
      <rect x="2.5" y="7" width="15" height="10" rx="1.5" />
      <circle cx="10" cy="12" r="3" />
      <path d="M17.5 10l4-2v8l-4-2z" />
    </>
  ),
  printer: (
    <>
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="8" rx="1.2" />
      <path d="M6 15h12v6H6z" />
    </>
  ),
  disc: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  desk: (
    <path d="M3 8h18M3 8v10M21 8v10M7 16h4M7 8V5h10v3" />
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
  display: (
    <>
      <rect x="2.5" y="4" width="19" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
      <path d="M9 9l3 3 3-5" />
    </>
  ),
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  quote: <path d="M7 8c-2.2 0-4 1.8-4 4v5h5v-5H6c0-1 .8-2 2-2V8zm10 0c-2.2 0-4 1.8-4 4v5h5v-5h-2c0-1 .8-2 2-2V8z" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12l5 5L19 8" />,
  star: <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.7L12 2.5z" />,
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3h2.4l2.1 12.1a2 2 0 002 1.65h8.8a2 2 0 002-1.65L20.5 7H6" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  refresh: (
    <path d="M20 11A8 8 0 105.5 16.5M20 11V5M20 11h-6M4 13a8 8 0 0014.5 5.5M4 13v6M4 13h6" />
  ),
  package: (
    <>
      <path d="M12 2.5l9 5v9l-9 5-9-5v-9l9-5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9.5" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.4" />
    </>
  ),
  creditCard: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="1.8" />
      <path d="M2.5 10h19" />
    </>
  ),
  download: (
    <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 18.5h16" />
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c1.3-4 4-6 7.5-6s6.2 2 7.5 6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
    </>
  ),
  edit: (
    <path d="M14.5 4.5l5 5L8 21H3v-5L14.5 4.5z" />
  ),
  trash: (
    <path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 6.5l9 6.5 9-6.5" />
    </>
  ),
  phone: (
    <path d="M6.5 3.5h3L11 8l-2 1.5a13 13 0 006.5 6.5L17 14l4.5 1.5v3a2 2 0 01-2.2 2A18 18 0 014.5 5.7a2 2 0 012-2.2z" />
  ),
  message: (
    <path d="M3 4.5h18v12H8.5L4 20.5V16.5H3v-12z" />
  ),
  send: (
    <path d="M21 3L10.5 13.5M21 3l-6.5 18-4-8-8-4L21 3z" />
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.7-4.7" />
    </>
  ),
  alert: (
    <>
      <path d="M12 2.5l10.5 18.5H1.5L12 2.5z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  bell: (
    <>
      <path d="M18 16v-5a6 6 0 00-12 0v5l-2 3h16l-2-3z" />
      <path d="M10 19a2 2 0 004 0" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  filter: (
    <path d="M3 5h18M6 12h12M10 19h4" />
  ),
  sliders: (
    <path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1M9 4v4M17 10v4M13 16v4" />
  ),
  grid: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>
  ),
  list: (
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  ),
  whatsapp: (
    <path d="M12 2.5A9.5 9.5 0 003.6 17L2.5 21.5l4.6-1.2A9.5 9.5 0 1012 2.5zm5.4 13.6c-.2.6-1.3 1.2-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.6.8 2 .9 2.1.1.2.1.4 0 .6-.1.2-.2.3-.4.5-.2.2-.4.4-.5.6-.2.2-.4.4-.2.7.2.3 1 1.6 2.1 2.6 1.4 1.3 2.6 1.7 2.9 1.9.3.2.5.1.7-.1.2-.2.8-1 1-1.3.2-.3.4-.3.7-.2.3.1 1.9.9 2.2 1.1.3.1.5.2.6.3.1.2.1.9-.2 1.5z" />
  ),
  compare: (
    <>
      <path d="M8 3v18M16 3v18" />
      <path d="M4 8h4M16 8h4M4 16h4M16 16h4" />
    </>
  ),
  image: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <circle cx="8.5" cy="10" r="1.8" />
      <path d="M3 17.5l5.5-5.5 3.5 3.5 3-3 6 6" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4L10 14" />
      <path d="M18 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 6.5V12l4 2.2" />
    </>
  ),
  tag: (
    <>
      <path d="M11.5 3H4v7.5L13.5 20 21 12.5 11.5 3z" />
      <circle cx="8" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  // Matches admin-portal's Icon "gear" glyph — needed here so a category
  // saved with icon: "gear" actually renders instead of silently
  // showing nothing (this component returns null for unknown names).
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.7 6.3l-1.7 1.7M8 16l-1.7 1.7M17.7 17.7L16 16M8 8L6.3 6.3" />
    </>
  ),
  fileText: (
    <>
      <path d="M6 2.5h9l5 5V21a1 1 0 01-1 1H6a1 1 0 01-1-1V3.5a1 1 0 011-1z" />
      <path d="M14.5 2.5V8h5.5M8 12.5h8M8 16h8M8 9h3" />
    </>
  ),
  chip: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M9 3.5V7M12 3.5V7M15 3.5V7M9 17v3.5M12 17v3.5M15 17v3.5M3.5 9H7M3.5 12H7M3.5 15H7M17 9h3.5M17 12h3.5M17 15h3.5" />
    </>
  ),
  instagram: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: (
    <path d="M15 3.5h-2.4A4.1 4.1 0 008.5 7.6v2.4H6V14h2.5v6.5H12V14h2.5l.5-3.9H12V7.9c0-.8.4-1.4 1.6-1.4H15V3.5z" />
  ),
  twitter: (
    <path d="M21 4.5c-.7.4-1.6.7-2.4.9a3.7 3.7 0 00-6.4 3.4A10.6 10.6 0 014 4.9a3.7 3.7 0 001.1 5 3.6 3.6 0 01-1.7-.5v.1a3.7 3.7 0 003 3.7 3.6 3.6 0 01-1.7.1 3.7 3.7 0 003.5 2.6A7.5 7.5 0 013 17.4a10.5 10.5 0 005.7 1.7c6.8 0 10.6-5.8 10.6-10.8v-.5c.7-.5 1.4-1.2 1.9-2z" />
  ),
  linkedin: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" />
      <circle cx="7.2" cy="8" r="1.4" fill="currentColor" stroke="none" />
      <path d="M7.2 11v7M12 18v-4.2c0-1.6 1-2.6 2.3-2.6 1.2 0 2 .8 2 2.5V18" />
    </>
  ),
  youtube: (
    <>
      <rect x="2" y="5.5" width="20" height="13" rx="3.5" />
      <path d="M10.5 9.3l5 2.7-5 2.7z" fill="currentColor" stroke="none" />
    </>
  ),
  google: (
    <path d="M21 12.2c0-.7-.06-1.4-.18-2.05H12v3.9h5.05a4.35 4.35 0 01-1.87 2.85v2.3h3a9 9 0 002.82-6.9zM12 21c2.43 0 4.47-.8 5.96-2.16l-3-2.3c-.83.56-1.9.9-2.96.9-2.27 0-4.2-1.53-4.9-3.6h-3.1v2.36A9 9 0 0012 21zM7.1 13.84a5.4 5.4 0 010-3.68V7.8H4a9 9 0 000 8.4l3.1-2.36zM12 6.5c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 004 7.8l3.1 2.36c.7-2.07 2.63-3.66 4.9-3.66z" />
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
