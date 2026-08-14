'use client';

// Global entity-drawer channel — lets ANY <EntityRef> (or any code) open an entity's
// detail drawer IN-PLACE from ANY page, without that page pre-mounting the drawer.
// A single <EntityDrawerHost/> (mounted once in RootProviders) subscribes here and renders
// the right self-loading drawer for the requested kind. Before this, entity refs could only
// deep-link to a page that already had the drawer, so clicking one navigated away.
//
// STACK (2026-08-14): giữ NGĂN XẾP nhiều drawer, không phải 1 slot. Mở entity B từ trong drawer
// entity A → B chồng LÊN A (đóng B lộ lại A), thay vì NUỐT A. Nhờ đó account → brief → habitat lồng
// nhau qua host được, khỏi phải giữ overlay cục bộ từng chỗ. Việc xếp chồng (z-order theo mount, ESC
// đóng đúng cái trên cùng, cascade-trái + làm mờ cái dưới) do primitive `ui/drawer.tsx` lo sẵn —
// host chỉ cần render cả mảng. Mirror cả stack lên URL (?ed=kind~id[~proj],kind~id,…) nên F5 /
// deep-link khôi phục đúng cả chồng.

import { useSyncExternalStore } from 'react';

export interface EntityDrawerReq { kind: string; id: string | number; project?: string | number }

// The ONE source of truth for which kinds the global EntityDrawerHost can open in-place.
// Both the host (switch) and <EntityRef> (open-in-place vs deep-link) read THIS — no more
// two hand-synced copies. Lives here (a light module both already import) to avoid the
// ui → host → accounts-vault import cycle a shared constant would otherwise create.
export const HOST_KINDS = new Set(['account', 'browser-profile', 'proxy', 'identity', 'brief', 'habitat', 'tribe', 'agent', 'team-member', 'media', 'contact']);

const EMPTY: EntityDrawerReq[] = [];
let stack: EntityDrawerReq[] = EMPTY;   // ngăn xếp; phần tử cuối = drawer TRÊN CÙNG (đang tương tác)
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const sameEntity = (a: EntityDrawerReq, b: EntityDrawerReq) => a.kind === b.kind && String(a.id) === String(b.id);

const encode = (s: EntityDrawerReq[]) =>
  s.map((r) => `${r.kind}~${r.id}${r.project != null ? '~' + r.project : ''}`).join(',');

function syncUrl(s: EntityDrawerReq[]) {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  if (s.length) u.searchParams.set('ed', encode(s));
  else u.searchParams.delete('ed');
  window.history.replaceState(window.history.state, '', u.toString());
}

function commit(next: EntityDrawerReq[]) {
  stack = next.length ? next : EMPTY;   // EMPTY ổn định → useSyncExternalStore không loop khi rỗng
  syncUrl(stack);
  emit();
}

/** Mở drawer entity — CHỒNG lên đỉnh. Nếu entity đã có trong stack thì cắt lên tới nó (đưa lên đỉnh,
 *  tránh trùng + vòng A→B→A). Chữ ký GIỮ NGUYÊN nên mọi call-site (EntityRef, …) không phải đổi. */
export function openEntityDrawer(kind: string, id: string | number, project?: string | number) {
  const req = { kind, id, project };
  const at = stack.findIndex((r) => sameEntity(r, req));
  commit(at >= 0 ? stack.slice(0, at + 1) : [...stack, req]);
}

/** Đóng drawer TRÊN CÙNG (lộ lại drawer dưới). Hết drawer → host render null. */
export function closeEntityDrawer() {
  if (stack.length) commit(stack.slice(0, -1));
}

/** Đóng drawer ở độ sâu `depth` VÀ mọi drawer nằm trên nó. Host truyền index từng frame vào onClose. */
export function closeEntityDrawersToDepth(depth: number) {
  if (depth >= 0 && depth < stack.length) commit(stack.slice(0, depth));
}

/** Read ?ed= (host gọi 1 lần khi mount để khôi phục CẢ chồng drawer sau F5 / deep-link). */
export function readEntityDrawerFromUrl(): EntityDrawerReq[] {
  if (typeof window === 'undefined') return [];
  const v = new URL(window.location.href).searchParams.get('ed');
  if (!v) return [];
  return v.split(',')
    .map((seg): EntityDrawerReq | null => {
      const [kind, id, project] = seg.split('~');
      return kind && id ? { kind, id, project } : null;
    })
    .filter((r): r is EntityDrawerReq => r != null);
}

export function useEntityDrawerReq(): EntityDrawerReq[] {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => stack,
    () => EMPTY,
  );
}
