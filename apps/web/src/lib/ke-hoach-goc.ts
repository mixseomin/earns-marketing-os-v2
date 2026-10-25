// KẾ HOẠCH GÓC HẰNG TUẦN (anh 25/10/2026: "kế hoạch phải tự sinh và tự cập nhật hàng tuần vào đây"; bước 4 kế hoạch góc spy):
// với mỗi máy studio đang chạy có nhóm góc spy (xv_may.goc_sp) → mỗi họ nền đã có bài 14 ngày qua × 7 ngày → một góc + một format.
//   góc: kho spy (bảng goc, loại ai_*), mỗi loại lấy các góc mạnh nhất (lượt nhắc), xếp xen loại; mỗi tuần dịch đi một đoạn để góc xoay vòng,
//        trong tuần mỗi họ nền lệch nhau 3 bậc (cùng ngày các nền khác góc).
//   format: xoay theo họ nền; format chưa có đường đăng đánh dấu can_dung; bài link một lần mỗi tuần và chỉ khi máy có nơi đăng link.
// Sinh khi CHƯA có (tuần này + tuần sau) lúc trang Lịch đọc — không cần tiến trình nền, không ghi đè ô đã sinh. 0đ, không gọi mô hình.
import 'server-only';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import type { GocBai } from './goc-spy';

type Fmt = { ten: string; nen: string; co: boolean };
// format theo họ nền (nen = nơi đăng của máy để nhãn / nhóm kênh khớp); co = đã có đường đăng
const F = (ten: string, nen: string, co = true): Fmt => ({ ten, nen, co });
const XOAY: Record<string, Fmt[]> = {
  facebook: [F('Reel', 'facebook'), F('Album 2 ảnh', 'fb_anh'), F('Thẻ chữ trên ảnh', 'fb_anh'), F('Ảnh + câu hỏi', 'fb_anh'), F('Reel', 'facebook'), F('A/B 2 ảnh', 'fb_anh'), F('Bài link', 'fb_link')],
  x: [F('Bình chọn', 'x_anh', false), F('Video', 'x'), F('Ảnh', 'x_anh'), F('Video', 'x'), F('Ảnh', 'x_anh'), F('Bình chọn', 'x_anh', false), F('Bài link', 'x_link')],
  instagram: [F('Carousel', 'instagram', false), F('Reel', 'instagram'), F('Carousel', 'instagram', false), F('Reel', 'instagram'), F('Story bình chọn', 'instagram', false), F('Reel', 'instagram'), F('Reel', 'instagram')],
  tiktok: [F('Video', 'tiktok'), F('Bài ảnh trượt', 'tiktok', false), F('Video', 'tiktok'), F('Video', 'tiktok'), F('Bài ảnh trượt', 'tiktok', false), F('Video', 'tiktok'), F('Video', 'tiktok')],
  youtube: Array.from({ length: 7 }, () => F('Shorts', 'youtube')),
  dailymotion: Array.from({ length: 7 }, () => F('Video', 'dailymotion')),
};
const hoCua = (nen: string) => { const g = nen.split(':')[0] ?? nen; return /^(facebook|fb_)/.test(g) ? 'facebook' : /^x(_|$)/.test(g) ? 'x' : g; };
const cong = (n: string, d: number) => new Date(Date.parse(`${n}T00:00:00Z`) + d * 864e5).toISOString().slice(0, 10);
export const thuHai = (n: string) => cong(n, -((new Date(`${n}T00:00:00Z`).getUTCDay() + 6) % 7));

async function docGoc(sp: number[]): Promise<GocBai[]> {
  let url = process.env.SPY_DATABASE_URL;
  if (!url) url = readFileSync('/root/.secrets/spy.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))?.slice(13);
  if (!url) throw new Error('không thấy kết nối kho spy');
  const pg = (await import('postgres')).default(url, { max: 1, prepare: false, connect_timeout: 5 });
  try {
    const rows = await pg<{ id: number; sp_id: number; loai: string; ten: string; n: number; r: number }[]>`
      select id, sp_id, loai, ten, n, r from (select id, sp_id, loai, ten, coalesce(so_nhac, 0) n,
        row_number() over (partition by regexp_replace(loai, '^ai_', '') order by coalesce(so_nhac, 0) desc, id) r
        from goc where sp_id = any(${sp}) and loai like 'ai\\_%' and ten is not null and ten <> 'Nhóm tạm thời' and coalesce(mo_ta, '') <> 'placeholder') x
      where r <= 4 order by r, n desc`;
    // xen loại: hạng 1 của mọi loại, rồi hạng 2… — trong mỗi hạng loại mạnh hơn trước
    return rows.map((x) => ({ sp: Number(x.sp_id), id: Number(x.id), loai: x.loai, ten: x.ten }));
  } finally { await pg.end(); }
}

/** Sinh kế hoạch cho tuần bắt đầu `tuan` (thứ Hai) nếu chưa có. Trả số ô đã thêm. */
export async function sinhTuan(tuan: string): Promise<number> {
  const d = getDb(); if (!d) return 0;
  const may = (await d.execute(sql`SELECT m.ma, m.goc_sp, array(SELECT DISTINCT e.key FROM xv_may_video v CROSS JOIN LATERAL jsonb_each(v.da_dang) e
      WHERE v.may_id = m.id AND e.key NOT LIKE '%:%' AND e.value->>'url' IS NOT NULL AND e.value->>'ngay' >= to_char(${tuan}::date - 14, 'YYYY-MM-DD')) AS nen
    FROM xv_may m WHERE m.chay AND m.goc_sp IS NOT NULL AND cardinality(m.goc_sp) > 0
      AND NOT EXISTS (SELECT 1 FROM ke_hoach_goc k WHERE k.may = m.ma AND k.tuan = ${tuan}::date)`)) as unknown as { ma: string; goc_sp: number[]; nen: string[] }[];
  const so = Math.round(Date.parse(`${tuan}T00:00:00Z`) / (7 * 864e5));   // số thứ tự tuần → dịch góc mỗi tuần
  let them = 0;
  for (const m of may) {
    const goc = await docGoc(m.goc_sp); if (!goc.length) continue;
    const ho = [...new Set(m.nen.map(hoCua))].filter((h) => XOAY[h]).sort(), coLink = new Set(m.nen.filter((n) => /_link$/.test(n)).map(hoCua));
    for (const [hi, h] of ho.entries()) for (let i = 0; i < 7; i++) {
      let f = XOAY[h]![(i + hi) % 7]!; if (f.ten === 'Bài link' && !coLink.has(h)) f = XOAY[h]![0]!;
      const g = goc[(so * 7 + i + hi * 3) % goc.length]!;
      await d.execute(sql`INSERT INTO ke_hoach_goc (tuan, may, ho, ngay, nen, format, can_dung, goc) VALUES (${tuan}::date, ${m.ma}, ${h}, ${cong(tuan, i)}::date, ${f.nen}, ${f.ten}, ${!f.co}, ${JSON.stringify(g)}::jsonb)
        ON CONFLICT (may, ho, ngay) DO NOTHING`);
      them++;
    }
  }
  return them;
}
/** tuần này + tuần sau luôn có kế hoạch (gọi từ trang Lịch; nhanh khi đã có — một câu đếm) */
export async function damBaoKeHoach(hom: string): Promise<void> {
  for (const t of [thuHai(hom), cong(thuHai(hom), 7)]) await sinhTuan(t);
}
export type OKeHoach = { may: string; ho: string; ngay: string; nen: string; format: string; can_dung: boolean; goc: GocBai };
export async function docKeHoachGoc(tu: string, den: string): Promise<OKeHoach[]> {
  const d = getDb(); if (!d) return [];
  return (await d.execute(sql`SELECT may, ho, ngay::text AS ngay, nen, format, can_dung, goc FROM ke_hoach_goc WHERE ngay BETWEEN ${tu}::date AND ${den}::date`)) as unknown as OKeHoach[];
}
