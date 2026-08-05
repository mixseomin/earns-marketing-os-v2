'use client';

// Global entity-drawer channel — lets ANY <EntityRef> (or any code) open an entity's
// detail drawer IN-PLACE from ANY page, without that page pre-mounting the drawer.
// A single <EntityDrawerHost/> (mounted once in RootProviders) subscribes here and renders
// the right self-loading drawer for the requested kind. Before this, entity refs could only
// deep-link to a page that already had the drawer, so clicking one navigated away.
//
// Also mirrors to the URL (?ed=kind~id[~project]) so a deep-link / F5 restores the open drawer.

import { useSyncExternalStore } from 'react';

export interface EntityDrawerReq { kind: string; id: string | number; project?: string | number }

// The ONE source of truth for which kinds the global EntityDrawerHost can open in-place.
// Both the host (switch) and <EntityRef> (open-in-place vs deep-link) read THIS — no more
// two hand-synced copies. Lives here (a light module both already import) to avoid the
// ui → host → accounts-vault import cycle a shared constant would otherwise create.
export const HOST_KINDS = new Set(['account', 'browser-profile', 'proxy', 'identity', 'brief', 'habitat', 'tribe', 'agent', 'team-member', 'media', 'contact']);

let current: EntityDrawerReq | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function syncUrl(req: EntityDrawerReq | null) {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  if (req) u.searchParams.set('ed', `${req.kind}~${req.id}${req.project != null ? '~' + req.project : ''}`);
  else u.searchParams.delete('ed');
  window.history.replaceState(window.history.state, '', u.toString());
}

export function openEntityDrawer(kind: string, id: string | number, project?: string | number) {
  current = { kind, id, project };
  syncUrl(current);
  emit();
}

export function closeEntityDrawer() {
  current = null;
  syncUrl(null);
  emit();
}

/** Read an ?ed= deep-link (host calls this once on mount to restore an open drawer on F5). */
export function readEntityDrawerFromUrl(): EntityDrawerReq | null {
  if (typeof window === 'undefined') return null;
  const v = new URL(window.location.href).searchParams.get('ed');
  if (!v) return null;
  const [kind, id, project] = v.split('~');
  return kind && id ? { kind, id, project } : null;
}

export function useEntityDrawerReq(): EntityDrawerReq | null {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => current,
    () => null,
  );
}
