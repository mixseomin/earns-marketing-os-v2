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
// Server-only: reached from 'use server' action files. Not itself 'use server' (exports a type
// + const), and it lazy-imports next/cache so it never leaks into a client bundle.

export type EntityKind =
  | 'account' | 'offer' | 'brief' | 'seeding' | 'tribe' | 'card' | 'squad' | 'agent'
  | 'identity' | 'outreach' | 'platform' | 'technology' | 'project' | 'knowledge'
  | 'resource' | 'backlink' | 'publication' | 'scene' | 'team-member' | 'inbox'
  | 'library' | 'roadmap' | 'environment' | 'scheduler' | 'use-case' | 'unmapped'
  | 'alert' | 'ai' | 'content' | 'ext-token' | 'session' | 'plan';

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
  tribe:        { sections: ['seeding', 'tribes'], pages: ['/p/[id]/tribes'], paths: ['/platforms'] },
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
  scene:        { paths: ['/architecture'] },
  'team-member': { sections: ['resources'], paths: ['/', '/team', '/inbox'], pages: ['/p/[id]/backlinks', '/p/[id]/inbox'] },
  inbox:        { paths: ['/inbox'] },
  library:      { paths: ['/library'] },
  roadmap:      { paths: ['/roadmap'] },
  environment:  { paths: ['/architecture', '/environments'], pages: ['/p/[id]/resources'] },
  scheduler:    { paths: ['/scheduler'] },
  'use-case':   { paths: ['/tests'] },
  unmapped:     { sections: ['resources'], paths: ['/unmapped'] },
  alert:        { sections: ['board', 'resources', 'squads', 'studio', 'tribes'], self: true },
  ai:           { sections: ['settings'], self: true, paths: ['/ai-log'] },
  content:      { sections: ['studio'] },
  'ext-token':  { paths: ['/architecture'] },
  session:      { paths: ['/'] },
  plan:         {},   // section is dynamic (`plans/${slug}`) → passed via ctx.sections
};

export interface TouchCtx {
  /** The affected project (for project-scoped sections). */
  projectId?: string | null;
  /** Several projects at once (e.g. moving an account between projects — bust old + new). */
  projectIds?: (string | null | undefined)[];
  /** Extra one-off concrete sections for this call (e.g. `plans/${id}`). */
  sections?: string[];
  /** Extra one-off cache tags for this call (e.g. `account:${id}`). */
  tags?: string[];
}

/**
 * Cascade cache/UI invalidation for a mutated entity. Call ONCE at the end of a server action:
 *   await touchEntity('account', { projectId });
 *   await touchEntity('account', { projectIds: [oldProject, newProject] });   // moved
 * The fan-out (which sections/paths/tags) is declared in ENTITY_DEPS above, not here.
 */
export async function touchEntity(kind: EntityKind, ctx: TouchCtx = {}): Promise<void> {
  const dep = ENTITY_DEPS[kind];
  if (!dep) return;
  const { revalidatePath, revalidateTag } = await import('next/cache');
  const pids = (ctx.projectIds ?? [ctx.projectId]).filter((p): p is string => !!p);
  for (const pid of pids) {
    for (const s of dep.sections ?? []) revalidatePath(`/p/${pid}/${s}`);
    for (const s of ctx.sections ?? []) revalidatePath(`/p/${pid}/${s}`);
    if (dep.self) revalidatePath(`/p/${pid}`);
  }
  for (const p of dep.paths ?? []) revalidatePath(p);
  for (const p of dep.pages ?? []) revalidatePath(p, 'page');
  for (const t of dep.tags ?? []) revalidateTag(t);
  for (const t of ctx.tags ?? []) revalidateTag(t);
}
