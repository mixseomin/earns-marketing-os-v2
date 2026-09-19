// POST /api/apps/ingest — app trên máy người dùng gửi lô sự kiện (gameshell-ios Sources/App/Analytics.swift).
// Không có secret trong app: {app, token} chỉ để lọc rác; mọi thứ upsert/khử trùng nên gửi lại không nhân đôi.
// Body: { app, token, install, v?, region?, events: [{t: ISO, e, p?}] } (≤200 sự kiện/lô).
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export const dynamic = 'force-dynamic';

type Ev = { t: string; e: string; p?: Record<string, unknown> };

export async function POST(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  let b: { app?: string; token?: string; install?: string; v?: string; region?: string; events?: Ev[] };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const app = String(b.app ?? ''), token = String(b.token ?? ''), install = String(b.install ?? '').slice(0, 64);
  if (!app || !token || !install) return NextResponse.json({ ok: false }, { status: 400 });
  const okApp = (await db.execute(sql`SELECT 1 FROM app_ung_dung WHERE key = ${app} AND token = ${token}`)) as unknown as unknown[];
  if (!okApp.length) return NextResponse.json({ ok: false }, { status: 403 });
  const events = (b.events ?? []).slice(0, 200).filter((e) => e && e.t && e.e && !Number.isNaN(Date.parse(e.t)));
  const sessions = events.filter((e) => e.e === 'session_start').length;
  await db.execute(sql`
    INSERT INTO app_cai (app_key, install_id, version, region, sessions, first_seen, last_seen)
    VALUES (${app}, ${install}, ${b.v ?? null}, ${b.region ?? null}, ${sessions}, now(), now())
    ON CONFLICT (app_key, install_id) DO UPDATE SET last_seen = now(), version = COALESCE(EXCLUDED.version, app_cai.version),
      region = COALESCE(EXCLUDED.region, app_cai.region), sessions = app_cai.sessions + EXCLUDED.sessions`);
  let n = 0;
  for (const e of events) {
    const r = await db.execute(sql`
      INSERT INTO app_su_kien (app_key, install_id, ts, ten, props)
      VALUES (${app}, ${install}, ${e.t}::timestamptz, ${String(e.e).slice(0, 40)}, ${e.p == null ? null : JSON.stringify(e.p)}::jsonb)
      ON CONFLICT DO NOTHING RETURNING id`);
    if ((r as unknown as unknown[]).length) n++;
  }
  return NextResponse.json({ ok: true, n });
}
