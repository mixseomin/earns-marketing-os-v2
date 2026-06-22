// board-radar.ts — Seeding Radar core (Phase 2): catalog resolve + account overlay +
// guardrail + tier composition. NO LLM here (fit scoring lives in lib/ai/board-scorer.ts).
// See decision earns-strategy/decisions/2026-06-22-seeding-radar-place-detector.md.
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

type Db = NonNullable<ReturnType<typeof getDb>>;

export type BoardTier = 'GO' | 'ADD' | 'TRACK' | 'SKIP' | 'NONE';

// ── Discriminator: engine-aware identity from a URL (mirrors /habitats/resolve) ──
// Returns the canonical board key. externalId = the real identity (subreddit slug /
// guild_id / group id / vanity), NOT the display name. host kept for url fallback.
export interface BoardKey { platformKey: string | null; externalId: string | null; name: string; host: string; url: string }
export function boardKeyFromUrl(rawUrl: string): BoardKey | null {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const p = u.pathname.split('/').filter(Boolean);
  // Reddit subreddit
  if (host.endsWith('reddit.com') && p[0] === 'r' && p[1]) {
    return { platformKey: 'reddit', externalId: p[1].toLowerCase(), name: `r/${p[1]}`, host, url: rawUrl };
  }
  // Discord guild
  if (host.endsWith('discord.com') && p[0] === 'channels' && p[1] && /^\d{15,25}$/.test(p[1])) {
    return { platformKey: 'discord', externalId: p[1], name: rawUrl, host, url: rawUrl };
  }
  // Known multi-community hosts → identity in path
  if (host.endsWith('facebook.com') || host.endsWith('fb.com')) {
    if (p[0] === 'groups' && p[1]) return { platformKey: 'facebook', externalId: `groups/${p[1]}`, name: `/groups/${p[1]}`, host, url: rawUrl };
    const id = u.searchParams.get('id');
    if (p[0] === 'profile.php' && id) return { platformKey: 'facebook', externalId: `profile/${id}`, name: `profile.php?id=${id}`, host, url: rawUrl };
  }
  if (host.endsWith('linkedin.com')) {
    if (p[0] === 'groups' && p[1]) return { platformKey: 'linkedin', externalId: `groups/${p[1]}`, name: `/groups/${p[1]}`, host, url: rawUrl };
    if (p[0] === 'company' && p[1]) return { platformKey: 'linkedin', externalId: `company/${p[1]}`, name: `/company/${p[1]}`, host, url: rawUrl };
  }
  if ((host.endsWith('twitter.com') || host.endsWith('x.com')) && p[0] === 'i' && p[1] === 'communities' && p[2]) {
    return { platformKey: 'twitter', externalId: `communities/${p[2]}`, name: `/i/communities/${p[2]}`, host, url: rawUrl };
  }
  // Generic forum/host = 1 community → no engine externalId, dedup by url
  return { platformKey: null, externalId: null, name: host, host, url: rawUrl };
}

// ── Resolve-or-create a platform_board, return its id (idempotent, converges w/ backfill) ──
// Match order: (1) external_id, (2) backfill name/url key, (3) insert. On a name/url hit we
// backfill external_id + refresh last_seen so future discovery hits tier 1.
export interface BoardInput {
  tenantId?: string;
  platformKey: string | null;
  technologyKey?: string | null;
  externalId: string | null;
  url: string | null;
  name: string;
  description?: string;
  members?: number;
  privacy?: string;
}
export async function resolveOrCreateBoard(db: Db, inp: BoardInput): Promise<number> {
  const tenantId = inp.tenantId || 'self';
  const ext = inp.externalId && inp.externalId.trim() ? inp.externalId.trim() : null;
  const url = inp.url && inp.url.trim() ? inp.url.trim() : null;
  // (1) external_id match
  if (ext) {
    const r = firstId(await db.execute(sql`
      SELECT id FROM platform_boards
      WHERE tenant_id = ${tenantId} AND platform_key IS NOT DISTINCT FROM ${inp.platformKey} AND external_id = ${ext}
      LIMIT 1`));
    if (r != null) { await touchBoard(db, r); return r; }
  }
  // (2) backfill name/url key (boards created from habitats have external_id NULL)
  const r2 = firstId(await db.execute(sql`
    SELECT id FROM platform_boards
    WHERE tenant_id = ${tenantId}
      AND platform_key IS NOT DISTINCT FROM ${inp.platformKey}
      AND (lower(name) = lower(${inp.name}) ${url ? sql`OR lower(url) = lower(${url})` : sql``})
    ORDER BY (external_id IS NULL) ASC, id ASC
    LIMIT 1`));
  if (r2 != null) {
    await db.execute(sql`
      UPDATE platform_boards SET
        external_id = COALESCE(external_id, ${ext}),
        url = COALESCE(url, ${url}),
        last_seen_at = now(), updated_at = now()
      WHERE id = ${r2}`);
    return r2;
  }
  // (3) insert new
  const ins = firstId(await db.execute(sql`
    INSERT INTO platform_boards (tenant_id, platform_key, technology_key, external_id, url, name, description, members, privacy)
    VALUES (${tenantId}, ${inp.platformKey}, ${inp.technologyKey ?? null}, ${ext}, ${url}, ${inp.name},
            ${inp.description ?? ''}, ${inp.members ?? 0}, ${inp.privacy ?? ''})
    ON CONFLICT (tenant_id, platform_key, external_id) DO UPDATE SET last_seen_at = now(), updated_at = now()
    RETURNING id`));
  if (ins != null) return ins;
  // ON CONFLICT path that didn't return (custom forum url-unique) → re-select by url
  const r3 = firstId(await db.execute(sql`
    SELECT id FROM platform_boards WHERE tenant_id = ${tenantId} AND lower(url) = lower(${url})
      AND external_id IS NULL AND platform_key IS NULL LIMIT 1`));
  if (r3 != null) return r3;
  throw new Error('resolveOrCreateBoard: could not resolve board');
}
async function touchBoard(db: Db, id: number) {
  await db.execute(sql`UPDATE platform_boards SET last_seen_at = now() WHERE id = ${id}`);
}
function firstId(res: unknown): number | null {
  const r = (res as Array<{ id?: unknown }>)[0];
  return r && r.id != null ? Number(r.id) : null;
}

// ── Account-dependent overlay (live, no LLM) ──
export interface Overlay { habitatId: number | null; hasHabitat: boolean; briefId: number | null; hasBrief: boolean; joinStatus: string | null; approachReady: boolean }
export async function boardOverlay(db: Db, boardId: number, projectId: string, accountId: number | null): Promise<Overlay> {
  const res = await db.execute(sql`
    SELECT h.id AS habitat_id, b.id AS brief_id, b.join_status, b.approach_md
    FROM habitats h
    LEFT JOIN community_briefs b ON b.habitat_id = h.id ${accountId != null ? sql`AND b.account_id = ${accountId}` : sql`AND false`}
    WHERE h.board_id = ${boardId} AND h.project_id = ${projectId}
    LIMIT 1`);
  const r = (res as Array<Record<string, unknown>>)[0];
  if (!r) return { habitatId: null, hasHabitat: false, briefId: null, hasBrief: false, joinStatus: null, approachReady: false };
  const briefId = r.brief_id != null ? Number(r.brief_id) : null;
  return {
    habitatId: Number(r.habitat_id), hasHabitat: true,
    briefId, hasBrief: briefId != null,
    joinStatus: r.join_status != null ? String(r.join_status) : null,
    approachReady: !!(r.approach_md && String(r.approach_md).trim()),
  };
}

// ── Guardrail predicate (account-dependent, read-time) → reason | null (null = pass) ──
export interface HabitatGate { privacy?: string; minKarma?: number; minAccountAgeDays?: number; minPosts?: number; modStrictness?: string }
export interface AccountFacts { status?: string; karma?: number; ageDays?: number; posts?: number }
const HARD_JOIN_BLOCK = new Set(['rejected', 'kicked', 'banned', 'left']);
export function guardrailSkip(gate: HabitatGate, acc: AccountFacts | null, joinStatus: string | null): string | null {
  if ((gate.privacy || '').toLowerCase() === 'private') return 'community private — không seed được';
  if (joinStatus && HARD_JOIN_BLOCK.has(joinStatus.toLowerCase())) return `account đã ${joinStatus} ở community này`;
  if (acc) {
    if (gate.minKarma && (acc.karma ?? 0) < gate.minKarma) return `karma ${acc.karma ?? 0} < tối thiểu ${gate.minKarma}`;
    if (gate.minAccountAgeDays && (acc.ageDays ?? 0) < gate.minAccountAgeDays) return `account ${Math.floor(acc.ageDays ?? 0)}d < tối thiểu ${gate.minAccountAgeDays}d`;
    if (gate.minPosts && (acc.posts ?? 0) < gate.minPosts) return `posts ${acc.posts ?? 0} < tối thiểu ${gate.minPosts}`;
  }
  return null; // mod_strictness = soft down-weight only, never a hard SKIP
}

// ── Compose final tier (read-time) ──
export function composeTier(opts: { topicTier: string | null; overlay: Overlay; guardrail: string | null; manualTier?: string | null }): { tier: BoardTier; reason: string } {
  const { topicTier, overlay, guardrail, manualTier } = opts;
  // user override wins over everything (explicit decision to dismiss / pin this board).
  if (manualTier === 'SKIP') return { tier: 'SKIP', reason: 'đã bỏ qua thủ công' };
  if (manualTier === 'GO') return { tier: 'GO', reason: 'pin thủ công' };
  if (guardrail) return { tier: 'SKIP', reason: guardrail };
  if (overlay.hasBrief && overlay.joinStatus === 'joined' && overlay.approachReady) return { tier: 'GO', reason: 'account đã join + có chiến lược → đăng ngay' };
  if (overlay.hasHabitat) {
    const reason = !overlay.hasBrief ? 'community đã track, account chưa có brief'
      : overlay.joinStatus === 'joined' ? 'account đã join, chưa có chiến lược (approach) → soạn brief'
      : `có brief (join: ${overlay.joinStatus || 'not_joined'}) → vào nhóm`;
    return { tier: 'ADD', reason };
  }
  if (topicTier === 'TRACK') return { tier: 'TRACK', reason: 'fit cao, project chưa adopt — nên track' };
  return { tier: 'NONE', reason: '' };
}

// ── Hash helpers (invalidation) ──
export function sha(parts: unknown): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);
}
export interface PillarSig { ids: string[]; keyMessages: string[]; seoKeywords: string[]; forbiddenMsgs: string[]; languages: string[]; status: string; tribeIds: number[]; threshold: number }
export function projectInputsHash(s: PillarSig): string { return sha(['p', s.ids, s.keyMessages, s.seoKeywords, s.forbiddenMsgs, s.languages, s.status, s.tribeIds, s.threshold]); }
export interface BoardSig { dominantTopics: string[]; forbiddenTopics: string[]; description: string; membersBucket: number; language: string }
export function boardInputsHash(s: BoardSig): string { return sha(['b', s.dominantTopics, s.forbiddenTopics, s.description, s.membersBucket, s.language]); }
// Coarse log bucket so ±1 member churn doesn't re-score.
export function membersBucket(n: number): number { return n <= 0 ? 0 : Math.floor(Math.log10(n) * 2); }
