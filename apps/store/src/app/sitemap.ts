import type { MetadataRoute } from 'next';
import { shopHienTai, dsSanPham } from '@/lib/shop';
import { TRANG_TINH } from '@mos2/shop/mat-tien';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const s = await shopHienTai(); if (!s) return [];
  const goc = `https://${s.domain}`;
  return [{ url: goc }, ...(await dsSanPham(s)).map((p) => ({ url: `${goc}/${p.slug}` })),
    ...TRANG_TINH.filter((t) => s.mt.trang[t.khoa]).map((t) => ({ url: `${goc}/static/${t.khoa}` })), { url: `${goc}/contact` }, { url: `${goc}/trackings/search` }];
}
