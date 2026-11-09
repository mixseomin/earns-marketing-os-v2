// touch-entity — the SERVER half of the entity cascade. Uses next/cache (revalidatePath/Tag),
// so it must NEVER be imported by a client component. The declarative map + types live in the
// client-safe ./entity-cascade (a debug overlay reads ENTITY_DEPS in the browser). Keeping the
// next/cache-touching code in a SEPARATE module is what lets that client import stay clean:
// importing the old combined file from a client component pulled next/cache into the client
// boundary and broke static prerender of /_not-found on the 2-CPU build host.

import { revalidatePath, revalidateTag } from 'next/cache';
import { ENTITY_DEPS, type EntityKind } from './entity-cascade';

export type { EntityKind } from './entity-cascade';

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
 * The fan-out (which sections/paths/tags) is declared in ENTITY_DEPS (./entity-cascade), not here.
 */
export async function touchEntity(kind: EntityKind, ctx: TouchCtx = {}): Promise<void> {
  const dep = ENTITY_DEPS[kind];
  if (!dep) return;
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
