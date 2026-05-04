// Real-data overrides for the cities-gg project. Pulls metrics from the
// shared Directus instance (https://as.on.tc) so the MOS2 dashboard reflects
// actual likes/shares/cities/videos instead of the content-studio mock KPIs.

import type { Mode, Kpi } from '@/lib/mock/types';

const DIRECTUS = 'https://as.on.tc';
const TOKEN = process.env.DIRECTUS_TOKEN ?? '6c7fb17ca4c5ddb094e580474d2fe6cc09c8e32d0174a75a96d4282a8804e227';

async function dget<T = any>(path: string): Promise<T> {
  const r = await fetch(`${DIRECTUS}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    next: { revalidate: 60 },
  });
  if (!r.ok) throw new Error(`Directus ${path} → ${r.status}`);
  return ((await r.json()) as any).data as T;
}

async function metaCount(path: string): Promise<number> {
  const r = await fetch(`${DIRECTUS}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    next: { revalidate: 60 },
  });
  if (!r.ok) return 0;
  return ((await r.json()) as any).meta?.filter_count ?? 0;
}

export async function citiesGgKpis(): Promise<Kpi[]> {
  const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

  const [cities, videos, broken, sumRow, evt24, share24, like7] = await Promise.all([
    metaCount(`/items/cgg_cities?filter[status][_eq]=published&fields=id&limit=1&meta=filter_count`),
    metaCount(`/items/cgg_videos?filter[status][_eq]=working&fields=id&limit=1&meta=filter_count`),
    metaCount(`/items/cgg_videos?filter[status][_eq]=broken&fields=id&limit=1&meta=filter_count`),
    dget<{ sum: { like_count: number } }[]>(`/items/cgg_cities?aggregate[sum]=like_count&limit=1`),
    metaCount(`/items/cgg_events?filter[created_at][_gte]=${since24}&fields=id&limit=1&meta=filter_count`),
    metaCount(`/items/cgg_events?filter[created_at][_gte]=${since24}&filter[action][_eq]=share&fields=id&limit=1&meta=filter_count`),
    metaCount(`/items/cgg_events?filter[created_at][_gte]=${since7}&filter[action][_eq]=like&fields=id&limit=1&meta=filter_count`),
  ]);

  const totalLikes = sumRow?.[0]?.sum?.like_count ?? 0;

  return [
    { label: 'CITIES', unit: 'PUBLISHED', val: String(cities), delta: '', tone: 'flat', primary: true },
    { label: 'VIDEOS', unit: 'WORKING', val: String(videos), delta: broken > 0 ? `${broken} broken` : 'all healthy', tone: broken > 0 ? 'down' : 'up' },
    { label: 'TOTAL LIKES', unit: 'CUM', val: String(totalLikes), delta: `${like7} this 7d`, tone: like7 > 0 ? 'up' : 'flat' },
    { label: 'SHARES 24h', unit: '', val: String(share24), delta: `${evt24} events 24h`, tone: share24 > 0 ? 'up' : 'flat' },
    { label: 'EVENTS 24h', unit: 'ALL', val: String(evt24), delta: '', tone: 'flat' },
  ];
}

export async function applyCitiesGgOverrides(mode: Mode): Promise<Mode> {
  let kpis: Kpi[] = [];
  try { kpis = await citiesGgKpis(); } catch { /* keep empty on error */ }
  return {
    ...mode,
    pageTitle: 'cities.gg',
    pageSub: 'Live engagement from v2.cities.gg — likes, shares, broken-video health.',
    kpis,
    suggestions: [],         // disabled per request
    revChart: undefined,     // hide demo revenue chart
    revData: [],
    topList: [],
  };
}
