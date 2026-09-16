// POST /api/phu/ingest — cửa cho adapter (scripts/phu/*.mjs trên box3, chạy cron) đổ số vào PHỦ.
// Auth: Bearer MOS2_EXT_KEY (như /api/ext/*). Body:
//   { project, events?: [{ts, loai, sid?, platform?, mang?, amount?, ma_don, nguon_du_lieu, raw?}],
//     chi?: [{ngay, sid_prefix, chi_usd, clicks?, impressions?, nguon_du_lieu?}],
//     landers?: [{host, path, ten, mo_ta?, dich?, last_sinh?, so_muc?, trang_thai?}],
//     camp?: [{nguon_key, ten, sid_prefix, lander?, target?, ngan_sach_ngay?, trang_thai, ghi_chu?}]  ← adapter mạng QC
//        tự khai camp nó thấy trên tài khoản (Bidvertiser /CAMPAIGNS/), không ai phải gõ tay vào trang,
//     nguon?: {key, name?, loai?, trang_thai?, macro_click?, nap_usd?, ghi_chu?}  ← vá lẻ một nguồn (balance, trạng thái),
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
type Cp = { nguon_key: string; ten: string; sid_prefix: string; lander?: string; target?: unknown; ngan_sach_ngay?: number; trang_thai: string; ghi_chu?: string; ket_thuc?: string; nhip_ngay?: number; tieu_chi?: unknown; ke_hoach?: string };
type Ng = { key: string; name?: string; loai?: string; trang_thai?: string; macro_click?: string; nap_usd?: number; ghi_chu?: string };

export async function POST(req: Request) {
  const denied = await checkAuth(req);
  if (denied) return denied;
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db' }, { status: 503 });
  const b = (await req.json()) as { project?: string; events?: Ev[]; chi?: Chi[]; landers?: Ld[]; camp?: Cp[]; nguon?: Ng; adapter?: { key: string; name: string; loai?: string; lich?: string; ok: boolean; note?: string } };
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
  let cp = 0;
  for (const c of b.camp ?? []) {
    // cùng luật với luuPhuCamp: sid_prefix đúng hai mẩu <nguồn>_<camp>
    const prefix = String(c.sid_prefix ?? '').trim().replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '');
    if (!c.nguon_key || !c.ten || !c.trang_thai || prefix.split('_').length !== 2) continue;
    // nguồn cho trigger phu_camp_ghi_doi (nhật ký trước→sau): adapter nào báo thì ghi tên nó
    await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('phu.nguon', ${'adapter:' + (b.adapter?.key ?? 'ingest')}, true)`);
    await tx.execute(sql`
      INSERT INTO phu_camp (project_id, nguon_key, ten, sid_prefix, lander, target, ngan_sach_ngay, trang_thai, bat_dau, ghi_chu, ket_thuc, nhip_ngay, tieu_chi, ke_hoach)
      VALUES (${project}, ${c.nguon_key}, ${c.ten}, ${prefix}, ${c.lander ?? null}, ${JSON.stringify(c.target ?? {})}::jsonb,
              ${c.ngan_sach_ngay == null ? null : Number(c.ngan_sach_ngay)}, ${c.trang_thai}, ${c.trang_thai === 'chay' ? sql`now()` : null}, ${c.ghi_chu ?? null},
              ${c.ket_thuc ?? null}::date, ${Math.max(1, Number(c.nhip_ngay) || 1)}, ${JSON.stringify(c.tieu_chi ?? {})}::jsonb, ${c.ke_hoach ?? null})
      ON CONFLICT (project_id, sid_prefix) DO UPDATE SET nguon_key = EXCLUDED.nguon_key, ten = EXCLUDED.ten, lander = COALESCE(EXCLUDED.lander, phu_camp.lander),
        target = phu_camp.target || EXCLUDED.target, ngan_sach_ngay = COALESCE(EXCLUDED.ngan_sach_ngay, phu_camp.ngan_sach_ngay), trang_thai = EXCLUDED.trang_thai,
        bat_dau = COALESCE(phu_camp.bat_dau, EXCLUDED.bat_dau), ghi_chu = COALESCE(EXCLUDED.ghi_chu, phu_camp.ghi_chu),
        ket_thuc = COALESCE(EXCLUDED.ket_thuc, phu_camp.ket_thuc), nhip_ngay = COALESCE(${c.nhip_ngay == null ? null : Math.max(1, Number(c.nhip_ngay))}, phu_camp.nhip_ngay),
        tieu_chi = phu_camp.tieu_chi || EXCLUDED.tieu_chi, ke_hoach = COALESCE(EXCLUDED.ke_hoach, phu_camp.ke_hoach), updated_at = now()`);
    });
    cp++;
  }
  if (b.nguon?.key) {
    const g = b.nguon;
    await db.execute(sql`
      INSERT INTO phu_nguon (project_id, key, name, loai, trang_thai, macro_click, nap_usd, ghi_chu, postback_token)
      VALUES (${project}, ${g.key}, ${g.name ?? g.key}, ${g.loai ?? 'pop'}, ${g.trang_thai ?? 'du_kien'}, ${g.macro_click ?? null}, ${Number(g.nap_usd) || 0}, ${g.ghi_chu ?? null}, encode(gen_random_bytes(12), 'hex'))
      ON CONFLICT (project_id, key) DO UPDATE SET name = COALESCE(${g.name ?? null}, phu_nguon.name), loai = COALESCE(${g.loai ?? null}, phu_nguon.loai),
        trang_thai = COALESCE(${g.trang_thai ?? null}, phu_nguon.trang_thai), macro_click = COALESCE(${g.macro_click ?? null}, phu_nguon.macro_click),
        nap_usd = COALESCE(${g.nap_usd == null ? null : Number(g.nap_usd)}, phu_nguon.nap_usd), ghi_chu = COALESCE(${g.ghi_chu ?? null}, phu_nguon.ghi_chu), updated_at = now()`);
  }
  if (b.adapter?.key) {
    const a = b.adapter;
    await db.execute(sql`
      INSERT INTO phu_adapter (project_id, key, name, loai, lich, last_run, last_ok, last_note)
      VALUES (${project}, ${a.key}, ${a.name || a.key}, ${a.loai ?? 'cron'}, ${a.lich ?? null}, now(), ${!!a.ok}, ${a.note ?? null})
      ON CONFLICT (project_id, key) DO UPDATE SET name = EXCLUDED.name, loai = EXCLUDED.loai, lich = COALESCE(EXCLUDED.lich, phu_adapter.lich),
        last_run = now(), last_ok = EXCLUDED.last_ok, last_note = EXCLUDED.last_note`);
  }
  return NextResponse.json({ ok: true, events_moi: ev, chi, landers: ld, camp: cp });
}
