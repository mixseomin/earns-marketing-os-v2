'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { translate, type Lang } from './i18n';

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, fallback?: string) => string };

const LangCtx = createContext<Ctx | null>(null);

export function LangProvider({ children, initial = 'vi' }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = (typeof window !== 'undefined' && localStorage.getItem('mos.lang')) as Lang | null;
    if (stored === 'vi' || stored === 'en') setLangState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('mos.lang', lang);
  }, [lang, hydrated]);

  const value: Ctx = {
    lang,
    setLang: setLangState,
    t: (key, fallback) => translate(lang, key, fallback),
  };
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}

export function useT() {
  return useLang().t;
}
