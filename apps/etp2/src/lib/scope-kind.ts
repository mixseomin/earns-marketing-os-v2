// Selector scope cascade tier + backward-compat normalizer.
//
// PLAIN module (NOT 'use server') on purpose: these are sync helpers. They used to
// live in lib/actions/habitat-selectors.ts, but a 'use server' file may only export
// async functions, so the sync const exports broke `next build`. Keep them here.
//
// scope_kind 'technology' is the canonical 3rd cascade tier (was legacy 'engine',
// renamed in mig 0101). Reads stay backward-compatible via these helpers.

export type ScopeKind = 'technology' | 'platform' | 'habitat';

// Legacy rows / un-updated ext requests may still carry 'engine'. Normalize incoming
// scope_kind through this before comparing/using so 'engine' resolves as 'technology'.
export const normScopeKind = (s: string): ScopeKind =>
  (s === 'engine' ? 'technology' : s) as ScopeKind;

// Stored scope_kind values a normalized scope matches — used in DB filters so a
// 'technology' filter also catches any un-migrated legacy 'engine' rows.
export const scopeKindMatch = (s: ScopeKind | string): string[] =>
  normScopeKind(s) === 'technology' ? ['technology', 'engine'] : [normScopeKind(s)];
