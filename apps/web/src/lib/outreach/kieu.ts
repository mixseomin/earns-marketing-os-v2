// SỔ KIỂU + NGUỒN + TRẠNG THÁI của outreach — MỘT nguồn cho outreach.on.tc (bảng, phễu, sổ kiểu) và cho việc tạo chiến dịch.
// File THƯỜNG (không 'use client'): máy chủ và trình duyệt cùng import được giá trị thật.
// Chiến dịch (outreach_campaigns.type) mang MÃ KIỂU ở đây; mã lạ trong DB vẫn hiện được (kieuCua trả kiểu "khac"), không vỡ bảng.
// Thêm kiểu = một mục KIEU. Thêm nguồn người nhận = một mục NGUON (+ bộ nạp ở nhịp sau). tra-repo-ok: sổ khai báo nội bộ, không phải khối mã nhiều thao tác.

export type KieuSo = {
  ten: string;
  /** người nhận là ai */
  nhan: string;
  /** kết quả tính là THẮNG của kiểu này — cột "Thắng" trên bảng đọc theo đây */
  dich: string;
  /** trạng thái người nhận được đếm là thắng */
  thang: string[];
  /** kênh chính */
  kenh: string;
  /** mã nguồn (NGUON) hợp với kiểu này */
  nguon: string[];
};

export const KIEU = {
  khach: { ten: 'Tìm khách mua', nhan: 'người có lý do mua ngay: đang chạy quảng cáo, đang bán cùng ngách', dich: 'mua sản phẩm hoặc đặt gói riêng', thang: ['interested', 'won'], kenh: 'email', nguon: ['spy_nha_qc', 'csv', 'manual'] },
  embed: { ten: 'Nhúng công cụ', nhan: 'chủ site có trang hợp để nhúng công cụ / bản đồ của dự án', dich: 'site của họ nhúng công cụ (đo được lượt tải)', thang: ['embedded'], kenh: 'email + form liên hệ', nguon: ['markdown_pack', 'csv', 'manual'] },
  backlink: { ten: 'Xin backlink', nhan: 'biên tập viên / chủ trang tài nguyên', dich: 'trang của họ đặt link về dự án', thang: ['interested', 'embedded', 'won'], kenh: 'email', nguon: ['backlink', 'csv', 'manual'] },
  doi_tac: { ten: 'Đối tác và affiliate', nhan: 'chương trình affiliate, nhà bán, người có tệp khách', dich: 'được duyệt vào chương trình hoặc chốt hợp tác', thang: ['interested', 'won'], kenh: 'email + form đăng ký', nguon: ['manual', 'csv'] },
  bao_chi: { ten: 'Báo chí và người viết', nhan: 'phóng viên, người viết bản tin, chủ kênh trong ngách', dich: 'bài viết / lượt nhắc tới dự án', thang: ['interested', 'won'], kenh: 'email + mạng xã hội', nguon: ['manual', 'csv'] },
  khac: { ten: 'Khác', nhan: 'chưa xếp kiểu', dich: 'tự đặt trong chiến dịch', thang: ['interested', 'embedded', 'won'], kenh: 'tự chọn', nguon: ['manual', 'csv'] },
} as const satisfies Record<string, KieuSo>;
export type MaKieu = keyof typeof KIEU;
/** mã kiểu cũ trong DB → mã trong sổ */
const KIEU_CU: Record<string, MaKieu> = { custom: 'khac', sales: 'khach', recruit: 'doi_tac' };
export const maKieu = (raw: string | null | undefined): MaKieu => {
  const k = String(raw ?? '');
  const co = (o: object) => Object.prototype.hasOwnProperty.call(o, k);   // không tra thẳng o[k]: mã lạ kiểu "toString" sẽ trúng hàm có sẵn của Object
  return co(KIEU) ? (k as MaKieu) : co(KIEU_CU) ? KIEU_CU[k]! : 'khac';
};
export const kieuCua = (raw: string | null | undefined): KieuSo => KIEU[maKieu(raw)];

export type NguonSo = { ten: string; moTa: string; /** bộ nạp đã chạy được chưa */ noi: boolean };
export const NGUON = {
  spy_nha_qc: { ten: 'Nhà quảng cáo từ spy', moTa: 'thương hiệu đang chạy quảng cáo trong một ngách (kho spy: Meta, TikTok, Google) → người nhận kèm quảng cáo của chính họ', noi: true },
  backlink: { ten: 'Việc backlink', moTa: 'việc backlink cần thư ngỏ trên bảng việc của dự án', noi: true },
  markdown_pack: { ten: 'Gói danh sách soạn sẵn', moTa: 'danh sách người nhận nạp theo gói (đợt MilitaryCalc)', noi: true },
  csv: { ten: 'Dán danh sách', moTa: 'dán danh sách tên · email · website, mỗi dòng một người', noi: true },
  manual: { ten: 'Thêm tay', moTa: 'thêm từng người trong trang outreach của dự án', noi: true },
  // nguồn do máy tìm người nhận ghi (mẫu thư riêng từng nguồn ở lib/outreach-template.ts)
  'resource-engine': { ten: 'Máy tìm trang tài nguyên', moTa: 'trang tổng hợp tài nguyên / link hữu ích do máy tìm người nhận dò ra', noi: true },
  listing: { ten: 'Trang danh sách link', moTa: 'site có trang "resources / helpful links" để xin thêm vào danh sách', noi: true },
  'pr-engine': { ten: 'Máy tìm người viết', moTa: 'người viết, biên tập viên để gửi số liệu làm bài', noi: true },
  'cse-engine': { ten: 'Máy tìm qua tìm kiếm', moTa: 'người nhận do máy dò bằng công cụ tìm kiếm', noi: true },
  affiliate: { ten: 'Chương trình affiliate', moTa: 'chương trình affiliate cần đăng ký hoặc xin duyệt', noi: true },
} as const satisfies Record<string, NguonSo>;
export function nguonCua(raw: string | null | undefined): NguonSo {
  const k = String(raw ?? '');
  if (Object.prototype.hasOwnProperty.call(NGUON, k)) return (NGUON as Record<string, NguonSo>)[k]!;   // không tra thẳng NGUON[k]: mã lạ kiểu "constructor" sẽ trúng hàm có sẵn của Object
  const dot = k.match(/^prospecting-(\d{4})-(\d{2})-(\d{2})$/);   // đợt tìm người nhận theo ngày
  if (dot) return { ten: `Đợt tìm ${dot[3]}/${dot[2]}/${dot[1]}`, moTa: 'một đợt máy tìm người nhận', noi: true };
  return { ten: k || 'không ghi nguồn', moTa: 'nguồn chưa khai trong sổ', noi: true };
}

/** nhóm trạng thái người nhận — phễu và mọi phép đếm trên outreach.on.tc đọc ở đây */
export const TT_CHO = ['to_send'];
export const TT_DANG = ['sent', 'followup_1', 'followup_2'];
export const TT_TRA_LOI = ['replied', 'interested', 'embedded', 'won'];
export const TT_CHET = ['declined', 'bounced', 'no_response', 'unreachable'];
export const NHAN_TT: Record<string, { ten: string; mau: string }> = {
  to_send: { ten: 'Chờ gửi', mau: 'var(--fg-3)' },
  sent: { ten: 'Đã gửi', mau: 'var(--accent)' },
  followup_1: { ten: 'Nhắc lần 1', mau: 'var(--accent)' },
  followup_2: { ten: 'Nhắc lần 2', mau: 'var(--accent)' },
  replied: { ten: 'Đã trả lời', mau: 'var(--neon-lime, #4ade80)' },
  interested: { ten: 'Quan tâm', mau: 'var(--neon-lime, #4ade80)' },
  embedded: { ten: 'Đã nhúng', mau: 'var(--neon-lime, #4ade80)' },
  won: { ten: 'Chốt', mau: 'var(--neon-lime, #4ade80)' },
  declined: { ten: 'Từ chối', mau: 'var(--fg-3)' },
  bounced: { ten: 'Thư dội', mau: 'var(--bad, #f87171)' },
  no_response: { ten: 'Không trả lời', mau: 'var(--fg-3)' },
  unreachable: { ten: 'Không liên lạc được', mau: 'var(--fg-3)' },
};
export const ttCua = (raw: string) => (Object.prototype.hasOwnProperty.call(NHAN_TT, raw) ? NHAN_TT[raw]! : { ten: raw, mau: 'var(--fg-2)' });
