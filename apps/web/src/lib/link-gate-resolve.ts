// Resolve a backlink /plays task → its community readiness, so a 🌱 community-seed
// card can show "can this account drop a link here yet?" and gate the link-drop.
//
// The backlinks board (human_tasks / `backlinks` view) has no account/brief/habitat
// column — the (account × subreddit) community_brief is resolved at read time (C /
// hybrid, approved 2026-08-05): subreddit auto-parsed from source_url; account =
// the task's already-resolved accountId (auto-pick or override). If a brief exists
// we run the SAME predicate advancePhase() uses (computeLinkGate) so /plays and the
// seeding cockpit agree; if not, we show what the account alone tells us (Tier A:
// safety + karma) and mark it untracked. Reddit only for now (link_gate_enabled).
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { computeLinkGate, DEFAULT_LINK_FLOOR } from '@/lib/link-readiness';
import type { Phase } from '@/lib/phase-plan';

type Db = NonNullable<ReturnType<typeof getDb>>;

export interface SeedGate {
  state: 'ready' | 'building' | 'no-brief' | 'no-account';
  sub: string | null;
  habitatId: number | null;
  briefId: number | null;
  phase: string | null;
  joined: boolean;
  tenureDays: number | null; tenureNeed: number;
  karma: number | null;      karmaNeed: number;
  seeds: number | null;      seedsNeed: number;
  safetyFail: boolean;       // shadowbanned/suspended — hard stop regardless of metrics
  ok: boolean;               // a live link is sanctioned right now
  blockers: string[];        // human-readable missing conditions (tooltip / drawer)
}

// reddit.com/r/<sub> — tolerates #play-N, /search/?…, /comments/…, trailing slash.
export function parseSubreddit(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/reddit\.com\/r\/([a-z0-9_]+)/i);
  return m?.[1] ?? null;
}

const rows = <T = Record<string, unknown>>(r: unknown): T[] => (r as { rows?: T[] })?.rows ?? (r as T[]) ?? [];
const parseStats = (v: unknown): Record<string, unknown> => {
  try { return typeof v === 'string' ? JSON.parse(v) : (v as Record<string, unknown>) || {}; } catch { return {}; }
};

// Batched — never a per-row subquery (backlinks list perf). One round per lookup table.
export async function resolveSeedGates(
  db: Db,
  items: Array<{ id: number; sourceUrl: string | null; accountId: number | null }>,
): Promise<Map<number, SeedGate>> {
  const out = new Map<number, SeedGate>();
  const withSub = items.map((it) => ({ ...it, sub: parseSubreddit(it.sourceUrl) })).filter((it): it is typeof it & { sub: string } => !!it.sub);
  if (!withSub.length) return out;

  const subs = [...new Set(withSub.map((it) => it.sub.toLowerCase()))];
  const acctIds = [...new Set(withSub.map((it) => it.accountId).filter((x): x is number => x != null))];

  // 1+2 (independent) — habitats by subreddit, account stats.
  const subList = sql.join(subs.map((s) => sql`${s}`), sql`, `);
  const [habRaw, statRaw] = await Promise.all([
    db.execute(sql`SELECT id, lower(split_part(url, '/r/', 2)) AS sub,
                          min_karma, min_account_age_days, min_posts, links_allowed_after, privacy
                   FROM habitats WHERE platform_key = 'reddit' AND lower(split_part(url, '/r/', 2)) IN (${subList})`),
    acctIds.length
      ? db.execute(sql`SELECT id, status, account_stats FROM platform_accounts WHERE id IN (${sql.join(acctIds.map((i) => sql`${i}`), sql`, `)})`)
      : Promise.resolve([] as unknown),
  ]);
  const habBySub = new Map<string, Record<string, unknown>>();
  for (const h of rows(habRaw)) habBySub.set(String(h.sub), h);
  const statById = new Map<number, Record<string, unknown>>();
  for (const a of rows(statRaw)) statById.set(Number(a.id), a);

  // 3 — briefs for these (account, habitat) pairs.
  const habIds = [...new Set([...habBySub.values()].map((h) => Number(h.id)))];
  const briefByPair = new Map<string, Record<string, unknown>>();
  if (acctIds.length && habIds.length) {
    const briefRaw = await db.execute(sql`
      SELECT id, account_id, habitat_id, current_phase, join_status, joined_at
      FROM community_briefs
      WHERE account_id IN (${sql.join(acctIds.map((i) => sql`${i}`), sql`, `)})
        AND habitat_id IN (${sql.join(habIds.map((i) => sql`${i}`), sql`, `)})`);
    for (const b of rows(briefRaw)) briefByPair.set(`${b.account_id}:${b.habitat_id}`, b);
  }

  // 4 — seeds + community value per resolved brief (same rule as advancePhase).
  const briefIds = [...new Set([...briefByPair.values()].map((b) => Number(b.id)))];
  const aggByBrief = new Map<number, { seeds: number; value: number }>();
  if (briefIds.length) {
    const aggRaw = await db.execute(sql`
      SELECT c.brief_id,
             count(*) FILTER (WHERE c.post_url IS NOT NULL AND (c.content_type IS NULL OR c.content_type <> 'link')
                              AND (c.post_lifecycle IS NULL OR c.post_lifecycle NOT IN ('removed-by-mod','self-deleted','ghosted'))) AS seeds,
             COALESCE(sum(COALESCE(c.insights_score,0) + COALESCE(c.insights_reply_count,0)),0) AS value
      FROM cards c WHERE c.brief_id IN (${sql.join(briefIds.map((i) => sql`${i}`), sql`, `)}) GROUP BY c.brief_id`);
    for (const r of rows(aggRaw)) aggByBrief.set(Number(r.brief_id), { seeds: Number(r.seeds), value: Number(r.value) });
  }

  const NEXT: Phase = 'seed'; // readiness = "would advancing this brief to its first LINK phase pass?"
  for (const it of withSub) {
    const sub = it.sub.toLowerCase();
    const hab = habBySub.get(sub) ?? null;
    const num = (v: unknown) => (v != null ? Number(v) : 0);
    const habInput = {
      minKarma: num(hab?.min_karma), minAccountAgeDays: num(hab?.min_account_age_days), minPosts: num(hab?.min_posts),
      linksAllowedAfter: (hab?.links_allowed_after as string) ?? '', privacy: (hab?.privacy as string) ?? '',
    };
    const karmaNeed = habInput.minKarma || DEFAULT_LINK_FLOOR.karma;
    const tenureNeed = habInput.minAccountAgeDays || DEFAULT_LINK_FLOOR.tenureDays;
    const seedsNeed = habInput.minPosts || DEFAULT_LINK_FLOOR.seeds;
    const habitatId = hab ? Number(hab.id) : null;

    if (it.accountId == null) {
      out.set(it.id, { state: 'no-account', sub, habitatId, briefId: null, phase: null, joined: false,
        tenureDays: null, tenureNeed, karma: null, karmaNeed, seeds: 0, seedsNeed, safetyFail: false, ok: false,
        blockers: ['chưa gán account cho task này'] });
      continue;
    }
    const stat = statById.get(it.accountId);
    const stats = parseStats(stat?.account_stats);
    const karma = stats.karma != null ? Number(stats.karma) : null;
    const shadowbanned = stats.shadowbanned === true || stats.shadowbanned === 'true';
    const suspended = stats.suspended === true || stats.suspended === 'true' || ['banned', 'suspended', 'blocked'].includes(String(stat?.status || ''));
    const safetyFail = shadowbanned || suspended;
    const brief = habitatId != null ? briefByPair.get(`${it.accountId}:${habitatId}`) : null;

    if (!brief) {
      // No per-community brief yet → Tier A only (safety + global karma); per-sub tenure/seeds unknown.
      const blockers: string[] = [];
      if (safetyFail) blockers.push(shadowbanned ? 'account shadowbanned' : 'account suspended/banned');
      if (karma != null && karma < karmaNeed) blockers.push(`karma ${karma} < ${karmaNeed}`);
      blockers.push('chưa track community (0 seed) — bắt đầu warm-up ở /seeding');
      out.set(it.id, { state: 'no-brief', sub, habitatId, briefId: null, phase: null, joined: false,
        tenureDays: null, tenureNeed, karma, karmaNeed, seeds: 0, seedsNeed, safetyFail, ok: false, blockers });
      continue;
    }
    const agg = aggByBrief.get(Number(brief.id)) ?? { seeds: 0, value: 0 };
    const joinStatus = (brief.join_status as string) ?? null;
    const gate = computeLinkGate({
      nextPhase: NEXT, joinStatus, joinedAt: (brief.joined_at as string) ?? null,
      karma, communityValue: agg.value, successfulSeeds: agg.seeds, shadowbanned, suspended, habitat: habInput,
    });
    const tenureDays = brief.joined_at ? Math.floor((Date.now() - new Date(brief.joined_at as string).getTime()) / 86400000) : 0;
    out.set(it.id, {
      state: gate.ok ? 'ready' : 'building', sub, habitatId, briefId: Number(brief.id),
      phase: (brief.current_phase as string) ?? null, joined: joinStatus === 'joined',
      tenureDays, tenureNeed, karma, karmaNeed, seeds: agg.seeds, seedsNeed, safetyFail,
      ok: gate.ok, blockers: gate.blockers.map((b) => b.msg),
    });
  }
  return out;
}

// ponytail: one runnable check for the parser (the only non-trivial branch here). Run: npx tsx lib/link-gate-resolve.ts
export function demo() {
  const c = (a: unknown, m: string) => console.assert(a, m);
  c(parseSubreddit('https://www.reddit.com/r/MilitaryFinance#play-231') === 'MilitaryFinance', 'strip #play');
  c(parseSubreddit('https://www.reddit.com/r/govfire/search/?q=x&sort=new') === 'govfire', 'strip /search');
  c(parseSubreddit('https://reddit.com/r/coins/') === 'coins', 'trailing slash');
  c(parseSubreddit('https://example.com/blog') === null, 'non-reddit → null');
  c(parseSubreddit(null) === null, 'null → null');
  console.log('link-gate-resolve demo: assertions passed');
}
if (typeof process !== 'undefined' && process.argv?.[1] && import.meta.url === `file://${process.argv[1]}`) demo();
