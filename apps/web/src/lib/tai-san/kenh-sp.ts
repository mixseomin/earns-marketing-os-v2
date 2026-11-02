// KÊNH SẢN PHẨM — đọc DB (server). Máy studio có xv_may.la_san_pham (migration 0402) + số ngày ở kenh_so_ngay 'may:<mã>' → tinhSoKenh.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { tinhSoKenh, type KenhSp, type SoNgayKenh } from './kenh-sp-tinh';

export async function docKenhSp(hom: string): Promise<KenhSp[]> {
  const d = getDb(); if (!d) return [];
  const may = (await d.execute(sql`SELECT m.id, m.ma, m.ten, m.chay, m.dang,
      count(v.id) FILTER (WHERE NOT coalesce(v.luu_tru, false))::int AS tap,
      count(v.id) FILTER (WHERE NOT coalesce(v.luu_tru, false) AND v.video_url IS NOT NULL AND NOT (v.da_dang ? 'youtube'))::int AS cho_dang,
      count(v.id) FILTER (WHERE v.da_dang ? 'youtube')::int AS da_dang,
      max(v.da_dang->'youtube'->>'ngay') AS dang_cuoi
    FROM xv_may m LEFT JOIN xv_may_video v ON v.may_id = m.id WHERE m.la_san_pham GROUP BY m.id ORDER BY m.id`)) as unknown as
    { ma: string; ten: string; chay: boolean; dang: { nen: string; br?: { handle?: string } }[]; tap: number; cho_dang: number; da_dang: number; dang_cuoi: string | null }[];
  if (!may.length) return [];
  const so = (await d.execute(sql`SELECT san_pham, ngay::text AS ngay, hien, so_muc, chi_tiet->>'nguoi_dk' AS nguoi_dk FROM kenh_so_ngay
    WHERE kenh = 'youtube' AND san_pham IN ${may.map((m) => `may:${m.ma}`)} AND ngay >= current_date - 30`)) as unknown as
    { san_pham: string; ngay: string; hien: number; so_muc: number; nguoi_dk: string | null }[];
  return may.map((m) => {
    const ds: SoNgayKenh[] = so.filter((r) => r.san_pham === `may:${m.ma}`).map((r) => ({ ngay: r.ngay.slice(0, 10), xem: Number(r.hien), daDang: Number(r.so_muc), nguoiDk: r.nguoi_dk == null ? null : Number(r.nguoi_dk) }));
    const handle = (m.dang ?? []).find((x) => x.nen === 'youtube')?.br?.handle;
    return { ma: m.ma, ten: m.ten.split('·').pop()!.trim(), chay: m.chay, kenhUrl: handle ? `https://www.youtube.com/${handle}` : null,
      tap: m.tap, choDang: m.cho_dang, daDang: m.da_dang, dangCuoi: m.dang_cuoi, ...tinhSoKenh(ds, hom) };
  });
}
