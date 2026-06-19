import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { getDb } from '@mos2/db';
import { canonPlatformKey } from '@/lib/habitat-platform-map';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_HTML = 6_000_000; // ~6MB guard

// Đoán page_kind từ URL (phpBB + generic forum patterns). Chỉ là nhãn để xếp thư
// viện — Claude vẫn đọc html thật để extract đúng field.
function guessPageKind(url: string): string {
  const u = (url || '').toLowerCase();
  if (/memberlist\.php[^#]*mode=viewprofile|\/u\/|\/user\/|\/users\/|\/profile|\/member\.|\/members\//.test(u)) return 'account-profile';
  if (/posting\.php[^#]*mode=(reply|post|quote)|\/submit|\/compose|\/new-post|\/post\/new/.test(u)) return 'composer';
  if (/ucp\.php[^#]*mode=register|\/register|\/signup|\/sign-up|\/join\b/.test(u)) return 'signup';
  if (/viewtopic\.php|\/thread|\/topic|\/t\/\d|comments\//.test(u)) return 'post-metrics';
  if (/viewforum\.php|\/forum|\/board|memberlist\.php/.test(u)) return 'subreddit-about';
  return 'page';
}

// POST /api/ext/dom-sample — ext lưu full HTML 1 trang vào thư viện DOM.
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('db unavailable', 200);
  let body: { platformKey?: string; technologyKey?: string; pageKind?: string; url?: string; hostname?: string; title?: string; html?: string; note?: string };
  try { body = await req.json(); } catch { return errorResponse('bad json', 400); }
  let html = (body.html || '').toString();
  if (!html.trim()) return errorResponse('html required', 400);
  if (html.length > MAX_HTML) html = html.slice(0, MAX_HTML);
  const rawKey = (body.platformKey || '').toString().trim();
  const platformKey = rawKey ? canonPlatformKey(rawKey) : null;
  const tech = (body.technologyKey || '').toString().trim().toLowerCase() || null;
  const url = (body.url || '').toString().slice(0, 600);
  const host = (body.hostname || '').toString().trim().toLowerCase().replace(/^www\./, '').slice(0, 200) || null;
  const title = (body.title || '').toString().slice(0, 300) || null;
  const pageKind = (body.pageKind || '').toString().trim() || guessPageKind(url);
  const note = (body.note || '').toString().slice(0, 500) || null;
  try {
    const ins = await db.execute(sql`
      INSERT INTO dom_samples (platform_key, technology_key, page_kind, url, hostname, title, html, bytes, note)
      VALUES (${platformKey}, ${tech}, ${pageKind}, ${url}, ${host}, ${title}, ${html}, ${html.length}, ${note})
      RETURNING id`);
    const id = (ins as unknown as Array<{ id: number }>)[0]?.id ?? null;
    return NextResponse.json({ ok: true, id, pageKind, platformKey, technologyKey: tech, bytes: html.length });
  } catch (e) {
    return errorResponse((e as Error).message, 200);
  }
}

// GET /api/ext/dom-sample            → list (metadata, no html)
// GET /api/ext/dom-sample?id=N&format=html  → raw html của 1 sample (Claude đọc)
// GET /api/ext/dom-sample?technologyKey=phpbb / ?platformKey=... → filter list
export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('db unavailable', 200);
  const p = new URL(req.url).searchParams;
  const id = p.get('id');
  if (id) {
    const rows = await db.execute(sql`SELECT id, platform_key, technology_key, page_kind, url, hostname, title, bytes, captured_at, html FROM dom_samples WHERE id = ${Number(id)} LIMIT 1`);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) return errorResponse('not found', 404);
    if (p.get('format') === 'html') {
      return new NextResponse(String(row.html ?? ''), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return NextResponse.json({ ok: true, sample: row });
  }
  const tech = p.get('technologyKey');
  const plat = p.get('platformKey') ? canonPlatformKey(p.get('platformKey')!) : null;
  const rows = await db.execute(sql`
    SELECT id, platform_key, technology_key, page_kind, url, hostname, title, bytes, captured_at
    FROM dom_samples
    WHERE (${tech}::text IS NULL OR technology_key = ${tech})
      AND (${plat}::text IS NULL OR platform_key = ${plat})
    ORDER BY captured_at DESC LIMIT 200`);
  return NextResponse.json({ ok: true, samples: rows });
}

// DELETE /api/ext/dom-sample?id=N — xoá 1 sample (vd chụp lỗi/chưa load xong).
export async function DELETE(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('db unavailable', 200);
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return errorResponse('id required', 400);
  try {
    await db.execute(sql`DELETE FROM dom_samples WHERE id = ${Number(id)}`);
    return NextResponse.json({ ok: true, deleted: Number(id) });
  } catch (e) {
    return errorResponse((e as Error).message, 200);
  }
}
