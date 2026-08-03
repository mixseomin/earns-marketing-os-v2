'use client';

import type { ReactNode } from 'react';
import { LangProvider } from '@/lib/lang-context';
import { TweaksProvider } from './tweaks';
import { RefactorDebug } from './ui/refactor-debug';

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <TweaksProvider>{children}</TweaksProvider>
      <RefactorDebug />
    </LangProvider>
  );
}
