import Link from 'next/link';
import { shopHienTai } from '@/lib/shop';
import { NutGio } from '@/components/gio';
import { Menu } from '@/components/menu';
import { TRANG_TINH } from '@mos2/shop/mat-tien';

// Khung trang bán hàng: dải trên + đầu trang (menu · logo giữa · giỏ) + chân trang. Checkout đứng ngoài khung này (2 cột riêng).
export default async function KhungShop({ children }: { children: React.ReactNode }) {
  const s = await shopHienTai();
  if (!s) return null;
  const m = s.mt;
  const logo = m.logo ? <img src={m.logo} alt={s.ten} /> : s.ten;
  const lien = [{ href: '/', ten: 'Shop all' }, { href: '/trackings/search', ten: 'Order Tracking' },
    ...TRANG_TINH.map((t) => ({ href: `/static/${t.khoa}`, ten: t.ten })), { href: '/contact', ten: 'Contact Us' }];
  return <>
        {m.thanh_tren && <div className="thanh-tren">{m.thanh_tren}</div>}
        <header className="dau"><div className="khung"><Menu lien={lien} /><Link className="logo" href="/">{logo}</Link><NutGio /></div></header>
        <main>{children}</main>
        <footer className="chan"><div className="khung">
          <div className="cot">
            <div><h3 className="lon">How can we help you?</h3><Link className="lien-he" href="/contact">Contact Us</Link>
              {m.dia_chi && <div className="dc"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>{m.dia_chi}</div>}
              {m.email && <div className="dc"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg><a href={`mailto:${m.email}`} style={{ color: '#fff' }}>{m.email}</a></div>}
            </div>
            <div><h3>Order</h3><Link className="lien" href="/trackings/search">Order Tracking</Link>
              <Link className="lien" href="/static/exchanges-returns">Exchanges &amp; Returns</Link><Link className="lien" href="/static/orders-shipping">Order &amp; Shipping</Link></div>
            <div><h3>Resources</h3><Link className="lien" href="/static/terms-of-service">Terms of Service</Link><Link className="lien" href="/static/privacy">Privacy Policy</Link></div>
          </div>
          <div className="duoi"><span>Secure checkout by Stripe</span><span>© {new Date().getFullYear()} {s.ten}. All rights reserved.</span><a href="#">Go to top ↑</a></div>
        </div></footer>
  </>;
}
