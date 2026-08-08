// type-glyph — THE single SVG line-icon set for the whole app (calendar pills · list · drawer header ·
// filters). No native emoji (renders identically on every OS). One canonical glyph per task type +
// the calendar's own markers. YDNI: the glyph SHAPE distinguishes meaning; colour = the stroke passed
// in (reserve strong colour for status). viewBox 0 0 24 24, stroke=currentColor, strokeWidth 2.
import type { ReactNode, CSSProperties } from 'react';

export type GlyphName =
  // calendar / status markers
  | 'pin' | 'link' | 'sprout' | 'mail' | 'check' | 'clock' | 'calendar' | 'alert' | 'dot' | 'brief'
  // task-type icons (see lib/task-type TYPE_META)
  | 'send' | 'rocket' | 'user' | 'scope' | 'badgecheck'
  | 'docpen' | 'film' | 'image' | 'chat' | 'mic' | 'layers' | 'filedoc' | 'window' | 'grid' | 'cap' | 'book';

export const GLYPH: Record<GlyphName, ReactNode> = {
  // ── calendar / status ──
  pin: <><path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" /><circle cx="12" cy="11" r="2.4" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></>,
  sprout: <><path d="M12 20v-7" /><path d="M12 13C12 9 9 7 5 7c0 4 3 6 7 6z" /><path d="M12 11c0-3 2-5 6-5 0 3-2 5-6 5z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8 3.5v4M16 3.5v4" /></>,
  alert: <><path d="M12 4 3 19h18L12 4z" /><path d="M12 10v4M12 16.5h.01" /></>,
  dot: <circle cx="12" cy="12" r="4" />,
  brief: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3.5h6v1" /><path d="m8.6 12.5 2 2 4-4" /></>,
  // ── task types ──
  send: <><line x1="21" y1="3" x2="10" y2="14" /><polygon points="21 3 14 21 10 14 3 10 21 3" /></>,
  rocket: <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" /></>,
  scope: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.6-4.6" /><path d="M8 9.5h5M8 12.5h3" /></>,
  badgecheck: <><path d="M12 3 5 6v5c0 4.4 3 7.4 7 9 4-1.6 7-4.6 7-9V6l-7-3z" /><path d="m8.5 12 2.5 2.5 5-5" /></>,
  docpen: <><rect x="4" y="4" width="10" height="15" rx="1.5" /><path d="M7 9h4M7 12.5h3" /><path d="M18 8.5a1.4 1.4 0 0 1 2 2l-6.5 6.5-3 1 1-3 6.5-6.5z" /></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><polygon points="10 9 16 12 10 15" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="8.5" cy="8.5" r="1.8" /><path d="m20 15-4-4L6 21" /></>,
  chat: <><path d="M20 6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2v4l4-4h6a2 2 0 0 0 2-2V6z" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0" /><path d="M12 17v4" /><path d="M8.5 21h7" /></>,
  layers: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  filedoc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5" /><path d="M12 11.5v5.5" /><path d="m9.5 14.5 2.5 2.5 2.5-2.5" /></>,
  window: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 9h18" /><path d="M6.5 6.5h.01M9.5 6.5h.01" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" /></>,
  cap: <><path d="M21 9 12 5 3 9l9 4 9-4z" /><path d="M7 11v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-5" /><path d="M21 9v5.5" /></>,
  book: <><rect x="7" y="3" width="11" height="18" rx="1.5" /><path d="M10.5 3v18" /></>,
};

// Render a glyph. `color` = stroke (defaults to currentColor so it inherits text colour = neutral by default).
export function TypeGlyph({ name, color = 'currentColor', size = 13, style }: { name: GlyphName; color?: string; size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }} aria-hidden>{GLYPH[name]}</svg>
  );
}
