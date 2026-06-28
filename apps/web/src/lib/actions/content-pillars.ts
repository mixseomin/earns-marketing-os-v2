'use server';

// Content Pillar System — macro content positioning per project.
// 1 project có 3-5 pillars (Educational depth / Personalized / Cultural bridge…).
// Mỗi card (blog/seeding/email/thread) link tới pillar → inherit voice +
// key_messages + forbidden + languages cho AI gen.
//
// Resolution order voice (mở rộng từ session trước):
//   card > channel.override > pillar > habitat > 'regular'

import { eq, and, sql } from 'drizzle-orm';
import { getDb, contentPillars, contentPillarTribes, projects } from '@mos2/db';
import { isValidVoiceProfile, type VoiceProfile, type FewShotExample } from '@/lib/ai/voice-profile';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export interface PillarExemplar {
  title?: string;
  link?: string;
  whyItWorks?: string;
}

export interface ContentPillarRow {
  id: number;
  projectId: string;
  slug: string;
  name: string;
  tagline: string;
  positioningMd: string;
  keyMessages: string[];
  forbiddenMsgs: string[];
  languages: string[];                  // ['en','vi','es']
  voiceProfile: VoiceProfile;
  voiceNotes: string;
  preferredTypes: string[];             // ['blog','thread','email','seed']
  exemplars: PillarExemplar[] | null;
  // few-shot examples re-use FewShotExample shape (compatibility với prompt builder)
  fewShotExamples?: FewShotExample[] | null;
  seoPillarUrl: string | null;
  seoKeywords: string[];
  // Map sang tag external (vd Astrolas content_pieces.pillar = 'education').
  // Khi push card sang Directus, MOS2 dùng tag này.
  externalTag: string | null;
  priority: number;
  status: string;                       // active|paused|archived
  tribeIds: number[];                   // M2M
  cardCount: number;                    // aggregated count of cards using this pillar
  createdAt: string;
  updatedAt: string;
}

export interface ContentPillarInput {
  slug?: string;
  name: string;
  tagline?: string;
  positioningMd?: string;
  keyMessages?: string[];
  forbiddenMsgs?: string[];
  languages?: string[];
  voiceProfile?: string;
  voiceNotes?: string;
  preferredTypes?: string[];
  exemplars?: PillarExemplar[] | null;
  seoPillarUrl?: string | null;
  seoKeywords?: string[];
  externalTag?: string | null;
  priority?: number;
  status?: string;
  tribeIds?: number[];                  // M2M write
}

function safeVoice(v: string | undefined | null): VoiceProfile {
  return v && isValidVoiceProfile(v) ? v : 'regular';
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]/g, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60);
}

export async function listContentPillars(projectId: string): Promise<ContentPillarRow[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT p.*,
           COALESCE(array_agg(DISTINCT pt.tribe_id) FILTER (WHERE pt.tribe_id IS NOT NULL), '{}') AS tribe_ids,
           (SELECT count(*) FROM cards WHERE pillar_id = p.id AND archived_at IS NULL) AS card_count
      FROM content_pillars p
      LEFT JOIN content_pillar_tribes pt ON pt.pillar_id = p.id
     WHERE p.project_id = ${projectId}
     GROUP BY p.id
     ORDER BY p.priority DESC, p.created_at ASC
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map(rowToPillar);
}

export async function getContentPillarById(projectId: string, id: number): Promise<ContentPillarRow | null> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT p.*,
           COALESCE(array_agg(DISTINCT pt.tribe_id) FILTER (WHERE pt.tribe_id IS NOT NULL), '{}') AS tribe_ids,
           (SELECT count(*) FROM cards WHERE pillar_id = p.id AND archived_at IS NULL) AS card_count
      FROM content_pillars p
      LEFT JOIN content_pillar_tribes pt ON pt.pillar_id = p.id
     WHERE p.id = ${id} AND p.project_id = ${projectId}
     GROUP BY p.id
     LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  return r ? rowToPillar(r) : null;
}

function rowToPillar(r: Record<string, unknown>): ContentPillarRow {
  const exemplars = Array.isArray(r.exemplars) ? (r.exemplars as PillarExemplar[]) : null;
  // exemplars cũng dùng cho few-shot prompt builder — map shape giống FewShotExample
  const fewShot = exemplars && exemplars.length > 0
    ? exemplars.filter((e) => e.title || e.whyItWorks).map((e) => ({
        title: e.title, body: e.whyItWorks ?? '', whyItWorks: e.whyItWorks,
      }))
    : null;
  return {
    id: Number(r.id),
    projectId: String(r.project_id),
    slug: String(r.slug),
    name: String(r.name),
    tagline: String(r.tagline ?? ''),
    positioningMd: String(r.positioning_md ?? ''),
    keyMessages: Array.isArray(r.key_messages) ? (r.key_messages as string[]) : [],
    forbiddenMsgs: Array.isArray(r.forbidden_msgs) ? (r.forbidden_msgs as string[]) : [],
    languages: Array.isArray(r.languages) ? (r.languages as string[]) : ['en'],
    voiceProfile: safeVoice(r.voice_profile as string),
    voiceNotes: String(r.voice_notes ?? ''),
    preferredTypes: Array.isArray(r.preferred_types) ? (r.preferred_types as string[]) : [],
    exemplars,
    fewShotExamples: fewShot,
    seoPillarUrl: r.seo_pillar_url ? String(r.seo_pillar_url) : null,
    seoKeywords: Array.isArray(r.seo_keywords) ? (r.seo_keywords as string[]) : [],
    externalTag: r.external_tag ? String(r.external_tag) : null,
    priority: Number(r.priority ?? 50),
    status: String(r.status ?? 'active'),
    tribeIds: Array.isArray(r.tribe_ids) ? (r.tribe_ids as number[]).map(Number).filter((n) => !isNaN(n)) : [],
    cardCount: Number(r.card_count ?? 0),
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : '',
    updatedAt: r.updated_at ? new Date(String(r.updated_at)).toISOString() : '',
  };
}

// "Biết thiếu để thêm" — coverage pillar TOÀN portfolio: mỗi project có mấy pillar + đã đăng bao nhiêu bài.
// none = 0 pillar (thiếu hẳn) · thin = 1-2 (mỏng) · ok ≥3. Sắp project thiếu/đăng-nhiều lên đầu (ưu tiên bổ sung).
export interface PillarCoverageRow { projectId: string; projectName: string; pillars: number; posted: number; status: 'none' | 'thin' | 'ok'; }
export async function pillarCoverage(): Promise<PillarCoverageRow[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const r = await db.execute(sql`
      SELECT pr.id, pr.name,
        (SELECT count(*)::int FROM content_pillars cp WHERE cp.project_id = pr.id AND COALESCE(cp.status,'') <> 'archived') AS pillars,
        (SELECT count(*)::int FROM cards c WHERE c.project_id = pr.id AND c.posted_at IS NOT NULL) AS posted
      FROM projects pr ORDER BY pillars ASC, posted DESC`);
    return (r as unknown as Array<Record<string, unknown>>).map((x) => {
      const pillars = Number(x.pillars ?? 0);
      return { projectId: String(x.id), projectName: String(x.name || x.id), pillars, posted: Number(x.posted ?? 0),
        status: (pillars === 0 ? 'none' : pillars < 3 ? 'thin' : 'ok') as PillarCoverageRow['status'] };
    });
  } catch { return []; }
}

// AI gợi ý 4-6 pillar cho 1 project (từ brand + website). save=true → tạo thật. DÙNG CHUNG cho
// route /api/ext/pillars/suggest và server action (drawer Pillar). "Làm sao biết thiếu để thêm".
export interface PillarSuggestion { name: string; tagline: string; keyMessages: string[]; }
export async function generatePillarSuggestions(
  projectId: string, save = false,
): Promise<{ ok: boolean; error?: string; suggested: PillarSuggestion[]; created: number; pillars: Array<{ id: number; name: string; tagline: string; keyMessages: string[]; slug: string }> }> {
  const fail = (error: string) => ({ ok: false, error, suggested: [], created: 0, pillars: [] });
  if (!aiEnabled()) return fail('OPENAI_API_KEY not set');
  const db = getDb(); if (!db) return fail('DB unavailable');
  projectId = (projectId ?? '').trim(); if (!projectId) return fail('projectId required');
  const [p] = await db.select({ name: projects.name, oneLiner: projects.oneLiner, persona: projects.persona, website: projects.website, contentStrategy: projects.contentStrategy })
    .from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return fail('project not found');

  let siteText = '';
  if (p.website) {
    try {
      const res = await fetch(p.website, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOS2-Pillars/1.0)' }, signal: AbortSignal.timeout(6000) });
      const html = await res.text();
      siteText = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3500);
    } catch { siteText = ''; }
  }
  const sysPrompt = `You are a content strategist. Define 4-6 CONTENT PILLARS (recurring topic groups) for this project's organic social presence. Output STRICT JSON:
{ "pillars": [ { "name": "...", "tagline": "...", "keyMessages": ["...","..."] }, ... ] }
- name: short pillar label (2-4 words), the topic group.
- tagline: one line on what this pillar covers / why it matters.
- keyMessages: 2-4 concrete angles/sub-topics under this pillar (each a short phrase a writer could turn into a post).
Cover distinct angles (educational, social-proof, behind-the-scenes, news/timely, community), grounded in what the project actually offers. ENGLISH. No em-dashes.`;
  const userPrompt = `# Project
Name: ${p.name}
One-liner: ${p.oneLiner || '(none)'}
Voice: ${p.persona || '(none)'}
Strategy: ${p.contentStrategy || '(none)'}
Website: ${p.website || '(none)'}

# Website content
${siteText || '(infer from name + one-liner)'}

# Task
Output STRICT JSON with 4-6 pillars.`;
  let suggested: PillarSuggestion[] = [];
  try {
    const ai = getOpenAI(); if (!ai) return fail('AI client unavailable');
    const completion = await ai.chat.completions.create({
      model: DEFAULT_MODEL, temperature: 0.7, max_tokens: 1100, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content?.trim() ?? '{}') as { pillars?: unknown };
    const arr = Array.isArray(parsed.pillars) ? parsed.pillars : [];
    suggested = arr.map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const km = Array.isArray(o.keyMessages) ? o.keyMessages.map((m) => String(m ?? '').trim()).filter(Boolean) : (typeof o.keyMessages === 'string' ? [String(o.keyMessages)] : []);
      return { name: String(o.name ?? '').trim(), tagline: String(o.tagline ?? '').trim(), keyMessages: km };
    }).filter((x) => x.name);
  } catch (e) { return fail(`AI error: ${(e as Error).message}`); }

  let created = 0;
  if (save && suggested.length) {
    for (const s of suggested) {
      try { const r = await createContentPillar(projectId, { name: s.name, tagline: s.tagline, keyMessages: s.keyMessages, positioningMd: '' }); if (r.ok) created++; } catch { /* skip dup */ }
    }
  }
  const pillars = ((await listContentPillars(projectId)) || [])
    .filter((p2) => (p2 as { status?: string }).status !== 'archived')
    .map((p2) => ({ id: p2.id, name: p2.name, tagline: p2.tagline, keyMessages: p2.keyMessages, slug: p2.slug }));
  return { ok: true, suggested, created, pillars };
}

export async function createContentPillar(
  projectId: string, input: ContentPillarInput,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!input.name?.trim()) return { ok: false, error: 'name required' };
  const db = ensureDb();
  const slug = input.slug?.trim() || slugify(input.name);
  if (!slug) return { ok: false, error: 'invalid slug' };
  // Check unique
  const existing = await db.execute(sql`
    SELECT id FROM content_pillars WHERE project_id = ${projectId} AND slug = ${slug} LIMIT 1
  `);
  if ((existing as unknown as Array<unknown>).length > 0) {
    return { ok: false, error: `slug '${slug}' đã tồn tại trong project` };
  }
  const inserted = await db.insert(contentPillars).values({
    tenantId: TENANT,
    projectId,
    slug,
    name: input.name.trim(),
    tagline: input.tagline ?? '',
    positioningMd: input.positioningMd ?? '',
    keyMessages: input.keyMessages ?? [],
    forbiddenMsgs: input.forbiddenMsgs ?? [],
    languages: input.languages ?? ['en'],
    voiceProfile: safeVoice(input.voiceProfile),
    voiceNotes: input.voiceNotes ?? '',
    preferredTypes: input.preferredTypes ?? [],
    exemplars: input.exemplars ?? null,
    seoPillarUrl: input.seoPillarUrl ?? null,
    seoKeywords: input.seoKeywords ?? [],
    externalTag: input.externalTag ?? null,
    priority: input.priority ?? 50,
    status: input.status ?? 'active',
  }).returning({ id: contentPillars.id });
  const newId = inserted[0]?.id;
  if (newId != null && input.tribeIds && input.tribeIds.length > 0) {
    await db.insert(contentPillarTribes).values(
      input.tribeIds.map((tribeId) => ({ pillarId: newId, tribeId })),
    ).onConflictDoNothing();
  }
  await flipBoardScoresStale(projectId);
  return { ok: true, id: newId };
}

// Seeding Radar: a pillar change invalidates this project's board topic-fit scores (lazy
// re-score on next /boards/score). Cheap UPDATE, no LLM. Guarded: board_project_score may
// be absent on environments behind migration 0107.
async function flipBoardScoresStale(projectId: string) {
  const db = getDb(); if (!db) return;
  try { await db.execute(sql`UPDATE board_project_score SET stale = true, updated_at = now() WHERE project_id = ${projectId} AND tenant_id = 'self' AND stale = false`); } catch { /* table absent pre-mig */ }
}

export async function updateContentPillar(
  projectId: string, id: number, patch: Partial<ContentPillarInput>,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name != null)            set.name = patch.name.trim();
  if (patch.slug != null)            set.slug = patch.slug.trim();
  if (patch.tagline != null)         set.tagline = patch.tagline;
  if (patch.positioningMd != null)   set.positioningMd = patch.positioningMd;
  if (patch.keyMessages != null)     set.keyMessages = patch.keyMessages;
  if (patch.forbiddenMsgs != null)   set.forbiddenMsgs = patch.forbiddenMsgs;
  if (patch.languages != null)       set.languages = patch.languages;
  if (patch.voiceProfile != null)    set.voiceProfile = safeVoice(patch.voiceProfile);
  if (patch.voiceNotes != null)      set.voiceNotes = patch.voiceNotes;
  if (patch.preferredTypes != null)  set.preferredTypes = patch.preferredTypes;
  if (patch.exemplars !== undefined) set.exemplars = patch.exemplars;
  if (patch.seoPillarUrl !== undefined) set.seoPillarUrl = patch.seoPillarUrl;
  if (patch.seoKeywords != null)     set.seoKeywords = patch.seoKeywords;
  if (patch.externalTag !== undefined) set.externalTag = patch.externalTag;
  if (patch.priority != null)        set.priority = patch.priority;
  if (patch.status != null)          set.status = patch.status;
  await db.update(contentPillars).set(set)
    .where(and(eq(contentPillars.id, id), eq(contentPillars.projectId, projectId)));
  // Tribes M2M (full replace)
  if (patch.tribeIds !== undefined) {
    await db.delete(contentPillarTribes).where(eq(contentPillarTribes.pillarId, id));
    if (patch.tribeIds.length > 0) {
      await db.insert(contentPillarTribes).values(
        patch.tribeIds.map((tribeId) => ({ pillarId: id, tribeId })),
      ).onConflictDoNothing();
    }
  }
  await flipBoardScoresStale(projectId);
  return { ok: true };
}

export async function deleteContentPillar(
  projectId: string, id: number,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.delete(contentPillars)
    .where(and(eq(contentPillars.id, id), eq(contentPillars.projectId, projectId)));
  // Cards.pillar_id → SET NULL (FK ON DELETE), không cần manual
  await flipBoardScoresStale(projectId);
  return { ok: true };
}

// Compact list cho pillar picker (cards header) — chỉ field cần để render.
export interface PillarPickerOption {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  voiceProfile: VoiceProfile;
  voiceIcon: string;
  voiceLabel: string;
  languages: string[];
  preferredTypes: string[];
  status: string;
  priority: number;
}

export async function listProjectPillarsCompact(projectId: string): Promise<PillarPickerOption[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT id, slug, name, tagline, voice_profile, languages, preferred_types, status, priority
      FROM content_pillars
     WHERE project_id = ${projectId} AND status != 'archived'
     ORDER BY priority DESC, created_at ASC
  `);
  // Inline import to avoid circular
  const { VOICE_PROFILE_META } = await import('@/lib/ai/voice-profile');
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => {
    const voice = safeVoice(r.voice_profile as string);
    const meta = VOICE_PROFILE_META[voice];
    return {
      id: Number(r.id),
      slug: String(r.slug),
      name: String(r.name),
      tagline: String(r.tagline ?? ''),
      voiceProfile: voice,
      voiceIcon: meta.icon,
      voiceLabel: meta.label,
      languages: Array.isArray(r.languages) ? (r.languages as string[]) : [],
      preferredTypes: Array.isArray(r.preferred_types) ? (r.preferred_types as string[]) : [],
      status: String(r.status),
      priority: Number(r.priority ?? 50),
    };
  });
}

// Lấy pillar context cho 1 card — dùng trong PillarPickerChip để show
// "đang dùng pillar X (kế thừa từ brief)" hoặc "(override)".
export interface CardPillarContext {
  projectId: string;
  cardPillarId: number | null;        // override cấp card
  briefPillarId: number | null;        // default từ brief
  effectivePillarId: number | null;
  targetLang: string;
  contentKind: string;
}
export async function getCardPillarContext(
  cardId: number,
): Promise<{ ok: true; ctx: CardPillarContext } | { ok: false; error: string }> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT c.project_id, c.pillar_id AS card_pillar_id, c.target_lang, c.content_kind,
           b.primary_pillar_id AS brief_pillar_id
      FROM cards c
      LEFT JOIN community_briefs b ON b.id = c.brief_id
     WHERE c.id = ${cardId}
     LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'card not found' };
  const cardPillarId = r.card_pillar_id ? Number(r.card_pillar_id) : null;
  const briefPillarId = r.brief_pillar_id ? Number(r.brief_pillar_id) : null;
  return {
    ok: true,
    ctx: {
      projectId: String(r.project_id),
      cardPillarId,
      briefPillarId,
      effectivePillarId: cardPillarId ?? briefPillarId,
      targetLang: String(r.target_lang ?? 'en'),
      contentKind: String(r.content_kind ?? 'seed'),
    },
  };
}

// Set pillar cho 1 card (manual override habitat default).
export async function setCardPillar(
  projectId: string, cardId: number, pillarId: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.execute(sql`
    UPDATE cards SET pillar_id = ${pillarId}, updated_at = now()
    WHERE id = ${cardId} AND project_id = ${projectId}
  `);
  return { ok: true };
}

// Set primary_pillar_id cho brief — mọi card mới tạo trong brief tự inherit.
export async function setBriefPrimaryPillar(
  projectId: string, briefId: number, pillarId: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.execute(sql`
    UPDATE community_briefs SET primary_pillar_id = ${pillarId}, updated_at = now()
    WHERE id = ${briefId} AND project_id = ${projectId}
  `);
  return { ok: true };
}
