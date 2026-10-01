import Link from 'next/link';
import { shopHienTai } from '@/lib/shop';
import { NutGio } from '@/components/gio';
import { Menu } from '@/components/menu';
import { DangKy } from '@/components/dang-ky';
import { LenDau } from '@/components/len-dau';
import { TRANG_TINH } from '@mos2/shop/mat-tien';

// Khung trang bán hàng — khuôn orabra: đầu trang dính (dải trên · logo giữa · giỏ phải · menu ngang ở desktop, ☰ ở mobile),
// "Scroll to top", chân trang 3 cột (Contact us · Info · đăng ký nhận mã). Checkout đứng ngoài khung này.
export default async function KhungShop({ children }: { children: React.ReactNode }) {
  const s = await shopHienTai();
  if (!s) return null;
  const m = s.mt;
  const logo = m.logo ? <img src={m.logo} alt={s.ten} /> : s.ten;
  const chinh = [{ href: '/', ten: 'Home' }, { href: '/trackings/search', ten: 'Track your order' }];
  const lien = [...chinh, ...TRANG_TINH.map((t) => ({ href: `/static/${t.khoa}`, ten: t.ten })), { href: '/contact', ten: 'Contact us' }];
  return <>
    <div className="dau-dinh">
      {m.thanh_tren && <div className="thanh-tren"><span>{m.thanh_tren}</span></div>}
      <header className="dau"><div className="khung">
        <Menu lien={lien} /><Link className="logo" href="/">{logo}</Link><NutGio />
      </div>
        <nav className="dau-nav" aria-label="Main">{chinh.map((l) => <Link key={l.href} href={l.href}>{l.ten}</Link>)}</nav>
      </header>
    </div>
    <main>{children}</main>
    <LenDau />
    <footer className="chan"><div className="khung">
      <div className="cot">
        <div><h3>Need help?</h3><Link className="lien-he" href="/contact">Contact us</Link>
          {m.email && <div className="dc">Email: <a href={`mailto:${m.email}`}>{m.email}</a></div>}
          {m.dia_chi && <div className="dc">Address: {m.dia_chi}</div>}
        </div>
        <div><h3>{s.domain} info</h3>
          <Link className="lien" href="/static/privacy">Privacy Policy</Link><Link className="lien" href="/static/exchanges-returns">Refund Policy</Link>
          <Link className="lien" href="/static/terms-of-service">Terms of Service</Link><Link className="lien" href="/static/orders-shipping">Shipping Policy</Link>
          <Link className="lien" href="/trackings/search">Track your order</Link></div>
        {m.dang_ky ? <DangKy tieuDe={m.dang_ky.tieu_de} chu={m.dang_ky.chu} /> : <div />}
      </div>
      <div className="duoi"><span>© {new Date().getFullYear()} {s.ten}. All rights reserved.</span><span>Secure checkout by Stripe</span></div>
    </div></footer>
  </>;
}
