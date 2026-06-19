'use server';

// Single authority for the "profile field" concept = the shared field NAME that
// links a SELECTOR (selector_overrides.field_name — how to find/fill an input,
// scoped platform/technology/habitat) with its per-account VALUE
// (platform_accounts.persona[name]). These are two stores on purpose (a selector
// is shared across every account on a platform; a value is per-account), but they
// share ONE canonical name. Renaming a field must move BOTH together — across
// every account on the platform — or the value strands (selector resolves to the
// new name while persona still holds the old key). This module is the only place
// that owns that cross-store operation, so future fixes touch one file.

import { getDb, platformAccounts, selectorOverrides } from '@mos2/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { canonField } from '../selector-field-canon';
import { setOverride, resolveSelectors, type ScopeKind, type SelectorSpec } from './habitat-selectors';
import { scopeKindMatch } from '@/lib/scope-kind';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

// persona keys that are config / identity-derived, not user-facing profile fields.
const HIDE_PERSONA = new Set([
  'identityId', 'humanizer', 'name_first', 'name_last', 'gender', 'country',
  'city', 'interests', 'backstory', 'voice_summary', 'narrative_style',
]);

// renameProfileField: rename a profile field everywhere it lives.
//  1) selector_overrides row at (scope, page) old→new via setOverride's renameFrom
//     (which also stops the CSS-identity guard folding new straight back onto old).
//  2) persona key old→new for EVERY account on the platform (one jsonb update) so
//     the value follows the name. Returns the name actually saved (may differ if
//     the guard folded new onto a third existing field) + how many accounts moved.
export async function renameProfileField(opts: {
  platformKey: string;
  pageKind: string;
  scopeKind: ScopeKind;
  scopeKey: string;
  oldName: string;
  newName: string;
}): Promise<{ ok: boolean; error?: string; savedName?: string; accountsTouched?: number; folded?: boolean }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  const oldCanon = canonField(opts.oldName, opts.pageKind);
  const newCanon = canonField(opts.newName, opts.pageKind);
  if (!newCanon) return { ok: false, error: 'newName empty after normalize' };
  if (!oldCanon || oldCanon === newCanon) {
    return { ok: true, savedName: newCanon, accountsTouched: 0, folded: false };
  }

  // 1) Selector rename — only if a selector exists for the old name at this scope.
  let savedName = newCanon;
  let folded = false;
  const [oldRow] = await db
    .select({ spec: selectorOverrides.spec })
    .from(selectorOverrides)
    .where(and(
      eq(selectorOverrides.tenantId, TENANT),
      inArray(selectorOverrides.scopeKind, scopeKindMatch(opts.scopeKind)),
      eq(selectorOverrides.scopeKey, opts.scopeKey),
      eq(selectorOverrides.pageKind, opts.pageKind),
      eq(selectorOverrides.fieldName, oldCanon),
    ))
    .limit(1);
  if (oldRow?.spec) {
    const res = await setOverride({
      scopeKind: opts.scopeKind,
      scopeKey: opts.scopeKey,
      pageKind: opts.pageKind,
      fieldName: newCanon,
      spec: oldRow.spec as SelectorSpec,
      source: 'manual',
      renameFrom: oldCanon,
    });
    if (!res.ok) return { ok: false, error: res.error || 'selector rename failed' };
    savedName = res.canonicalField || newCanon;
    folded = !!res.adopted;
  }

  // 2) Persona key rename across every account on the platform (value follows name).
  //    jsonb_exists() avoids the `?` operator clashing with bind placeholders.
  const upd = await db.execute(sql`
    UPDATE platform_accounts
    SET persona = (persona - ${oldCanon}::text)
                  || jsonb_build_object(${savedName}::text, persona -> ${oldCanon}::text),
        updated_at = NOW()
    WHERE platform_key = ${opts.platformKey}
      AND jsonb_exists(persona, ${oldCanon})
  `);
  const accountsTouched = (upd as { rowCount?: number }).rowCount ?? 0;

  revalidatePath('/platforms');
  revalidatePath('/accounts');
  return { ok: true, savedName, accountsTouched, folded };
}

// listProfileFields: the JOINED view. Every profile field for an account =
// its selector (css + scope, platform-resolved) UNION its persona value — one
// list so the dashboard stops showing selector and persona as two disconnected
// things. Hidden config/identity keys are excluded.
export async function listProfileFields(opts: {
  platformKey: string;
  accountId: number;
  pageKind: string;
}): Promise<Array<{ field: string; css: string | null; scope: ScopeKind | null; value: string | null; hasSelector: boolean }>> {
  const db = getDb();
  if (!db) return [];
  const resolved = await resolveSelectors({ platformKey: opts.platformKey, pageKind: opts.pageKind });
  const [acc] = await db
    .select({ persona: platformAccounts.persona })
    .from(platformAccounts)
    .where(eq(platformAccounts.id, opts.accountId))
    .limit(1);
  const persona = (acc?.persona as Record<string, unknown>) || {};

  const names = new Set<string>(Object.keys(resolved));
  for (const k of Object.keys(persona)) {
    if (HIDE_PERSONA.has(k)) continue;
    const v = persona[k];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') names.add(k);
  }

  return [...names].sort().map((field) => {
    const sel = resolved[field];
    const raw = persona[field];
    const value = (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') ? String(raw) : null;
    return { field, css: sel?.spec?.css ?? null, scope: sel?.source?.scope ?? null, value, hasSelector: !!sel };
  });
}
