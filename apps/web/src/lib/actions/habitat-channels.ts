'use server';

// Sub-channel của habitat (Discord/Slack/Telegram) — mỗi channel có rule +
// format riêng. Card.channelId link tới đây để biết bài đăng vào channel nào
// và áp đúng rules. Habitat 1-ruleset (subreddit/forum) → bỏ qua bảng này.

import { eq, and, sql } from 'drizzle-orm';
import { getDb, habitatChannels } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export interface HabitatChannelRow {
  id: number;
  habitatId: number;
  name: string;
  url: string | null;
  description: string;
  rules: string;
  language: string;        // 0080: channel-level lang override
  allowedFormats: string[] | null;
  postingGates: Record<string, unknown> | null;
  voiceProfileOverride: string | null;
  fewShotExamples: Array<{ title?: string; body: string; whyItWorks?: string }> | null;
  sortOrder: number;
}

export interface HabitatChannelInput {
  name: string;
  url?: string | null;
  externalId?: string | null;   // stable key (Discord snowflake | forum slug.id) — match khi sync rules
  description?: string;
  rules?: string;
  language?: string;
  allowedFormats?: string[] | null;
  postingGates?: Record<string, unknown> | null;
  voiceProfileOverride?: string | null;
  fewShotExamples?: Array<{ title?: string; body: string; whyItWorks?: string }> | null;
  sortOrder?: number;
}

export async function listChannelsForHabitat(habitatId: number): Promise<HabitatChannelRow[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT id, habitat_id, name, url, description, rules, language,
           allowed_formats, posting_gates, voice_profile_override, few_shot_examples, sort_order
      FROM habitat_channels
     WHERE habitat_id = ${habitatId}
     ORDER BY sort_order ASC, id ASC
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    habitatId: Number(r.habitat_id),
    name: String(r.name),
    url: r.url ? String(r.url) : null,
    description: String(r.description ?? ''),
    rules: String(r.rules ?? ''),
    language: String(r.language ?? ''),
    allowedFormats: Array.isArray(r.allowed_formats) ? (r.allowed_formats as string[]) : null,
    postingGates: (r.posting_gates && typeof r.posting_gates === 'object' && !Array.isArray(r.posting_gates))
      ? (r.posting_gates as Record<string, unknown>) : null,
    voiceProfileOverride: r.voice_profile_override ? String(r.voice_profile_override) : null,
    fewShotExamples: Array.isArray(r.few_shot_examples)
      ? (r.few_shot_examples as HabitatChannelRow['fewShotExamples']) : null,
    sortOrder: Number(r.sort_order ?? 0),
  }));
}

export async function createChannel(
  habitatId: number, input: HabitatChannelInput,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!input.name?.trim()) return { ok: false, error: 'name required' };
  const db = ensureDb();
  const inserted = await db.insert(habitatChannels).values({
    tenantId: TENANT,
    habitatId,
    name: input.name.trim(),
    url: input.url ?? null,
    externalId: input.externalId ?? null,
    description: input.description ?? '',
    rules: input.rules ?? '',
    language: input.language ?? '',
    allowedFormats: input.allowedFormats ?? null,
    postingGates: input.postingGates ?? null,
    voiceProfileOverride: input.voiceProfileOverride ?? null,
    fewShotExamples: input.fewShotExamples ?? null,
    sortOrder: input.sortOrder ?? 0,
  }).returning({ id: habitatChannels.id });
  return { ok: true, id: inserted[0]?.id };
}

export async function updateChannel(
  id: number, patch: Partial<HabitatChannelInput>,
): Promise<{ ok: boolean }> {
  const db = ensureDb();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name != null) set.name = patch.name.trim();
  if (patch.url !== undefined) set.url = patch.url;
  if (patch.description != null) set.description = patch.description;
  if (patch.rules != null) set.rules = patch.rules;
  if (patch.language != null) set.language = patch.language;
  if (patch.allowedFormats !== undefined) set.allowedFormats = patch.allowedFormats;
  if (patch.postingGates !== undefined) set.postingGates = patch.postingGates;
  if (patch.voiceProfileOverride !== undefined) set.voiceProfileOverride = patch.voiceProfileOverride;
  if (patch.fewShotExamples !== undefined) set.fewShotExamples = patch.fewShotExamples;
  if (patch.sortOrder != null) set.sortOrder = patch.sortOrder;
  await db.update(habitatChannels).set(set).where(eq(habitatChannels.id, id));
  return { ok: true };
}

export async function deleteChannel(id: number): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.delete(habitatChannels)
    .where(and(eq(habitatChannels.id, id), eq(habitatChannels.tenantId, TENANT)));
  return { ok: true };
}

// Bulk replace toàn bộ channels của habitat — dùng cho UI inline section.
// Đơn giản nhất: delete-all + insert-all. Nếu cần preserve card.channel_id
// thì upsert by name (chấp nhận channel id mới khi user rename — card.channel_id
// SET NULL nhờ FK on delete cascade).
export async function bulkReplaceChannels(
  habitatId: number, channels: HabitatChannelInput[],
): Promise<{ ok: boolean; count: number }> {
  const db = ensureDb();
  // Strategy: upsert by name (giữ id ổn định cho cards đã link).
  const existing = await listChannelsForHabitat(habitatId);
  const existByName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  const newNames = new Set(channels.map((c) => c.name.trim().toLowerCase()));
  // Delete channels không còn trong list mới.
  for (const e of existing) {
    if (!newNames.has(e.name.toLowerCase())) {
      await db.delete(habitatChannels).where(eq(habitatChannels.id, e.id));
    }
  }
  // Upsert.
  for (let i = 0; i < channels.length; i++) {
    const c = channels[i]!;
    const key = c.name.trim().toLowerCase();
    const existed = existByName.get(key);
    if (existed) {
      await updateChannel(existed.id, { ...c, sortOrder: i });
    } else {
      await createChannel(habitatId, { ...c, sortOrder: i });
    }
  }
  return { ok: true, count: channels.length };
}
