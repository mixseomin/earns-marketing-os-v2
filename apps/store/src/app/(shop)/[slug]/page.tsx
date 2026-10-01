import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { shopHienTai, sanPhamTheoSlug, danhGiaVaBan } from '@/lib/shop';
import { TrangMua } from '@/components/mua';
import { KhoiDanhGia } from '@/components/danh-gia';

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const s = await shopHienTai(); if (!s) return {};
  const sp = await sanPhamTheoSlug(s, (await params).slug); if (!sp) return {};
  const mo = sp.mo_ta.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 155);
  return { title: sp.ten, description: mo, openGraph: { title: sp.tieu_de, description: mo, images: sp.anh_ds.slice(0, 1) }, alternates: { canonical: `/${sp.slug}` } };
}

export default async function TrangSanPham({ params }: P) {
  const s = await shopHienTai(); if (!s) notFound();
  const sp = await sanPhamTheoSlug(s, (await params).slug); if (!sp) notFound();
  const dg = await danhGiaVaBan(sp.id);
  const m = s.mt;
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: sp.ten, image: sp.anh_ds, brand: { '@type': 'Brand', name: s.ten },
    offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: sp.gia, highPrice: Math.max(...sp.bien_the.map((b) => b.gia)),
      availability: sp.bien_the.some((b) => !b.het_hang) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
    ...(dg.so > 0 && dg.tb ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: dg.tb, reviewCount: dg.so } } : {}) };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    <div className="khung">
      <TrangMua d={{ sp, diem: dg.tb, soDg: dg.so, daBan: dg.daBan, saleHet: m.sale_het && Date.parse(m.sale_het) > Date.now() ? m.sale_het : null,
        dongSale: m.dong_sale ?? null, tonDuoi: m.ton_hien_duoi, camKet: m.cam_ket ?? [], bac: m.bac_giam }} />
    </div>
    {sp.mo_ta && <section className="khoi"><div className="khung hai">
      <h2 className="nhan-an">Description</h2>
      <div className="mo-ta" dangerouslySetInnerHTML={{ __html: sp.mo_ta }} />
    </div></section>}
    <section className="khoi" id="reviews"><div className="khung"><KhoiDanhGia spId={sp.id} ds={dg.ds} tb={dg.tb} so={dg.so} /></div></section>
    <section className="khoi xam"><div className="khung hai">
      <h2>Shipping &amp; Returns</h2>
      <p className="chinh-sach" style={{ fontSize: 17, margin: 0 }}><span style={{ color: 'var(--nhan)' }}>{s.ten}</span> stands by our product quality and offers returns,
        refunds, and exchanges. Please see our policy details <Link href="/static/exchanges-returns">here</Link>. You may also learn more about shipping
        FAQs <Link href="/static/orders-shipping">here</Link>.</p>
    </div></section>
    {(m.faq ?? []).length > 0 && <section className="khoi faq"><div className="khung">
      <h2>FAQ</h2>
      {m.faq!.map((f) => <details key={f.hoi}><summary>{f.hoi}</summary><div dangerouslySetInnerHTML={{ __html: f.dap }} /></details>)}
    </div></section>}
  </>;
}
