import { shopHienTai } from '@/lib/shop';
import { ThanhToan } from '@/components/thanh-toan';
import { pkStripe } from '@mos2/shop/stripe';

export const metadata = { title: 'Secure Checkout', robots: { index: false } };
export default async function TrangThanhToan() {
  const s = await shopHienTai(); if (!s) return null;
  return <ThanhToan ten={s.ten} logo={s.mt.logo ?? null} pk={pkStripe(s.khoa)} shipTen={s.mt.ship.ten ?? 'Shipping'}
    saleHet={s.mt.sale_het && Date.parse(s.mt.sale_het) > Date.now() ? s.mt.sale_het : null} />;
}
