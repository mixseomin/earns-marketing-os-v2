// GỌN BẢNG XÉT LUẬT KHI GỬI XUỐNG TRÌNH DUYỆT (anh 09/11/2026 "page camp giờ chậm quá"): etp.xet_luat ghi cho MỖI camp đủ tên + mô tả của MỖI luật
// → 472 camp × ~13 luật chép lại cùng một đoạn mô tả = 1,45 MB trong 12 MB dữ liệu trang. Máy chủ gom tên + mô tả về một bảng chữ duy nhất (xetChu),
// mỗi dòng xét chỉ giữ số thứ tự trong bảng đó; EtpView mở lại ngay lúc nhận nên mọi component vẫn đọc du.xetLuat[camp][i].ten / .mo_ta như cũ.
// Gom theo cặp (tên, mô tả) chứ không theo mã luật: cùng mã có thể khác chữ theo camp (T30 thường / T30 ROAS thắng).
import type { DuLieuEtp, XetLuat } from './etp-doc';

export type XetGon = Omit<XetLuat, 'ten' | 'mo_ta'> & { c: number };
export type DuLieuEtpGui = Omit<DuLieuEtp, 'xetLuat'> & { xetLuat: Record<number, XetGon[]>; xetChu: [string, string][] };

export function gonXet(d: DuLieuEtp): DuLieuEtpGui {
  const xetChu: [string, string][] = [], so = new Map<string, number>();
  const xetLuat = Object.fromEntries(Object.entries(d.xetLuat).map(([camp, ds]) => [camp, ds.map(({ ten, mo_ta, ...r }) => {
    const k = `${ten}\u0000${mo_ta}`;
    let c = so.get(k);
    if (c == null) { c = xetChu.length; xetChu.push([ten, mo_ta]); so.set(k, c); }
    return { ...r, c };
  })]));
  return { ...d, xetLuat, xetChu };
}

export function moXet(d: DuLieuEtpGui): DuLieuEtp {
  const { xetChu, ...r } = d;
  return { ...r, xetLuat: Object.fromEntries(Object.entries(d.xetLuat).map(([camp, ds]) => [camp, ds.map(({ c, ...x }) => {
    const chu = xetChu[c];
    if (!chu) throw new Error(`etp-xet-gon: dòng xét camp #${camp} trỏ chữ #${c} không có trong bảng (${xetChu.length} chữ)`);
    return { ...x, ten: chu[0], mo_ta: chu[1] };
  })])) };
}
