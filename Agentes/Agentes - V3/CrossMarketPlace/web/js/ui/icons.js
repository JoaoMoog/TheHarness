// Line icons (24px grid, stroke 1.75) matching the Figma "Ícone/*" components.
const PATHS = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.8c1.9.7 3.1 2.5 3.5 5.2"/>',
  swap: '<path d="M4 8h15"/><path d="M15 4l4 4-4 4"/><path d="M20 16H5"/><path d="M9 12l-4 4 4 4"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.4 2.6 2.6 5-5.5"/>',
  chart: '<path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-6"/><path d="M21 20H3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9"/><path d="M10.2 20.5a2 2 0 0 0 3.6 0"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  sparkle: '<path d="M11 4l1.8 5.2L18 11l-5.2 1.8L11 18l-1.8-5.2L4 11l5.2-1.8z"/><path d="M19 3v4"/><path d="M17 5h4"/>',
  code: '<path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/><path d="m14 4-4 16"/>',
  network: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.5 6h7"/><path d="M7.2 8.3l3.6 7.4"/><path d="M16.8 8.3l-3.6 7.4"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3"/><path d="M12 18.5v3"/><path d="M2.5 12h3"/><path d="M18.5 12h3"/><path d="m5.3 5.3 2.1 2.1"/><path d="m16.6 16.6 2.1 2.1"/><path d="m5.3 18.7 2.1-2.1"/><path d="m16.6 7.4 2.1-2.1"/>',
  layout: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9h17"/><path d="M9.5 20.5V9"/>',
  book: '<path d="M4.5 18.5V5A1.5 1.5 0 0 1 6 3.5h13.5v14H6a1.5 1.5 0 0 0-1.5 1.5A1.5 1.5 0 0 0 6 20.5h13.5"/><path d="M8.5 7.5h7"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.6-1.8"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  trend: '<path d="m3.5 16.5 6-6 4 4 7-7"/><path d="M15 7.5h5.5V13"/>',
  list: '<path d="M8.5 6.5h12"/><path d="M8.5 12h12"/><path d="M8.5 17.5h12"/><path d="M4 6.5h.01"/><path d="M4 12h.01"/><path d="M4 17.5h.01"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12"/><circle cx="12" cy="12" r="2.8"/>',
  inbox: '<path d="M3.5 13.5 6 5h12l2.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z"/><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5"/>',
  upload: '<path d="M12 15V4"/><path d="m7 8 5-5 5 5"/><path d="M4 15v4a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-4"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  file: '<path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5"/>',
  archive: '<rect x="3.5" y="4" width="17" height="4.5" rx="1"/><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5"/><path d="M10 12.5h4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
};

/** Inline SVG icon. Decorative by default; pass a label for meaningful icons. */
export function icon(name, { size = 20, label = "" } = {}) {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg ${a11y} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] ?? ""}</svg>`;
}
