// entity-cascade — ONE declarative map of "when an entity changes, what else goes stale".
//
// Before: every server action hand-listed its own revalidatePath/revalidateTag cluster
// (~250 call sites across ~45 files). Adding a surface that depends on, say, accounts meant
// hunting down every account-mutating action and editing its list — the dependency graph
// lived in the callers and drifted.
//
// After: a mutation says only WHAT it touched — `await touchEntity('account', { projectId })`
// — and THIS file owns WHERE that cascades. Add a dependent surface = edit ONE line here.
//
// Invariant: each entry is a SUPERSET of every call site that touched that kind. Over-busting
// a cache only costs a recompute; UNDER-busting shows stale UI. So when unsure, list more.
//
// Data-level cascades (a related ROW must change: junctions, counts, derived columns) do NOT
// belong here — those stay Postgres triggers/generated columns (e.g. sync_account_project,
// migration 0154), so no caller — app, Directus, or manual SQL — can forget them. This file is
// only the cache/UI-invalidation half.
//
// PURE DATA, client-safe: this file has NO next/cache import, so the /cascade page and the
// FlowDebug overlay ('3') can read ENTITY_DEPS in the browser. The next/cache-touching runtime
// (touchEntity + TouchCtx) lives in ./touch-entity — server-only. Do NOT merge them back:
// a client component importing the combined module broke static prerender of /_not-found.

export type EntityKind =
  | 'account' | 'offer' | 'brief' | 'seeding' | 'tribe' | 'card' | 'squad' | 'agent'
  | 'identity' | 'outreach' | 'platform' | 'technology' | 'project' | 'knowledge'
  | 'resource' | 'backlink' | 'publication' | 'scene' | 'team-member' | 'inbox'
  | 'library' | 'roadmap' | 'environment' | 'scheduler' | 'use-case' | 'unmapped'
  | 'alert' | 'ai' | 'content' | 'ext-token' | 'session' | 'plan' | 'pillar' | 'habitat'
  | 'followup';

export interface Dep {
  /** Project sub-sections → revalidatePath(`/p/${projectId}/${s}`). Needs ctx.projectId(s). */
  sections?: string[];
  /** Also bump the project overview → revalidatePath(`/p/${projectId}`). */
  self?: boolean;
  /** Absolute paths → revalidatePath(p). */
  paths?: string[];
  /** Route templates / layout pages → revalidatePath(p, 'page') (busts ALL dynamic instances). */
  pages?: string[];
  /** Cache tags → revalidateTag(t). */
  tags?: string[];
}

// SUPERSET of the historical revalidate clusters, keyed by the entity a mutation touches.
// Exported so /cascade can render the live cascade graph (it IS the verification surface).
// Cleaned 3 pre-existing dead targets a verify pass caught (each was a silent no-op — a
// revalidatePath to a route that doesn't exist — so removing them changes no behavior):
//   account.paths dropped '/accounts' (no app/accounts route; vault is client-fetched via API)
//   brief.sections dropped 'community' (no app/p/[id]/community folder)
//   publication.paths dropped '/p'  (app/p has no page.tsx; only /p/[id] and /p/new render)
export const ENTITY_DEPS: Record<EntityKind, Dep> = {
  account:      { sections: ['resources', 'seeding', 'tribes'], paths: ['/platforms'] },
  offer:        { tags: ['affiliate-offers'] },
  brief:        { sections: ['resources', 'seeding', 'tribes'] },
  seeding:      { sections: ['board', 'resources', 'seeding', 'tribes'] },
  tribe:        { sections: ['seeding', 'tribes'], pages: ['/p/[id]/tribes'], paths: ['/platforms', '/communities'] },
  pillar:       { sections: ['pillars'], paths: ['/architecture'] },
  habitat:      { sections: ['tribes', 'seeding'], pages: ['/p/[id]/tribes'], paths: ['/communities', '/platforms', '/architecture'] },
  card:         { sections: ['board'], self: true },
  squad:        { sections: ['board', 'squads'], self: true },
  agent:        { sections: ['squads'], paths: ['/agents'] },
  identity:     { sections: ['identities'] },
  outreach:     { sections: ['outreach'] },
  platform:     { paths: ['/platforms', '/architecture'], pages: ['/platforms', '/p/[id]/resources'] },
  technology:   { paths: ['/platforms'] },
  project:      { sections: ['board', 'settings', 'squads'], self: true, paths: ['/'] },
  knowledge:    { sections: ['resources'], paths: ['/knowledge'] },
  resource:     { sections: ['resources'] },
  backlink:     { sections: ['backlinks', 'plays'], pages: ['/p/[id]/backlinks', '/p/[id]/plays', '/plays'], paths: ['/catalog'] },
  publication:  { sections: ['publications'] },
  scene:        { paths: ['/architecture'], pages: ['/p/[id]/scenes'] },
  'team-member': { sections: ['resources'], paths: ['/', '/team', '/inbox'], pages: ['/p/[id]/backlinks', '/p/[id]/inbox'] },
  inbox:        { paths: ['/inbox'] },
  library:      { paths: ['/library'] },
  roadmap:      { paths: ['/roadmap'] },
  environment:  { paths: ['/architecture', '/environments'], pages: ['/p/[id]/resources'] },
  scheduler:    { paths: ['/scheduler'] },
  'use-case':   { paths: ['/tests'] },
  unmapped:     { sections: ['resources'], paths: ['/unmapped'] },
  alert:        { sections: ['board', 'resources', 'squads', 'tribes'], self: true },   // 'studio' đã xoá — bust route không tồn tại là no-op im lặng
  ai:           { sections: ['settings'], self: true, paths: ['/ai-log'] },
  content:      { sections: ['plays'], pages: ['/p/[id]/plays', '/plays'] },   // studio đã gộp vào /plays; trỏ 'studio' là bust một trang không còn ai xem trong khi lịch vẫn cũ
  'ext-token':  { paths: ['/architecture'] },
  session:      { paths: ['/'] },
  plan:         {},   // section is dynamic (`plans/${slug}`) → passed via ctx.sections
  followup:     { pages: ['/p/[id]/plays', '/plays', '/p/[id]/backlinks'] },   // deferred-work items ride the plays calendar
};

// The runtime that consumes this map — touchEntity + TouchCtx — lives in ./touch-entity
// (server-only, imports next/cache). Kept out of this file so ENTITY_DEPS stays client-safe.
