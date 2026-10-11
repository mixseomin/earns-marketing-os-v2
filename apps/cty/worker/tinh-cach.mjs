// CHỈ SỐ GỐC (tính cách) — lớp "gốc" của nhân sự (decision 2026-10-11 nhân sự sống): đặt lúc tuyển, CỐ ĐỊNH, thang 1–10, khai trong
// SOUL.md (`tc_<chỉ số>: <1–10>`). Con số không tự có nghĩa với mô hình → mỗi chỉ số có THANG 3 NẤC dịch ra hành vi, đi vào lời dặn.
// Chỉ số nào chạy so sánh mà không đổi được kết quả thì bỏ (cai-tien.mjs --so-tinh-cach) — không giữ chỉ số trang trí.
export const TINH_CACH = {
  can_than: { ten: 'Cẩn thận', nac: ['Ưu tiên nộp nhanh; chỉ kiểm lại khi thấy rõ có sai.', 'Kiểm lại các tiêu chí đếm được (số câu, số từ, ngôn ngữ) trước khi nộp.', 'Trước khi nộp, tự đếm lại TỪNG tiêu chí và ghi bằng chứng cho từng tiêu chí; còn nghi ngờ thì sửa trước rồi mới nộp.'] },
  sang_tao: { ten: 'Sáng tạo', nac: ['Bám sát cách diễn đạt quen thuộc, an toàn, không thử lạ.', 'Diễn đạt tự nhiên, có thể đổi cách nói khi tiêu chí cho phép.', 'Tìm góc diễn đạt mới, cụ thể, đáng nhớ — nhưng không bao giờ phá tiêu chí.'] },
  mem_mong: { ten: 'Mềm mỏng', nac: ['Nói thẳng, ngắn, không rào đón.', 'Nói rõ việc, giữ giọng trung tính.', 'Góp ý nhẹ nhàng: chỉ ra chỗ chưa đạt kèm cách sửa cụ thể.'] },
};
const nac = (v) => (v <= 3 ? 0 : v <= 7 ? 1 : 2);
/** fm SOUL (+ ghi đè) → [{ ma, ten, gia_tri, hanh_vi }] — chỉ chỉ số đã khai. */
export function tinhCachCua(fm, ghiDe = {}) {
  return Object.entries(TINH_CACH).flatMap(([ma, t]) => {
    const v = Number(ghiDe[ma] ?? fm[`tc_${ma}`]); if (!(v >= 1 && v <= 10)) return [];
    return [{ ma, ten: t.ten, gia_tri: v, hanh_vi: t.nac[nac(v)] }];
  });
}
/** Đoạn đưa vào lời dặn. Rỗng khi chưa khai. */
export const loiDanTinhCach = (ds) => (ds.length ? `\n\nTÍNH CÁCH GỐC (thang 1–10):\n${ds.map((x) => `- ${x.ten} ${x.gia_tri}/10: ${x.hanh_vi}`).join('\n')}` : '');

if (process.argv.includes('--tu-kiem') && (process.argv[1] || '').endsWith('tinh-cach.mjs')) {
  const ds = tinhCachCua({ tc_can_than: 9, tc_sang_tao: 2, tc_mem_mong: 5, tc_la: 7 });
  const loi = [];
  if (ds.length !== 3 || ds[0].hanh_vi !== TINH_CACH.can_than.nac[2] || ds[1].hanh_vi !== TINH_CACH.sang_tao.nac[0] || ds[2].hanh_vi !== TINH_CACH.mem_mong.nac[1]) loi.push('thang 3 nấc');
  if (tinhCachCua({ tc_can_than: 9 }, { can_than: 2 })[0].hanh_vi !== TINH_CACH.can_than.nac[0]) loi.push('ghi đè (chạy so sánh)');
  if (tinhCachCua({ tc_can_than: 0 }).length || loiDanTinhCach([]) !== '') loi.push('ngoài 1–10 / chưa khai → bỏ qua');
  if (loi.length) { console.error('✗ tinh-cach:', loi.join('; ')); process.exit(1); }
  console.log('✓ tinh-cach: thang 3 nấc, ghi đè để so sánh, chưa khai thì bỏ qua');
}
