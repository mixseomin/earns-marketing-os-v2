// SHOP — luật SỨC KHOẺ CỔNG THANH TOÁN (thuần, dùng chung máy chủ + màn). Máy chủ (lib/shop/cong.ts) chỉ chụp SỐ THÔ từ Stripe;
// đánh giá đỏ/vàng làm ở đây theo ngưỡng — anh sửa ngưỡng ở /shop › Thanh toán là màn đánh giá lại ngay, không phải đọc lại Stripe.
// Ngưỡng mặc định theo mốc công khai: Stripe/Visa coi tỷ lệ dispute ~0,75% là vùng nguy hiểm (chương trình giám sát VDMP của Visa từ 0,9%),
// nên vàng từ 0,5%, đỏ từ 0,75%. Thất bại cao bất thường là dấu hiệu bị thử thẻ (card testing).

export type SucKhoeCong = {
  luc: string;
  tai_khoan: { id: string; ten: string | null; nuoc: string | null; tien_te: string | null; nhan_tien: boolean; rut_tien: boolean;
    thieu: string[]; qua_han: string[]; ly_do_khoa: string | null; han: number | null; lich_rut: string | null };
  so_du: { kha_dung: number; cho: number; tien_te: string };
  /** 90 ngày (cách Stripe chấm tỷ lệ dispute) — doc_het = false khi quá nhiều giao dịch, chỉ đọc 1000 gần nhất */
  ky90: { thanh_cong: number; tien: number; that_bai: number; chan_rui_ro: number; hoan: number; tien_hoan: number; dispute: number; dispute_mo: number; efw: number; doc_het: boolean };
  ky30: { thanh_cong: number; that_bai: number };
  rut: { id: string; so: number; ngay: string; trang_thai: string; loi: string | null }[];
  webhook: { url: string; trang_thai: string; so_su_kien: number; cua_minh: boolean }[];
  /** sự kiện ≥ 1 giờ tuổi trong 3 ngày qua mà Stripe vẫn chưa giao xong tới mọi webhook (pending_webhooks > 0) */
  su_kien_treo: number;
};
export type NguongCong = { dispute_vang: number; dispute_do: number; hoan_vang: number; that_bai_vang: number; that_bai_do: number };
export const NGUONG_MAC_DINH: NguongCong = { dispute_vang: 0.5, dispute_do: 0.75, hoan_vang: 10, that_bai_vang: 15, that_bai_do: 30 };
export const NHAN_NGUONG: Record<keyof NguongCong, string> = {
  dispute_vang: 'Dispute — vàng từ (%)', dispute_do: 'Dispute — đỏ từ (%)', hoan_vang: 'Hoàn tiền — vàng từ (%)',
  that_bai_vang: 'Thanh toán thất bại — vàng từ (%)', that_bai_do: 'Thanh toán thất bại — đỏ từ (%)' };

export type VanDe = { muc: 'do' | 'vang'; chu: string };
export type TyLe = { dispute: number | null; hoan: number | null; that_bai: number | null };

const pt = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10000) / 100 : null);
export function tyLeCong(s: SucKhoeCong): TyLe {
  return { dispute: pt(s.ky90.dispute, s.ky90.thanh_cong), hoan: pt(s.ky90.hoan, s.ky90.thanh_cong), that_bai: pt(s.ky30.that_bai, s.ky30.thanh_cong + s.ky30.that_bai) };
}

/** Đánh giá: danh sách vấn đề (đỏ trước) + mức chung. Chỉ dựa trên số thô + ngưỡng — cùng một hàm cho máy chủ (cảnh báo) và màn. */
export function danhGiaCong(s: SucKhoeCong, ng: Partial<NguongCong> = {}): { muc: 'tot' | 'vang' | 'do'; van_de: VanDe[]; ty_le: TyLe } {
  const n = { ...NGUONG_MAC_DINH, ...ng };
  const t = tyLeCong(s), v: VanDe[] = [];
  if (!s.tai_khoan.nhan_tien) v.push({ muc: 'do', chu: `Tài khoản KHÔNG nhận được tiền${s.tai_khoan.ly_do_khoa ? ` (${s.tai_khoan.ly_do_khoa})` : ''} — mọi checkout đang hỏng` });
  if (!s.tai_khoan.rut_tien) v.push({ muc: 'do', chu: 'Tài khoản bị khoá rút tiền (payouts) — tiền bán được không về ngân hàng' });
  if (s.tai_khoan.qua_han.length) v.push({ muc: 'do', chu: `Stripe đòi bổ sung đã QUÁ HẠN: ${s.tai_khoan.qua_han.slice(0, 4).join(', ')}` });
  if (s.tai_khoan.thieu.length) v.push({ muc: 'vang', chu: `Stripe đòi bổ sung: ${s.tai_khoan.thieu.slice(0, 4).join(', ')}${s.tai_khoan.han ? ` · hạn ${new Date(s.tai_khoan.han * 1000).toISOString().slice(0, 10)}` : ''}` });
  if (t.dispute != null && t.dispute >= n.dispute_do) v.push({ muc: 'do', chu: `Tỷ lệ dispute 90 ngày ${t.dispute}% ≥ ${n.dispute_do}% — vùng Stripe/Visa có thể giữ tiền hoặc khoá tài khoản` });
  else if (t.dispute != null && t.dispute >= n.dispute_vang) v.push({ muc: 'vang', chu: `Tỷ lệ dispute 90 ngày ${t.dispute}% ≥ ${n.dispute_vang}%` });
  if (s.ky90.dispute_mo) v.push({ muc: 'vang', chu: `${s.ky90.dispute_mo} dispute đang chờ nộp bằng chứng` });
  if (s.ky90.efw) v.push({ muc: 'vang', chu: `${s.ky90.efw} cảnh báo gian lận sớm (EFW) từ ngân hàng — hoàn chủ động trước khi thành dispute` });
  if (t.hoan != null && t.hoan >= n.hoan_vang) v.push({ muc: 'vang', chu: `Tỷ lệ hoàn tiền 90 ngày ${t.hoan}% ≥ ${n.hoan_vang}%` });
  if (t.that_bai != null && t.that_bai >= n.that_bai_do) v.push({ muc: 'do', chu: `Thanh toán thất bại 30 ngày ${t.that_bai}% — nghi bị thử thẻ (card testing)` });
  else if (t.that_bai != null && t.that_bai >= n.that_bai_vang) v.push({ muc: 'vang', chu: `Thanh toán thất bại 30 ngày ${t.that_bai}% ≥ ${n.that_bai_vang}%` });
  if (s.rut.some((r) => r.trang_thai === 'failed')) v.push({ muc: 'do', chu: 'Có lần rút tiền về ngân hàng THẤT BẠI — kiểm tài khoản ngân hàng trên Stripe' });
  const wTat = s.webhook.filter((w) => w.trang_thai !== 'enabled');
  if (wTat.length) v.push({ muc: 'vang', chu: `${wTat.length} webhook đang tắt: ${wTat.map((w) => w.url).join(', ')}` });
  if (s.su_kien_treo) v.push({ muc: 'vang', chu: `${s.su_kien_treo} sự kiện Stripe chưa giao được tới webhook (≥ 1 giờ) — có endpoint đang lỗi; Stripe sẽ tự tắt endpoint lỗi lâu` });
  v.sort((a, b) => (a.muc === b.muc ? 0 : a.muc === 'do' ? -1 : 1));
  return { muc: v.some((x) => x.muc === 'do') ? 'do' : v.length ? 'vang' : 'tot', van_de: v, ty_le: t };
}

/** LOẠI CỔNG — một sổ cho máy chủ (kiểm khoá) + màn (nhãn). vai: 'thu' thu tiền khách · 'nhan' nơi tiền về. api: máy tự đọc sức khoẻ được chưa.
 *  Thêm cổng mới (vd PingPong có API sau này) = thêm một dòng ở đây + một bộ đọc như chupStripe; sổ shop_cong không đổi. */
export const KIEU_CONG: Record<string, { ten: string; vai: 'thu' | 'nhan'; api: boolean; link: string | null }> = {
  stripe: { ten: 'Stripe', vai: 'thu', api: true, link: 'https://dashboard.stripe.com/' },
  paypal: { ten: 'PayPal', vai: 'thu', api: false, link: 'https://www.paypal.com/' },
  payoneer: { ten: 'Payoneer', vai: 'nhan', api: false, link: 'https://www.payoneer.com/' },
  pingpong: { ten: 'PingPong', vai: 'nhan', api: false, link: 'https://www.pingpongx.com/' },
  khac: { ten: 'Khác', vai: 'thu', api: false, link: null },
};
export const VAI_CONG: Record<'thu' | 'nhan', string> = { thu: 'Thu tiền khách', nhan: 'Nơi tiền về' };
export const TRANG_THAI_TAY: Record<string, [string, 'tot' | 'vang' | 'do']> = { on: ['bình thường', 'tot'], can_xem: ['cần xem', 'vang'], khoa: ['bị khoá / hạn chế', 'do'] };
/** Cổng chưa có API: quá chừng này ngày chưa kiểm tay → vàng. */
export const KIEM_TAY_NGAY = 30;

/** Một cổng như màn đọc (lib/shop/cong.ts docDsCong). */
export type CongDong = { id: number; loai: string; vai: 'thu' | 'nhan'; ma: string; ten: string | null; ghiChu: string | null; taiKhoan: string | null; link: string | null;
  veCongId: number | null; trangThaiTay: string | null; kiemLuc: string | null; nguong: Record<string, number>; sucKhoe: SucKhoeCong | null;
  docLuc: string | null; loi: string | null; shops: string[]; lichSu: { ngay: string; so: Pick<SucKhoeCong, 'ky90' | 'ky30' | 'so_du'> }[] };

/** Đánh giá MỘT cổng bất kể loại: có số đọc từ API → danhGiaCong; chưa có API → trạng thái anh ghi + hạn kiểm tay. */
export function danhGiaMotCong(g: CongDong, bayGio = Date.now()): { muc: 'tot' | 'vang' | 'do'; van_de: VanDe[]; ty_le: TyLe | null } {
  if (g.loi) return { muc: 'do', van_de: [{ muc: 'do', chu: `Không đọc được cổng: ${g.loi}` }], ty_le: null };
  if (g.sucKhoe) return danhGiaCong(g.sucKhoe, g.nguong);
  const v: VanDe[] = [];
  const tt = TRANG_THAI_TAY[g.trangThaiTay ?? ''];
  if (tt?.[1] === 'do') v.push({ muc: 'do', chu: `Ghi tay: ${tt[0]}` });
  else if (tt?.[1] === 'vang') v.push({ muc: 'vang', chu: `Ghi tay: ${tt[0]}` });
  const ngay = g.kiemLuc ? Math.floor((bayGio - Date.parse(g.kiemLuc)) / 86_400_000) : null;
  if (KIEU_CONG[g.loai]?.api) { if (!g.docLuc) v.push({ muc: 'vang', chu: 'Chưa đọc được lần nào — bấm "Đọc lại ngay"' }); }
  else if (ngay == null) v.push({ muc: 'vang', chu: 'Chưa kiểm tay lần nào — mở trang quản trị của cổng, xem có thông báo/hạn chế không rồi bấm "Đã kiểm"' });
  else if (ngay > KIEM_TAY_NGAY) v.push({ muc: 'vang', chu: `${ngay} ngày chưa kiểm tay (quá ${KIEM_TAY_NGAY} ngày)` });
  return { muc: v.some((x) => x.muc === 'do') ? 'do' : v.length ? 'vang' : 'tot', van_de: v, ty_le: null };
}

/** Ô "tài khoản" của cổng: CHỈ email / mã tài khoản. Trả lỗi nếu trông như mật khẩu hoặc số thẻ / số tài khoản ngân hàng (≥ 12 chữ số liền). */
export function loiTaiKhoanCong(tk: string): string | null {
  if (/mật khẩu|password|passwd|\bpin\b/i.test(tk)) return 'không lưu mật khẩu ở đây — chỉ email / mã tài khoản';
  if (/\d(?:[\s-]?\d){11,}/.test(tk)) return 'không lưu số thẻ / số tài khoản ngân hàng — chỉ email hoặc mã tài khoản (vd ID Payoneer)';
  return null;
}

