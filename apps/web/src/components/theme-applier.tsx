'use client';

import { useEffect } from 'react';
import { useTweaks } from './tweaks';
import { useLang } from '@/lib/lang-context';

const ACCENTS: Record<string, { line: string; soft: string; edge: string } | null> = {
  auto: null,
  cyan: { line: '#00e5ff', soft: 'rgba(0,229,255,.12)', edge: 'rgba(0,229,255,.35)' },
  lime: { line: '#b6ff3c', soft: 'rgba(182,255,60,.12)', edge: 'rgba(182,255,60,.35)' },
  amber: { line: '#ffb03c', soft: 'rgba(255,176,60,.12)', edge: 'rgba(255,176,60,.35)' },
  violet: { line: '#9d6cff', soft: 'rgba(157,108,255,.12)', edge: 'rgba(157,108,255,.35)' },
  pink: { line: '#ff3ca8', soft: 'rgba(255,60,168,.12)', edge: 'rgba(255,60,168,.35)' },
};

export function ThemeApplier({ modeAccent = 'cyan' }: { modeAccent?: string }) {
  const { tweaks } = useTweaks();
  const { setLang } = useLang();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
    const accentKey = tweaks.accent === 'auto' ? modeAccent : tweaks.accent;
    const a = ACCENTS[accentKey] ?? ACCENTS.cyan!;
    document.documentElement.style.setProperty('--accent', a.line);
    document.documentElement.style.setProperty('--accent-soft', a.soft);
    document.documentElement.style.setProperty('--accent-line', a.edge);
  }, [tweaks.theme, tweaks.accent, modeAccent]);

  useEffect(() => {
    setLang(tweaks.lang);
  }, [tweaks.lang, setLang]);

  return null;
}
