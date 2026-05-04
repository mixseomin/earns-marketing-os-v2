'use client';

import { useEffect } from 'react';
import { useTweaks } from './tweaks';
import { useLang } from '@/lib/lang-context';

// Tweaks-driven accent override. 'auto' (default) means: do NOT override —
// inherit --accent from globals.css, which is theme-aware (blue in both
// light + dark). Explicit picks override at runtime.
const ACCENTS: Record<string, { line: string; soft: string; edge: string } | null> = {
  auto:   null,
  blue:   { line: 'var(--neon-blue)',   soft: 'rgba(91,173,255,.16)',  edge: 'rgba(91,173,255,.40)' },
  cyan:   { line: 'var(--neon-cyan)',   soft: 'rgba(56,189,248,.16)',  edge: 'rgba(56,189,248,.40)' },
  lime:   { line: 'var(--neon-lime)',   soft: 'rgba(182,255,60,.16)',  edge: 'rgba(182,255,60,.40)' },
  amber:  { line: 'var(--neon-amber)',  soft: 'rgba(255,176,60,.16)',  edge: 'rgba(255,176,60,.40)' },
  violet: { line: 'var(--neon-violet)', soft: 'rgba(157,108,255,.16)', edge: 'rgba(157,108,255,.40)' },
  pink:   { line: 'var(--neon-pink)',   soft: 'rgba(255,60,168,.16)',  edge: 'rgba(255,60,168,.40)' },
};

export function ThemeApplier(_: { modeAccent?: string } = {}) {
  const { tweaks } = useTweaks();
  const { setLang } = useLang();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
    const root = document.documentElement.style;
    if (tweaks.accent === 'auto') {
      // Clear inline overrides so the CSS-file values win (theme-aware blue).
      root.removeProperty('--accent');
      root.removeProperty('--accent-soft');
      root.removeProperty('--accent-line');
    } else {
      const a = ACCENTS[tweaks.accent] ?? ACCENTS.blue!;
      root.setProperty('--accent', a.line);
      root.setProperty('--accent-soft', a.soft);
      root.setProperty('--accent-line', a.edge);
    }
  }, [tweaks.theme, tweaks.accent]);

  useEffect(() => {
    setLang(tweaks.lang);
  }, [tweaks.lang, setLang]);

  return null;
}
