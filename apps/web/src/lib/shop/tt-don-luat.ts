// SHOP — luật TRẠNG THÁI THANH TOÁN một đơn (thuần, dùng chung máy chủ + màn). Ảnh chụp do lib/shop/tt-don.ts đọc từ cổng (migration 0216).
// Một câu trả lời cho ba câu anh hỏi khi nhận đơn: khách trả qua đâu · tiền về tới đâu · có đang bị đòi lại tiền không (hoàn / dispute / gian lận / khách xin hoàn).

export type TtDon = {
  cong: string;                         // 'Stripe' …
  pi: string | null; charge: string | null;
  tien: number; phi: number | null; thuc_nhan: number | null; tien_te: string;
  /** tiền trong cổng: pending (đang giữ) · available (khả dụng) — available_on = ngày khả dụng */
  tien_ve: { trang_thai: string | null; kha_dung_tu: string | null };
  /** lần rút (payout) ước chứa tiền đơn này — theo lịch rút tự động: lần rút đầu tiên tạo sau ngày khả dụng */
  rut: { id: string; trang_thai: string; ngay_ve: string } | null;
  hoan: { id: string; so: number; trang_thai: string; ly_do: string | null; luc: string }[];
  dispute: { id: string; so: number; trang_thai: string; ly_do: string; han: string | null } | null;
  efw: boolean;                         // ngân hàng báo cảnh báo gian lận sớm cho giao dịch này
  luc: string;
};
export type Muc = 'tot' | 'vang' | 'do' | 'nhat';
/** Hồ sơ khách (shop_ho_so.loai) nghĩa là "đòi lại tiền giữa chừng" — tính khi còn mở. */
export const LOAI_XIN_HOAN = ['hoan_tien', 'doi_tra'];
export const MAU_MUC: Record<Muc, string> = { tot: 'var(--ok)', vang: 'var(--warn)', do: 'var(--bad)', nhat: 'var(--fg-3)' };
export type TomTt = { nhan: string; muc: Muc; chi_tiet: string[] };

const ngay = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const tien = (x: number) => `$${x.toFixed(2)}`;
const DISPUTE_MO = new Set(['needs_response', 'warning_needs_response', 'under_review', 'warning_under_review']);

/** Tóm trạng thái tiền của đơn — nhãn chính (cột bảng đơn) + mức + các dòng chi tiết (drawer).
 *  `khachXinHoan` = đơn có hồ sơ khách đang mở loại hoàn tiền / đổi trả (form liên hệ) — đòi lại tiền "giữa chừng" trước khi thành dispute. */
export function tomTtDon(tt: TtDon | null, congTt: string | null, khachXinHoan = false): TomTt {
  const ct: string[] = [];
  if (!tt) {
    if (khachXinHoan) return { nhan: 'khách xin hoàn', muc: 'vang', chi_tiet: [`${congTt ?? 'cổng chưa rõ'} · chưa đọc trạng thái tiền`] };
    return { nhan: congTt ? `${congTt} · chưa đọc` : '—', muc: 'nhat', chi_tiet: [] };
  }
  const daHoan = tt.hoan.filter((h) => h.trang_thai === 'succeeded' || h.trang_thai === 'pending').reduce((s, h) => s + h.so, 0);
  ct.push(`${tt.cong} · ${tien(tt.tien)}${tt.phi != null ? ` · phí ${tien(tt.phi)} · thực nhận ${tien(tt.thuc_nhan ?? tt.tien - tt.phi)}` : ''}`);
  if (tt.tien_ve.trang_thai === 'pending') ct.push(`Tiền đang giữ trong ${tt.cong} — khả dụng từ ${tt.tien_ve.kha_dung_tu ?? '?'}`);
  else if (tt.tien_ve.trang_thai === 'available') ct.push(`Tiền đã khả dụng trong ${tt.cong} từ ${tt.tien_ve.kha_dung_tu ?? '?'}`);
  if (tt.rut) ct.push(`Lần rút ${tt.rut.id} · ${tt.rut.trang_thai === 'paid' ? 'đã về' : tt.rut.trang_thai} · ngày về ${tt.rut.ngay_ve} (ước theo lịch rút)`);
  for (const h of tt.hoan) ct.push(`Hoàn ${tien(h.so)} · ${h.trang_thai}${h.ly_do ? ` · ${h.ly_do}` : ''} · ${h.luc.slice(0, 10)}`);
  if (tt.dispute) ct.push(`Dispute ${tt.dispute.id} · ${tt.dispute.ly_do} · ${tien(tt.dispute.so)} · ${tt.dispute.trang_thai}${tt.dispute.han ? ` · hạn nộp bằng chứng ${tt.dispute.han.slice(0, 10)}` : ''}`);
  if (tt.efw) ct.push('Ngân hàng của khách báo CẢNH BÁO GIAN LẬN SỚM — nên hoàn chủ động trước khi thành dispute');
  if (khachXinHoan) ct.push('Khách đang xin hoàn / đổi trả (hồ sơ mở)');

  // nhãn chính: thứ đáng lo nhất trước
  if (tt.dispute && DISPUTE_MO.has(tt.dispute.trang_thai)) return { nhan: `dispute · ${tt.dispute.ly_do}`, muc: 'do', chi_tiet: ct };
  if (tt.dispute?.trang_thai === 'lost') return { nhan: 'thua dispute', muc: 'do', chi_tiet: ct };
  if (tt.efw) return { nhan: 'cảnh báo gian lận', muc: 'do', chi_tiet: ct };
  if (daHoan >= tt.tien - 0.009) return { nhan: 'đã hoàn toàn bộ', muc: 'nhat', chi_tiet: ct };
  if (daHoan > 0) return { nhan: `hoàn một phần ${tien(daHoan)}`, muc: 'vang', chi_tiet: ct };
  if (khachXinHoan) return { nhan: 'khách xin hoàn', muc: 'vang', chi_tiet: ct };
  if (tt.rut?.trang_thai === 'paid') return { nhan: `đã về · ${ngay(tt.rut.ngay_ve)}`, muc: 'tot', chi_tiet: ct };
  if (tt.rut) return { nhan: `đang rút · ${ngay(tt.rut.ngay_ve)}`, muc: 'tot', chi_tiet: ct };
  if (tt.tien_ve.trang_thai === 'available') return { nhan: `khả dụng ở ${tt.cong}`, muc: 'tot', chi_tiet: ct };
  if (tt.tien_ve.trang_thai === 'pending') return { nhan: `chờ về · ${ngay(tt.tien_ve.kha_dung_tu)}`, muc: 'nhat', chi_tiet: ct };
  return { nhan: tt.cong, muc: 'nhat', chi_tiet: ct };
}
