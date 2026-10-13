// THỬ NGƯỜI XEM LẦN ĐẦU (13/10/2026 — anh: "đây là chuẩn bị quan trọng cho mọi video, cần chuẩn hoá"). Fox Tales tập 2 chấm kịch bản 100/100
// (đủ 5 nhịp, hook, lật ngược đúng chỗ) mà xem xong vẫn khó hiểu: cú lật dựa vào truyện Aesop phim không kể, mục tiêu Felix không ai nói,
// đoạn quạ hát thì câm. Máy chấm cấu trúc không thấy được — phải có một người xem CHỈ biết thứ trên màn kể lại câu chuyện.
//   banNguoiXem(canh) = bảng shot chỉ gồm thứ người xem thấy (hành động) / đọc (chữ màn) / nghe (lời, ai nói) — không brief, không ghi chú.
//   maBan(ban)        = mã phiên bản: kịch bản đổi chữ/lời/hành động → kết quả thử cũ hết hiệu lực.
//   chanNguoiXem(...) = cổng trước sinh keyframe + xuất (quy-trinh.ts › chanTienKy, actions.ts › xuatTap).
// Lượt Claude ở claude.ts › thuNguoiXem. Thuần — tự kiểm: nguoi-xem.test.mts
import { doanChuMan, giayPhat, type Canh, type ThuNguoiXem } from './kieu';

export type ShotXem = Pick<Canh, 'thu_tu' | 'phat_s' | 'thoi_luong_s' | 'hanh_dong' | 'chu_man' | 'thoai' | 'loi_thoai'>;
/** Điểm hiểu tối thiểu (0–10) để qua cổng — cùng với "khớp ý tác giả". */
export const DIEM_HIEU_DAT = 7;

export function banNguoiXem(canh: ShotXem[]): string {
  let t = 0;
  return canh.map((c) => {
    const g = giayPhat(c); const tu = t; t += g;
    const chu = doanChuMan(c.chu_man ?? '', g).map((d) => d.dong.join(' ')).join(' / ').trim();
    const nghe = (c.thoai?.length ? c.thoai.filter((d) => d.loi.trim()).map((d) => `${d.nhan_vat.trim() || 'Người dẫn (giọng ngoài khung)'}: "${d.loi.trim()}"`) : c.loi_thoai.trim() ? [c.loi_thoai.trim()] : []).join(' · ');
    return `#${c.thu_tu} [${tu.toFixed(1)}–${t.toFixed(1)}s] THẤY: ${c.hanh_dong.trim() || '(không tả)'} | CHỮ TRÊN MÀN: ${chu || '—'} | NGHE: ${nghe || '(không lời)'}`;
  }).join('\n');
}

/** Mã ngắn ổn định của bản người xem (djb2) — đủ để biết kịch bản đã đổi sau lần thử. */
export function maBan(ban: string): string {
  let h = 5381; for (let i = 0; i < ban.length; i++) h = ((h << 5) + h + ban.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Tiền tố mọi câu chặn của bước này — quy-trinh.ts lọc theo nó. */
export const TIEN_TO_NGUOI_XEM = 'người xem: ';
export const TEN_NUT_NGUOI_XEM = '🧑 Kiểm người xem có hiểu không';

export function chanNguoiXem(t: ThuNguoiXem | null | undefined, canh: ShotXem[]): string[] {
  if (!canh.length) return [];
  const tien = TIEN_TO_NGUOI_XEM;
  if (!t) return [`${tien}chưa kiểm — bấm ${TEN_NUT_NGUOI_XEM}`];
  if (t.ma !== maBan(banNguoiXem(canh))) return [`${tien}kịch bản đã sửa sau lần kiểm — bấm ${TEN_NUT_NGUOI_XEM} lần nữa`];
  if (t.dat) return [];
  return [`${tien}chưa hiểu (${t.diem}/10${t.khop ? '' : ', lệch ý tác giả'}): ${[t.lech, ...t.cho_kho.slice(0, 3).map((x) => `#${x.shot} ${x.van_de}`)].filter(Boolean).join('; ')}`];
}
