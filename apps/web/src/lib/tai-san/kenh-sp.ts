// KÊNH SẢN PHẨM — đọc DB (server). Máy studio có xv_may.la_san_pham (migration 0402) + số ngày ở kenh_so_ngay 'may:<mã>' → tinhSoKenh.
// TẬP KÊNH = video máy làm tập nạp (de.loai 'video-ngoai', lam-tap.mjs); video Dạng × Góc của cùng máy (vd astrolas → FB Eyes On Stars) KHÔNG tính vào kênh.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { changVideo, lichKenhHs, yTuongTuSinh, soTheoPlaylist, tinhSoKenh, type DangLam, type HoSoKenhLich, type KenhSp, type NguoiLaSo, type SoKenh, type SoNgayKenh, type TapCho } from './kenh-sp-tinh';

/** Đọc một tệp JSON của máy làm tập (apps/xuong-video/scripts/lich-su/<tệp>) — cwd của web có thể là gốc repo hoặc apps/web. */
function docTepLichSu<T>(tep: string): T | null {
  for (const goc of [process.cwd(), join(process.cwd(), '..'), join(process.cwd(), '../..')]) {
    try { return JSON.parse(readFileSync(join(goc, 'apps/xuong-video/scripts/lich-su', tep), 'utf8')) as T; } catch { /* thử gốc khác */ }
  }
  console.warn(`kenh-sp: không đọc được apps/xuong-video/scripts/lich-su/${tep}`);
  return null;
}
/** Hồ sơ kênh của máy làm tập (kenh.json — MỘT nguồn với việc nền chay-kenh.mjs): lich_tap + gio_tap + playlist theo mã máy. */
function hoSoKenh(): Record<string, HoSoKenhLich> {
  const k = docTepLichSu<Record<string, HoSoKenhLich & { may?: string }>>('kenh.json') ?? {};
  return Object.fromEntries(Object.values(k).filter((x) => x && typeof x === 'object' && x.may).map((x) => [x.may!, x]));
}
/** Sổ kênh theo mã máy (so-kenh.json — chung mọi kênh studio; Studio + máy gác lich-su/kiem-so-kenh.mjs đọc cùng tệp). */
function soKenh(): Record<string, SoKenh> {
  const k = docTepLichSu<Record<string, SoKenh | string>>('so-kenh.json') ?? {};
  return Object.fromEntries(Object.entries(k).filter((e): e is [string, SoKenh] => !e[0].startsWith('_') && typeof e[1] === 'object' && Array.isArray(e[1]?.giai_doan)));
}

/** Tệp nguồn ý tưởng tự sinh mà các sổ khai (vd lich-troi.json — lich-su/lich-troi.mjs sinh): { tệp: su_kien[] }. */
function docNguonYTuong(so: Record<string, SoKenh>): Record<string, { ma: string; chu: string; utc: string }[]> {
  const tep = [...new Set(Object.values(so).flatMap((k) => (k.nguon_y_tuong ?? []).map((n) => n.tep)))];
  return Object.fromEntries(tep.map((t) => [t, docTepLichSu<{ su_kien?: { ma: string; chu: string; utc: string }[] }>(t)?.su_kien ?? []]));
}

export async function docKenhSp(hom: string): Promise<KenhSp[]> {
  const d = getDb(); if (!d) return [];
  const may = (await d.execute(sql`SELECT m.id, m.ma, m.ten, m.chay, m.dang, m.nguon->'dang_lam' AS dang_lam, m.nguon->'tap_cho' AS tap_cho,
      count(v.id) FILTER (WHERE NOT coalesce(v.luu_tru, false))::int AS tap,
      count(v.id) FILTER (WHERE NOT coalesce(v.luu_tru, false) AND v.video_url IS NOT NULL AND NOT (v.da_dang ? 'youtube'))::int AS cho_dang,
      count(v.id) FILTER (WHERE v.da_dang ? 'youtube')::int AS da_dang,
      max(v.da_dang->'youtube'->>'ngay') AS dang_cuoi
    FROM xv_may m LEFT JOIN xv_may_video v ON v.may_id = m.id AND v.de->>'loai' = 'video-ngoai' WHERE m.la_san_pham GROUP BY m.id ORDER BY m.id`)) as unknown as
    { ma: string; ten: string; chay: boolean; dang_lam: DangLam | null; tap_cho: TapCho[] | null; dang: { nen: string; gio_tu?: string; br?: { handle?: string } }[]; tap: number; cho_dang: number; da_dang: number; dang_cuoi: string | null }[];
  if (!may.length) return [];
  const so = (await d.execute(sql`SELECT san_pham, ngay::text AS ngay, hien, so_muc, chi_tiet->>'nguoi_dk' AS nguoi_dk FROM kenh_so_ngay
    WHERE kenh = 'youtube' AND san_pham IN ${may.map((m) => `may:${m.ma}`)} AND ngay >= current_date - 30`)) as unknown as
    { san_pham: string; ngay: string; hien: number; so_muc: number; nguoi_dk: string | null }[];
  const anh = (await d.execute(sql`SELECT DISTINCT ON (san_pham) san_pham, chi_tiet->>'anh' AS anh FROM kenh_so_ngay WHERE kenh = 'youtube' AND san_pham IN ${may.map((m) => `may:${m.ma}`)}
    AND chi_tiet->>'anh' IS NOT NULL ORDER BY san_pham, ngay DESC`)) as unknown as { san_pham: string; anh: string }[];
  const phim = (await d.execute(sql`SELECT id, kinh_thanh->>'may' AS may FROM xv_phim WHERE kinh_thanh->>'may' IN ${may.map((m) => m.ma)} ORDER BY id`)) as unknown as { id: number; may: string }[];
  const vids = (await d.execute(sql`SELECT m.ma, v.slug, coalesce(v.dang->>'title', v.chu_de, v.slug) AS ten, v.xuat_luc IS NOT NULL AS xuat, v.cham->>'ket' AS cham, v.giay, (coalesce(v.xuat_luc, v.created_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS ngay_lam,
      v.da_dang ? 'youtube' AS da_dang, v.dang->>'playlist' AS playlist, v.dang->>'mau' AS mau, v.dang->>'y_tuong' AS y_tuong, v.da_dang->'youtube'->>'ngay' AS ngay, v.da_dang->'youtube'->>'url' AS url, (v.luot_xem_nen->>'youtube')::int AS xem
    FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.la_san_pham AND v.de->>'loai' = 'video-ngoai' AND NOT coalesce(v.luu_tru, false) ORDER BY v.created_at DESC`)) as unknown as
    { ma: string; slug: string; ten: string; xuat: boolean; cham: string | null; giay: string | null; ngay_lam: string | null; da_dang: boolean; playlist: string | null; mau: string | null; y_tuong: string | null; ngay: string | null; url: string | null; xem: number | null }[];
  const lich = ((await d.execute(sql`SELECT ds FROM xv_lich_du_kien`)) as unknown as { ds: { may: string; ngay: string; gio?: string; nen: string; title?: string }[] }[]).flatMap((r) => r.ds ?? []);
  const hs = hoSoKenh(), lt = soKenh(), nguonY = docNguonYTuong(lt), gioNay = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
  return may.map((m) => {
    const ds: SoNgayKenh[] = so.filter((r) => r.san_pham === `may:${m.ma}`).map((r) => ({ ngay: r.ngay.slice(0, 10), xem: Number(r.hien), daDang: Number(r.so_muc), nguoiDk: r.nguoi_dk == null ? null : Number(r.nguoi_dk) }));
    const handle = (m.dang ?? []).find((x) => x.nen === 'youtube')?.br?.handle, l = lichKenhHs(hs[m.ma], hom, gioNay);
    const videos = vids.filter((v) => v.ma === m.ma).map((v) => ({ slug: v.slug, ten: v.ten.replace(/\s*#shorts\s*/i, ''), ngayLam: v.ngay_lam, trangThai: changVideo({ daDang: v.da_dang, xuat: v.xuat, cham: v.cham }),
      ngayDang: v.ngay?.slice(0, 10) ?? null, url: v.url, xem: v.xem, giay: v.giay == null ? null : Number(v.giay),
      // tập không ghi playlist (làm trước G1) của kênh chỉ MỘT playlist → playlist đó (cùng luật playlist.mjs › playlistCuaTap)
      mau: v.mau, yTuong: v.y_tuong,
      playlist: v.playlist ?? (hs[m.ma]?.playlist?.length === 1 ? hs[m.ma]!.playlist![0]!.ma : null) }));
    return { ma: m.ma, ten: m.ten.split('·').pop()!.trim(), chay: m.chay, kenhUrl: handle ? `https://www.youtube.com/${handle}` : null,
      tap: m.tap, choDang: m.cho_dang, daDang: m.da_dang, dangCuoi: m.dang_cuoi, ...tinhSoKenh(ds, hom),
      phimId: phim.find((p) => p.may === m.ma)?.id ?? null, so: lt[m.ma] ?? null, nguoi: (() => { const t = lt[m.ma]?.nguoi_tep; const x = t ? docTepLichSu<{ nguoi: NguoiLaSo[]; rodden_dung_nha?: string[] }>(t) : null; return x ? { ds: x.nguoi, dungNha: x.rodden_dung_nha ?? ['AA'] } : null; })(), yTuongTuSinh: lt[m.ma] ? yTuongTuSinh(lt[m.ma]!, nguonY, hom) : [], anh: anh.find((a) => a.san_pham === `may:${m.ma}`)?.anh ?? null,
      playlist: soTheoPlaylist(hs[m.ma]?.playlist ?? [], l.theo, videos),
      ke: (() => {
        return { lichTap: l.chu, tapKe: l.ke, dangLam: m.dang_lam ?? null, tapCho: m.tap_cho ?? [], gioDang: (m.dang ?? []).find((x) => x.nen === 'youtube')?.gio_tu ?? null,
          lichDang: lich.filter((x) => x.may === m.ma && x.ngay >= hom).sort((a, b) => `${a.ngay}${a.gio ?? ''}`.localeCompare(`${b.ngay}${b.gio ?? ''}`)).slice(0, 10)
            .map((x) => ({ ngay: x.ngay, gio: x.gio ?? null, nen: x.nen, tieuDe: x.title ?? '' })) }; })(),
      videos };
  });
}
