'use server';

import { getDb, platformTechnologies, platforms, habitats } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export interface SignupField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'boolean' | 'phone' | 'email' | 'captcha' | 'info' | 'snippet';
  required: boolean;
  notes?: string;
  placeholder?: string;
  options?: string[];
  // For type='snippet' — content template inherited from platform.checklist
  template?: string;
  alt?: string[];
  maxLen?: number;
  source?: 'engine' | 'platform' | 'checklist';
  // Ràng buộc signup tích luỹ per-platform (lộ lúc submit, vd "password ≥15 ký tự") →
  // fill/gen khớp sẵn lần sau. notes = mô tả người đọc; min/max/pattern = structured.
  minLength?: number;
  maxLength?: number;
  pattern?: string;       // regex value phải khớp
}

export interface TechnologyRow {
  key: string;
  label: string;
  description: string;
  signupFields: SignupField[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(r: typeof platformTechnologies.$inferSelect): TechnologyRow {
  return {
    key: r.key,
    label: r.label,
    description: r.description,
    signupFields: (r.signupFields as SignupField[]) ?? [],
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listTechnologies(): Promise<TechnologyRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.select().from(platformTechnologies).orderBy(platformTechnologies.label);
  return rows.map(mapRow);
}

export async function getTechnology(key: string): Promise<TechnologyRow | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db.select().from(platformTechnologies).where(eq(platformTechnologies.key, key)).limit(1);
  return row ? mapRow(row) : null;
}

export async function upsertTechnology(input: {
  key: string;
  label: string;
  description?: string;
  signupFields?: SignupField[];
  notes?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  try {
    await db
      .insert(platformTechnologies)
      .values({
        key: input.key,
        label: input.label,
        description: input.description ?? '',
        signupFields: input.signupFields ?? [],
        notes: input.notes ?? null,
      })
      .onConflictDoUpdate({
        target: platformTechnologies.key,
        set: {
          label: input.label,
          description: input.description ?? '',
          signupFields: input.signupFields ?? [],
          notes: input.notes ?? null,
          updatedAt: new Date(),
        },
      });
    revalidatePath('/platforms');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Compute effective signup fields for a platform:
// merge(technology.signupFields, platform.signupFields)
// Platform fields with same key override technology defaults.
// Result is used in Account form pre-deployment section.
export async function getEffectiveSignupFields(platformKey: string): Promise<SignupField[]> {
  const db = getDb();
  if (!db) return [];

  const [pf] = await db
    .select({
      technologyKey: platforms.technologyKey,
      signupFields: platforms.signupFields,
      checklist: platforms.checklist,
    })
    .from(platforms)
    .where(eq(platforms.key, platformKey))
    .limit(1);
  if (!pf) return [];

  const platformFields = ((pf.signupFields as SignupField[]) ?? []).map((f) => ({ ...f, source: 'platform' as const }));

  let techFields: SignupField[] = [];
  if (pf.technologyKey) {
    const [tech] = await db
      .select({ signupFields: platformTechnologies.signupFields })
      .from(platformTechnologies)
      .where(eq(platformTechnologies.key, pf.technologyKey))
      .limit(1);
    if (tech) techFields = ((tech.signupFields as SignupField[]) ?? []).map((f) => ({ ...f, source: 'engine' as const }));
  }

  // Auto-derive snippet fields from platform.checklist (creating phase) so
  // user doesn't have to redefine HEADLINE/BIO/etc. The checklist remains
  // canonical; here we surface them as fields-to-prepare unified with engine
  // signup_fields.
  type ChkSnippet = { label: string; text: string; alt?: string[]; maxLen?: number };
  type ChkItem = { key: string; phase: string; tip?: string; snippets?: ChkSnippet[] };
  const checklist = (pf.checklist as ChkItem[]) ?? [];
  const snippetFields: SignupField[] = checklist
    .filter((it) => it.phase === 'creating' && (it.snippets?.length ?? 0) > 0)
    .flatMap((it) => (it.snippets ?? []).map((s) => ({
      key: s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label: s.label,
      type: 'snippet' as const,
      required: false,
      notes: it.tip,
      template: s.text,
      alt: s.alt,
      maxLen: s.maxLen,
      source: 'checklist' as const,
    })));

  // Merge order: engine defaults → platform overrides (by key) → checklist snippets
  const merged: SignupField[] = [...techFields];
  for (const pField of platformFields) {
    const idx = merged.findIndex((f) => f.key === pField.key);
    if (idx >= 0) merged[idx] = pField;
    else merged.push(pField);
  }
  for (const sField of snippetFields) {
    if (!merged.some((f) => f.key === sField.key)) merged.push(sField);
  }
  return merged;
}

// Same but for habitats (community can have its own tech)
export async function getEffectiveSignupFieldsForHabitat(habitatId: number): Promise<SignupField[]> {
  const db = getDb();
  if (!db) return [];

  const [h] = await db
    .select({ technologyKey: habitats.technologyKey, platformKey: habitats.platformKey })
    .from(habitats)
    .where(eq(habitats.id, habitatId))
    .limit(1);
  if (!h) return [];

  // Habitat's own tech takes priority; fall back to platform tech
  const techKey = h.technologyKey ?? null;
  if (techKey) {
    const [tech] = await db.select({ signupFields: platformTechnologies.signupFields })
      .from(platformTechnologies).where(eq(platformTechnologies.key, techKey)).limit(1);
    if (tech) return (tech.signupFields as SignupField[]) ?? [];
  }

  if (h.platformKey) return getEffectiveSignupFields(h.platformKey);
  return [];
}

// ── Technology auto-detection ──────────────────────────────────────────────
// Ported from astro-man extension PLATFORM_FINGERPRINTS.
// Server fetches the signup page HTML and scans for URL patterns, DOM class/id
// strings, and <meta name="generator"> content — same logic as the extension.

const FINGERPRINTS: Record<string, {
  url: RegExp[];
  html: string[];   // substrings to look for in raw HTML (class/id/attr names)
  meta: string[];   // meta generator content substrings
  mosKey: string;   // maps to our technology.key
}> = {
  phpbb:         { url: [/ucp\.php/, /viewforum\.php/, /viewtopic\.php/, /posting\.php/],    html: ['phpbb3', 'id="phpbb"', "id='phpbb'", 'class="phpbb'],    meta: [],           mosKey: 'phpbb' },
  vbulletin:     { url: [/showthread\.php/, /forumdisplay\.php/, /member\.php/],             html: ['vbmenu_control', 'vbulletin_css', 'vbulletin'],           meta: ['vBulletin'], mosKey: 'vbulletin' },
  xenforo:       { url: [/\/threads\//, /\/forums\//],                                       html: ['data-xf-init', 'p-nav', 'p-body', 'xenforo'],            meta: ['XenForo'],   mosKey: 'xenforo' },
  discourse:     { url: [],                                                                   html: ['d-header', 'discourse-setup', 'Ember.Application', 'data-ember-action'], meta: ['Discourse'], mosKey: 'discourse' },
  wordpress:     { url: [/wp-login\.php/, /wp-admin/, /\/wp-content\//],                    html: ['wp-core-ui', 'wpadminbar', 'wp-content', 'wpforms'],     meta: ['WordPress'],  mosKey: 'wordpress' },
  mybb:          { url: [/showthread\.php/, /member\.php/],                                  html: ['mybb_', 'class="navigation"', "id='panel'", 'id="panel"'], meta: ['MyBB'],   mosKey: 'mybb' },
  invisionpower: { url: [/\/topic\//, /\/forum\//],                                          html: ['ipsLayout', 'data-ipsquote', 'ipsApp', 'ipb_'],          meta: ['Invision', 'IPS Community'], mosKey: 'invisionpower' },
};

export async function detectTechnologyFromUrl(
  signupUrl: string,
): Promise<{ techKey: string | null; method: string; confidence: 'certain' | 'likely' | 'none' }> {
  if (!signupUrl?.trim()) return { techKey: null, method: 'no-url', confidence: 'none' };

  const url = signupUrl.trim();

  // 1. URL pattern match (fast, no fetch needed)
  for (const [, fp] of Object.entries(FINGERPRINTS)) {
    if (fp.url.some((re) => re.test(url))) {
      return { techKey: fp.mosKey, method: 'url-pattern', confidence: 'certain' };
    }
  }

  // 2. Fetch page HTML and scan for fingerprints
  let html = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOS2-Detector/1.0)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    html = await res.text();
    html = html.slice(0, 80_000); // scan first 80KB only
  } catch {
    return { techKey: null, method: 'fetch-failed', confidence: 'none' };
  }

  // 3. Meta generator check (most reliable when present)
  const metaMatch = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["']/i);
  const generator = metaMatch?.[1] ?? '';
  if (generator) {
    for (const [, fp] of Object.entries(FINGERPRINTS)) {
      if (fp.meta.some((m) => generator.includes(m))) {
        return { techKey: fp.mosKey, method: `meta-generator:${generator.slice(0, 40)}`, confidence: 'certain' };
      }
    }
  }

  // 4. HTML substring scan — count hits per engine, pick highest
  const scores: Record<string, number> = {};
  for (const [slug, fp] of Object.entries(FINGERPRINTS)) {
    scores[slug] = fp.html.filter((s) => html.includes(s)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) {
    return { techKey: FINGERPRINTS[best[0]]!.mosKey, method: `html-scan(${best[1]} hits)`, confidence: best[1] >= 3 ? 'certain' : 'likely' };
  }
  if (best && best[1] === 1) {
    return { techKey: FINGERPRINTS[best[0]]!.mosKey, method: `html-scan(1 hit)`, confidence: 'likely' };
  }

  return { techKey: null, method: 'no-match', confidence: 'none' };
}
