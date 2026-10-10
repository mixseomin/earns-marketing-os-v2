import type { Metadata } from 'next';
import './cty.css';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Công ty', template: '%s · Công ty' }, robots: { index: false, follow: false } };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  return (
    <html lang="vi">
      <body>
        <header className="cty-top">
          <a href="/" className="cty-brand">🏢 Công ty</a>
          <a href="/" className="cty-mono">sơ đồ</a>
          <a href="/luat" className="cty-mono">luật chung</a>
          <a href="/muc-tieu" className="cty-mono">mục tiêu · ngân sách</a>
          <a href="https://vp.on.tc" className="cty-mono">văn phòng pixel ↗</a>
          <span style={{ flex: 1 }} />
          <span className="cty-pill cty-pill-off">chế độ tham quan</span>
          <a href="https://mos2.on.tc" className="cty-mono">mos2</a>
          {me && <span className="cty-mono cty-muted">{me.displayName || me.email}</span>}
        </header>
        <main className="cty-main">{children}</main>
      </body>
    </html>
  );
}
