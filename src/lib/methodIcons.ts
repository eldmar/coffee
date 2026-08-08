/**
 * Line icons for the five brew methods, as the inner markup of a 48×48 SVG.
 *
 * Shared so the homepage chooser, the comparison table and the method cards all
 * draw the same shapes at the same stroke width.
 */
export const methodIcons: Record<string, string> = {
  espresso: `<rect x="4" y="6" width="40" height="10" rx="2"/><rect x="8" y="16" width="32" height="14" rx="1"/><path d="M18 30h12v4a6 6 0 0 1-12 0v-4Z"/><path d="M21 16v-4m6 4v-4"/><circle cx="14" cy="23" r="2.5"/><circle cx="34" cy="23" r="2.5"/><path d="M4 42h40"/>`,
  aeropress: `<rect x="16" y="4" width="16" height="6" rx="1"/><rect x="14" y="10" width="20" height="22" rx="1"/><path d="M14 16h20m-20 6h20"/><path d="M12 32h24v4H12z"/><path d="M18 36v6h12v-6"/>`,
  v60: `<path d="M8 8h32l-10 18h-12L8 8Z"/><path d="M18 26v4h12v-4"/><path d="M12 34h24v8H12z"/><path d="M12 38h24"/>`,
  'french-press': `<rect x="12" y="10" width="24" height="30" rx="2"/><path d="M24 10V4m-6 0h12"/><path d="M12 24h24"/><path d="M36 16h6v10h-6"/><path d="M17 30h14m-14 5h14"/>`,
  'moka-pot': `<path d="M16 4h16l-3 12H19L16 4Z"/><path d="M19 16l-4 8h18l-4-8"/><path d="M15 24l3 18h12l3-18"/><path d="M32 8l8 5-5 6"/>`,
};
