import 'server-only';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import type { MucThuVien } from './thu-vien';

/** Mọi mẫu trong thư viện thiết kế, mới nhất trước. Bảng chưa có (migration chưa chạy) → rỗng, không làm gãy trang chủ. */
export async function docThuVien(): Promise<MucThuVien[]> {
  const d = getDb(); if (!d) return [];
  try {
    const r = (await d.execute(sql`SELECT id, ten, nhanh, mo_ta, cach_dung, nguon_url, tac_gia, giay_phep, anh, the, ban_luu,
      tao_luc::text AS tao_luc FROM thu_vien ORDER BY tao_luc DESC`)) as unknown as MucThuVien[];
    return r;
  } catch (e) {
    console.error('thu_vien:', (e as Error).message);
    return [];
  }
}
