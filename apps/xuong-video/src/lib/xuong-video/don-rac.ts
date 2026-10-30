// MÁY DỌN RÁC R2 (anh 31/10/2026: "cần 1 con dọn rác tự động") — luật thuần, không I/O; chạy bằng scripts/don-rac-r2.mts (Phòng Tài nguyên gọi mỗi đêm).
// Rác = tệp studio trong thư mục được dọn (DON), cũ hơn TUOI_NGAY, mà KHÔNG chỗ nào trên box3 còn nhắc tới (mọi DB + tệp /opt, /var/lib).
// Không xoá thẳng: dời vào thùng rác xuong-video/rac/<ngày>/…, giữ GIU_RAC_NGAY ngày rồi mới xoá hẳn — trong thời gian đó trả lại được (--tra).
// Thư mục KHÔNG dọn: may/ (máy đăng — iMac có thể còn giữ link), ethopex/, lora/ (mô hình đã huấn luyện), nho/ (ảnh nhỏ đi theo ảnh gốc), kho/ (thư viện).

export const GOC = 'xuong-video/';
export const RAC = `${GOC}rac/`;
export const DON = ['clip', 'keyframe', 'xuat', 'khung-xam', 'thu', 'soat', 'am', 'bang', 'animatic', 'video', 'bien-the', 'may-dung', 'do-sau',
  'clip-sua', 'vong-sua', 'sua-tay', 'thu-3d', 'thu-phong-cach', 'thu-nhan-vat', 'bo-set'];
export const TUOI_NGAY = 14, GIU_RAC_NGAY = 30, TRAN_LUOT = 5000;
/** Phanh: kho tham chiếu ít hơn mức này = quét hỏng (DB không đọc được) → không dọn gì. Tỷ lệ rác vượt mức này = nghi quét sót → không dọn. */
export const PHANH = { thamChieuToiThieu: 3000, tyLeRacToiDa: 0.7 };

type Tep = { key: string; size: number; luc: number };
const ten = (k: string) => k.slice(k.lastIndexOf('/') + 1);
const giai = (x: string) => { try { return decodeURIComponent(x); } catch { return x; } };

/** Chuỗi khớp `xuong-video/…` nhặt được từ dump DB + tệp → tập khoá + tập tên tệp (khớp theo tên là lưới đỡ khi đường dẫn bị cắt / mã hoá khác). */
export function khoThamChieu(chuoi: Iterable<string>): { khoa: Set<string>; ten: Set<string> } {
  const khoa = new Set<string>(), tenTep = new Set<string>();
  for (const c of chuoi) { const k = giai(c.trim()).replace(/[.,;:]+$/, ''); if (!k.startsWith(GOC)) continue; khoa.add(k); const t = ten(k); if (t.length >= 12) tenTep.add(t); }
  return { khoa, ten: tenTep };
}

/** Thuần: danh sách tệp R2 + kho tham chiếu → việc phải làm. Phanh kéo thì trả `dung` (lý do) và không có việc nào. */
export function chonRac(ds: Tep[], ref: { khoa: Set<string>; ten: Set<string> }, bay = Date.now()) {
  const nguong = bay - TUOI_NGAY * 864e5, hetRac = bay - GIU_RAC_NGAY * 864e5;
  const thuMuc = (k: string) => k.slice(GOC.length).split('/')[0] ?? '';
  const trongPham = ds.filter((t) => t.key.startsWith(GOC) && !t.key.startsWith(RAC) && DON.includes(thuMuc(t.key)));
  const cu = trongPham.filter((t) => t.luc && t.luc < nguong);
  const rac = cu.filter((t) => !ref.khoa.has(t.key) && !ref.ten.has(ten(t.key)));
  // thùng rác: ngày nằm trong đường dẫn rac/<YYYY-MM-DD>/ — quá hạn giữ thì xoá hẳn
  const xoaHan = ds.filter((t) => t.key.startsWith(RAC) && Date.parse(t.key.slice(RAC.length, RAC.length + 10)) < hetRac);
  const theoThuMuc: Record<string, { n: number; mb: number }> = {};
  for (const t of rac) { const m = (theoThuMuc[thuMuc(t.key)] ??= { n: 0, mb: 0 }); m.n++; m.mb += t.size / 1e6; }
  let dung: string | null = null;
  if (ref.khoa.size < PHANH.thamChieuToiThieu) dung = `kho tham chiếu chỉ ${ref.khoa.size} khoá (< ${PHANH.thamChieuToiThieu}) — quét DB / tệp hỏng, không dọn`;
  else if (cu.length && rac.length / cu.length > PHANH.tyLeRacToiDa) dung = `${rac.length}/${cu.length} tệp cũ không ai nhắc (> ${PHANH.tyLeRacToiDa * 100}%) — nghi quét sót, không dọn`;
  return { quet: trongPham.length, cu: cu.length, rac: dung ? [] : rac.slice(0, TRAN_LUOT), conLai: dung ? 0 : Math.max(0, rac.length - TRAN_LUOT), xoaHan: dung ? [] : xoaHan, theoThuMuc, dung,
    tongRacMb: Math.round(rac.reduce((a, t) => a + t.size, 0) / 1e6) };
}

/** Khoá trong thùng rác của một tệp: xuong-video/clip/a.mp4 → xuong-video/rac/2026-10-31/clip/a.mp4 */
export const khoaRac = (key: string, ngay: string) => `${RAC}${ngay}/${key.slice(GOC.length)}`;
/** Ngược lại (trả tệp về chỗ cũ). */
export const khoaTuRac = (key: string) => (key.startsWith(RAC) ? GOC + key.slice(RAC.length + 11) : null);
