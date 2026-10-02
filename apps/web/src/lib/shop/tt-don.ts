// SHOP — đọc TRẠNG THÁI THANH TOÁN từng đơn từ cổng (migration 0216; CHỈ ĐỌC). Hiện: Stripe (đơn mặt tiền mos có mã PaymentIntent trong raw.pi).
// Mỗi nhịp cron ≤ 30 đơn, ưu tiên đơn mới: < 3 ngày đọc lại mỗi giờ · < 30 ngày mỗi 6 giờ · tới 120 ngày mỗi ngày. Ghi ảnh chụp vào shop_don.tt,
// và đồng bộ hai số sổ đang dùng để tính lãi: hoan (tiền đã hoàn thật) + phi_cong (phí cổng thật).
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { coStripe, stripe } from '@mos2/shop/stripe';
import type { TtDon } from './tt-don-luat';

type Row = Record<string, unknown>;
const q = async <T = Row>(s: ReturnType<typeof sql>) => { const d = getDb(); if (!d) throw new Error('chưa nối DB'); return (await d.execute(s)) as unknown as T[]; };
const iso = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);

type Bt = { id: string; status: string; available_on: number; fee: number; net: number };
type Charge = { id: string; amount: number; currency: string; disputed: boolean; balance_transaction: Bt | string | null;
  outcome?: { risk_level?: string | null; risk_score?: number | null; seller_message?: string | null } | null;
  refunds?: { data: { id: string; amount: number; status: string; reason: string | null; created: number }[] } };
type Pi = { id: string; amount: number; currency: string; latest_charge: Charge | string | null };
type Rut = { id: string; status: string; created: number; arrival_date: number; automatic: boolean };

export async function docTtDon(gioiHan = 30) {
  const ds = await q<{ id: number; khoa: string; pi: string; cong_tt: string | null }>(sql`
    SELECT d.id, c.khoa, d.raw->>'pi' AS pi, d.cong_tt FROM shop_don d JOIN shop_cua_hang c ON c.id = d.cua_hang_id
     WHERE d.raw->>'pi' IS NOT NULL AND d.tra_luc > now() - interval '120 days'
       AND (d.tt_luc IS NULL OR d.tt_luc < now() - CASE WHEN d.tra_luc > now() - interval '3 days' THEN interval '1 hour'
                                                       WHEN d.tra_luc > now() - interval '30 days' THEN interval '6 hours' ELSE interval '1 day' END)
     ORDER BY d.tt_luc NULLS FIRST, d.tra_luc DESC LIMIT ${gioiHan}`);
  const rutTheoShop = new Map<string, Rut[]>();
  let doc = 0, loi = 0;
  for (const d of ds) {
    if (!coStripe(d.khoa)) continue;
    try {
      const pi = await stripe<Pi>(d.khoa, 'GET', `payment_intents/${encodeURIComponent(d.pi)}?expand[]=latest_charge.balance_transaction&expand[]=latest_charge.refunds`);
      const ch = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      const bt = ch && typeof ch.balance_transaction === 'object' ? ch.balance_transaction : null;
      let dispute: TtDon['dispute'] = null, efw = false, rut: TtDon['rut'] = null;
      if (ch?.disputed) {
        const r = await stripe<{ data: { id: string; amount: number; status: string; reason: string; evidence_details?: { due_by?: number | null } }[] }>(d.khoa, 'GET', `disputes?payment_intent=${encodeURIComponent(pi.id)}&limit=1`);
        const x = r.data[0];
        if (x) dispute = { id: x.id, so: x.amount / 100, trang_thai: x.status, ly_do: x.reason, han: iso(x.evidence_details?.due_by) };
      }
      if (ch) efw = (await stripe<{ data: unknown[] }>(d.khoa, 'GET', `radar/early_fraud_warnings?charge=${encodeURIComponent(ch.id)}`)).data.length > 0;
      if (bt?.status === 'available') {
        // lần rút tự động đầu tiên tạo SAU ngày khả dụng là lần chứa tiền này (lịch rút tự động gom mọi khoản đã khả dụng)
        if (!rutTheoShop.has(d.khoa)) rutTheoShop.set(d.khoa, (await stripe<{ data: Rut[] }>(d.khoa, 'GET', 'payouts?limit=50')).data);
        const p = (rutTheoShop.get(d.khoa) ?? []).filter((x) => x.automatic && x.created >= bt.available_on).sort((a, b) => a.created - b.created)[0];
        if (p) rut = { id: p.id, trang_thai: p.status, ngay_ve: iso(p.arrival_date)!.slice(0, 10) };
      }
      const hoan = (ch?.refunds?.data ?? []).map((h) => ({ id: h.id, so: h.amount / 100, trang_thai: h.status, ly_do: h.reason, luc: iso(h.created)! }));
      const tt: TtDon = { cong: d.cong_tt ?? 'Stripe', pi: pi.id, charge: ch?.id ?? null, tien: pi.amount / 100, phi: bt ? bt.fee / 100 : null, thuc_nhan: bt ? bt.net / 100 : null,
        tien_te: pi.currency.toUpperCase(), tien_ve: { trang_thai: bt?.status ?? null, kha_dung_tu: bt ? iso(bt.available_on)!.slice(0, 10) : null }, rut, hoan, dispute, efw,
        rui_ro: ch?.outcome ? { muc: ch.outcome.risk_level ?? null, diem: ch.outcome.risk_score ?? null, ghi: ch.outcome.seller_message ?? null } : undefined, luc: new Date().toISOString() };
      const daHoan = hoan.filter((h) => h.trang_thai === 'succeeded').reduce((s, h) => s + h.so, 0);
      await q(sql`UPDATE shop_don SET tt = ${JSON.stringify(tt)}::jsonb, tt_luc = now(), hoan = GREATEST(hoan, ${daHoan}), phi_cong = COALESCE(${tt.phi}, phi_cong) WHERE id = ${d.id}`);
      doc++;
    } catch (e) {
      await q(sql`UPDATE shop_don SET tt_luc = now(), tt = COALESCE(tt, '{}'::jsonb) || ${JSON.stringify({ loi: (e as Error).message.slice(0, 200) })}::jsonb WHERE id = ${d.id}`);
      loi++;
    }
  }
  return { doc, loi };
}
