import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { getDb } from '@mos2/db';
import { canonPlatformKey } from '@/lib/habitat-platform-map';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST /api/ext/platform-adopt
// Toast "➕ Thêm" trên site mới → bind platform vào technology vừa detect được
// (= inherit selector pack ngay). Upsert stub platform nếu forum chưa có row,
// rồi xoá detection (đã xử lý). Tương đương adoptTemplate() nhưng gọi từ ext.
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('db unavailable', 200);
  let body: { platformKey?: string; technologyKey?: string; hostname?: string };
  try { body = await req.json(); } catch { return errorResponse('bad json', 400); }
  const rawKey = (body.platformKey || '').toString().trim();
  const tech = (body.technologyKey || '').toString().trim().toLowerCase();
  if (!rawKey || !tech) return errorResponse('platformKey + technologyKey required', 400);
  const platformKey = canonPlatformKey(rawKey);
  const host = (body.hostname || '').toString().trim().toLowerCase().replace(/^www\./, '') || platformKey;
  try {
    const known = await db.execute(sql`SELECT 1 FROM platform_technologies WHERE key = ${tech} LIMIT 1`);
    if (!(known as unknown as unknown[]).length) return NextResponse.json({ ok: false, error: 'unknown technology' });
    await db.execute(sql`
      INSERT INTO platforms (key, label, signup_url, technology_key)
      VALUES (${platformKey}, ${host}, ${'https://' + host}, ${tech})
      ON CONFLICT (key) DO UPDATE SET technology_key = ${tech}, updated_at = now()`);
    await db.execute(sql`DELETE FROM platform_tech_detections WHERE platform_key = ${platformKey} AND technology_key = ${tech}`);
    return NextResponse.json({ ok: true, platformKey, technologyKey: tech });
  } catch (e) {
    return errorResponse((e as Error).message, 200);
  }
}
