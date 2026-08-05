'use client';

// EntityDrawerHost — mounted ONCE (RootProviders). Subscribes to the global entity-drawer
// channel and renders the right self-loading drawer for whatever <EntityRef> (or any code)
// asked to open, IN-PLACE, on ANY page. Drawers are lazy-loaded so this adds nothing to the
// global bundle until an entity is actually opened. New kinds = one line in the switch.

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useEntityDrawerReq, openEntityDrawer, closeEntityDrawer, readEntityDrawerFromUrl } from '@/lib/entity-drawer';

const AccountDrawer = dynamic(() => import('./account-drawer').then((m) => m.AccountDrawer), { ssr: false });
const BrowserProfileDrawerById = dynamic(() => import('./entity-self-drawers').then((m) => m.BrowserProfileDrawerById), { ssr: false });
const ProxyDrawerById = dynamic(() => import('./entity-self-drawers').then((m) => m.ProxyDrawerById), { ssr: false });
const IdentityDrawer = dynamic(() => import('./identity-drawer').then((m) => m.IdentityDrawer), { ssr: false });

// Kinds this host can open in-place. <EntityRef> checks the SAME set to decide open-in-place
// vs deep-link. Keep in sync with the switch below + HOST_KINDS in entity-ref.tsx.
export const HOST_KINDS = new Set(['account', 'browser-profile', 'proxy', 'identity']);

export function EntityDrawerHost() {
  const req = useEntityDrawerReq();
  // Deep-link restore: if the page loaded with ?ed=kind~id, open that drawer on mount.
  useEffect(() => { const u = readEntityDrawerFromUrl(); if (u) openEntityDrawer(u.kind, u.id, u.project); }, []);
  if (!req) return null;
  const onClose = () => closeEntityDrawer();
  const id = Number(req.id);
  switch (req.kind) {
    case 'account': return <AccountDrawer accountId={id} onClose={onClose} />;
    case 'browser-profile': return <BrowserProfileDrawerById id={id} onClose={onClose} />;
    case 'proxy': return <ProxyDrawerById id={id} onClose={onClose} />;
    case 'identity': return <IdentityDrawer identityId={id} onClose={onClose} />;
    default: return null;   // unregistered kind → nothing (EntityRef falls back to deep-link route)
  }
}
