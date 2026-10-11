import type { Metadata } from 'next';
import './cty.css';
import { getCurrentUser } from '@/lib/auth';
import { NganLinks } from '@/components/ngan/links';
import { GopY } from '@/components/gop-y';
import { ChonMuiGio } from '@/components/gio';
import { ThanhTren } from '@/components/thanh-tren';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Công ty', template: '%s · Công ty' }, robots: { index: false, follow: false } };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  return (
    <html lang="vi">
      <head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" /></head>
      <body>
        <header className="cty-top">
          <a href="/" className="cty-brand">🏢 Công ty</a>
          <ThanhTren />
          <span style={{ flex: 1 }} />
          <ChonMuiGio />
          <span className="cty-pill cty-pill-off">chế độ tham quan</span>
          <a href="https://mos2.on.tc" className="cty-dh-muc">MOS2 ↗</a>
          {me && <span className="cty-nho cty-muted">{me.displayName || me.email}</span>}
        </header>
        <main className="cty-main">{children}</main>
        <NganLinks />
        {me?.role === 'admin' && <GopY />}
      </body>
    </html>
  );
}
