import type { MetadataRoute } from 'next';
import { shopHienTai } from '@/lib/shop';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await shopHienTai();
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/checkout', '/thank-you', '/api/'] }], sitemap: s ? `https://${s.domain}/sitemap.xml` : undefined };
}
