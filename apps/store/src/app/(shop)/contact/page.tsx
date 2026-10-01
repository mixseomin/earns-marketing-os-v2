import { shopHienTai } from '@/lib/shop';
import { LienHe } from '@/components/lien-he';

export const metadata = { title: 'Contact Us' };
export default async function TrangLienHe({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const s = await shopHienTai(); if (!s) return null;
  const t = s.mt.trang['contact'];
  return <div className="khung trang" style={{ maxWidth: 720 }}>
    <h1>Contact Us</h1>
    {t ? <div className="noi-dung" dangerouslySetInnerHTML={{ __html: t.html }} /> : <p>We usually reply within 24 hours.</p>}
    {s.mt.email && <p>Email: <a href={`mailto:${s.mt.email}`}>{s.mt.email}</a></p>}
    <LienHe don={((await searchParams).order ?? '').replace(/[^0-9A-Za-z-]/g, '').slice(0, 20)} />
  </div>;
}
