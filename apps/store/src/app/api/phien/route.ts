// POST /api/phien {p, meta?, cuon, ev:[{l,t,c,ts}]} — sổ phiên khách (components/phien.tsx gửi). Bot bỏ ngay; không lưu IP.
// Một lượt: upsert shop_phien (nhịp cuối, trang đang xem, % cuộn, chặng xa nhất, đếm trang/click, giỏ, số đơn) + chèn sự kiện (trừ nhịp).
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { BAO_SANG_CHANG, LA_BOT, SO_CHANG, docUa } from '@mos2/shop/phien';
import { shopHienTai } from '@/lib/shop';
import { ipCua, quaGioiHan } from '@/lib/chan';

type Ev = { l?: string; t?: string; c?: Record<string, unknown>; ts?: number };
const LOAI = new Set(['nhip', 'xem_trang', 'cuon', 'click', 'chon', 'mo_gio', 'nhap_tt', 'checkout', ...Object.keys(BAO_SANG_CHANG).map((k) => BAO_SANG_CHANG[k]!)]);
const cat = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : null);

export async function POST(req: Request) {
  const ok = NextResponse.json({ ok: true });
  if (LA_BOT.test(req.headers.get('user-agent') ?? '')) return ok;
  if (quaGioiHan(`phien:${ipCua(req)}`, 1200, 3600_000)) return ok;
  const s = await shopHienTai(), db = getDb();
  if (!s || !db) return ok;
  const b = (await req.json().catch(() => null)) as { p?: string; meta?: { k?: string; dau?: string; ref?: string | null; tb?: string; ng?: string; mg?: string | null; mh?: string }; cuon?: number; ev?: Ev[] } | null;
  const id = cat(b?.p, 60);
  if (!b || !id) return ok;
  const ev = (b.ev ?? []).filter((e) => e.l && LOAI.has(e.l)).slice(0, 50);
  const bayGio = Date.now();
  const tsCua = (e: Ev) => new Date(Math.min(bayGio, Math.max(bayGio - 600_000, Number(e.ts) || bayGio))).toISOString();
  const chang = Math.max(0, ...ev.map((e) => SO_CHANG[e.l!] ?? (e.l === 'xem_trang' ? 0 : -1)));
  const soTrang = ev.filter((e) => e.l === 'xem_trang').length, soClick = ev.filter((e) => e.l === 'click').length;
  const gio = ev.filter((e) => e.l === 'them_gio').reduce((t, e) => t + (Number(e.c?.value) || 0), 0);
  const don = cat(ev.find((e) => e.l === 'dat_hang')?.c?.so, 20);
  const trang = cat(ev[ev.length - 1]?.t, 200);
  const cuon = Math.max(0, Math.min(100, Math.round(Number(b.cuon) || 0)));

  // Phiên mới: nguồn = cookie utm "nguon" (middleware) → host referrer → direct
  let nguon = 'direct', utm: Record<string, string> | null = null;
  try { utm = JSON.parse((await cookies()).get('nguon')?.value ?? 'null'); } catch { /* cookie hỏng */ }
  const ref = cat(b.meta?.ref, 300);
  if (utm?.sid) nguon = utm.sid;
  else if (ref) { try { const h = new URL(ref).hostname.replace(/^www\./, ''); if (!s.domain.endsWith(h) && !h.endsWith(s.domain)) nguon = h; } catch { /* ref hỏng */ } }
  const hd = req.headers;
  const tp = hd.get('cf-ipcity'), nuoc = hd.get('cf-ipcountry');
  const ua = docUa(hd.get('user-agent') ?? '');
  const mh = cat(b.meta?.mh, 20), mhOk = mh && /^\d{2,5}×\d{2,5}$/.test(mh) ? mh : null;

  await db.execute(sql`
    INSERT INTO shop_phien (id, cua_hang_id, khach_id, trang_dau, trang_hien, cuon, nguon, utm, ref, thiet_bi, nuoc, thanh_pho, chang, so_trang, so_click, gio_gia, so_don,
                            trinh_duyet, he_dieu_hanh, ngon_ngu, mui_gio, man_hinh)
    VALUES (${id}, ${s.id}, ${cat(b.meta?.k, 60)}, ${cat(b.meta?.dau, 300) ?? trang}, ${trang}, ${cuon}, ${nguon}, ${utm ? JSON.stringify(utm) : null}::jsonb, ${ref},
            ${cat(b.meta?.tb, 10)}, ${nuoc && nuoc !== 'XX' ? nuoc : null}, ${tp ? decodeURIComponent(tp).slice(0, 60) : null}, ${chang}, ${soTrang}, ${soClick}, ${gio}, ${don},
            ${ua.trinh_duyet}, ${ua.he_dieu_hanh}, ${cat(b.meta?.ng, 20)}, ${cat(b.meta?.mg, 60)}, ${mhOk})
    ON CONFLICT (id) DO UPDATE SET cuoi = now(), trang_hien = COALESCE(EXCLUDED.trang_hien, shop_phien.trang_hien),
      cuon = CASE WHEN EXCLUDED.trang_hien IS DISTINCT FROM shop_phien.trang_hien AND ${soTrang} > 0 THEN EXCLUDED.cuon ELSE GREATEST(shop_phien.cuon, EXCLUDED.cuon) END,
      chang = GREATEST(shop_phien.chang, EXCLUDED.chang), so_trang = shop_phien.so_trang + EXCLUDED.so_trang, so_click = shop_phien.so_click + EXCLUDED.so_click,
      gio_gia = shop_phien.gio_gia + EXCLUDED.gio_gia, so_don = COALESCE(EXCLUDED.so_don, shop_phien.so_don),
      -- thiết bị: điền khi còn trống (phiên mở trước bản 0217, hoặc lần gửi đầu thiếu) — không ghi đè
      trinh_duyet = COALESCE(shop_phien.trinh_duyet, EXCLUDED.trinh_duyet), he_dieu_hanh = COALESCE(shop_phien.he_dieu_hanh, EXCLUDED.he_dieu_hanh),
      ngon_ngu = COALESCE(shop_phien.ngon_ngu, EXCLUDED.ngon_ngu), mui_gio = COALESCE(shop_phien.mui_gio, EXCLUDED.mui_gio), man_hinh = COALESCE(shop_phien.man_hinh, EXCLUDED.man_hinh)
    WHERE shop_phien.cua_hang_id = ${s.id}`);
  const ghi = ev.filter((e) => e.l !== 'nhip');
  if (ghi.length) await db.execute(sql`
    INSERT INTO shop_phien_su_kien (phien_id, ts, loai, trang, chi_tiet)
    SELECT ${id}, x.ts::timestamptz, x.l, x.t, x.c FROM jsonb_to_recordset(${JSON.stringify(ghi.map((e) => ({ ts: tsCua(e), l: e.l, t: cat(e.t, 200), c: e.c ?? null })))}::jsonb)
      AS x(ts text, l text, t text, c jsonb)`);
  return ok;
}
