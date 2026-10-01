import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

type Row = Record<string, unknown>;
export const q = async <T = Row>(s: ReturnType<typeof sql>) => {
  const d = getDb(); if (!d) throw new Error('chưa nối DB');
  return (await d.execute(s)) as unknown as T[];
};

/** Nhật ký từng đơn (drawer /shop đọc thành dòng thời gian). */
export async function ghiSuKien(donId: number, nguon: string, noiDung: string, loi = false) {
  await q(sql`INSERT INTO shop_su_kien (don_id, nguon, noi_dung, loi) VALUES (${donId}, ${nguon}, ${noiDung}, ${loi})`);
}

/** Link theo dõi gửi khách — trang của chính shop, mang chìa đơn (khách không phải gõ gì). */
export const linkTheoDoi = (ch: { domain: string; nen_tang?: string }, soDon: string, khoaDon: string) =>
  ch.nen_tang === 'mos'
    ? `https://${ch.domain}/trackings/search?order=${encodeURIComponent(soDon)}&key=${encodeURIComponent(khoaDon)}`
    : `https://${ch.domain}/track-order/?order=${encodeURIComponent(soDon)}&key=${encodeURIComponent(khoaDon)}`;
