'use client';

import type { ReactNode } from 'react';
import { LangProvider } from '@/lib/lang-context';
import { TweaksProvider } from './tweaks';
import { RefactorDebug } from './ui/refactor-debug';
import { FlowDebug } from './ui/flow-debug';
import { EntityDrawerHost } from './entity-drawer-host';

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <TweaksProvider>{children}</TweaksProvider>
      {/* Opens any entity's drawer in-place from any page (see lib/entity-drawer). */}
      <EntityDrawerHost />
      <RefactorDebug />
      <FlowDebug />
    </LangProvider>
  );
}
