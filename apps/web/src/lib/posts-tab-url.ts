// Parse / serialize URL params cho tab seeding cockpit:
//   ?st=posts                           seeding tab (queue|posts), default queue
//   ?d=7                                days (1|7|30|90|all), default 7
//   ?lc=live,ghosted                    lifecycles CSV
//   ?hr=0                               hideRemoved 0/1, default 1
//   ?pf=reddit,x                        platformKeys CSV
//   ?h=12,34                            habitatIds CSV
//   ?a=5,6                              accountIds CSV
//   ?bf=42                              briefIds CSV
//   ?ct=text,image                      contentTypes CSV
//   ?ai=1                               aiDetectionOnly 0/1
//   ?own=own|external                   habitat ownership filter
//   ?ak=user|bot|app                    account kind filter
//   ?mv=100  ?ms=10  ?mr=5              min views/score/replies
//   ?q=search                           text search habitat/account/title/body
//   ?s=views_desc                       sort key
//   ?p=2                                page number (1-based), default 1
//
// Đặt key ngắn để URL không phình. Server (Next 15 async searchParams) +
// client mirror dùng chung file này.

import type { AllPostedFilters, PostedSortKey } from '@/lib/actions/brief-posts';

export type SeedingTabKey = 'queue' | 'posts';

export interface ParsedSeedingTabUrl {
  view: SeedingTabKey;
  filters: AllPostedFilters;
  page: number;             // 1-based
}

const VALID_SORTS: PostedSortKey[] = [
  'posted_desc', 'posted_asc', 'views_desc', 'score_desc', 'replies_desc', 'ratio_desc',
  'cost_desc', 'cost_asc', 'duration_desc', 'duration_asc',
];

const VALID_LIFECYCLES = new Set([
  'live', 'ghosted', 'removed-by-mod', 'self-deleted', 'low-engagement', '_none',
]);

const PAGE_LIMIT = 50;

function pickStr(v: string | string[] | undefined): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function parseCsv(v: string | string[] | undefined): string[] | undefined {
  const s = pickStr(v);
  if (!s) return undefined;
  const arr = s.split(',').map((x) => x.trim()).filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

function parseCsvNum(v: string | string[] | undefined): number[] | undefined {
  const arr = parseCsv(v);
  if (!arr) return undefined;
  const nums = arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
  return nums.length > 0 ? nums : undefined;
}

function parseNum(v: string | string[] | undefined): number | null {
  const s = pickStr(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v: string | string[] | undefined, def: boolean): boolean {
  const s = pickStr(v);
  if (s == null) return def;
  return s === '1' || s === 'true';
}

export function parseSeedingTabUrl(
  sp: Record<string, string | string[] | undefined>,
): ParsedSeedingTabUrl {
  const viewRaw = pickStr(sp.st);
  const view: SeedingTabKey = viewRaw === 'posts' ? 'posts' : 'queue';

  // Days: '7' → 7, 'all' / '' / null → null, số khác → number.
  let days: number | null = 7;
  const dRaw = pickStr(sp.d);
  if (dRaw === 'all') days = null;
  else if (dRaw != null) {
    const n = Number(dRaw);
    if (Number.isFinite(n) && n > 0) days = n;
  }

  const lifecyclesRaw = parseCsv(sp.lc);
  const lifecycles = lifecyclesRaw?.filter((l) => VALID_LIFECYCLES.has(l));

  const hideRemoved = parseBool(sp.hr, true);

  const sortRaw = pickStr(sp.s) as PostedSortKey | null;
  const sort: PostedSortKey = (sortRaw && VALID_SORTS.includes(sortRaw))
    ? sortRaw
    : 'posted_desc';

  const minViews = parseNum(sp.mv);
  const minScore = parseNum(sp.ms);
  const minReplies = parseNum(sp.mr);
  const q = pickStr(sp.q) ?? undefined;

  const pageRaw = parseNum(sp.p);
  const page = pageRaw != null && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  return {
    view,
    page,
    filters: {
      days,
      lifecycles: lifecycles && lifecycles.length > 0 ? lifecycles : undefined,
      hideRemoved,
      platformKeys: parseCsv(sp.pf),
      habitatIds: parseCsvNum(sp.h),
      accountIds: parseCsvNum(sp.a),
      briefIds: parseCsvNum(sp.bf),
      contentTypes: parseCsv(sp.ct),
      aiDetectionOnly: parseBool(sp.ai, false),
      ownership: (() => {
        const v = pickStr(sp.own);
        return v === 'own' || v === 'external' ? v : undefined;
      })(),
      accountKind: (() => {
        const v = pickStr(sp.ak);
        return v === 'user' || v === 'bot' || v === 'app' ? v : undefined;
      })(),
      minViews,
      minScore,
      minReplies,
      q,
      sort,
      limit: PAGE_LIMIT,
      offset: (page - 1) * PAGE_LIMIT,
    },
  };
}

// Serialize filters → URL params. Bỏ key về default để URL ngắn.
export function serializeSeedingTabUrl(
  view: SeedingTabKey,
  filters: AllPostedFilters,
): URLSearchParams {
  const qs = new URLSearchParams();
  if (view !== 'queue') qs.set('st', view);

  if (filters.days !== 7) {
    qs.set('d', filters.days == null ? 'all' : String(filters.days));
  }
  if (filters.lifecycles && filters.lifecycles.length > 0) {
    qs.set('lc', filters.lifecycles.join(','));
  }
  if (filters.hideRemoved === false) qs.set('hr', '0');
  if (filters.platformKeys && filters.platformKeys.length > 0) {
    qs.set('pf', filters.platformKeys.join(','));
  }
  if (filters.habitatIds && filters.habitatIds.length > 0) {
    qs.set('h', filters.habitatIds.join(','));
  }
  if (filters.accountIds && filters.accountIds.length > 0) {
    qs.set('a', filters.accountIds.join(','));
  }
  if (filters.briefIds && filters.briefIds.length > 0) {
    qs.set('bf', filters.briefIds.join(','));
  }
  if (filters.contentTypes && filters.contentTypes.length > 0) {
    qs.set('ct', filters.contentTypes.join(','));
  }
  if (filters.aiDetectionOnly) qs.set('ai', '1');
  if (filters.ownership) qs.set('own', filters.ownership);
  if (filters.accountKind) qs.set('ak', filters.accountKind);
  if (filters.minViews != null) qs.set('mv', String(filters.minViews));
  if (filters.minScore != null) qs.set('ms', String(filters.minScore));
  if (filters.minReplies != null) qs.set('mr', String(filters.minReplies));
  if (filters.q && filters.q.trim()) qs.set('q', filters.q.trim());
  if (filters.sort && filters.sort !== 'posted_desc') qs.set('s', filters.sort);

  const limit = filters.limit ?? PAGE_LIMIT;
  const offset = filters.offset ?? 0;
  const page = Math.floor(offset / limit) + 1;
  if (page > 1) qs.set('p', String(page));

  return qs;
}
