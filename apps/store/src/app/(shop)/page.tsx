import Link from 'next/link';
import { shopHienTai, dsSanPham } from '@/lib/shop';
import { usd } from '@mos2/shop/gia';

export default async function TrangChu() {
  const s = await shopHienTai(); if (!s) return null;
  const ds = await dsSanPham(s);
  return <div className="khung">
    <h1 className="tieu-de-trang">Best Sellers</h1>
    <div className="luoi">{ds.map((p) => <Link key={p.id} className="the-sp" href={`/${p.slug}`}>
      <div className="a">{p.anh_ds[0] && <img src={p.anh_ds[0]} alt={p.ten} loading="lazy" />}</div>
      <div className="t">{p.ten}</div>
      <div className="g">{usd(p.gia)}{p.gia_goc ? <s>{usd(p.gia_goc)}</s> : null}</div>
    </Link>)}</div>
  </div>;
}
