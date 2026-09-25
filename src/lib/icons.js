const svgWrap = (paths, size = 18, extra = '') => 
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="width:${size}px; height:${size}px; display:inline-block; vertical-align:middle; flex-shrink:0;" aria-hidden="true" ${extra}>${paths}</svg>`;

const line = (paths, size = 18) => 
  svgWrap(paths, size, 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"');

export const ico = {
  search: line('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/>', 18),
  wa: svgWrap('<path fill="currentColor" d="M12.04 2c-5.46 0-9.9 4.43-9.9 9.9 0 1.74.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9C22 6.44 17.5 2 12.04 2zm5.76 14.16c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.83-.12-.42-.13-.97-.32-1.67-.62-2.94-1.27-4.86-4.23-5-4.42-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.3.6-.37.8-.37h.57c.18 0 .43-.07.67.51.24.6.82 2.07.9 2.22.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.03 1.12 1 2.07 1.32 2.36 1.47.3.15.47.13.64-.08.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.72.81 2.01.96.3.15.5.22.57.34.08.13.08.74-.16 1.42z"/>', 20),
  back: line('<path d="M15 5l-7 7 7 7"/>', 18),
  plus: line('<path d="M12 5v14M5 12h14"/>', 16),
  minus: line('<path d="M5 12h14"/>', 16),
  bag: line('<path d="M6 7h12l-1.1 13H7.1L6 7z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/>', 18),
  photo: line('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5.5-5.5L7 19"/>', 18),
  eye: line('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 18),
  info: line('<circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/>', 14),
  store: line('<path d="M4 10v10h16V10M3 10l2-7h14l2 7M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0M9 20v-6h6v6"/>', 16),
  orders: line('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>', 18),
  qr: line('<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM21 14v4h-3v3M13 21h2M21 21h.01"/>', 18),
  external: line('<path d="M14 3h7v7M21 3l-11 11M9 3H3v18h18v-6"/>', 16),
  logout: line('<path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h13"/>', 16),
  chevron: line('<path d="m6 9 6 6 6-6"/>', 14),
  close: line('<path d="m6 6 12 12M18 6 6 18"/>', 16),
  food: line('<path d="M4 11a8 8 0 0 1 16 0H4z"/><path d="M3 15h18"/><path d="M5 19h14a2 2 0 0 0 2-2H3a2 2 0 0 0 2 2z"/>', 28),
  drink: line('<path d="M6 3h12v5a6 6 0 0 1-12 0V3ZM12 14v7M8 21h8"/>', 18),
  burger: line('<path d="M4 11a8 8 0 0 1 16 0H4z"/><path d="M3 15h18"/><path d="M5 19h14a2 2 0 0 0 2-2H3a2 2 0 0 0 2 2z"/>', 20),
  delivery: line('<circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><circle cx="12" cy="4" r="2"/><path d="m10 8-2 4 5 2v4M10 8l4 3h3M5 18l4-5h6l-3 5H5M16 8h2l1 10"/><rect x="1" y="8" width="5" height="4" rx="1"/>', 16),
  clock: line('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 14),
  mapPin: line('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', 14),
  table: line('<path d="M4 18v3M20 18v3M4 11h16M3 7h18v4H3z"/>', 14),
  tag: line('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1" fill="currentColor"/>', 13),
  utensils: line('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>', 15),
  check: line('<polyline points="20 6 9 17 4 12"/>', 16),
  checkCircle: line('<circle cx="12" cy="12" r="10"/><polyline points="16 9 10.5 15 8 12.5"/>', 18),
  trash: line('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 15),
  motorcycle: line('<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-3l-3 6.5h7l2-3.5h-4M5.5 17.5l3-7.5M18.5 17.5l-3.5-5"/>', 16)
};
