// POST /api/phu/ingest — cửa cho adapter (scripts/phu/*.mjs trên box3, chạy cron) đổ số vào PHỦ.
// Auth: Bearer MOS2_EXT_KEY (như /api/ext/*). Body:
//   { project, events?: [{ts, loai, sid?, platform?, mang?, amount?, ma_don, nguon_du_lieu, raw?}],
//     chi?: [{ngay, sid_prefix, chi_usd, clicks?, impressions?, nguon_du_lieu?}],
//     landers?: [{host, path, ten, mo_ta?, dich?, last_sinh?, so_muc?, trang_thai?}],
//     adapter?: {key, name, loai?, lich?, ok, note?} }
// Mọi thứ upsert/khử trùng — adapter chạy lại cùng khoảng log không nhân đôi số.
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../ext/_auth';
import { sidPrefix } from '@/lib/phu-shared';

export const dynamic = 'force-dynamic';

type Ev = { ts: string; loai: string; sid?: string; platform?: string; mang?: string; amount?: number; ma_don: string; nguon_du_lieu: string; raw?: unknown };
type Chi = { ngay: string; sid_prefix: string; chi_usd: number; clicks?: number; impressions?: number; nguon_du_lieu?: string };
type Ld = { host: string; path?: string; ten: string; mo_ta?: string; dich?: string; last_sinh?: string; so_muc?: number; trang_thai?: string };

export async function POST(req: Request) {
  const denied = await checkAuth(req);
  if (denied) return denied;
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db' }, { status: 503 });
  const b = (await req.json()) as { project?: string; events?: Ev[]; chi?: Chi[]; landers?: Ld[]; adapter?: { key: string; name: string; loai?: string; lich?: string; ok: boolean; note?: string } };
  const project = String(b.project ?? '').trim();
  if (!project) return NextResponse.json({ ok: false, error: 'thiếu project' }, { status: 400 });
  let ev = 0, chi = 0, ld = 0;
  for (const e of b.events ?? []) {
    if (!e.ma_don || !e.nguon_du_lieu || !e.loai || !e.ts) continue;
    const r = await db.execute(sql`
      INSERT INTO phu_su_kien (project_id, ts, loai, sid, sid_prefix, platform_slug, mang, amount, ma_don, nguon_du_lieu, raw)
      VALUES (${project}, ${e.ts}::timestamptz, ${e.loai}, ${e.sid ?? null}, ${sidPrefix(e.sid)}, ${e.platform ?? null}, ${e.mang ?? null},
              ${Number(e.amount) || 0}, ${String(e.ma_don)}, ${e.nguon_du_lieu}, ${e.raw == null ? null : JSON.stringify(e.raw)}::jsonb)
      ON CONFLICT (nguon_du_lieu, ma_don) DO UPDATE SET amount = EXCLUDED.amount, raw = COALESCE(EXCLUDED.raw, phu_su_kien.raw)
      RETURNING (xmax = 0) AS moi`);
    if ((r as unknown as Array<{ moi: boolean }>)[0]?.moi) ev++;
  }
  for (const c of b.chi ?? []) {
    if (!c.ngay || !c.sid_prefix) continue;
    await db.execute(sql`
      INSERT INTO phu_chi (project_id, ngay, nguon_key, sid_prefix, chi_usd, clicks, impressions, nguon_du_lieu)
      VALUES (${project}, ${c.ngay}::date, ${c.sid_prefix.split('_')[0]}, ${c.sid_prefix}, ${Number(c.chi_usd) || 0}, ${c.clicks ?? null}, ${c.impressions ?? null}, ${c.nguon_du_lieu ?? 'api'})
      ON CONFLICT (project_id, ngay, sid_prefix) DO UPDATE SET chi_usd = EXCLUDED.chi_usd, clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions,
        nguon_du_lieu = EXCLUDED.nguon_du_lieu, updated_at = now()`);
    chi++;
  }
  for (const l of b.landers ?? []) {
    if (!l.host || !l.ten) continue;
    await db.execute(sql`
      INSERT INTO phu_lander (project_id, host, path, ten, mo_ta, dich, last_sinh, so_muc, trang_thai)
      VALUES (${project}, ${l.host}, ${l.path ?? '/'}, ${l.ten}, ${l.mo_ta ?? null}, ${l.dich ?? null}, ${l.last_sinh ?? null}::timestamptz, ${l.so_muc ?? null}, ${l.trang_thai ?? 'song'})
      ON CONFLICT (project_id, host, path) DO UPDATE SET ten = EXCLUDED.ten, mo_ta = COALESCE(EXCLUDED.mo_ta, phu_lander.mo_ta), dich = COALESCE(EXCLUDED.dich, phu_lander.dich),
        last_sinh = COALESCE(EXCLUDED.last_sinh, phu_lander.last_sinh), so_muc = COALESCE(EXCLUDED.so_muc, phu_lander.so_muc), trang_thai = EXCLUDED.trang_thai`);
    ld++;
  }
  if (b.adapter?.key) {
    const a = b.adapter;
    await db.execute(sql`
      INSERT INTO phu_adapter (project_id, key, name, loai, lich, last_run, last_ok, last_note)
      VALUES (${project}, ${a.key}, ${a.name || a.key}, ${a.loai ?? 'cron'}, ${a.lich ?? null}, now(), ${!!a.ok}, ${a.note ?? null})
      ON CONFLICT (project_id, key) DO UPDATE SET name = EXCLUDED.name, loai = EXCLUDED.loai, lich = COALESCE(EXCLUDED.lich, phu_adapter.lich),
        last_run = now(), last_ok = EXCLUDED.last_ok, last_note = EXCLUDED.last_note`);
  }
  return NextResponse.json({ ok: true, events_moi: ev, chi, landers: ld });
}
