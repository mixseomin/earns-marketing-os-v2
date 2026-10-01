import Link from 'next/link';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { chotThanhToan, type MonTT } from '@mos2/shop/thanh-toan';
import { usd } from '@mos2/shop/gia';
import { shopHienTai } from '@/lib/shop';
import { BaoMua } from '@/components/bao-mua';
import { CamKet, DuKien } from '@/components/giao-khach';
import { cauHinhGiao } from '@mos2/shop/giao';

export const metadata = { title: 'Thank you', robots: { index: false } };
type P = { searchParams: Promise<{ tt?: string }> };

// Trang cảm ơn = một trong ba cửa chốt đơn (webhook · trang này · đối soát cron). Tải lại trang không tạo đơn thứ hai.
export default async function CamOn({ searchParams }: P) {
  const s = await shopHienTai(); const db = getDb();
  const tt = (await searchParams).tt ?? '';
  if (!s || !db || !/^[0-9a-f-]{36}$/.test(tt)) return <div className="khung trang"><h1>Order not found</h1><p><Link href="/">Continue shopping</Link></p></div>;
  const d = await chotThanhToan(s, tt).catch(() => null);
  const g = cauHinhGiao(s.mt.giao);
  const [p] = (await db.execute(sql`SELECT mon, tong::text, khach->>'email' AS email FROM shop_thanh_toan WHERE id = ${tt}::uuid AND cua_hang_id = ${s.id}`)) as unknown as
    { mon: MonTT[]; tong: string; email: string | null }[];
  if (!d) return <div className="khung trang"><h1>Your payment is processing</h1>
    <p>We are confirming your payment with the bank. This usually takes a few seconds. <Link href={`/thank-you?tt=${tt}`}>Refresh this page</Link>.</p>
    <p>If you were charged and this page does not update, email us at {s.mt.email} and we will sort it out right away.</p></div>;
  return <div className="khung trang" style={{ maxWidth: 720 }}>
    <BaoMua so={d.so_don} tong={Number(p?.tong ?? 0)} mon={(p?.mon ?? []).map((m) => ({ item_id: String(m.san_pham_id), item_name: m.ten, item_variant: m.tuy_chon, price: m.gia, quantity: m.sl }))} />
    <h1>Thank you for your order!</h1>
    <p style={{ fontSize: 17 }}>Your order number is <b>#{d.so_don}</b>.{p?.email ? <> A confirmation email is on its way to <b>{p.email}</b>.</> : null}</p>
    <div style={{ border: '1px solid var(--vien)', borderRadius: 6, padding: 20, margin: '20px 0' }}>
      {(p?.mon ?? []).map((m) => <div className="tt-mon" key={m.bien_the_id}>{m.anh ? <img src={m.anh} alt="" /> : <div />}
        <div><div className="ten-m">{m.ten}</div><div className="tc">{m.tuy_chon}</div><div className="dg-m"><span>Qty {m.sl}</span><span>{usd(m.gia * m.sl)}</span></div></div></div>)}
      <div className="tt-tong"><div className="cuoi"><span>Total paid</span><span>{usd(Number(p?.tong ?? 0))}</span></div></div>
    </div>
    <DuKien g={g} nhan="Estimated delivery:" />
    <CamKet g={g} />
    <p style={{ marginTop: 18 }}>We will email you at each step: when your order ships, when it reaches the US, and when it is out for delivery. You can also check it any time:</p>
    <p><Link className="nut-tt" style={{ maxWidth: 360 }} href={`/trackings/search?order=${d.so_don}&key=${d.khoa_don}`}>Track your order</Link></p>
  </div>;
}
