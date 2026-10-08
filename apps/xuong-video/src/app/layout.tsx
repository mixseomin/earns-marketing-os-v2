import type { Metadata } from 'next';
import './xv.css';
import { PhongToKhiRe } from '@/components/phong-to';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Xưởng video', template: '%s · Xưởng video' }, robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <header className="xv-top">
          <a href="/" className="xv-brand">🎬 Xưởng video</a>
          <span className="xv-mono">kịch bản → storyboard → keyframe → clip → ghép</span>
          <span style={{ flex: 1 }} />
          <a href="/log" className="xv-mono">💰 sổ chi phí</a>
          <a href="https://mos2.on.tc" className="xv-mono">mos2</a>
        </header>
        <main className="xv-main">{children}</main>
        <PhongToKhiRe />
      </body>
    </html>
  );
}
