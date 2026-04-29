'use client';

import type { ReactNode } from 'react';
import { LangProvider } from '@/lib/lang-context';
import { TweaksProvider } from './tweaks';

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <TweaksProvider>{children}</TweaksProvider>
    </LangProvider>
  );
}
