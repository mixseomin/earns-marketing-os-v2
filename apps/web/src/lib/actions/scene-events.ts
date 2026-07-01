'use server';

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { DEFAULT_SCENE_EVENTS, type SceneEvent } from '@/lib/scene-events';

// Sửa taxonomy event + bảng điểm familiarity (app_settings.scene_events). Admin-only.
// Validate ở trust boundary: kind non-empty, dir hợp lệ, score number 0..100 (recompute dùng số này).

function sanitize(events: unknown): SceneEvent[] {
  if (!Array.isArray(events)) return [];
  const seen = new Set<string>();
  const out: SceneEvent[] = [];
  for (const raw of events) {
    const e = raw as Partial<SceneEvent>;
    const kind = String(e?.kind ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!kind || seen.has(kind)) continue;
    seen.add(kind);
    const score = Number(e?.score);
    out.push({
      kind,
      label: String(e?.label ?? kind).slice(0, 40),
      emoji: String(e?.emoji ?? '•').slice(0, 8),
      dir: e?.dir === 'theirs' ? 'theirs' : 'ours',
      toggle: e?.toggle === true,
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
      ...(e?.desc ? { desc: String(e.desc).slice(0, 160) } : {}),
    });
  }
  return out;
}

export async function saveSceneEvents(events: SceneEvent[]): Promise<{ ok: boolean; error?: string }> {
  await requireRole(['admin']);
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  const clean = sanitize(events);
  if (!clean.length) return { ok: false, error: 'Không có event hợp lệ' };
  if (!clean.some((e) => e.kind === 'default')) return { ok: false, error: "Thiếu row 'default' (fallback)" };
  try {
    await db.execute(sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('scene_events', ${JSON.stringify(clean)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
    revalidatePath('/architecture');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message?.slice(0, 120) || 'save failed' };
  }
}

export async function resetSceneEvents(): Promise<{ ok: boolean; error?: string }> {
  return saveSceneEvents(DEFAULT_SCENE_EVENTS);
}
