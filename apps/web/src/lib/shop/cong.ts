// SHOP — CỔNG THANH TOÁN (migration 0213): tự nhận cổng từ khoá của từng shop, chụp số thô sức khoẻ từ Stripe (CHỈ ĐỌC), lưu ảnh chụp + lịch sử ngày.
// Đánh giá đỏ/vàng: lib/shop/cong-luat.ts (thuần, dùng chung với màn). Gọi từ cron /api/cron/shop (mỗi cổng ~6 giờ một lần) và nút "Đọc lại".
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { coStripe, stripe } from '@mos2/shop/stripe';
import { dsCuaHang } from './dong-bo';
import type { CongDong, SucKhoeCong } from './cong-luat';

type Row = Record<string, unknown>;
const q = async <T = Row>(s: ReturnType<typeof sql>) => { const d = getDb(); if (!d) throw new Error('chưa nối DB'); return (await d.execute(s)) as unknown as T[]; };

type Ds<T> = { data: T[]; has_more: boolean };
/** Lật trang list API của Stripe (tối đa `trang` × 100 dòng) — đủ cho shop nhỏ; quá thì báo doc_het = false. */
async function het<T extends { id: string }>(khoa: string, duong: string, trang = 10): Promise<{ ds: T[]; het: boolean }> {
  const ds: T[] = [];
  let sau = '';
  for (let i = 0; i < trang; i++) {
    const r = await stripe<Ds<T>>(khoa, 'GET', `${duong}${duong.includes('?') ? '&' : '?'}limit=100${sau ? `&starting_after=${sau}` : ''}`);
    ds.push(...r.data);
    if (!r.has_more || !r.data.length) return { ds, het: true };
    sau = r.data[r.data.length - 1]!.id;
  }
  return { ds, het: false };
}

/** Chụp số thô một tài khoản Stripe bằng khoá của một shop dùng nó. Ném lỗi nếu Stripe từ chối. */
export async function chupStripe(khoa: string, domainMinh: string[]): Promise<SucKhoeCong> {
  const bayGio = Math.floor(Date.now() / 1000), t90 = bayGio - 90 * 86400, t30 = bayGio - 30 * 86400;
  type Acct = { id: string; country?: string; default_currency?: string; charges_enabled?: boolean; payouts_enabled?: boolean; business_profile?: { name?: string | null };
    settings?: { dashboard?: { display_name?: string }; payouts?: { schedule?: { interval?: string; delay_days?: number } } };
    requirements?: { currently_due?: string[]; past_due?: string[]; disabled_reason?: string | null; current_deadline?: number | null } };
  const a = await stripe<Acct>(khoa, 'GET', 'account');
  const b = await stripe<{ available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] }>(khoa, 'GET', 'balance');
  const tt = (a.default_currency ?? 'usd').toLowerCase();
  const tong = (x: { amount: number; currency: string }[]) => x.filter((y) => y.currency === tt).reduce((s, y) => s + y.amount, 0) / 100;
  type Charge = { id: string; created: number; status: string; paid: boolean; amount: number; amount_refunded: number; refunded: boolean; outcome?: { type?: string } | null };
  const ch = await het<Charge>(khoa, `charges?created[gte]=${t90}`);
  const dp = await het<{ id: string; status: string }>(khoa, `disputes?created[gte]=${t90}`, 3);
  const efw = await het<{ id: string }>(khoa, `radar/early_fraud_warnings?created[gte]=${t90}`, 2);
  const po = await stripe<Ds<{ id: string; amount: number; arrival_date: number; status: string; failure_message?: string | null }>>(khoa, 'GET', 'payouts?limit=5');
  const wh = await stripe<Ds<{ url: string; status: string; enabled_events: string[] }>>(khoa, 'GET', 'webhook_endpoints?limit=50');
  const ev = await het<{ id: string; created: number; pending_webhooks: number }>(khoa, `events?created[gte]=${bayGio - 3 * 86400}`, 3);
  const thanh = ch.ds.filter((c) => c.status === 'succeeded'), hong = ch.ds.filter((c) => c.status === 'failed');
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  return {
    luc: new Date().toISOString(),
    tai_khoan: { id: a.id, ten: a.settings?.dashboard?.display_name ?? a.business_profile?.name ?? null, nuoc: a.country ?? null, tien_te: tt, nhan_tien: !!a.charges_enabled, rut_tien: !!a.payouts_enabled,
      thieu: a.requirements?.currently_due ?? [], qua_han: a.requirements?.past_due ?? [], ly_do_khoa: a.requirements?.disabled_reason ?? null, han: a.requirements?.current_deadline ?? null,
      lich_rut: a.settings?.payouts?.schedule ? `${a.settings.payouts.schedule.interval ?? ''}${a.settings.payouts.schedule.delay_days != null ? ` · trễ ${a.settings.payouts.schedule.delay_days} ngày` : ''}` : null },
    so_du: { kha_dung: tong(b.available), cho: tong(b.pending), tien_te: tt },
    ky90: { thanh_cong: thanh.length, tien: thanh.reduce((s, c) => s + c.amount, 0) / 100, that_bai: hong.length, chan_rui_ro: ch.ds.filter((c) => c.outcome?.type === 'blocked').length,
      hoan: thanh.filter((c) => c.amount_refunded > 0).length, tien_hoan: thanh.reduce((s, c) => s + c.amount_refunded, 0) / 100,
      dispute: dp.ds.length, dispute_mo: dp.ds.filter((d) => ['needs_response', 'warning_needs_response'].includes(d.status)).length, efw: efw.ds.length, doc_het: ch.het },
    ky30: { thanh_cong: thanh.filter((c) => c.created >= t30).length, that_bai: hong.filter((c) => c.created >= t30).length },
    rut: po.data.map((p) => ({ id: p.id, so: p.amount / 100, ngay: new Date(p.arrival_date * 1000).toISOString().slice(0, 10), trang_thai: p.status, loi: p.failure_message ?? null })),
    webhook: wh.data.map((w) => ({ url: w.url, trang_thai: w.status, so_su_kien: w.enabled_events.length, cua_minh: domainMinh.includes(host(w.url)) })),
    su_kien_treo: ev.ds.filter((e) => e.pending_webhooks > 0 && e.created < bayGio - 3600).length,
  };
}

/** Nhận cổng + đọc sức khoẻ. Mỗi shop có khoá Stripe → GET account → gắn shop vào cổng (một acct = một cổng, nhiều shop dùng chung).
 *  Cổng đọc quá `tuoiGio` giờ (hoặc ep) → chụp lại, lưu ảnh chụp + một dòng lịch sử / ngày. */
export async function docCong(o: { ep?: boolean; tuoiGio?: number } = {}) {
  const shops = (await dsCuaHang(false)).filter((c) => coStripe(c.khoa));
  const domainMinh = (await q<{ d: string }>(sql`SELECT DISTINCT unnest(array_append(ten_mien, domain)) AS d FROM shop_cua_hang`)).map((x) => x.d.replace(/^www\./, ''));
  const theoCong = new Map<number, string>();   // cổng → khoá một shop dùng nó (để đọc)
  const kq: Record<string, unknown>[] = [];
  for (const ch of shops) {
    try {
      const a = await stripe<{ id: string; settings?: { dashboard?: { display_name?: string } } }>(ch.khoa, 'GET', 'account');
      const [c] = await q<{ id: number }>(sql`INSERT INTO shop_cong (loai, ma, ten) VALUES ('stripe', ${a.id}, ${a.settings?.dashboard?.display_name ?? null})
        ON CONFLICT (loai, ma) DO UPDATE SET ten = COALESCE(shop_cong.ten, EXCLUDED.ten) RETURNING id`);
      await q(sql`UPDATE shop_cua_hang SET cong_id = ${c!.id} WHERE id = ${ch.id}`);
      if (!theoCong.has(c!.id)) theoCong.set(c!.id, ch.khoa);
    } catch (e) { kq.push({ shop: ch.khoa, loi: (e as Error).message.slice(0, 200) }); }
  }
  for (const [id, khoa] of theoCong) {
    const [c] = await q<{ doc_luc: string | null }>(sql`SELECT doc_luc::text FROM shop_cong WHERE id = ${id}`);
    if (!o.ep && c?.doc_luc && Date.now() - Date.parse(c.doc_luc) < (o.tuoiGio ?? 6) * 3600_000) continue;
    try {
      const s = await chupStripe(khoa, domainMinh);
      await q(sql`UPDATE shop_cong SET suc_khoe = ${JSON.stringify(s)}::jsonb, doc_luc = now(), loi = NULL WHERE id = ${id}`);
      await q(sql`INSERT INTO shop_cong_lich_su (cong_id, ngay, so) VALUES (${id}, current_date, ${JSON.stringify({ ky90: s.ky90, ky30: s.ky30, so_du: s.so_du })}::jsonb)
        ON CONFLICT (cong_id, ngay) DO UPDATE SET so = EXCLUDED.so`);
      kq.push({ cong: id, ok: true });
    } catch (e) {
      await q(sql`UPDATE shop_cong SET loi = ${(e as Error).message.slice(0, 300)}, doc_luc = now() WHERE id = ${id}`);
      kq.push({ cong: id, loi: (e as Error).message.slice(0, 200) });
    }
  }
  return kq;
}

export async function docDsCong(): Promise<CongDong[]> {
  const d = getDb();
  if (!d) return [];
  const [cg, ls] = await Promise.all([
    q(sql`SELECT g.id, g.loai, g.ma, g.ten, g.ghi_chu, g.nguong, g.suc_khoe, g.doc_luc::text AS doc_luc, g.loi,
            COALESCE((SELECT array_agg(c.khoa ORDER BY c.id) FROM shop_cua_hang c WHERE c.cong_id = g.id), '{}') AS shops FROM shop_cong g ORDER BY g.id`),
    q(sql`SELECT cong_id, ngay::text AS ngay, so FROM shop_cong_lich_su WHERE ngay > current_date - 30 ORDER BY ngay`),
  ]);
  return cg.map((r) => ({ id: Number(r.id), loai: String(r.loai), ma: String(r.ma), ten: (r.ten as string) ?? null, ghiChu: (r.ghi_chu as string) ?? null,
    nguong: (r.nguong ?? {}) as Record<string, number>, sucKhoe: (r.suc_khoe as SucKhoeCong) ?? null, docLuc: (r.doc_luc as string) ?? null, loi: (r.loi as string) ?? null,
    shops: (r.shops as string[]) ?? [], lichSu: ls.filter((x) => Number(x.cong_id) === Number(r.id)).map((x) => ({ ngay: String(x.ngay), so: x.so as CongDong['lichSu'][number]['so'] })) }));
}
