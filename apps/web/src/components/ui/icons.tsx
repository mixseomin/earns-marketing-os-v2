// Inline SVG icons (Lucide-style stroke icons). currentColor = follows
// surrounding text color. Use sparingly — emoji is fine for stuff that
// doesn't need precise sizing.

import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  title?: string;
}

const baseProps = (size: number, color: string | undefined, sw: number, style: CSSProperties | undefined) => ({
  width: size, height: size,
  viewBox: '0 0 24 24', fill: 'none',
  stroke: color ?? 'currentColor', strokeWidth: sw,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style: { display: 'inline-block', verticalAlign: 'text-bottom', flexShrink: 0, ...style },
  'aria-hidden': true,
});

// Globe — software platform (Reddit, Facebook, phpBB, etc).
export function IconPlatform({ size = 14, color, strokeWidth = 1.8, style, title }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth, style)}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20" />
      <path d="M12 2a14.5 14.5 0 0 1 0 20" />
      <path d="M2 12h20" />
    </svg>
  );
}

// Users / pin — concrete community / group / habitat (Lyso, r/astrology, FB group).
export function IconCommunity({ size = 14, color, strokeWidth = 1.8, style, title }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth, style)}>
      {title && <title>{title}</title>}
      <path d="M18 21a8 8 0 0 0-16 0" />
      <circle cx="10" cy="8" r="5" />
      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </svg>
  );
}

// ── Content-format icons (thay emoji 📝🖼️🎬…) ──────────────────────
function Svg(p: IconProps, children: React.ReactNode) {
  return (
    <svg {...baseProps(p.size ?? 14, p.color, p.strokeWidth ?? 1.8, p.style)}>
      {p.title && <title>{p.title}</title>}{children}
    </svg>
  );
}

export type FormatKind =
  | 'text' | 'image' | 'video' | 'link' | 'thread'
  | 'poll' | 'carousel' | 'story' | 'doc' | 'mix';

export function FormatIcon({ kind, ...p }: IconProps & { kind: string }) {
  switch (kind) {
    case 'image':
      return Svg(p, <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>);
    case 'video':
      return Svg(p, <><rect x="2" y="4" width="14" height="16" rx="2" /><path d="m16 9 6-3v12l-6-3z" /></>);
    case 'link':
      return Svg(p, <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>);
    case 'thread':
      return Svg(p, <><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></>);
    case 'poll':
      return Svg(p, <><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="13" y="7" width="3" height="10" /><rect x="19" y="13" width="0.01" height="4" /></>);
    case 'carousel':
      return Svg(p, <><rect x="7" y="5" width="10" height="14" rx="2" /><path d="M3 8v8M21 8v8" /></>);
    case 'story':
      return Svg(p, <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 6h4" /></>);
    case 'doc':
      return Svg(p, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>);
    case 'mix':
      return Svg(p, <><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></>);
    case 'text':
    default:
      return Svg(p, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>);
  }
}

// ── Action icons cho luồng seeding ─────────────────────────────────
export const IconFilePlus = (p: IconProps) => Svg(p, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M12 12v6M9 15h6" /></>);
export const IconList = (p: IconProps) => Svg(p, <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>);
export const IconCheck = (p: IconProps) => Svg(p, <path d="M20 6 9 17l-5-5" />);
export const IconBan = (p: IconProps) => Svg(p, <><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></>);
export const IconGear = (p: IconProps) => Svg(p, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>);
export const IconUndo = (p: IconProps) => Svg(p, <><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></>);
export const IconTrash = (p: IconProps) => Svg(p, <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>);
export const IconGlobe = (p: IconProps) => Svg(p, <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a14.5 14.5 0 0 1 0 20 14.5 14.5 0 0 1 0-20" /></>);
export const IconClock = (p: IconProps) => Svg(p, <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>);
export const IconSparkles = (p: IconProps) => Svg(p, <><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5 10.1 7.6z" /><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></>);
export const IconSliders = (p: IconProps) => Svg(p, <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" /></>);
export const IconChevron = ({ dir = 'down', ...p }: IconProps & { dir?: 'down' | 'right' | 'up' | 'left' }) =>
  Svg(p,
    dir === 'right' ? <path d="m9 18 6-6-6-6" /> :
    dir === 'up'    ? <path d="m18 15-6-6-6 6" /> :
    dir === 'left'  ? <path d="m15 18-6-6 6-6" /> :
                       <path d="m6 9 6 6 6-6" />); // down (default)
export const IconWarn = (p: IconProps) => Svg(p, <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>);
export const IconDots = (p: IconProps) => Svg(p, <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>);
export const IconSwap = (p: IconProps) => Svg(p, <><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></>);
export const IconPencil = (p: IconProps) => Svg(p, <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></>);
export const IconUser = (p: IconProps) => Svg(p, <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const IconX = (p: IconProps) => Svg(p, <path d="M18 6 6 18M6 6l12 12" />);
export const IconLock = (p: IconProps) => Svg(p, <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>);
export const IconInfo = (p: IconProps) => Svg(p, <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>);
