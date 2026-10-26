// KHO DẠNG BÀI — một nguồn: scripts/ke-hoach-goc/dang-bai.json (thu thập 26/10/2026, có nguồn). Kế hoạch tuần (ke-hoach-goc.ts) và
// tab Social › Góc › Kế hoạch cùng đọc từ đây; thêm / sửa dạng = sửa JSON, không sửa mã.
import kho from '../../../../scripts/ke-hoach-goc/dang-bai.json';

export type DuongDung = '0d' | 'giong' | 'anh' | 'poll';
export interface DangBai {
  ma: string; ten: string; nhom: 'video' | 'anh' | 'tuong-tac' | 'link'; dung: string;
  nen: string[]; ngach: string[]; goc_loai: string[]; duong: DuongDung; mau: string | null; vi_du?: string;
}
export const DANG_BAI = kho.dang as DangBai[];
export const LUAT_NEN = kho._luat_nen as Record<string, string>;
export const NGUON_DANG = kho._nguon as string[];

export const NHOM_DANG: Record<DangBai['nhom'], string> = { video: 'Video', anh: 'Bài ảnh', 'tuong-tac': 'Tương tác', link: 'Bài link' };
export const DUONG_DUNG: Record<DuongDung, string> = { '0d': 'Mẫu dựng 0đ (ffmpeg + ảnh/video thật)', giong: 'Cần giọng AI (báo giá trước)', anh: 'Bài ảnh / carousel', poll: 'Bình chọn nền tảng' };
export const NGACH: Record<string, string> = { moi: 'Mọi ngách', 'du-lich': 'Du lịch', scam: 'Chống lừa đảo', 'cao-tuoi': 'Người lớn tuổi / hoài cổ', hoc: 'Học / luyện thi', 'san-pham': 'Sản phẩm' };

/** Dạng hợp với một loại góc spy (ai_phan_doi…) — bảng ghép loại góc → dạng của kế hoạch tuần. */
export const dangTheoLoai = (loai: string) => DANG_BAI.filter((d) => d.goc_loai.includes(loai));
/** Dạng dùng được cho một họ nền (facebook / x / instagram / tiktok / youtube / dailymotion). */
export const dangTheoNen = (ho: string) => DANG_BAI.filter((d) => d.nen.includes(ho));
/** Mọi loại góc spy có trong kho, theo thứ tự số dạng giảm dần. */
export const LOAI_GOC_KHO = [...new Set(DANG_BAI.flatMap((d) => d.goc_loai))].sort((a, b) => dangTheoLoai(b).length - dangTheoLoai(a).length);
