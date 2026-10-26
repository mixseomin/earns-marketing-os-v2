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
import { hoCua } from './ho-nen';

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
const cong = (n: string, d: number) => new Date(Date.parse(`${n}T00:00:00Z`) + d * 864e5).toISOString().slice(0, 10);
export const thuHai = (n: string) => cong(n, -((new Date(`${n}T00:00:00Z`).getUTCDay() + 6) % 7));

/** kết nối kho spy (DB spy trên box3) — đóng sau khi dùng */
export async function moSpy() {
  let url = process.env.SPY_DATABASE_URL;
  if (!url) url = readFileSync('/root/.secrets/spy.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))?.slice(13);
  if (!url) throw new Error('không thấy kết nối kho spy');
  return (await import('postgres')).default(url, { max: 1, prepare: false, connect_timeout: 5 });
}
async function docGoc(sp: number[], tat: number[] = []): Promise<GocBai[]> {
  const pg = await moSpy();
  try {
    const rows = await pg<{ id: number; sp_id: number; loai: string; ten: string; n: number; r: number }[]>`
      select id, sp_id, loai, ten, n, r from (select id, sp_id, loai, ten, coalesce(so_nhac, 0) n,
        row_number() over (partition by regexp_replace(loai, '^ai_', '') order by coalesce(so_nhac, 0) desc, id) r
        from goc where sp_id = any(${sp}) and not (id = any(${tat})) and loai like 'ai\\_%' and ten is not null and ten <> 'Nhóm tạm thời' and coalesce(mo_ta, '') <> 'placeholder') x
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
    const tat = ((await d.execute(sql`SELECT goc_id FROM goc_tat WHERE may = ${m.ma}`)) as unknown as { goc_id: number }[]).map((x) => Number(x.goc_id));
    const goc = await docGoc(m.goc_sp, tat); if (!goc.length) continue;
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
  await danhDauBaiSite(thuHai(hom));
  await noiBaiSite(hom);
}
/** Ô link tối đa mỗi họ nền mỗi tuần — cùng nhịp máy đăng (nhip-an-toan NHIP_LINK = 3: một bài link sau hai bài thường ≈ 2 / 7 ngày) */
export const LINK_TUAN = 2;
/** BÀI SITE KHÔNG BƠ VƠ (anh 26/10/2026): mỗi bài site đã lên phải có ít nhất một ô kế hoạch sắp tới (từ ngày mai) trỏ sang.
 *  Chọn ô của đúng thương hiệu, họ nền facebook / x, chưa có link đích, tuần đó chưa đủ LINK_TUAN ô link; ưu tiên ô cùng góc → ô 'Bài link' → ngày sớm.
 *  Ô được chọn nhận góc của bài + link đích; ở họ nền máy có nơi đăng link (fb_link / x_link) thì thành 'Bài link', không thì giữ format, link nằm trong chữ đăng.
 *  Hết chỗ trong các tuần đã sinh thì bài chờ tuần sau (bảng hiện "chưa có nguồn"). */
export async function noiBaiSite(hom: string): Promise<void> {
  const d = getDb(); if (!d) return;
  const mai = cong(hom, 1);
  const bai = (await d.execute(sql`SELECT b.may, b.goc, b.url, m.dang FROM bai_site_goc b JOIN xv_may m ON m.ma = b.may
    WHERE b.trang_thai = 'da_len' AND b.url IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ke_hoach_goc k WHERE k.dich = b.url AND k.ngay >= ${hom}::date)
    ORDER BY b.can_truoc NULLS LAST`)) as unknown as { may: string; goc: GocBai; url: string; dang: { nen: string }[] }[];
  for (const b of bai) {
    const nenMay = new Set((b.dang ?? []).map((x) => x.nen));
    const [o] = (await d.execute(sql`SELECT k.id, k.ho FROM ke_hoach_goc k
      WHERE k.may = ${b.may} AND k.ngay >= ${mai}::date AND k.dich IS NULL AND k.ho IN ('facebook', 'x')
        AND (SELECT count(*) FROM ke_hoach_goc z WHERE z.may = k.may AND z.ho = k.ho AND z.tuan = k.tuan AND (z.dich IS NOT NULL OR z.format = 'Bài link')) < ${LINK_TUAN}
           + CASE WHEN k.format = 'Bài link' THEN 1 ELSE 0 END
      ORDER BY (k.goc->>'id')::int = ${b.goc.id} DESC, k.format = 'Bài link' DESC, k.ngay, k.ho LIMIT 1`)) as unknown as { id: number; ho: string }[];
    if (!o) continue;
    const nenLink = o.ho === 'facebook' ? 'fb_link' : 'x_link', laLink = nenMay.has(nenLink);
    if (laLink) await d.execute(sql`UPDATE ke_hoach_goc SET dich = ${b.url}, goc = ${JSON.stringify(b.goc)}::jsonb, format = 'Bài link', nen = ${nenLink}, can_dung = false WHERE id = ${o.id}`);
    else await d.execute(sql`UPDATE ke_hoach_goc SET dich = ${b.url}, goc = ${JSON.stringify(b.goc)}::jsonb WHERE id = ${o.id}`);
  }
}
/** BÀI SITE THEO GÓC (anh 26/10/2026): góc có ô bài link, hoặc từ 3 ô trở lên trong một tuần kế hoạch (từ tuần `tu`), cần một bài trên site đích
 *  của thương hiệu (xv_may.site_dich) — thêm dòng 'can_viet' nếu chưa có; dòng đã có giữ nguyên trạng thái, chỉ kéo sớm hạn can_truoc. */
export async function danhDauBaiSite(tu: string): Promise<void> {
  const d = getDb(); if (!d) return;
  await d.execute(sql`INSERT INTO bai_site_goc (may, goc_id, goc, site, can_truoc, ly_do)
    SELECT k.may, (k.goc->>'id')::int, (array_agg(k.goc))[1], m.site_dich,
      coalesce(min(k.ngay) FILTER (WHERE k.format = 'Bài link'), min(k.ngay)),
      CASE WHEN bool_or(k.format = 'Bài link') THEN 'bài link' ELSE count(*) || ' ô trong tuần' END
    FROM ke_hoach_goc k JOIN xv_may m ON m.ma = k.may
    WHERE k.tuan >= ${tu}::date AND m.site_dich IS NOT NULL
    GROUP BY k.may, k.tuan, (k.goc->>'id')::int, m.site_dich
    HAVING bool_or(k.format = 'Bài link') OR count(*) >= 3
    ON CONFLICT (may, goc_id) DO UPDATE SET can_truoc = least(bai_site_goc.can_truoc, excluded.can_truoc), cap_nhat = now()
      WHERE excluded.can_truoc < bai_site_goc.can_truoc`);
}
export type BaiSite = { may: string; goc_id: number; site: string; can_truoc: string | null; ly_do: string | null; trang_thai: string; url: string | null };
export async function docBaiSite(): Promise<BaiSite[]> {
  const d = getDb(); if (!d) return [];
  return (await d.execute(sql`SELECT may, goc_id, site, can_truoc::text AS can_truoc, ly_do, trang_thai, url FROM bai_site_goc`)) as unknown as BaiSite[];
}
export type OKeHoach = { may: string; ho: string; ngay: string; nen: string; format: string; can_dung: boolean; goc: GocBai; dich: string | null };
export async function docKeHoachGoc(tu: string, den: string): Promise<OKeHoach[]> {
  const d = getDb(); if (!d) return [];
  return (await d.execute(sql`SELECT may, ho, ngay::text AS ngay, nen, format, can_dung, goc, dich FROM ke_hoach_goc WHERE ngay BETWEEN ${tu}::date AND ${den}::date`)) as unknown as OKeHoach[];
}
