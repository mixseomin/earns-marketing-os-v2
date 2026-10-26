// CHỌN DẠNG CHO Ô KẾ HOẠCH TUẦN (bước 2 Dạng × Góc × Sản phẩm, anh duyệt 26/10/2026) — THUẦN, không DB: ke-hoach-goc.ts › sinhTuan gọi cho từng ô.
// Thay bảng XOAY cứng 7 ô / họ nền: dạng lấy từ kho dang-bai.json, lọc theo họ nền của ô + ngách của máy + dạng máy đã tắt; ưu tiên dạng nuôi bởi
// đúng LOẠI GÓC của ô; xoay để mỗi kênh ≥ 4 dạng khác nhau / tuần và không hai ngày liền cùng dạng; dạng chưa có đường đăng vẫn được xếp (can_dung).
//   node_modules/.bin/tsx apps/web/src/lib/chon-dang.test.mts
import { DANG_BAI, type DangBai } from './dang-bai';
import { DUONG_DANG } from './ke-hoach-dang-goc';

/** Nơi đăng (mã nền của máy đăng) cho một dạng trên một họ nền; null = họ nền đó không đăng được dạng này (ảnh lên YouTube / Dailymotion). */
export function nenCua(d: DangBai, ho: string): string | null {
  if (d.nhom === 'video') return ['facebook', 'x', 'youtube', 'instagram', 'tiktok', 'dailymotion'].includes(ho) ? ho : null;
  if (d.nhom === 'link') return ho === 'facebook' ? 'fb_link' : ho === 'x' ? 'x_link' : null;
  if (d.duong === 'poll') return ho === 'x' ? 'x_poll' : ho === 'instagram' ? 'ig_story_poll' : null;   // Facebook Page không có bình chọn bài thường
  // bài ảnh / tương tác / carousel
  if (d.ma === 'carousel') return ho === 'instagram' ? 'ig_carousel' : ho === 'tiktok' ? 'tiktok_anh' : ho === 'facebook' ? 'fb_anh' : null;
  return ho === 'facebook' ? 'fb_anh' : ho === 'x' ? 'x_anh' : ho === 'instagram' ? 'ig_carousel' : ho === 'tiktok' ? 'tiktok_anh' : null;
}
export const coDuong = (nen: string) => DUONG_DANG.some((x) => x.nen === nen && x.co);

export interface ChonDangVao {
  ho: string;                 // họ nền của ô (facebook / x / instagram / tiktok / youtube / dailymotion)
  ngach: string[];            // ngách của máy (xv_may.ngach)
  tat: string[];              // dạng máy đã tắt (dang_tat)
  loaiGoc: string;            // loại góc spy của ô (ai_phan_doi…)
  tuan: string[];             // dạng (mã) đã xếp cho máy × họ nền trong tuần này, theo thứ tự ngày (phần tử cuối = hôm trước)
  dem14: Record<string, number>;   // số ô 14 ngày qua của máy × họ nền theo mã dạng (xoay đều về lâu dài)
  coLink: boolean;            // máy có nơi đăng link cho họ nền này
  ngayLink?: boolean;         // ô này là ô dành cho bài link (một ô / tuần / họ nền)
  kho?: DangBai[];
}
export interface ChonDangRa { ma: string; ten: string; nen: string; co: boolean }

/** Ứng viên dạng cho một họ nền của máy: trong kho, không tắt, hợp ngách, họ nền đăng được. */
export function ungVien(v: Pick<ChonDangVao, 'ho' | 'ngach' | 'tat' | 'kho'>): (DangBai & { nenO: string })[] {
  return (v.kho ?? DANG_BAI).filter((d) => d.nhom !== 'link' && !v.tat.includes(d.ma) && (d.ngach.includes('moi') || d.ngach.some((n) => v.ngach.includes(n))) && d.nen.includes(v.ho))
    .map((d) => ({ ...d, nenO: nenCua(d, v.ho)! })).filter((d) => d.nenO);
}

/** Chọn dạng cho một ô. Điểm: đúng loại góc +4 · có mẫu dựng +2 · có đường đăng +1 · dựng 0đ +0,5 · trừ số lần đã dùng trong tuần ×3 · trừ số lần 14 ngày ×0,5;
 *  cấm trùng dạng hôm trước; tuần chưa đủ 4 dạng khác nhau thì chỉ chọn dạng chưa dùng trong tuần (khi còn ứng viên). */
export function chonDang(v: ChonDangVao): ChonDangRa | null {
  const kho = v.kho ?? DANG_BAI;
  if (v.ngayLink && v.coLink) { const l = kho.find((d) => d.nhom === 'link'); const nen = l && nenCua(l, v.ho); if (l && nen) return { ma: l.ma, ten: l.ten, nen, co: coDuong(nen) }; }
  let uv = ungVien(v); if (!uv.length) return null;
  const homTruoc = v.tuan[v.tuan.length - 1], daDung = new Set(v.tuan);
  const khac = uv.filter((d) => d.ma !== homTruoc); if (khac.length) uv = khac;
  if (daDung.size < 4) { const moi = uv.filter((d) => !daDung.has(d.ma)); if (moi.length) uv = moi; }
  const diem = (d: DangBai & { nenO: string }) => (d.goc_loai.includes(v.loaiGoc) ? 4 : 0) + (d.mau ? 2 : 0) + (coDuong(d.nenO) ? 1 : 0) + (d.duong === '0d' ? 0.5 : 0)
    - 3 * v.tuan.filter((x) => x === d.ma).length - 0.5 * (v.dem14[d.ma] ?? 0);
  const t = [...uv].sort((a, b) => diem(b) - diem(a) || a.ma.localeCompare(b.ma))[0]!;
  return { ma: t.ma, ten: t.ten, nen: t.nenO, co: coDuong(t.nenO) };
}

/** Xếp cả tuần cho một máy × họ nền: 7 ô, ô thứ `oLink` (0–6) là bài link khi máy có nơi đăng link. */
export function xepTuan(v: Omit<ChonDangVao, 'loaiGoc' | 'tuan' | 'ngayLink'> & { loai: string[]; oLink?: number }): ChonDangRa[] {
  const ra: ChonDangRa[] = [], tuan: string[] = [];
  for (let i = 0; i < 7; i++) {
    const c = chonDang({ ...v, loaiGoc: v.loai[i] ?? v.loai[0] ?? '', tuan, ngayLink: i === (v.oLink ?? 6) });
    if (!c) continue; ra.push(c); tuan.push(c.ma);
  }
  return ra;
}
