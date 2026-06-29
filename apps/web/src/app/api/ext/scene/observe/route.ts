import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { firstRow, errorResponse } from '@/lib/ext-route';
import { ensureIdentity, ensureRelationship } from '@/lib/scene-people';

// POST /api/ext/scene/observe
// Passive participant logging — khi xem 1 thread/community, log MỌI participant
// (author) vào people (status 'observed', familiarity GIỮ NGUYÊN nếu đã có →
// observe KHÔNG inflate; familiarity chỉ lên từ tương tác thật qua /seeding/insights).
// Skip owned habitat (sân nhà). platform_key lấy từ habitat (khớp forward-fill →
// tránh duplicate row x/twitter). Idempotent. Body: { projectId, habitatId?, platformKey?, handles[] }
export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as { projectId?: string; habitatId?: number; platformKey?: string; handles?: string[]; contacts?: Record<string, Record<string, unknown>> };
  const projectId = (body.projectId || '').trim();
  const habitatId = Number(body.habitatId || 0) || null;
  const handles = Array.isArray(body.handles)
    ? [...new Set(body.handles.map((h) => String(h || '').replace(/^@/, '').trim().toLowerCase()).filter(Boolean))].slice(0, 60)
    : [];
  // contacts: map handle(lowercased) → { userId, profile, pm, email, website, location, posts, host, engine }.
  // Scrape từ forum (cực giá trị outreach) → merge vào scene_identities.scraped_meta.contacts. Latest-wins.
  const contacts = (body.contacts && typeof body.contacts === 'object') ? body.contacts : {};
  if (!projectId || !handles.length) return errorResponse('projectId + handles required', 400);

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  let pk = (body.platformKey || '').trim();
  if (habitatId) {
    const h = firstRow(await db.execute(sql`SELECT is_own, platform_key FROM habitats WHERE id = ${habitatId} LIMIT 1`));
    if (h && h.is_own === true) return NextResponse.json({ ok: true, skipped: 'owned', count: 0 });
    if (h && h.platform_key) pk = String(h.platform_key);
  }

  // 2-tier: identity GLOBAL (platform+handle) + relationship per project (account 0 = observed-level).
  let added = 0, withContacts = 0;
  for (const handle of handles) {
    const identityId = await ensureIdentity(db, pk, handle);
    if (!identityId) continue;
    const before = firstRow(await db.execute(sql`SELECT id FROM people WHERE project_id = ${projectId} AND identity_id = ${identityId} AND account_id = 0 LIMIT 1`));
    await ensureRelationship(db, { projectId, identityId, accountId: 0, platformKey: pk, handle });
    if (!before) added++;
    // Contacts → scraped_meta.contacts (GLOBAL trên identity vì contact = thuộc tính của người, ko per-project).
    const c = contacts[handle];
    if (c && typeof c === 'object' && Object.keys(c).length) {
      try {
        // MERGE channels: auto-capture KHÔNG được wipe channel thêm tay (subtype='manual') hay channel cũ chưa
        // tìm lại lần này. Đọc channels hiện có → incoming (auto) win key trùng, GIỮ manual + prior-not-replaced.
        const exRow = firstRow(await db.execute(sql`SELECT scraped_meta -> 'contacts' -> 'channels' AS ch FROM scene_identities WHERE id = ${identityId} LIMIT 1`));
        const existing = Array.isArray(exRow?.ch) ? (exRow!.ch as Array<Record<string, unknown>>) : [];
        const incoming = Array.isArray((c as { channels?: unknown }).channels) ? ((c as { channels: Array<Record<string, unknown>> }).channels) : [];
        const byKey = new Map<string, Record<string, unknown>>();
        for (const ch of incoming) { if (ch && ch.type && ch.value) byKey.set(String(ch.type).toLowerCase() + ':' + String(ch.value).toLowerCase(), ch); }
        for (const ch of existing) { if (!ch || !ch.type || !ch.value) continue; const k = String(ch.type).toLowerCase() + ':' + String(ch.value).toLowerCase(); if (ch.subtype === 'manual' || !byKey.has(k)) byKey.set(k, ch); }
        const c2 = { ...(c as Record<string, unknown>), channels: [...byKey.values()] };
        await db.execute(sql`UPDATE scene_identities SET scraped_meta = COALESCE(scraped_meta, '{}'::jsonb) || ${JSON.stringify({ contacts: c2 })}::jsonb, updated_at = now() WHERE id = ${identityId}`);
        withContacts++;
      } catch { /* non-fatal: contacts là bonus, ko được làm hỏng observe */ }
    }
  }
  return NextResponse.json({ ok: true, count: added, total: handles.length, contacts: withContacts });
}
