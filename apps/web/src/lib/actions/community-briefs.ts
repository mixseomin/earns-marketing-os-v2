'use server';

// Server actions for community_briefs — per (account × habitat) approach plan.
// See migration 0039_community_briefs.sql for shape + intent.

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, communityBriefs, platformAccounts, habitats, tribes } from '@mos2/db';
import { getHabitatById, type HabitatRow } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import type { Phase, PhaseEntry, PhaseHistoryEntry } from '@/lib/phase-plan';
import { defaultPhasePlanFor, PLANNED_PHASES } from '@/lib/phase-plan';
import {
  dbList, numField, nullNumField, dateField, reqDateField,
  textField, nullTextField, jsonArrayField,
  TENANT,
} from '@/lib/db-helpers';

// Local ensureDb still here for backward compat — db-helpers.ensureDb is the
// same function; keeping this local form unblocks the gradual migration.
function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export interface BriefTemplate {
  label: string;
  body: string;
}

// 0057 Join membership state — TÁCH HẲN khỏi engagement phase. Constants
// (label/color/icon) ở @/lib/join-status (không 'use server'). File này chỉ
// dùng type + parseJoinStatus helper qua import.
import { parseJoinStatus, type JoinStatus } from '@/lib/join-status';
export type { JoinStatus } from '@/lib/join-status';

export interface BriefRow {
  id: number;
  projectId: string;
  accountId: number;
  habitatId: number;
  approachMd: string;
  cadence: string;
  tone: string;
  doMd: string;
  dontMd: string;
  templates: BriefTemplate[];
  aiSuggestion: unknown | null;       // last generated, shape = BriefSuggestion
  aiSuggestionAt: string | null;
  currentPhase: Phase;
  phasePlan: PhaseEntry[];
  phaseHistory: PhaseHistoryEntry[];
  narrativeMd: string;
  // Default content pillar cho brief — mọi card mới tạo trong brief inherit.
  // NULL = no pillar default (cards có thể override per-card).
  primaryPillarId: number | null;
  // 0057: membership state (Discord/FB group/subreddit join state).
  // Phase warm-up chỉ active khi joinStatus='joined'. Seeding gate fail nếu
  // joinStatus ≠ 'joined'.
  joinStatus: JoinStatus;
  joinedAt: string | null;
  joinUrl: string | null;
  joinNote: string | null;
  updatedAt: string;
}

export interface BriefForAccount extends BriefRow {
  habitatName: string;
  habitatKind: string;
  habitatUrl: string | null;
  habitatMembers: number;
  tribeName: string | null;
}

export interface BriefForHabitat extends BriefRow {
  accountHandle: string | null;
  accountEmail: string | null;
  accountStatus: string;
  platformKey: string;
  platformLabel: string;
}

// ── Read ──────────────────────────────────────────────────────────

// Count distinct accounts that have a brief in any habitat of each tribe.
// Returns: { byTribe: { [tribeId]: count }, byHabitat: { [habitatId]: count }, allHabitats: number, untrackedTribe: number }
//   - byTribe: distinct accounts across all habitats of a given tribe
//   - byHabitat: brief count per habitat (= account count, since (account, habitat) is unique)
//   - allHabitats: distinct accounts across the entire project
//   - untrackedTribe: distinct accounts in habitats with no tribe link
export async function countAccountsPerTribe(projectId: string): Promise<{
  byTribe: Record<number, number>;
  byHabitat: Record<number, number>;
  allHabitats: number;
  untrackedTribe: number;
}> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT b.account_id, b.habitat_id, h.tribe_id
    FROM community_briefs b
    JOIN habitats h ON h.id = b.habitat_id
    WHERE b.tenant_id = ${TENANT} AND b.project_id = ${projectId}
  `);
  const list = rows as unknown as Array<{ account_id: number; habitat_id: number; tribe_id: number | null }>;

  const byTribeSet = new Map<number, Set<number>>();
  const byHabitatSet = new Map<number, Set<number>>();
  const allSet = new Set<number>();
  const untrackedSet = new Set<number>();

  for (const r of list) {
    allSet.add(Number(r.account_id));
    const hSet = byHabitatSet.get(Number(r.habitat_id)) ?? new Set<number>();
    hSet.add(Number(r.account_id));
    byHabitatSet.set(Number(r.habitat_id), hSet);
    if (r.tribe_id == null) {
      untrackedSet.add(Number(r.account_id));
    } else {
      const tSet = byTribeSet.get(Number(r.tribe_id)) ?? new Set<number>();
      tSet.add(Number(r.account_id));
      byTribeSet.set(Number(r.tribe_id), tSet);
    }
  }

  const byTribe: Record<number, number> = {};
  for (const [tid, s] of byTribeSet) byTribe[tid] = s.size;
  const byHabitat: Record<number, number> = {};
  for (const [hid, s] of byHabitatSet) byHabitat[hid] = s.size;

  return {
    byTribe,
    byHabitat,
    allHabitats: allSet.size,
    untrackedTribe: untrackedSet.size,
  };
}


function parsePhase(v: unknown): Phase {
  const s = typeof v === 'string' ? v : '';
  return (PLANNED_PHASES as readonly string[]).includes(s) || s === 'cooldown' || s === 'paused'
    ? (s as Phase)
    : 'warm-up';
}

function parsePhasePlan(v: unknown): PhaseEntry[] {
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is PhaseEntry => !!e && typeof e === 'object' && typeof (e as PhaseEntry).phase === 'string');
}

function parsePhaseHistory(v: unknown): PhaseHistoryEntry[] {
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is PhaseHistoryEntry => !!e && typeof e === 'object' && typeof (e as PhaseHistoryEntry).to === 'string');
}

export async function listBriefsForAccount(accountId: number): Promise<BriefForAccount[]> {
  // Migrated to db-helpers (2026-05-22 refactor) — pattern reference for the
  // other list*/get* functions in this file. Replace `db.execute + map` with
  // `dbList + field helpers`.
  return dbList(sql`
    SELECT
      b.id, b.project_id, b.account_id, b.habitat_id,
      b.approach_md, b.cadence, b.tone, b.do_md, b.dont_md, b.templates,
      b.ai_suggestion, b.ai_suggestion_at,
      b.current_phase, b.phase_plan, b.phase_history, b.narrative_md,
      b.primary_pillar_id,
      b.join_status, b.joined_at, b.join_url, b.join_note,
      b.updated_at,
      h.name AS habitat_name, h.kind AS habitat_kind, h.url AS habitat_url,
      h.members AS habitat_members,
      t.name AS tribe_name,
      pa.handle AS account_handle, p.label AS platform_label
    FROM community_briefs b
    JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN tribes t ON t.id = h.tribe_id
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    LEFT JOIN platforms p ON p.key = pa.platform_key
    WHERE b.tenant_id = ${TENANT} AND b.account_id = ${accountId}
    ORDER BY h.name ASC
  `, (r): BriefForAccount => ({
    id: numField(r.id),
    projectId: textField(r.project_id),
    accountId: numField(r.account_id),
    habitatId: numField(r.habitat_id),
    approachMd: textField(r.approach_md),
    cadence: textField(r.cadence),
    tone: textField(r.tone),
    doMd: textField(r.do_md),
    dontMd: textField(r.dont_md),
    templates: jsonArrayField<BriefTemplate>(r.templates),
    aiSuggestion: r.ai_suggestion ?? null,
    aiSuggestionAt: dateField(r.ai_suggestion_at),
    currentPhase: parsePhase(r.current_phase),
    phasePlan: parsePhasePlan(r.phase_plan),
    phaseHistory: parsePhaseHistory(r.phase_history),
    narrativeMd: textField(r.narrative_md),
    primaryPillarId: nullNumField(r.primary_pillar_id),
    joinStatus: parseJoinStatus(r.join_status),
    joinedAt: dateField(r.joined_at),
    joinUrl: nullTextField(r.join_url),
    joinNote: nullTextField(r.join_note),
    updatedAt: reqDateField(r.updated_at),
    habitatName: textField(r.habitat_name),
    habitatKind: textField(r.habitat_kind),
    habitatUrl: nullTextField(r.habitat_url),
    habitatMembers: numField(r.habitat_members),
    tribeName: nullTextField(r.tribe_name),
  }));
}

export async function listBriefsForHabitat(habitatId: number): Promise<BriefForHabitat[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT
      b.id, b.project_id, b.account_id, b.habitat_id,
      b.approach_md, b.cadence, b.tone, b.do_md, b.dont_md, b.templates,
      b.ai_suggestion, b.ai_suggestion_at,
      b.current_phase, b.phase_plan, b.phase_history, b.narrative_md,
      b.primary_pillar_id,
      b.join_status, b.joined_at, b.join_url, b.join_note,
      b.updated_at,
      pa.handle AS account_handle, pa.email AS account_email, pa.status AS account_status,
      pa.platform_key,
      p.label AS platform_label,
      h.name AS habitat_name, h.kind AS habitat_kind
    FROM community_briefs b
    JOIN platform_accounts pa ON pa.id = b.account_id
    JOIN platforms p ON p.key = pa.platform_key
    LEFT JOIN habitats h ON h.id = b.habitat_id
    WHERE b.tenant_id = ${TENANT} AND b.habitat_id = ${habitatId}
    ORDER BY pa.handle ASC NULLS LAST
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    projectId: String(r.project_id),
    accountId: Number(r.account_id),
    habitatId: Number(r.habitat_id),
    approachMd: String(r.approach_md ?? ''),
    cadence: String(r.cadence ?? ''),
    tone: String(r.tone ?? ''),
    doMd: String(r.do_md ?? ''),
    dontMd: String(r.dont_md ?? ''),
    templates: (r.templates as BriefTemplate[]) ?? [],
    aiSuggestion: r.ai_suggestion ?? null,
    aiSuggestionAt: r.ai_suggestion_at instanceof Date ? r.ai_suggestion_at.toISOString() : (r.ai_suggestion_at ? String(r.ai_suggestion_at) : null),
    currentPhase: parsePhase(r.current_phase),
    phasePlan: parsePhasePlan(r.phase_plan),
    phaseHistory: parsePhaseHistory(r.phase_history),
    narrativeMd: String(r.narrative_md ?? ''),
    primaryPillarId: r.primary_pillar_id != null ? Number(r.primary_pillar_id) : null,
    joinStatus: parseJoinStatus(r.join_status),
    joinedAt: r.joined_at instanceof Date ? r.joined_at.toISOString() : (r.joined_at ? String(r.joined_at) : null),
    joinUrl: r.join_url ? String(r.join_url) : null,
    joinNote: r.join_note ? String(r.join_note) : null,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    accountHandle: r.account_handle ? String(r.account_handle) : null,
    accountEmail: r.account_email ? String(r.account_email) : null,
    accountStatus: String(r.account_status ?? 'todo'),
    platformKey: String(r.platform_key ?? ''),
    platformLabel: String(r.platform_label ?? ''),
  }));
}

// Single brief by id (for opening BriefEditModal in-place from Seeding
// Cockpit without navigating away). Returns null if not in project.
export async function getBriefRow(projectId: string, briefId: number): Promise<BriefRow | null> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT b.id, b.project_id, b.account_id, b.habitat_id,
           b.approach_md, b.cadence, b.tone, b.do_md, b.dont_md, b.templates,
           b.ai_suggestion, b.ai_suggestion_at,
           b.current_phase, b.phase_plan, b.phase_history, b.narrative_md,
           b.primary_pillar_id,
           b.join_status, b.joined_at, b.join_url, b.join_note,
           b.updated_at
    FROM community_briefs b
    WHERE b.tenant_id = ${TENANT} AND b.id = ${briefId} AND b.project_id = ${projectId}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    projectId: String(r.project_id),
    accountId: Number(r.account_id),
    habitatId: Number(r.habitat_id),
    approachMd: String(r.approach_md ?? ''),
    cadence: String(r.cadence ?? ''),
    tone: String(r.tone ?? ''),
    doMd: String(r.do_md ?? ''),
    dontMd: String(r.dont_md ?? ''),
    templates: (r.templates as BriefTemplate[]) ?? [],
    aiSuggestion: r.ai_suggestion ?? null,
    aiSuggestionAt: r.ai_suggestion_at instanceof Date ? r.ai_suggestion_at.toISOString() : (r.ai_suggestion_at ? String(r.ai_suggestion_at) : null),
    currentPhase: parsePhase(r.current_phase),
    phasePlan: parsePhasePlan(r.phase_plan),
    phaseHistory: parsePhaseHistory(r.phase_history),
    narrativeMd: String(r.narrative_md ?? ''),
    primaryPillarId: r.primary_pillar_id != null ? Number(r.primary_pillar_id) : null,
    joinStatus: parseJoinStatus(r.join_status),
    joinedAt: r.joined_at instanceof Date ? r.joined_at.toISOString() : (r.joined_at ? String(r.joined_at) : null),
    joinUrl: r.join_url ? String(r.join_url) : null,
    joinNote: r.join_note ? String(r.join_note) : null,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

// Gộp getBriefRow + getBriefModalCtx thành 1 server action — modal mở cần
// CẢ row (form fields) lẫn ctx (label header + habitat url). 1 SELECT JOIN
// = 1 round-trip thay vì 2 Promise.all → modal mở nhanh gấp đôi (server
// action serialization + RSC framing là phần đắt, không phải SQL).
export async function getBriefForModal(
  projectId: string, briefId: number,
): Promise<{
  row: BriefRow;
  ctx: BriefModalCtx;
  phaseCounts: Record<string, number>;
  // Breakdown count theo (phase, content_type) — UI Overview roadmap dùng để
  // vẽ actual mix bar so với target mix; thay cho việc fetch từng list bài.
  phaseTypeCounts: Record<string, Record<string, number>>;
  // Channels của habitat (chỉ có cho Discord/Slack/Telegram). UI dùng để
  // picker per-post + hiển thị channel rules.
  channels: Array<{
    id: number; name: string; url: string | null; description: string;
    rules: string; allowedFormats: string[] | null;
  }>;
} | null> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT b.id, b.project_id, b.account_id, b.habitat_id,
           b.approach_md, b.cadence, b.tone, b.do_md, b.dont_md, b.templates,
           b.ai_suggestion, b.ai_suggestion_at,
           b.current_phase, b.phase_plan, b.phase_history, b.narrative_md,
           b.primary_pillar_id,
           b.join_status, b.joined_at, b.join_url, b.join_note,
           b.updated_at,
           pa.handle AS account_handle, pa.platform_key AS platform_key,
           pa.status AS account_status, pa.block_reason AS account_block_reason,
           p.label AS platform_label, p.category AS platform_category,
           p.allowed_formats AS platform_allowed_formats,
           h.name AS habitat_name, h.kind AS habitat_kind, h.url AS habitat_url,
           h.allowed_formats_override AS habitat_allowed_formats_override
    FROM community_briefs b
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    LEFT JOIN platforms p ON p.key = pa.platform_key
    LEFT JOIN habitats h ON h.id = b.habitat_id
    WHERE b.tenant_id = ${TENANT} AND b.id = ${briefId} AND b.project_id = ${projectId}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return null;
  // Số bài THỰC CÓ theo phase + breakdown theo content_type — 1 query group
  // BY (phase, type) rồi build cả 2 cấu trúc (tổng phase + breakdown). Cùng
  // round-trip server action.
  const countRows = await db.execute(sql`
    SELECT brief_phase AS phase, coalesce(content_type, 'text') AS ct, count(*)::int AS n
      FROM cards
     WHERE brief_id = ${briefId} AND brief_phase IS NOT NULL
       AND archived_at IS NULL
     GROUP BY brief_phase, content_type
  `);
  const phaseCounts: Record<string, number> = {};
  const phaseTypeCounts: Record<string, Record<string, number>> = {};
  for (const c of (countRows as unknown as Array<{ phase: string; ct: string; n: number }>)) {
    const ph = String(c.phase);
    const ct = String(c.ct);
    phaseCounts[ph] = (phaseCounts[ph] ?? 0) + Number(c.n);
    if (!phaseTypeCounts[ph]) phaseTypeCounts[ph] = {};
    phaseTypeCounts[ph][ct] = (phaseTypeCounts[ph][ct] ?? 0) + Number(c.n);
  }
  const row: BriefRow = {
    id: Number(r.id),
    projectId: String(r.project_id),
    accountId: Number(r.account_id),
    habitatId: Number(r.habitat_id),
    approachMd: String(r.approach_md ?? ''),
    cadence: String(r.cadence ?? ''),
    tone: String(r.tone ?? ''),
    doMd: String(r.do_md ?? ''),
    dontMd: String(r.dont_md ?? ''),
    templates: (r.templates as BriefTemplate[]) ?? [],
    aiSuggestion: r.ai_suggestion ?? null,
    aiSuggestionAt: r.ai_suggestion_at instanceof Date ? r.ai_suggestion_at.toISOString() : (r.ai_suggestion_at ? String(r.ai_suggestion_at) : null),
    currentPhase: parsePhase(r.current_phase),
    phasePlan: parsePhasePlan(r.phase_plan),
    phaseHistory: parsePhaseHistory(r.phase_history),
    narrativeMd: String(r.narrative_md ?? ''),
    primaryPillarId: r.primary_pillar_id != null ? Number(r.primary_pillar_id) : null,
    joinStatus: parseJoinStatus(r.join_status),
    joinedAt: r.joined_at instanceof Date ? r.joined_at.toISOString() : (r.joined_at ? String(r.joined_at) : null),
    joinUrl: r.join_url ? String(r.join_url) : null,
    joinNote: r.join_note ? String(r.join_note) : null,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
  const handle = r.account_handle ? String(r.account_handle) : 'no-handle';
  const plat = String(r.platform_label ?? '');
  const hname = String(r.habitat_name ?? `Habitat #${r.habitat_id}`);
  const hkind = String(r.habitat_kind ?? '');
  const ctx: BriefModalCtx = {
    accountId: Number(r.account_id),
    habitatId: Number(r.habitat_id),
    accountLabel: plat ? `@${handle} · ${plat}` : `@${handle}`,
    habitatLabel: hkind ? `${hname} · ${hkind}` : hname,
    habitatUrl: r.habitat_url ? String(r.habitat_url) : null,
    habitatKind: hkind,
    platformKey: String(r.platform_key ?? ''),
    platformCategory: String(r.platform_category ?? ''),
    platformAllowedFormats: Array.isArray(r.platform_allowed_formats) ? (r.platform_allowed_formats as string[]) : null,
    habitatAllowedFormats: Array.isArray(r.habitat_allowed_formats_override) ? (r.habitat_allowed_formats_override as string[]) : null,
    accountStatus: String(r.account_status ?? 'active'),
    accountBlockReason: r.account_block_reason ? String(r.account_block_reason) : null,
  };
  // Load channels của habitat — chỉ phải SELECT 1 lần khi mở modal, client
  // dùng để render channel picker per-post.
  const chRows = await db.execute(sql`
    SELECT id, name, url, description, rules, allowed_formats
      FROM habitat_channels
     WHERE habitat_id = ${Number(r.habitat_id)}
     ORDER BY sort_order ASC, id ASC
  `);
  const channels = (chRows as unknown as Array<Record<string, unknown>>).map((c) => ({
    id: Number(c.id),
    name: String(c.name),
    url: c.url ? String(c.url) : null,
    description: String(c.description ?? ''),
    rules: String(c.rules ?? ''),
    allowedFormats: Array.isArray(c.allowed_formats) ? (c.allowed_formats as string[]) : null,
  }));

  return { row, ctx, phaseCounts, phaseTypeCounts, channels };
}

// Server action wrapper cho getHabitatById — client component (BriefModalLoader
// gọi khi user click chip habitat ở header để mở HabitatFormModal).
export async function getHabitatRowAction(projectId: string, habitatId: number): Promise<HabitatRow | null> {
  return getHabitatById(projectId, habitatId);
}

// Context (ids + nhãn hiển thị) để mở BriefEditModal ĐỘC LẬP với seeding
// queue — F5 / deep-link ?m=brief&mId=<briefId> luôn mở được kể cả brief
// không có lane seeding.
export interface BriefModalCtx {
  accountId: number;
  habitatId: number;
  accountLabel: string;     // "@handle · Platform"
  habitatLabel: string;     // "Habitat · kind"
  habitatUrl: string | null; // link tới community để mở ra đăng thật
  habitatKind: string;      // discord/subreddit/fb-group/... để chọn favicon fallback
  platformKey: string;      // để lọc content formats hợp lệ (allowedFormats)
  platformCategory: string;
  // Override DB cho content formats. null/empty = fallback hardcoded.
  platformAllowedFormats: string[] | null;
  habitatAllowedFormats: string[] | null;
  // Account status để hiển thị pill ở header (active/warming/banned/dormant...)
  accountStatus: string;
  accountBlockReason: string | null;
}
// (getBriefModalCtx legacy — đã thay bằng getBriefForModal trả gộp row+ctx
// trong 1 round-trip. Không còn ai gọi.)

// ── Persona voice (read) ──────────────────────────────────────────

export interface PersonaVoice {
  nameFirst?: string;
  nameLast?: string;
  voiceSummary?: string;       // 1-line voice DNA (e.g. "warm story-driven")
  narrativeStyle?: string;     // "memoir" | "academic" | "data-driven" | ...
  backstory?: string;
  interests?: string[];
}

// Read account.persona JSONB and expose the voice-shaping subset. Returns
// null if account has no persona.
export async function getAccountPersonaVoice(accountId: number): Promise<PersonaVoice | null> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT persona FROM platform_accounts WHERE id = ${accountId} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return null;
  const p = r.persona as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return null;
  return {
    nameFirst: typeof p.name_first === 'string' ? p.name_first : undefined,
    nameLast: typeof p.name_last === 'string' ? p.name_last : undefined,
    voiceSummary: typeof p.voice_summary === 'string' ? p.voice_summary : undefined,
    narrativeStyle: typeof p.narrative_style === 'string' ? p.narrative_style : undefined,
    backstory: typeof p.backstory === 'string' ? p.backstory : undefined,
    interests: Array.isArray(p.interests) ? (p.interests as unknown[]).filter((x): x is string => typeof x === 'string') : undefined,
  };
}

// ── Phase helpers (read) ──────────────────────────────────────────

// Return the current phase per habitat across all briefs for a project.
// Used by TribesRealPage to render a phase pill on each habitat card.
// If multiple briefs in same habitat have different phases, prefer the
// LOWEST phase (most cautious - warm-up < value < bridge < seed < direct).
// cooldown/paused are surfaced as-is when ALL briefs are in those states.
export async function listHabitatPhases(projectId: string): Promise<Record<number, Phase>> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT habitat_id, current_phase
    FROM community_briefs
    WHERE tenant_id = ${TENANT} AND project_id = ${projectId}
  `);
  const list = rows as unknown as Array<{ habitat_id: number; current_phase: string }>;
  const order: Record<string, number> = { 'warm-up': 0, value: 1, bridge: 2, seed: 3, direct: 4 };
  const byHabitat: Record<number, Phase> = {};
  for (const r of list) {
    const hid = Number(r.habitat_id);
    const p = parsePhase(r.current_phase);
    const cur = byHabitat[hid];
    if (cur == null) { byHabitat[hid] = p; continue; }
    // cooldown / paused: keep if all are; otherwise prefer normal phase
    const curOrder = order[cur] ?? 99;
    const newOrder = order[p] ?? 99;
    if (newOrder < curOrder) byHabitat[hid] = p;
  }
  return byHabitat;
}

// ── Project-wide brief tree (Hierarchy view) ──────────────────────
// Tribe → Habitat → (account, brief) nested for the Tree view-mode on
// the Tribes page. Habitats with no tribe are grouped under a synthetic
// "Chưa gắn tribe" node (tribeId=null). Habitats with no briefs still
// appear (empty accounts[]) so the user sees coverage gaps.

export interface BriefTreeAccount {
  briefId: number;
  accountId: number;
  handle: string;
  platformLabel: string;
  accountStatus: string;
  currentPhase: Phase;
  nextPhase: Phase | null;   // next PLANNED phase after currentPhase
  postCount: number;
  // seeding schedule snapshot (null = no schedule yet for this brief)
  seeding: {
    status: 'overdue' | 'due' | 'upcoming' | 'paused' | 'off-phase';
    daysUntilDue: number;
    frequencyDays: number;
  } | null;
}
export interface BriefTreeHabitat {
  id: number;
  name: string;
  kind: string;
  url: string | null;
  status: string;
  otherTribeNames: string[];   // secondary tribes (M2M, excludes primary)
  accounts: BriefTreeAccount[];
}
export interface BriefTreeTribe {
  id: number | null;         // null = habitats not linked to any tribe
  name: string;
  lifecycle: string;
  habitats: BriefTreeHabitat[];
}

export async function listProjectBriefTree(projectId: string): Promise<BriefTreeTribe[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT
      h.id AS habitat_id, h.name AS habitat_name, h.kind AS habitat_kind,
      h.status AS habitat_status, h.url AS habitat_url, h.tribe_id AS tribe_id,
      t.name AS tribe_name, t.lifecycle AS tribe_lifecycle,
      (SELECT array_agg(t2.name ORDER BY t2.name)
         FROM habitat_tribes ht2 JOIN tribes t2 ON t2.id = ht2.tribe_id
         WHERE ht2.habitat_id = h.id AND ht2.is_primary = false) AS other_tribe_names,
      b.id AS brief_id, b.account_id, b.current_phase,
      pa.handle AS account_handle, pa.status AS account_status,
      p.label AS platform_label,
      (SELECT count(*)::int FROM cards c WHERE c.brief_id = b.id) AS post_count,
      ss.id AS sched_id, ss.frequency_days AS sched_freq, ss.active_phases AS sched_phases,
      ss.paused AS sched_paused, ss.last_seeded_at AS sched_last, ss.created_at AS sched_created
    FROM habitats h
    LEFT JOIN tribes t ON t.id = h.tribe_id
    LEFT JOIN community_briefs b ON b.habitat_id = h.id AND b.tenant_id = ${TENANT}
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    LEFT JOIN platforms p ON p.key = pa.platform_key
    LEFT JOIN seeding_schedules ss ON ss.brief_id = b.id
    WHERE h.tenant_id = ${TENANT} AND h.project_id = ${projectId}
    ORDER BY t.name ASC NULLS LAST, h.name ASC, pa.handle ASC NULLS LAST
  `);
  const list = rows as unknown as Array<Record<string, unknown>>;

  const tribeMap = new Map<string, BriefTreeTribe>();
  const habMap = new Map<number, BriefTreeHabitat>();

  for (const r of list) {
    const tribeId = r.tribe_id == null ? null : Number(r.tribe_id);
    const tKey = tribeId == null ? 'none' : String(tribeId);
    let tribe = tribeMap.get(tKey);
    if (!tribe) {
      tribe = {
        id: tribeId,
        name: tribeId == null ? 'Chưa gắn tribe' : String(r.tribe_name ?? `Tribe #${tribeId}`),
        lifecycle: tribeId == null ? '' : String(r.tribe_lifecycle ?? ''),
        habitats: [],
      };
      tribeMap.set(tKey, tribe);
    }

    const hid = Number(r.habitat_id);
    let hab = habMap.get(hid);
    if (!hab) {
      const others = r.other_tribe_names;
      hab = {
        id: hid,
        name: String(r.habitat_name ?? `Habitat #${hid}`),
        kind: String(r.habitat_kind ?? 'forum'),
        url: r.habitat_url ? String(r.habitat_url) : null,
        status: String(r.habitat_status ?? 'target'),
        otherTribeNames: Array.isArray(others) ? others.map((x) => String(x)) : [],
        accounts: [],
      };
      habMap.set(hid, hab);
      tribe.habitats.push(hab);
    }

    if (r.brief_id != null) {
      const cur = parsePhase(r.current_phase);
      const i = PLANNED_PHASES.indexOf(cur);
      // seeding snapshot (compute-on-read, mirrors lib/actions/seeding.ts)
      let seeding: BriefTreeAccount['seeding'] = null;
      if (r.sched_id != null) {
        const DAY = 86_400_000;
        const freq = Math.max(1, Number(r.sched_freq ?? 3));
        const base = r.sched_last ? new Date(String(r.sched_last)) : new Date(String(r.sched_created));
        const nextDueMs = base.getTime() + freq * DAY;
        const now = Date.now();
        const active = Array.isArray(r.sched_phases)
          ? (r.sched_phases as unknown[]).map(String)
          : [];
        let status: NonNullable<BriefTreeAccount['seeding']>['status'];
        if (r.sched_paused) status = 'paused';
        else if (active.length > 0 && !active.includes(cur)) status = 'off-phase';
        else if (now >= nextDueMs + freq * DAY * 2) status = 'overdue';
        else if (now >= nextDueMs) status = 'due';
        else status = 'upcoming';
        seeding = { status, daysUntilDue: Math.round((nextDueMs - now) / DAY), frequencyDays: freq };
      }
      hab.accounts.push({
        briefId: Number(r.brief_id),
        accountId: Number(r.account_id),
        handle: r.account_handle ? String(r.account_handle) : 'no-handle',
        platformLabel: String(r.platform_label ?? ''),
        accountStatus: String(r.account_status ?? 'todo'),
        currentPhase: cur,
        nextPhase: i >= 0 && i < PLANNED_PHASES.length - 1 ? (PLANNED_PHASES[i + 1] ?? null) : null,
        postCount: Number(r.post_count ?? 0),
        seeding,
      });
    }
  }

  // Defunct tribes / habitats sink to the bottom; "Chưa gắn tribe" last.
  return Array.from(tribeMap.values()).sort((a, b) => {
    if ((a.id == null) !== (b.id == null)) return a.id == null ? 1 : -1;
    const ad = a.lifecycle === 'defunct' ? 1 : 0;
    const bd = b.lifecycle === 'defunct' ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name);
  });
}

// Habitats this account COULD engage in but doesn't have a brief yet.
// Filtered to project + same platform_key (we only post the same platform
// with the same account — Reddit handle on r/* habitats, not FB groups).
export async function listAddableHabitatsForAccount(
  projectId: string, accountId: number,
): Promise<Array<{ id: number; name: string; kind: string; url: string | null; tribeName: string | null }>> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT h.id, h.name, h.kind, h.url, t.name AS tribe_name
    FROM habitats h
    LEFT JOIN tribes t ON t.id = h.tribe_id
    WHERE h.tenant_id = ${TENANT} AND h.project_id = ${projectId}
      AND NOT EXISTS (
        SELECT 1 FROM community_briefs b
        WHERE b.account_id = ${accountId} AND b.habitat_id = h.id
      )
    ORDER BY h.name ASC
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ''),
    kind: String(r.kind ?? ''),
    url: r.url ? String(r.url) : null,
    tribeName: r.tribe_name ? String(r.tribe_name) : null,
  }));
}

// Accounts this habitat COULD have a brief from but doesn't yet.
// Filtered to accounts on platforms matching habitat.kind (subreddit →
// reddit accounts only). Pass platformKeys=null to skip the filter
// (used when caller already knows the kind is platform-agnostic).
export async function listAddableAccountsForHabitat(
  projectId: string, habitatId: number, platformKeys: string[] | null,
): Promise<Array<{ id: number; handle: string | null; status: string; platformKey: string; platformLabel: string }>> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT pa.id, pa.handle, pa.status, pa.platform_key, p.label AS platform_label
    FROM platform_accounts pa
    JOIN platforms p ON p.key = pa.platform_key
    JOIN project_accounts pj ON pj.account_id = pa.id AND pj.project_id = ${projectId}
    WHERE pa.tenant_id = ${TENANT}
      ${platformKeys && platformKeys.length > 0
        ? sql`AND pa.platform_key IN (${sql.join(platformKeys.map((k) => sql`${k}`), sql`, `)})`
        : sql``}
      AND NOT EXISTS (
        SELECT 1 FROM community_briefs b
        WHERE b.habitat_id = ${habitatId} AND b.account_id = pa.id
      )
    ORDER BY pa.handle ASC NULLS LAST
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    handle: r.handle ? String(r.handle) : null,
    status: String(r.status ?? 'todo'),
    platformKey: String(r.platform_key ?? ''),
    platformLabel: String(r.platform_label ?? ''),
  }));
}

// 0058 fix: listSwappableAccountsForBrief — pick accounts ACTIVE đã có sẵn
// trên platform same habitat (chưa có brief với habitat này) để user re-assign
// brief sang account khác thay vì phải tạo account mới.
//
// Use case: brief đang dùng account 'todo' (chưa tạo) → user muốn swap sang
// account đã active sẵn để start seeding ngay.
//
// Filter:
//   - account active (todo/creating/blocked/banned excluded — không dùng được)
//   - same project (qua project_accounts pivot)
//   - platform_key match habitat.platform_key (Reddit account không assign
//     vào Discord habitat)
//   - account chưa có brief với habitat_id này
export async function listSwappableAccountsForBrief(
  projectId: string, briefId: number,
): Promise<Array<{ id: number; handle: string | null; status: string; platformKey: string; platformLabel: string; accountKind: string }>> {
  const db = ensureDb();
  // Lấy habitat_id + platform_key của brief
  const briefRow = await db.execute(sql`
    SELECT b.habitat_id, h.platform_key
      FROM community_briefs b
      JOIN habitats h ON h.id = b.habitat_id
     WHERE b.id = ${briefId} AND b.project_id = ${projectId}
     LIMIT 1
  `);
  const br = (briefRow as unknown as Array<Record<string, unknown>>)[0];
  if (!br) return [];
  const habitatId = Number(br.habitat_id);
  const platformKey = String(br.platform_key ?? '');
  if (!platformKey) return [];
  const rows = await db.execute(sql`
    SELECT pa.id, pa.handle, pa.status, pa.platform_key, pa.account_kind,
           p.label AS platform_label
    FROM platform_accounts pa
    JOIN platforms p ON p.key = pa.platform_key
    JOIN project_accounts pj ON pj.account_id = pa.id AND pj.project_id = ${projectId}
    WHERE pa.tenant_id = ${TENANT}
      AND pa.status = 'active'
      AND pa.platform_key = ${platformKey}
      AND NOT EXISTS (
        SELECT 1 FROM community_briefs b2
        WHERE b2.habitat_id = ${habitatId} AND b2.account_id = pa.id
      )
    ORDER BY pa.handle ASC NULLS LAST
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    handle: r.handle ? String(r.handle) : null,
    status: String(r.status ?? 'todo'),
    platformKey: String(r.platform_key ?? ''),
    platformLabel: String(r.platform_label ?? ''),
    accountKind: String(r.account_kind ?? 'user'),
  }));
}

// ── Write ─────────────────────────────────────────────────────────

export interface BriefPatch {
  approachMd?: string;
  cadence?: string;
  tone?: string;
  doMd?: string;
  dontMd?: string;
  templates?: BriefTemplate[];
  narrativeMd?: string;
}

// 0057: set join membership state cho 1 brief. Khi chuyển sang 'joined' lần
// đầu, tự set joined_at=now() nếu chưa có. Khi sang 'rejected/kicked/left'
// giữ joined_at làm lịch sử (đã từng join). Khi back về 'not_joined' (hiếm,
// thường là reset state) → clear joined_at.
export interface SetJoinStatusPayload {
  joinStatus: JoinStatus;
  joinUrl?: string | null;     // invite URL (Discord) / join request URL (FB) / link tới sub
  joinNote?: string | null;    // mod feedback, shadow-ban detection, etc.
}

export async function setBriefJoinStatus(
  projectId: string, briefId: number, payload: SetJoinStatusPayload,
): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  const db = ensureDb();
  // Verify brief in project
  const existing = await db.execute(sql`
    SELECT id, join_status, joined_at FROM community_briefs
    WHERE id = ${briefId} AND project_id = ${projectId} AND tenant_id = ${TENANT}
    LIMIT 1
  `);
  const e = (existing as unknown as Array<Record<string, unknown>>)[0];
  if (!e) return { ok: false, error: 'Brief không tồn tại trong project' };
  const prev = parseJoinStatus(e.join_status);
  const next = payload.joinStatus;
  if (!['not_joined','pending','joined','rejected','kicked','left'].includes(next)) {
    return { ok: false, error: `joinStatus không hợp lệ: ${next}` };
  }
  // Joined-at logic:
  //   - new = 'joined' && prev != 'joined' && joined_at NULL → set now()
  //   - new = 'not_joined' → clear joined_at (reset state, không phải lịch sử)
  //   - Other → giữ nguyên (mất join là quá khứ, joined_at vẫn nghĩa lý)
  let joinedAtSql = sql`joined_at`;
  if (next === 'joined' && prev !== 'joined' && e.joined_at == null) {
    joinedAtSql = sql`now()`;
  } else if (next === 'not_joined') {
    joinedAtSql = sql`NULL`;
  }
  await db.execute(sql`
    UPDATE community_briefs
       SET join_status = ${next},
           joined_at = ${joinedAtSql},
           join_url = ${payload.joinUrl ?? null},
           join_note = ${payload.joinNote ?? null},
           updated_at = now()
     WHERE id = ${briefId} AND project_id = ${projectId}
  `);
  // Warnings: phase mismatch warnings để UI hiển thị.
  const warnings: string[] = [];
  if (next !== 'joined') {
    // Nếu brief có cards phase=seed/direct đã được seeded → có inconsistency
    const seedCount = await db.execute(sql`
      SELECT count(*)::int AS n FROM cards
      WHERE brief_id = ${briefId} AND seeded_at IS NOT NULL
    `);
    const n = Number((seedCount as unknown as Array<{ n: number }>)[0]?.n ?? 0);
    if (n > 0) {
      warnings.push(`Brief đã có ${n} bài đăng dù chưa joined — kiểm tra lại lịch sử.`);
    }
  }
  // Revalidate paths
  const { revalidatePath } = await import('next/cache');
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/community`);
  return { ok: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// ── Auto-fix brief sai nền tảng (1 click, tự động tối đa) ────────
// Tự: resolve/tạo platform từ habitat → tìm account MOS2 đúng platform →
// nếu không có, import account chưa dùng từ Directus → nếu vẫn không,
// tạo account placeholder (status=todo) → reassign brief. Trả mô tả đã
// làm gì để toast hiển thị.
function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'ext';
}
const KIND_CATEGORY: Record<string, string> = {
  forum: 'community', cafe: 'community', 'q-a': 'community', other: 'community',
  hashtag: 'social', 'hashtag-community': 'social', twitter: 'social', x: 'social',
};

export interface AutoFixResult {
  ok: boolean;
  action?: 'none' | 'picked-existing' | 'imported-directus' | 'created-placeholder';
  createdPlatform?: boolean;
  platformKey?: string;
  accountId?: number;
  message?: string;
  error?: string;
}

export async function autoFixBriefAccount(
  projectId: string, briefId: number,
): Promise<AutoFixResult> {
  const db = ensureDb();
  const [{ createPlatform }, accountsMod] = await Promise.all([
    import('@/lib/actions/platforms'),
    import('@/lib/actions/accounts'),
  ]);
  const rows = await db.execute(sql`
    SELECT b.account_id, b.habitat_id, h.name AS hname, h.kind AS hkind,
           h.url AS hurl, h.platform_key AS hpf, pa.platform_key AS acct_pf
    FROM community_briefs b
    JOIN habitats h ON h.id = b.habitat_id
    JOIN platform_accounts pa ON pa.id = b.account_id
    WHERE b.id = ${briefId} AND b.project_id = ${projectId} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'brief not in project' };
  const habitatId = Number(r.habitat_id);
  const hname = String(r.hname ?? 'kênh');
  const hkind = String(r.hkind ?? 'forum');
  const hurl = r.hurl ? String(r.hurl) : '';
  const hpf = r.hpf ? String(r.hpf) : '';
  const acctPf = r.acct_pf ? String(r.acct_pf) : '';

  // 1. Resolve platform key cho kênh
  let platformKey = '';
  let createdPlatform = false;
  if (hpf) {
    const ex = await db.execute(sql`SELECT 1 FROM platforms WHERE key = ${hpf} LIMIT 1`);
    if ((ex as unknown as Array<unknown>).length > 0) platformKey = hpf;
  }
  if (!platformKey) {
    const km: Record<string, string> = {
      subreddit: 'reddit', 'discord-server': 'discord', discord: 'discord',
      'fb-group': 'facebook', fb_group: 'facebook', facebook: 'facebook',
      telegram: 'telegram', youtube: 'youtube',
    };
    const mapped = km[hkind];
    if (mapped) {
      const ex = await db.execute(sql`SELECT 1 FROM platforms WHERE key = ${mapped} LIMIT 1`);
      if ((ex as unknown as Array<unknown>).length > 0) platformKey = mapped;
    }
  }
  if (!platformKey) {
    // Kênh ngoài chưa có platform → tự tạo từ habitat
    let domain = '';
    try { domain = hurl ? new URL(hurl.startsWith('http') ? hurl : `https://${hurl}`).hostname.replace(/^www\./, '') : ''; } catch { /* noop */ }
    const key = slug(domain || hname);
    const exist = await db.execute(sql`SELECT key FROM platforms WHERE key = ${key} LIMIT 1`);
    if ((exist as unknown as Array<unknown>).length > 0) {
      platformKey = key;
    } else {
      const cp = await createPlatform({
        key, label: hname,
        signupUrl: hurl || (domain ? `https://${domain}` : `https://${key}.example`),
        priority: 'medium', iconSlug: '',
        category: (KIND_CATEGORY[hkind] ?? 'community') as never,
        description: `Auto-tạo từ kênh seeding "${hname}" (${hkind})`,
      });
      if (!cp.ok) return { ok: false, error: `Không tạo được platform: ${cp.error}` };
      platformKey = cp.key || key;
      createdPlatform = true;
    }
    // Gắn platform_key vào habitat để nhất quán + hết cảnh báo
    await db.execute(sql`
      UPDATE habitats SET platform_key = ${platformKey}, updated_at = now()
      WHERE id = ${habitatId} AND project_id = ${projectId}
    `);
  }

  // 2. Tìm account đúng platform: MOS2 sẵn → Directus chưa dùng → tạo mới
  let accountId: number | null = null;
  let action: AutoFixResult['action'] = 'created-placeholder';

  const local = await accountsMod.listAccountsForProjectByPlatform(projectId, platformKey, habitatId);
  const pick = local.find((a) => !a.alreadyBriefedHere && a.id !== Number(r.account_id));
  if (pick) { accountId = pick.id; action = 'picked-existing'; }

  if (accountId == null) {
    try {
      const dir = await accountsMod.listDirectusAccountsForPlatform(platformKey);
      if (dir.ok && dir.enabled) {
        const unused = dir.accounts.find((d) => d.localAccountId == null);
        if (unused) {
          const imp = await accountsMod.importDirectusAccount(projectId, unused.directusId);
          if (imp.ok && imp.id) { accountId = imp.id; action = 'imported-directus'; }
        }
      }
    } catch { /* Directus optional */ }
  }

  if (accountId == null) {
    const created = await accountsMod.createAccount(projectId, {
      platformKey,
      handle: `auto-${slug(hname)}`,
      status: 'todo',
      notes: `Auto-tạo để fix brief sai nền tảng cho "${hname}". Cần đăng ký + điền login thật ở Resources.`,
      tags: ['auto-fix', 'needs-credentials'],
    });
    if (!created.ok || !created.id) return { ok: false, error: `Không tạo được account: ${created.error}` };
    accountId = created.id;
    action = 'created-placeholder';
  }

  const re = await reassignBriefAccount(projectId, briefId, accountId);
  if (!re.ok) return { ok: false, error: re.error };

  const msg =
    action === 'picked-existing' ? `Đã gán account MOS2 sẵn có trên "${platformKey}".`
    : action === 'imported-directus' ? `Đã import account chưa dùng từ Directus + gán (platform "${platformKey}").`
    : `Đã tạo account tạm trên "${platformKey}" + gán. Vào Resources điền login thật khi rảnh.`;
  return {
    ok: true, action, createdPlatform, platformKey, accountId,
    message: (createdPlatform ? `Tự tạo platform "${platformKey}" từ kênh. ` : '') + msg
      + (acctPf ? ` (cũ: account ${acctPf})` : ''),
  };
}

// Đổi account của 1 brief (sửa account sai nền tảng). Giữ nguyên brief id
// → phase_plan / cards / seeding_schedules (FK brief_id) không đổi, chỉ
// account đổi. Chặn nếu (newAccount, habitat) đã có brief khác.
export async function reassignBriefAccount(
  projectId: string, briefId: number, newAccountId: number,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const cur = await db.execute(sql`
    SELECT account_id, habitat_id FROM community_briefs
    WHERE id = ${briefId} AND project_id = ${projectId} LIMIT 1
  `);
  const c = (cur as unknown as Array<{ account_id: number; habitat_id: number }>)[0];
  if (!c) return { ok: false, error: 'brief not in project' };
  if (Number(c.account_id) === newAccountId) return { ok: true };

  // account phải thuộc project (link pivot nếu chưa)
  await db.execute(sql`
    INSERT INTO project_accounts (project_id, account_id)
    VALUES (${projectId}, ${newAccountId})
    ON CONFLICT (project_id, account_id) DO NOTHING
  `);

  const clash = await db.execute(sql`
    SELECT 1 FROM community_briefs
    WHERE account_id = ${newAccountId} AND habitat_id = ${c.habitat_id} AND id <> ${briefId}
    LIMIT 1
  `);
  if ((clash as unknown as Array<unknown>).length > 0) {
    return { ok: false, error: 'Đã có brief cho account này ở habitat này — không thể gán trùng' };
  }

  await db.execute(sql`
    UPDATE community_briefs SET account_id = ${newAccountId}, updated_at = now()
    WHERE id = ${briefId} AND project_id = ${projectId}
  `);
  revalidatePath(`/p/${projectId}/seeding`);
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}

export async function upsertBrief(
  projectId: string, accountId: number, habitatId: number, patch: BriefPatch,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const db = ensureDb();

  // Validate FK pairings exist & belong to project
  const valid = await db.execute(sql`
    SELECT
      EXISTS (SELECT 1 FROM project_accounts WHERE project_id = ${projectId} AND account_id = ${accountId}) AS account_ok,
      EXISTS (SELECT 1 FROM habitats WHERE id = ${habitatId} AND project_id = ${projectId}) AS habitat_ok
  `);
  const v = (valid as unknown as Array<Record<string, unknown>>)[0];
  if (!v?.account_ok) return { ok: false, error: 'account not in project' };
  if (!v?.habitat_ok) return { ok: false, error: 'habitat not in project' };

  const existing = await db
    .select({ id: communityBriefs.id })
    .from(communityBriefs)
    .where(and(eq(communityBriefs.accountId, accountId), eq(communityBriefs.habitatId, habitatId)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(communityBriefs)
      .set({
        ...(patch.approachMd != null ? { approachMd: patch.approachMd } : {}),
        ...(patch.cadence    != null ? { cadence: patch.cadence } : {}),
        ...(patch.tone       != null ? { tone: patch.tone } : {}),
        ...(patch.doMd       != null ? { doMd: patch.doMd } : {}),
        ...(patch.dontMd     != null ? { dontMd: patch.dontMd } : {}),
        ...(patch.templates  != null ? { templates: patch.templates } : {}),
        ...(patch.narrativeMd != null ? { narrativeMd: patch.narrativeMd } : {}),
        updatedAt: new Date(),
      })
      .where(eq(communityBriefs.id, existing[0]!.id));
    revalidatePath(`/p/${projectId}/resources`);
    revalidatePath(`/p/${projectId}/tribes`);
    return { ok: true, id: existing[0]!.id };
  }

  const inserted = await db.insert(communityBriefs).values({
    tenantId: TENANT,
    projectId,
    accountId,
    habitatId,
    approachMd: patch.approachMd ?? '',
    cadence: patch.cadence ?? '',
    tone: patch.tone ?? '',
    doMd: patch.doMd ?? '',
    dontMd: patch.dontMd ?? '',
    templates: patch.templates ?? [],
    narrativeMd: patch.narrativeMd ?? '',
  }).returning({ id: communityBriefs.id });

  revalidatePath(`/p/${projectId}/resources`);
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true, id: inserted[0]?.id };
}

// Persist last AI suggestion so F5 doesn't lose it. Auto-creates an empty
// brief row if none exists yet (so the suggestion survives even before the
// user has saved any approach text).
export async function saveBriefSuggestion(
  projectId: string, accountId: number, habitatId: number, suggestion: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  // Upsert empty row first so we have somewhere to attach the JSON
  const existing = await db
    .select({ id: communityBriefs.id })
    .from(communityBriefs)
    .where(and(eq(communityBriefs.accountId, accountId), eq(communityBriefs.habitatId, habitatId)))
    .limit(1);
  if (existing.length === 0) {
    // Validate FK pairings
    const valid = await db.execute(sql`
      SELECT
        EXISTS (SELECT 1 FROM project_accounts WHERE project_id = ${projectId} AND account_id = ${accountId}) AS account_ok,
        EXISTS (SELECT 1 FROM habitats WHERE id = ${habitatId} AND project_id = ${projectId}) AS habitat_ok
    `);
    const v = (valid as unknown as Array<Record<string, unknown>>)[0];
    if (!v?.account_ok) return { ok: false, error: 'account not in project' };
    if (!v?.habitat_ok) return { ok: false, error: 'habitat not in project' };
    await db.insert(communityBriefs).values({
      tenantId: TENANT, projectId, accountId, habitatId,
      aiSuggestion: suggestion as Record<string, unknown>,
      aiSuggestionAt: new Date(),
    });
  } else {
    await db.update(communityBriefs)
      .set({ aiSuggestion: suggestion as Record<string, unknown>, aiSuggestionAt: new Date() })
      .where(eq(communityBriefs.id, existing[0]!.id));
  }
  // Don't revalidate aggressively — the suggestion is metadata, doesn't
  // change the rendered brief list. Caller will re-read via state.
  return { ok: true };
}

export async function deleteBrief(projectId: string, briefId: number): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.delete(communityBriefs).where(eq(communityBriefs.id, briefId));
  revalidatePath(`/p/${projectId}/resources`);
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true };
}

// ── Phase write actions ───────────────────────────────────────────

// Save the entire phasePlan (5 phase entries typically). Used when editing
// a single phase tab in BriefEditModal - we merge by phase name and replace
// the matched entry, preserving the rest.
export async function savePhasePlan(
  projectId: string, briefId: number, plan: PhaseEntry[],
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  await db.update(communityBriefs)
    .set({ phasePlan: plan, updatedAt: new Date() })
    .where(eq(communityBriefs.id, briefId));
  revalidatePath(`/p/${projectId}/tribes`);
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}

// Initialize phase plan from archetype defaults. Used when a brief is freshly
// created (phase_plan = []) and user opens the phase view first time.
// Idempotent: only fills if plan is currently empty.
export async function initPhasePlanFromDefaults(
  projectId: string, briefId: number,
): Promise<{ ok: boolean; plan?: PhaseEntry[]; error?: string }> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT b.phase_plan, h.kind, h.mod_strictness, h.language, h.members
    FROM community_briefs b
    JOIN habitats h ON h.id = b.habitat_id
    WHERE b.id = ${briefId}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'brief not found' };
  const existing = parsePhasePlan(r.phase_plan);
  if (existing.length > 0) return { ok: true, plan: existing };
  const plan = defaultPhasePlanFor({
    kind: String(r.kind ?? ''),
    modStrictness: r.mod_strictness ? String(r.mod_strictness) : null,
    language: r.language ? String(r.language) : null,
    members: r.members != null ? Number(r.members) : null,
  });
  await db.update(communityBriefs)
    .set({ phasePlan: plan, updatedAt: new Date() })
    .where(eq(communityBriefs.id, briefId));
  revalidatePath(`/p/${projectId}/tribes`);
  return { ok: true, plan };
}

// Advance brief to a new phase. Appends to phase_history. reason is required
// so we have audit context.
export async function advancePhase(
  projectId: string, briefId: number, nextPhase: Phase, reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const me = await getCurrentUser();
  const rows = await db.execute(sql`
    SELECT b.current_phase, b.phase_history, b.join_status, pa.status AS account_status
      FROM community_briefs b
      LEFT JOIN platform_accounts pa ON pa.id = b.account_id
     WHERE b.id = ${briefId} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'brief not found' };
  const from = parsePhase(r.current_phase);
  if (from === nextPhase) return { ok: true };
  // GATE 0057 + 2-layer: chuyển sang bridge/seed/direct yêu cầu account
  // active VÀ joined. warm-up/value/cooldown/paused thì chỉ cần account active.
  const accountStatus = String(r.account_status ?? 'todo');
  if (accountStatus !== 'active') {
    return {
      ok: false,
      error: `❌ Account đang "${accountStatus}" (không phải 'active') — không thể advance phase. Fix account trước.`,
    };
  }
  const joinStatus = String(r.join_status ?? 'not_joined');
  if (joinStatus !== 'joined' && ['bridge', 'seed', 'direct'].includes(nextPhase)) {
    return {
      ok: false,
      error: `❌ Không thể chuyển sang phase "${nextPhase}" khi join_status="${joinStatus}". Phase này yêu cầu account đã joined community.`,
    };
  }
  const history = parsePhaseHistory(r.phase_history);
  history.push({
    from,
    to: nextPhase,
    at: new Date().toISOString(),
    byUserId: me?.id ?? null,
    reason: reason || '',
  });
  await db.update(communityBriefs)
    .set({ currentPhase: nextPhase, phaseHistory: history, updatedAt: new Date() })
    .where(eq(communityBriefs.id, briefId));
  revalidatePath(`/p/${projectId}/tribes`);
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}
