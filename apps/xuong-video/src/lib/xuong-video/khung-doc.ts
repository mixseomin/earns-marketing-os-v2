// KHUNG ĐỌC của một shot cho storyboard (anh 24/10/2026: "trình bày giống như truyện nhưng chi tiết hơn và có thứ tự rõ ràng", "phải nhìn được đầu, giữa,
// cuối mỗi shot"). MỘT hàm cho bảng truyện tranh (scripts/truyen-tranh.mts) và nút 🎞 Storyboard của tập › 🎬 Phân cảnh (phan-canh-ve.tsx) — hai chỗ không lệch nhau.
// Mỗi khung: nhãn thứ tự (#N·đầu / #N·giữa / #N·cuối), ảnh, câu tả tiếng Việt, trạng thái đồ ĐÚNG thời điểm khung (⚡ = vừa đổi), thoại (khung đầu), cớ cắt
// sang shot sau (khung cuối cùng của shot). Thuần — client dùng được.
import type { Canh } from './kieu';
import { TEN_NOI } from './noi-nhip';

export type KhungDoc = { luc: 'dau' | 'giua' | 'ket'; nhan: string; url: string | null; vi: string; vat: string[]; thoai: string[]; noi: string | null };
const TEN = { dau: 'đầu', giua: 'giữa', ket: 'cuối' } as const;
export function khungDoc(c: Pick<Canh, 'thu_tu' | 'hanh_dong' | 'keyframe_url' | 'thoai'> & Partial<Pick<Canh, 'keyframe_ket' | 'keyframe_giua' | 'dan_dung' | 'ky_thuat'>>): KhungDoc[] {
  const kv = (c.ky_thuat?.khung_ve?.length ? c.ky_thuat.khung_ve : ['dau']) as KhungDoc['luc'][]; const dd = c.dan_dung ?? {};
  return kv.map((luc, i) => ({
    luc, nhan: kv.length > 1 ? `#${c.thu_tu}·${TEN[luc]}` : `#${c.thu_tu}`,
    url: luc === 'dau' ? c.keyframe_url : luc === 'ket' ? c.keyframe_ket ?? null : c.keyframe_giua ?? null,
    vi: (luc === 'dau' ? dd.mo_vi : luc === 'giua' ? dd.giua_vi : dd.ket_vi) || c.hanh_dong,
    vat: (luc === 'ket' ? c.ky_thuat?.vat_ket : c.ky_thuat?.vat) ?? [],
    thoai: i === 0 ? c.thoai.filter((t) => t.loi.trim()).map((t) => `${t.nhan_vat}: “${t.loi}”`) : [],
    noi: i === kv.length - 1 && dd.noi ? `↳ cắt ${TEN_NOI[dd.noi]}` : null,
  }));
}
