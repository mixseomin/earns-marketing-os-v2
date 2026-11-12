// CỔNG TIỀN HÌNH DO MÁY CHẤM (anh 12/11/2026: "luật là não của mày thôi, không tin được… đã có hệ chấm điểm" + "studio phải thể hiện rõ những thông tin
// chấm và block này"). MỘT hàm cho cổng keyframe (sinh-anh.ts › lyChanKeyframe, phim khai kinh_thanh.video_tho) và ô 🚦 trên Lưới kịch bản — cùng số ở
// cả hai chỗ. Đo trên máy ảo 3D (may_3d + khung_xam đo sống / Blender), không đọc nhận định của ai:
//   (1) người nói thấy mặt + thoại không nằm trong toàn cảnh (bo-set-3d.ts › nguoiNoiKhongThayMat / thoaiToanCanh)
//   (2) lỗi liền mạch từng shot (bo-set-3d.ts › loiMachTap — chuỗi nhìn → thấy, trục, hướng máy chủ, tổng thể…); sổ trang phục để cổng keyframe từng shot lo
//   (3) điểm Murch cả tập ≥ MURCH_TAP_DAT (diem-murch.ts). Thuần — không DB.
import type { BoSet, Canh, NhanVat, PhanCanh } from './kieu';
import { loiMachTap, nguoiNoiKhongThayMat, thoaiToanCanh } from './bo-set-3d';
import { diemMurchTap, diemMurchCanh, MURCH_TAP_DAT } from './diem-murch';
import type { KhongGianTap } from './khong-gian';

export type LoiCong = { id: number; thu_tu: number; ly: string; loai: 'nguoi_noi' | 'mach' };
export type CongVideoTho = { mo: boolean; diem: number; nguong: number; loi: LoiCong[] };

export function congVideoTho(ds: Canh[], nhanVat: NhanVat[], sets: Pick<BoSet, 'id' | 'du_lieu'>[], tap: { phan_canh?: PhanCanh[] | null; khong_gian?: KhongGianTap | null }, laQc = false): CongVideoTho {
  const mach = loiMachTap(ds, nhanVat, sets, tap.phan_canh ?? [], tap.khong_gian ?? null);
  const loi: LoiCong[] = [];
  for (const c of ds) {
    for (const s of [...nguoiNoiKhongThayMat(c), ...thoaiToanCanh(c)]) loi.push({ id: c.id, thu_tu: c.thu_tu, ly: s.replace(/^NGƯỜI NÓI: /, ''), loai: 'nguoi_noi' });
    for (const s of mach[c.id] ?? []) if (!/^sổ trang phục/.test(s)) loi.push({ id: c.id, thu_tu: c.thu_tu, ly: s, loai: 'mach' });
  }
  const diem = diemMurchCanh(ds, diemMurchTap(ds, nhanVat, sets, { phanCanh: tap.phan_canh ?? [], laQc, kg: tap.khong_gian ?? null })).tap;
  return { mo: !loi.length && diem >= MURCH_TAP_DAT, diem, nguong: MURCH_TAP_DAT, loi };
}
/** Câu chặn cho nút sinh keyframe (rỗng = mở). */
export const cauChanCong = (k: CongVideoTho): string[] => [
  ...(k.loi.length ? [`Ngữ pháp shot / liền mạch chưa đạt (máy đo trên 3D, ${k.loi.length} lỗi): ${k.loi.slice(0, 8).map((x) => `#${x.thu_tu} ${x.ly.split(' — ')[0]}`).join('; ')}${k.loi.length > 8 ? '; …' : ''}`] : []),
  ...(k.diem < k.nguong ? [`Điểm Murch cả tập ${k.diem} < ${k.nguong} — sửa các shot điểm thấp (lý do từng tiêu chí ở chip M trên lưới) rồi mới sinh keyframe`] : []),
];
