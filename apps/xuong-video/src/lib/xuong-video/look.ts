// LOOK — TÔNG MÀU CHUNG CẢ PHIM (colorist "show LUT"; anh 17/10/2026 "phần xưởng khác có mà mình chưa làm, chọn cái tự động được"): bản xuất trước
// đây chỉ cân độ sáng giữa các clip (xuat.ts › canMauCanh) — mỗi clip AI một chất màu, phim không có "look". Một tông cho cả phim (kinh thánh
// `look`, key nhóm 'mau' của thư viện dien-anh.ts), shot khai ky_thuat.mau KHÁC thì tông riêng thắng (hồi tưởng đen trắng…). Áp sau cân sáng.
// Chuỗi lọc ffmpeg nhẹ tay (colorbalance ±0,1, eq) — đổi tông chứ không đổi nội dung; kiểm chạy được: look.test.mts.
export const LOOK: Record<string, string> = {
  tu_nhien: 'eq=contrast=1.03:saturation=1.02',
  am: 'colorbalance=rs=0.05:gs=0.02:bs=-0.05:rm=0.04:bm=-0.04,eq=saturation=1.05',
  teal_cam: 'colorbalance=rs=-0.08:bs=0.10:rh=0.08:gh=0.03:bh=-0.08,eq=contrast=1.08:saturation=1.08',
  lanh: 'colorbalance=rs=-0.05:bs=0.08:rm=-0.03:bm=0.05,eq=contrast=1.05:saturation=0.8',
  xanh_benh: 'colorbalance=rs=-0.03:gs=0.06:gm=0.05,eq=saturation=0.85',
  pastel: 'eq=contrast=0.9:saturation=0.85:brightness=0.03',
  tuong_phan_cao: 'eq=contrast=1.2:saturation=1.05',
  den_trang: 'hue=s=0,eq=contrast=1.1',
};
/** Tông của PHIM: khai tay (kinh_thanh.look) thắng; chưa khai thì SUY từ câu phong cách hình — chạy tự động, không cần người chọn. Chỉ suy cho
 *  PHIM TRUYỆN có thể loại (không phải quảng cáo qc_*): bản xuất quảng cáo đang chạy giữ nguyên màu trừ khi khai tay. */
export function lookPhim(kt: { look?: string; phong_cach?: string; the_loai?: string } | null | undefined): string {
  if (kt?.look && LOOK[kt.look]) return kt.look;
  if (!kt?.the_loai || /^qc_/.test(kt.the_loai)) return '';
  const p = (kt?.phong_cach ?? '').toLowerCase();
  if (/(black[- ]and[- ]white|monochrome|đen trắng|b&w)/.test(p)) return 'den_trang';
  if (/(teal|steel[- ]blue|orange and teal|blockbuster)/.test(p)) return 'teal_cam';
  if (/(pastel|soft candy)/.test(p)) return 'pastel';
  if (/(sickly|green tint|horror)/.test(p)) return 'xanh_benh';
  if (/(cold|cool|desaturated|bleak|lạnh)/.test(p)) return 'lanh';
  if (/(warm|golden|cozy|sunset|ấm)/.test(p)) return 'am';
  if (/(high[- ]contrast|noir|punchy)/.test(p)) return 'tuong_phan_cao';
  return p ? 'tu_nhien' : '';
}
/** Chuỗi lọc look của một shot: tông riêng của shot (ky_thuat.mau) nếu khác tông phim, không thì tông phim; không rõ → '' (không áp). */
export const lookShot = (phim?: string | null, shot?: string | null): string => LOOK[(shot && shot !== phim ? shot : phim) ?? ''] ?? '';
