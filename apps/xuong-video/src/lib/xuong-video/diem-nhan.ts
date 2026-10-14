// ĐIỂM NHẤN QC (15/10/2026 — anh: "thêm các hiệu ứng tạo điểm nhấn… hiệu ứng kèm âm thanh"): mỗi loại shot QC một cặp HIỆU ỨNG HÌNH
// (lớp hieu_ung của timeline, lop.ts › HIEU_UNG) + TIẾNG (sfx.ts) đặt đúng điểm cắt — hook bật zoom + pop, nỗi đau rung + đập, giải pháp
// chớp + ding, ưu đãi/CTA zoom + ka-ching… Shot liền sau cùng loại không nhấn lại (nhấn mọi shot = không còn gì là điểm nhấn).
// Thuần — một hàm cho template (dung-template), nút ✨ trên studio (actions › apDiemNhan) và script. Tự kiểm: diem-nhan.test.mts
import type { Lop, LoaiShotMau } from './kieu';
import type { HieuUngKhung } from './kieu';

type Nhan = { hu?: HieuUngKhung; cuong?: number; dai?: number; tre?: number; am: string[] };
export const DIEM_NHAN_QC: Record<LoaiShotMau, Nhan> = {
  hook: { hu: 'zoom', cuong: 0.7, dai: 0.5, am: ['pop'] },
  uu_dai: { hu: 'chop', cuong: 0.6, dai: 0.35, am: ['ka_ching'] },
  noi_dau: { hu: 'rung', cuong: 0.5, dai: 0.5, am: ['dap'] },
  giai_phap: { hu: 'chop', cuong: 0.5, dai: 0.35, am: ['ding'] },
  demo: { hu: 'zoom', cuong: 0.6, dai: 0.6, am: ['vut'] },
  tinh_nang: { hu: 'zoom', cuong: 0.5, dai: 0.5, am: ['pop'] },
  so_sanh: { hu: 'glitch', cuong: 0.5, dai: 0.3, am: ['vut'] },
  bang_chung: { hu: 'chop', cuong: 0.4, dai: 0.3, tre: 0.2, am: ['chup'] },
  tran_an: { am: ['pop'] },
  cta: { hu: 'zoom', cuong: 0.7, dai: 0.6, am: ['ka_ching'] },
  end_card: { hu: 'zoom', cuong: 0.6, dai: 0.8, am: ['ka_ching'] },
  khac: { am: [] },
};
/** Tiếng do điểm nhấn đặt — chạy lại thì thay đúng những tiếng này, tiếng người chọn tay giữ nguyên. */
const TIENG_NHAN = new Set(Object.values(DIEM_NHAN_QC).flatMap((x) => x.am));
export const TEN_LOP_NHAN = 'Điểm nhấn';

/** ds = shot theo thứ tự phát (loại = phan_doan, phat = giây phát, am = tiếng đang có). Trả lớp hiệu ứng mới (thay lớp điểm nhấn cũ, giữ
 *  lớp khác) + tiếng mỗi shot (thay tiếng điểm nhấn cũ, giữ tiếng tay). */
export function diemNhan(ds: { loai: string; phat: number; am?: string[] }[], lopCu: Lop[] = []): { lop: Lop[]; am: string[][] } {
  const lop = lopCu.filter((l) => !(l.loai === 'hieu_ung' && (l.ten ?? '').startsWith(TEN_LOP_NHAN)));
  const am: string[][] = [];
  let t = 0;
  ds.forEach((s, i) => {
    const giu = (s.am ?? []).filter((k) => !TIENG_NHAN.has(k));
    const nhan = DIEM_NHAN_QC[s.loai as LoaiShotMau];
    const lap = i > 0 && ds[i - 1]!.loai === s.loai;   // cùng loại liền nhau → không nhấn lại
    if (nhan && !lap) {
      am.push([...giu, ...nhan.am]);
      if (nhan.hu && s.phat > 0) {
        const tu = Math.round((t + (nhan.tre ?? 0)) * 100) / 100;
        lop.push({ id: `nhan-${i}`, loai: 'hieu_ung', ten: `${TEN_LOP_NHAN} · ${s.loai}`, tu, den: Math.round(Math.min(t + s.phat, tu + (nhan.dai ?? 0.5)) * 100) / 100,
          x: 0.5, y: 0.5, w: 1, h: 1, xoay: 0, mo: 1, vao: 'khong', ra: 'khong', hu: nhan.hu, cuong: nhan.cuong ?? 0.5 } as Lop);
      }
    } else am.push(giu);
    t += s.phat;
  });
  return { lop, am };
}
