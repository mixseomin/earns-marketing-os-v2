// POST /api/apps/ingest — app trên máy người dùng gửi lô sự kiện (gameshell-ios Sources/App/Analytics.swift).
// Không có secret trong app: {app, token} chỉ để lọc rác; mọi thứ upsert/khử trùng nên gửi lại không nhân đôi.
// Body: { app, token, install, v?, region?, events: [{t: ISO, e, p?}] } (≤200 sự kiện/lô).
// Sự kiện chẩn đoán (yieldboard-ios Sources/Core/Diag.swift): `diag_error` mang p.fp (dấu vân tay lỗi, giống nhau trên mọi
// máy) → lỗi MỚI thành một việc review giao AI (review-pull thấy) — một việc mở cho mỗi fp, máy khác gặp lại chỉ đếm thêm
// trong app_su_kien; `diag_report` = người dùng tự bấm "Report a problem" → luôn thành việc. Trần 30 việc tự sinh/app/ngày.
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
  const okApp = (await db.execute(sql`SELECT ten, project_id FROM app_ung_dung WHERE key = ${app} AND token = ${token}`)) as unknown as Array<{ ten: string; project_id: string | null }>;
  if (!okApp.length) return NextResponse.json({ ok: false }, { status: 403 });
  const events = (b.events ?? []).slice(0, 200).filter((e) => e && e.t && e.e && !Number.isNaN(Date.parse(e.t)));
  // Chèn sự kiện trước (ON CONFLICT DO NOTHING) — phiên chỉ cộng theo session_start THẬT SỰ mới, gửi lại không cộng đôi.
  let n = 0, sessions = 0;
  for (const e of events) {
    const r = await db.execute(sql`
      INSERT INTO app_su_kien (app_key, install_id, ts, ten, props)
      VALUES (${app}, ${install}, ${e.t}::timestamptz, ${String(e.e).slice(0, 40)}, ${e.p == null ? null : JSON.stringify(e.p)}::jsonb)
      ON CONFLICT DO NOTHING RETURNING id`);
    if ((r as unknown as unknown[]).length) {
      n++; if (e.e === 'session_start') sessions++;
      if (e.e === 'diag_error' || e.e === 'diag_report') await toReview(db, app, okApp[0]!, install, b, e);
    }
  }
  await db.execute(sql`
    INSERT INTO app_cai (app_key, install_id, version, region, sessions, first_seen, last_seen)
    VALUES (${app}, ${install}, ${b.v ?? null}, ${b.region ?? null}, ${sessions}, now(), now())
    ON CONFLICT (app_key, install_id) DO UPDATE SET last_seen = now(), version = COALESCE(EXCLUDED.version, app_cai.version),
      region = COALESCE(EXCLUDED.region, app_cai.region), sessions = app_cai.sessions + EXCLUDED.sessions`);
  return NextResponse.json({ ok: true, n });
}

type Db = NonNullable<ReturnType<typeof getDb>>;
const cut = (v: unknown, max: number) => String(v ?? '').slice(0, max);

/** Lỗi chẩn đoán → việc review giao AI (hàng đợi chung, /api/review). Không có project thì bỏ — việc phải thuộc về đâu đó. */
async function toReview(db: Db, app: string, a: { ten: string; project_id: string | null }, install: string,
                        b: { v?: string; region?: string }, e: Ev) {
  if (!a.project_id) return;
  const p = e.p ?? {};
  const user = e.e === 'diag_report';
  const fp = cut(p.fp, 80);
  if (!user) {
    if (!fp) return;
    const open = (await db.execute(sql`
      SELECT 1 FROM human_tasks WHERE prep_payload->>'kind' = 'review' AND prep_payload->'targetRef'->>'fp' = ${fp}
        AND prep_payload->'targetRef'->>'app' = ${app} AND status IN ('pending', 'in_progress') LIMIT 1`)) as unknown as unknown[];
    if (open.length) return;
    const today = (await db.execute(sql`
      SELECT count(*)::int AS n FROM human_tasks WHERE prep_payload->>'kind' = 'review' AND prep_payload->'targetRef'->>'app' = ${app}
        AND prep_payload->>'reporter' = 'app' AND created_at > now() - interval '1 day'`)) as unknown as Array<{ n: number }>;
    if ((today[0]?.n ?? 0) >= 30) return;
  }
  const head = user ? `Người dùng báo: ${cut(p.note, 120) || '(không ghi chú)'}` : `${cut(p.n, 30)} · ${cut(p.s, 20)} · ${cut(p.m, 160)}`;
  const payload = {
    kind: 'review', targetType: 'app-diag', targetRef: { app, fp: fp || null, network: p.n ?? null, version: b.v ?? null },
    targetUrl: null, dimension: user ? 'user-report' : 'connection', assignedTo: 'ai', reporter: 'app', reporterKind: 'machine', thread: [],
  };
  const detail = JSON.stringify({ version: b.v, region: b.region, install: install.slice(0, 8), at: e.t, ...p }, null, 2).slice(0, 8000);
  await db.execute(sql`
    INSERT INTO human_tasks (project_id, title, instructions, prep_payload, status)
    VALUES (${a.project_id}, ${`[${a.ten}] ${head}`.slice(0, 240)}, ${detail}, ${JSON.stringify(payload)}::jsonb, 'pending')`);
}
