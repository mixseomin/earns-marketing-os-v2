// Canonical field-name normalizer for selector_overrides.
//
// PROBLEM: field_name was free-text. The same physical input got different
// keys depending on which writer ran (LLM learn vs on-page train vs a typo):
//   custom_fields[Pronoun] · custom_fields_pronoun · pronous · pronoun
// → parallel duplicate rows that resolve to the same element.
//
// FIX: every write funnels through setOverride/setMap, which run canonField()
// first. Mechanical normalization handles bracket/case/separator noise;
// page-kind-scoped FIELD_ALIASES fold known synonyms/typos onto one key.
//
// Keep this the SINGLE source of truth — add an alias here, never special-case
// at a call site. Pair with the CSS-identity guard in habitat-selectors.ts
// (same css, different name → adopt existing) which catches what aliases can't.
//
// ⚠ Aliases are PER page_kind on purpose: `url` means community-link on
// 'subreddit-about' but profile-website on 'signup'. Never alias globally.

// page_kind → { mechanically-normalized variant : canonical key }.
// Lowercase keys, matched AFTER mechCanon(). Extend per page_kind.
export const FIELD_ALIASES: Record<string, Record<string, string>> = {
  signup: {
    pronous: 'custom_fields_pronoun',
    pronoun: 'custom_fields_pronoun',
    pronouns: 'custom_fields_pronoun',
    custom_fields_pronouns: 'custom_fields_pronoun',
    custom_fields_job: 'custom_fields_occupation',
    occupation: 'custom_fields_occupation',
    website: 'profile_website',
    url: 'profile_website',
    homepage: 'profile_website',
    aboutyou: 'about',
    about_you: 'about',
    bio: 'about',
    displayname: 'display_name',
    nickname: 'display_name',
    confirm_password: 'password_confirm',
    password2: 'password_confirm',
    passwordconfirm: 'password_confirm',
  },
};

// Mechanical normalize: trim → lowercase → strip wrapper noise →
// non-alnum runs become a single '_' → trim leading/trailing '_'.
// custom_fields[Pronoun] → custom_fields_pronoun ; "About You" → about_you
export function mechCanon(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[[\].()]/g, '_')   // brackets/parens → _
    .replace(/[^a-z0-9]+/g, '_') // any other non-alnum run → _
    .replace(/_+/g, '_')          // collapse repeats
    .replace(/^_+|_+$/g, '');     // trim edges
}

// DOM-structural selector fields are read VERBATIM by resolveSelectors() + buildDbAdapter() and
// the ext maps them CASE-SENSITIVELY (a.sel.postBtn / a.sel.replyAction by exact key). mechCanon
// would turn '.'→'_' (viewer.handle → viewer_handle), strip _adapter's leading underscore, AND
// lowercase camelCase (composer.postBtn → composer.postbtn) → consumer lookup MISSES (widget can't
// detect handle/author; "Học lại lưu đúng nhưng widget ko nhận" + the postBtn re-train regression).
// So they bypass canon and return VERBATIM (case preserved). Only FORM-INPUT fields (signup) get
// mechCanon + page-kind alias fold.
//   - dotted convention: composer.* / post.* / viewer.* / thread.* / parent.* / metric.*
const PRESERVE_DOTTED = /^(composer|post|viewer|thread|parent|metric)\.[a-z0-9_]+$/i;
//   - the whole 'composer' page_kind: every field is a selector entity name (incl non-dotted
//     camelCase like 'replyAction') that the ext maps by exact key.
const VERBATIM_PAGE_KINDS = new Set(['composer']);

// Full canonical: structural fields verbatim; form fields → mechanical + page-kind alias fold.
// Returns '' for empty input so callers can reject. Idempotent.
export function canonField(raw: string, pageKind?: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (t.toLowerCase() === '_adapter') return '_adapter';
  if ((pageKind && VERBATIM_PAGE_KINDS.has(pageKind)) || PRESERVE_DOTTED.test(t)) return t;
  const m = mechCanon(t);
  if (!m) return '';
  const aliases = pageKind ? FIELD_ALIASES[pageKind] : undefined;
  return aliases?.[m] ?? m;
}
