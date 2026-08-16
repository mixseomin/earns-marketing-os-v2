'use client';

// entity-signal — the CLIENT half of the cascade (Tier 2). `entity-cascade` + `touchEntity`
// bust the SERVER cache, so anything rendered on the server comes back fresh. But a list that a
// client component loads itself —
//     const [rows, setRows] = useState(null);
//     useEffect(() => { listX(id).then(setRows); }, [id]);
// — never re-runs on revalidatePath/router.refresh: the deps didn't change, so React keeps the
// effect (and the stale rows) until the component remounts. Tier 1 can't reach it; that fetch
// lives in the browser, past the cache boundary.
//
// So the mutation says it ONCE more, on this side: `signalEntity('account')` after the action
// resolves, and every `useEntityList('account', …)` mounted anywhere refetches. Same shape as
// entity-cascade — the mutation names WHAT it touched, this file owns WHO reloads — and it reuses
// EntityKind so the two halves can't drift into two vocabularies.
//
// Cross-window: signals also go out as one `mos2:entity` postMessage, so a drawer opened from the
// Crew extension (separate window, same origin) reloads too. The three legacy channels
// (`mos2:habitat-updated`, `mos2:brief-updated`, `mos2:account-updated`) are mapped onto kinds
// here, so old senders keep working and new code has exactly one API to learn.

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { EntityKind } from './entity-cascade';

const versions = new Map<EntityKind, number>();
const subs = new Set<() => void>();

const LEGACY: Record<string, EntityKind> = {
  'mos2:habitat-updated': 'habitat',
  'mos2:brief-updated': 'brief',
  'mos2:account-updated': 'account',
};

function bump(kind: EntityKind) {
  versions.set(kind, (versions.get(kind) ?? 0) + 1);
  subs.forEach((f) => f());
}

/** Tell every client list of this kind to reload. Call after a mutating server action resolves. */
export function signalEntity(kind: EntityKind, { broadcast = true } = {}) {
  bump(kind);
  if (broadcast && typeof window !== 'undefined') {
    window.postMessage({ type: 'mos2:entity', kind }, window.location.origin);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    const data = e.data as { type?: string; kind?: EntityKind } | null;
    if (!data?.type) return;
    // broadcast:false — the sender already bumped locally, and re-broadcasting would ping-pong.
    const legacy = LEGACY[data.type];
    if (data.type === 'mos2:entity' && data.kind) signalEntity(data.kind, { broadcast: false });
    else if (legacy) signalEntity(legacy, { broadcast: false });
  });
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Version counter for a kind — re-renders the caller whenever that kind is signalled. */
export function useEntityVersion(kind: EntityKind): number {
  return useSyncExternalStore(subscribe, () => versions.get(kind) ?? 0, () => 0);
}

/**
 * Self-refreshing client list: same ergonomics as the useEffect+useState pattern it replaces,
 * but it also reloads when `kind` is signalled. `null` = still loading (callers rely on that to
 * skip the first paint), so a reload keeps the previous rows on screen instead of flashing empty.
 */
export function useEntityList<T>(kind: EntityKind, loader: () => Promise<T>, deps: unknown[] = []): T | null {
  const version = useEntityVersion(kind);
  const [rows, setRows] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    loader().then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows(null); });
    return () => { live = false; };
    // ponytail: loader is re-created every render, so it stays OUT of deps on purpose — the
    // caller's deps + the version counter are what decide a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, version, ...deps]);
  return rows;
}
