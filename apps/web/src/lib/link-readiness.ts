// Link-post readiness gate. Posting a LINK to a community is sensitive — an aged
// but dormant account that drops a commercial link with zero standing in that
// community gets shadowbanned (2026-08-05, Mortondelia36). So a link is only
// sanctioned once the account has earned standing THERE: tenure + value + a track
// record of successful link-free seeds + a human review. Everything below that bar
// stays SEEDING (link-free value posts). This mirrors the phase ladder
// (warm-up/value/bridge = no link; seed = first contextual link; direct = promo) —
// see phase-plan.ts — and turns its intent into an enforced predicate.
//
// The gate only fires for the LINK phases (seed/direct). Advancing a brief INTO
// seed/direct is itself the human review (advancePhase records who + why in
// phase_history), so no separate approval column is needed — this predicate is the
// pre-condition the reviewer must clear.
import { type Phase } from './phase-plan';

// The two phases where a live link is sanctioned. bridge and earlier = link-free seeding.
export const LINK_PHASES: Phase[] = ['seed', 'direct'];
export const isLinkPhase = (p: Phase | string): boolean => (LINK_PHASES as string[]).includes(p);

// Floors used when a community (habitat) hasn't set its own threshold (min_* = 0).
// A link is sensitive → require *some* standing even on an unconfigured community.
export const DEFAULT_LINK_FLOOR = { tenureDays: 14, karma: 20, seeds: 2 };

export interface LinkGateInputs {
  nextPhase: Phase;
  joinStatus: string | null;
  joinedAt: string | Date | null;
  karma: number | null;              // global account karma (Reddit gives no per-sub karma → global is the proxy)
  communityValue: number;            // sum of score + earned-replies on our posts IN this community (per-community contribution)
  successfulSeeds: number;           // live, link-free posts we've landed IN this community
  shadowbanned: boolean;
  suspended: boolean;
  habitat: {
    minKarma?: number | null;
    minAccountAgeDays?: number | null;
    minPosts?: number | null;
    linksAllowedAfter?: string | null;
    privacy?: string | null;
  };
  now?: number;                      // injectable for tests
}

export type LinkBlockerKey = 'safety' | 'links-banned' | 'privacy' | 'join' | 'tenure' | 'value' | 'community-value' | 'seeds';
export interface LinkBlocker { key: LinkBlockerKey; msg: string; need?: number; have?: number }
export interface LinkGateResult { ok: boolean; gated: boolean; blockers: LinkBlocker[] }

// Pure predicate. gated=false means this phase carries no link (seeding) → always ok.
export function computeLinkGate(x: LinkGateInputs): LinkGateResult {
  if (!isLinkPhase(x.nextPhase)) return { ok: true, gated: false, blockers: [] };
  const blockers: LinkBlocker[] = [];
  const now = x.now ?? Date.now();

  // 1. Safety — hard fail regardless of any threshold (the shadowban lesson).
  if (x.shadowbanned) blockers.push({ key: 'safety', msg: 'account shadowbanned — link vô hình + rủi ro, tuyệt đối không thả link' });
  if (x.suspended) blockers.push({ key: 'safety', msg: 'account suspended' });

  // 2. Community explicitly bans links / self-promo (e.g. r/MilitaryFinance
  // "est. contributor only, no self-links" — exactly the rule Mortondelia36 broke).
  // NOTE: threshold-style values ("after 30 days", "100 messages") must NOT match —
  // those mean links ARE allowed once a bar is met, which the numeric gates handle.
  const links = (x.habitat.linksAllowedAfter || '').trim().toLowerCase();
  if (links === 'never' || links === 'no' || /banned|no self|self.?promo|no link|not allow/.test(links)) {
    blockers.push({ key: 'links-banned', msg: `community cấm self-link (rule: "${x.habitat.linksAllowedAfter}")` });
  }
  if ((x.habitat.privacy || '').toLowerCase() === 'private') blockers.push({ key: 'privacy', msg: 'community private' });

  // 3. Membership.
  if (x.joinStatus !== 'joined') blockers.push({ key: 'join', msg: `chưa joined community (join_status=${x.joinStatus || 'not_joined'})` });

  // 4. Tenure — days since we joined this community.
  const tenureNeed = x.habitat.minAccountAgeDays || DEFAULT_LINK_FLOOR.tenureDays;
  const tenureHave = x.joinedAt ? Math.floor((now - new Date(x.joinedAt).getTime()) / 86400000) : 0;
  if (tenureHave < tenureNeed) blockers.push({ key: 'tenure', msg: `tenure ${tenureHave}d < ${tenureNeed}d trong community`, need: tenureNeed, have: tenureHave });

  // 5. Value — global karma (overall standing) must clear the community's bar…
  const karmaNeed = x.habitat.minKarma || DEFAULT_LINK_FLOOR.karma;
  const karmaHave = x.karma ?? 0;
  if (karmaHave < karmaNeed) blockers.push({ key: 'value', msg: `karma ${karmaHave} < ${karmaNeed}`, need: karmaNeed, have: karmaHave });
  // …and our contribution HERE must not be net-negative (getting downvoted = not welcome yet).
  if (x.communityValue < 0) blockers.push({ key: 'community-value', msg: `đóng góp trong community đang âm (score ${x.communityValue}) — bài đang bị downvote`, have: x.communityValue });

  // 6. Track record — successful link-free seeds landed IN this community.
  const seedsNeed = x.habitat.minPosts || DEFAULT_LINK_FLOOR.seeds;
  if (x.successfulSeeds < seedsNeed) blockers.push({ key: 'seeds', msg: `seed thành công ${x.successfulSeeds} < ${seedsNeed} trong community`, need: seedsNeed, have: x.successfulSeeds });

  return { ok: blockers.length === 0, gated: true, blockers };
}

// ponytail: one runnable check for the branch/threshold logic. Run: npx tsx lib/link-readiness.ts
export function demo() {
  const base: LinkGateInputs = {
    nextPhase: 'seed', joinStatus: 'joined', joinedAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    karma: 400, communityValue: 30, successfulSeeds: 5, shadowbanned: false, suspended: false,
    habitat: { minKarma: 50, minAccountAgeDays: 30, minPosts: 3, linksAllowedAfter: '', privacy: 'public' },
  };
  const ok = computeLinkGate(base);
  console.assert(ok.ok && ok.gated, 'ready seed brief should pass');
  console.assert(computeLinkGate({ ...base, nextPhase: 'value' }).gated === false, 'value phase is not gated');
  console.assert(!computeLinkGate({ ...base, shadowbanned: true }).ok, 'shadowban must block');
  console.assert(!computeLinkGate({ ...base, joinStatus: 'not_joined' }).ok, 'not joined must block');
  console.assert(!computeLinkGate({ ...base, karma: 10 }).ok, 'low karma must block');
  console.assert(!computeLinkGate({ ...base, successfulSeeds: 1 }).ok, 'too few seeds must block');
  console.assert(!computeLinkGate({ ...base, joinedAt: new Date().toISOString() }).ok, 'no tenure must block');
  console.assert(!computeLinkGate({ ...base, communityValue: -5 }).ok, 'negative community value must block');
  console.assert(!computeLinkGate({ ...base, habitat: { ...base.habitat, linksAllowedAfter: 'never' } }).ok, 'links-banned community must block');
  console.assert(!computeLinkGate({ ...base, habitat: { ...base.habitat, linksAllowedAfter: 'est. contributor only, no self-links' } }).ok, 'no-self-links rule must block');
  console.assert(computeLinkGate({ ...base, habitat: { ...base.habitat, linksAllowedAfter: 'after 30 days' } }).ok, 'threshold-style links_allowed_after must NOT hard-block');
  console.log('link-readiness demo: all assertions passed');
}

// client-safe: only auto-runs when executed directly via tsx, never in a browser bundle
if (typeof process !== 'undefined' && process.argv?.[1] && import.meta.url === `file://${process.argv[1]}`) demo();
