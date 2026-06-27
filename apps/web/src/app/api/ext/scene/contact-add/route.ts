import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { firstRow, errorResponse } from '@/lib/ext-route';
import { ensureIdentity } from '@/lib/scene-people';

export const dynamic = 'force-dynamic';

// POST /api/ext/scene/contact-add — thêm THỦ CÔNG 1 contact-channel cho 1 người (từ popover Crew ext, khi
// auto-extract sót hoặc biết từ nguồn khác). APPEND vào scene_identities.scraped_meta.contacts.channels (dedupe,
// subtype='manual') — KHÔNG ghi đè các field/channel khác. Body: { platformKey, handle, type, value, url? }.
export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const b = (await req.json().catch(() => ({}))) as { platformKey?: string; handle?: string; type?: string; value?: string; url?: string };
  const pk = String(b.platformKey || '').trim();
  const handle = String(b.handle || '').replace(/^@/, '').trim().toLowerCase();
  const type = String(b.type || '').trim().toLowerCase();
  const value = String(b.value || '').trim();
  if (!pk || !handle || !type || !value) return errorResponse('platformKey + handle + type + value required', 400);
  if (type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return errorResponse('invalid email', 400);

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const identityId = await ensureIdentity(db, pk, handle);
  if (!identityId) return errorResponse('identity create failed', 500);

  // Đọc contacts hiện tại → append channel vào .channels (dedupe theo type:value).
  const row = firstRow(await db.execute(sql`SELECT scraped_meta -> 'contacts' AS contacts FROM scene_identities WHERE id = ${identityId} LIMIT 1`));
  const contacts = (row && row.contacts && typeof row.contacts === 'object') ? (row.contacts as Record<string, unknown>) : {};
  const channels = Array.isArray((contacts as { channels?: unknown }).channels)
    ? ((contacts as { channels: Array<Record<string, unknown>> }).channels)
    : [];

  const url = b.url ? String(b.url)
    : (type === 'email' ? 'mailto:' + value
      : (type === 'website' && !/^https?:/i.test(value) ? 'https://' + value
        : (/^https?:/i.test(value) ? value : '')));

  const exists = channels.some((ch) => String(ch.type).toLowerCase() === type && String(ch.value).toLowerCase() === value.toLowerCase());
  if (!exists) channels.push({ type, value, url, subtype: 'manual' });
  (contacts as { channels: unknown }).channels = channels;

  await db.execute(sql`UPDATE scene_identities SET scraped_meta = COALESCE(scraped_meta, '{}'::jsonb) || ${JSON.stringify({ contacts })}::jsonb, updated_at = now() WHERE id = ${identityId}`);

  return NextResponse.json({ ok: true, channels, added: !exists });
}
