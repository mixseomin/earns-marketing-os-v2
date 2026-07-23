import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// Atomic per-field write cho identity.custom_fields — server-merge jsonb_set thay cho
// ext GET→merge→PATCH (read-modify-write race: 2 field lưu đua nhau mất update). Dùng CỘT custom_fields
// SẴN CÓ (không đẻ cột fields mới → dashboard readers không đổi). avatar → set kèm avatar_url scalar.
//   POST { key, value, avatarUrl? } → set custom_fields[key]=value (+avatar_url nếu gửi)
//   DELETE ?key=                    → custom_fields = custom_fields - key
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const { id } = await params; const idNum = Number(id);
  if (!Number.isFinite(idNum)) return errorResponse('bad id', 400);
  const b = (await req.json().catch(() => ({}))) as { key?: string; value?: string; avatarUrl?: string };
  const key = String(b.key ?? '').trim();
  if (!key) return errorResponse('key required', 400);
  const value = String(b.value ?? '');
  const avatarUrl = typeof b.avatarUrl === 'string' ? b.avatarUrl : null;
  const r = (await db.execute(sql`
    UPDATE identities SET
      custom_fields = jsonb_set(coalesce(custom_fields, '{}'::jsonb), ARRAY[${key}]::text[], to_jsonb(${value}::text), true),
      avatar_url = COALESCE(${avatarUrl}::text, avatar_url),
      updated_at = now()
    WHERE id = ${idNum} RETURNING id`)) as Array<{ id: number }>;
  if (!r[0]) return errorResponse('not found', 404);
  return okResponse({ ok: true, id: idNum, key });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const { id } = await params; const idNum = Number(id);
  if (!Number.isFinite(idNum)) return errorResponse('bad id', 400);
  const key = (new URL(req.url).searchParams.get('key') || '').trim();
  if (!key) return errorResponse('key required', 400);
  const r = (await db.execute(sql`
    UPDATE identities SET custom_fields = coalesce(custom_fields, '{}'::jsonb) - ${key}, updated_at = now()
    WHERE id = ${idNum} RETURNING id`)) as Array<{ id: number }>;
  if (!r[0]) return errorResponse('not found', 404);
  return okResponse({ ok: true, id: idNum, key });
}
