import type { Metadata } from 'next';
import './xv.css';
import { PhongToKhiRe } from '@/components/phong-to';
import { GopY } from '@/components/gop-y';
import { getCurrentUser } from '@/lib/auth';
import { TheoDoiBan } from '@/components/theo-doi-ban';
import { maBan } from '@/lib/ban';
import { NganChung, NutNgan } from '@/components/ngan-chung';
import { GoiYHost } from '@/components/goi-y';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Xưởng video', template: '%s · Xưởng video' }, robots: { index: false, follow: false } };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  return (
    <html lang="vi">
      <body>
        <header className="xv-top">
          <a href="/" className="xv-brand">🎬 Xưởng video</a>
          <span className="xv-mono">kịch bản → storyboard → keyframe → clip → ghép</span>
          <span style={{ flex: 1 }} />
          <NutNgan y={{ loai: 'thu-vien' }}>🎬 thư viện điện ảnh</NutNgan>
          <NutNgan y={{ loai: 'so-chi-phi' }}>💰 sổ chi phí</NutNgan>
          <a href="https://mos2.on.tc" className="xv-mono">mos2</a>
        </header>
        <main className="xv-main">{children}</main>
        <PhongToKhiRe />
        <NganChung />
        <GoiYHost />
        {me?.role === 'admin' && <GopY />}
        <TheoDoiBan banDau={maBan()} />
      </body>
    </html>
  );
}
