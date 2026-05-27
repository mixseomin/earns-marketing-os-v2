'use client';

// Module-scope cache cho getBriefForModal — dedup hover prefetch + click,
// TTL 45s, timeout 10s. Tách khỏi seeding-cockpit để AllPostsTab dùng chung.

import { getBriefForModal } from '@/lib/actions/community-briefs';

type BriefModalRes = Awaited<ReturnType<typeof getBriefForModal>>;
type Pending = Promise<BriefModalRes>;

const briefCache = new Map<string, { at: number; promise: Pending }>();
const BRIEF_TTL = 45_000;
const BRIEF_FETCH_TIMEOUT = 10_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export function fetchBriefModal(projectId: string, briefId: number): Pending {
  const key = `${projectId}/${briefId}`;
  const hit = briefCache.get(key);
  if (hit && Date.now() - hit.at < BRIEF_TTL) return hit.promise;
  const promise = withTimeout(
    getBriefForModal(projectId, briefId),
    BRIEF_FETCH_TIMEOUT,
    `getBriefForModal(${briefId})`,
  );
  briefCache.set(key, { at: Date.now(), promise });
  promise.catch((err) => {
    console.warn('[mos2] brief fetch failed', err);
    briefCache.delete(key);
  });
  return promise;
}

export function prefetchBriefModal(projectId: string, briefId: number): void {
  void fetchBriefModal(projectId, briefId).catch(() => {});
}

export function invalidateBriefModal(projectId: string, briefId: number): void {
  briefCache.delete(`${projectId}/${briefId}`);
}
