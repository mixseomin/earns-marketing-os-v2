// THAM KHẢO CÂU CHỮ QC (anh 15/10/2026: "việc refer đến một nguồn nào cho QC là mặc định cho mọi template và video QC. Cấm dùng nội dung mày viết
// mà không có tham khảo… phần này luôn phải show ra"). Mỗi câu chữ của shot QC (chữ màn + từng câu lời) mang danh sách nguồn: lời khách thật
// (Reddit / Amazon / Trustpilot…) hoặc QC đang thắng (spy qc_meta), đúng quy trình skill viet-qc-truc-dien. Câu không có nguồn → cổng chặn sinh.
// Template: câu cố định của template mang nguồn ngay trên shot template; câu có ô {{x}} lấy nguồn của ô lúc điền (chepPhim › thamKhaoSauDien).
// Thuần — một chỗ cho cổng (quy-trinh.ts › chanTienKy), chép template (template-db.ts) và panel shot. Tự kiểm: tham-khao.test.mts
import { dienChu, timO } from './template';

export type NguonThamKhao = {
  loai: 'loi_khach' | 'qc_thang';
  /** reddit · amazon · trustpilot · qc_meta… */ nguon: string;
  /** trích NGUYÊN VĂN câu/đoạn đã học */ trich: string;
  link?: string;
  /** mã gốc: goc_nguon.id (lời khách) / library_id (QC thắng) */ ma?: string;
  /** QC thắng: "Shapecurve · x20 · 69 ngày" */ ghi?: string;
  /** kỹ thuật skill đã dùng (lật cách hiểu, chi tiết đời thật, câu cụt có nhịp, gỡ rủi ro…) */ ky_thuat?: string;
};
export type ThamKhaoCau = { cau: string; nguon: NguonThamKhao[] };

const chuan = (s: string): string => s.toLowerCase().replace(/[“”"]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').replace(/[\s.!?…,;:·-]+$/u, '').trim();

/** Mọi câu chữ người xem đọc/nghe của shot: chữ màn + từng câu lời (bỏ trống, bỏ trùng). */
export function cauCuaShot(c: { chu_man?: string; thoai?: { loi?: string }[] }): string[] {
  const out: string[] = [];
  for (const x of [c.chu_man ?? '', ...(c.thoai ?? []).map((t) => t.loi ?? '')]) {
    const v = x.trim();
    if (v && !out.some((o) => chuan(o) === chuan(v))) out.push(v);
  }
  return out;
}

/** Nguồn của một câu (so sau khi chuẩn hoá dấu câu/hoa thường) — sửa câu là mất nguồn, phải tham khảo lại. */
export const nguonCuaCau = (tk: ThamKhaoCau[] | undefined, cau: string): NguonThamKhao[] => (tk ?? []).find((x) => chuan(x.cau) === chuan(cau))?.nguon ?? [];

/** Câu chưa có nguồn. Câu còn ô {{x}} (shot của template) không tính — nguồn của nó đến từ ô lúc điền. */
export function cauThieuNguon(c: { chu_man?: string; thoai?: { loi?: string }[]; tham_khao?: ThamKhaoCau[] }): string[] {
  return cauCuaShot(c).filter((x) => !timO(x).length && !nguonCuaCau(c.tham_khao, x).length);
}

export const TIEN_TO_THAM_KHAO = 'tham khảo: ';
/** Cổng: phim QC, shot nào còn câu chữ không có nguồn → chặn (mỗi shot một dòng). */
export function chanThamKhao(ds: { thu_tu?: number; chu_man?: string; thoai?: { loi?: string }[]; tham_khao?: ThamKhaoCau[] }[], laQc: boolean): string[] {
  if (!laQc) return [];
  return ds.flatMap((c, i) => {
    const thieu = cauThieuNguon(c);
    return thieu.length ? [`${TIEN_TO_THAM_KHAO}shot #${c.thu_tu ?? i + 1} có câu chưa có nguồn tham khảo (lời khách thật / QC thắng — skill viet-qc-truc-dien): ${thieu.map((x) => `“${x}”`).join(', ')}`] : [];
  });
}

/** Chép shot template → phim: mỗi câu sau khi điền = nguồn của câu cố định trên shot template + nguồn của mọi ô câu đó dùng (tkO[ô]). */
export function thamKhaoSauDien(c: { chu_man?: string; thoai?: { loi?: string }[]; tham_khao?: ThamKhaoCau[] }, gt: Record<string, string>, tkO: Record<string, NguonThamKhao[]> = {}): ThamKhaoCau[] {
  const out: ThamKhaoCau[] = [];
  for (const cau of cauCuaShot(c)) {
    const nguon = [...nguonCuaCau(c.tham_khao, cau), ...timO(cau).flatMap((k) => tkO[k] ?? [])];
    const dien = dienChu(cau, gt);
    const cu = out.find((x) => chuan(x.cau) === chuan(dien));
    if (cu) cu.nguon.push(...nguon.filter((n) => !cu.nguon.some((m) => m.trich === n.trich)));
    else if (nguon.length) out.push({ cau: dien, nguon: nguon.filter((n, i) => nguon.findIndex((m) => m.trich === n.trich) === i) });
  }
  return out;
}
