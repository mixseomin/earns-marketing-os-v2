// KHUÔN QC PHIM NGẮN (Ethopex): chữ trên màn ngắn + tên phim ở shot 1 + thẻ cuối xem miễn phí. Dùng chung cho tao-lo.mts và them-the-cuoi.mts.
const NEN: Record<string, string> = { reelshort: 'ReelShort', netshort: 'NetShort', dramabox: 'DramaBox' };
/** chữ trên màn gọn: ≤ maxTu từ giữ nguyên; dài hơn thì cắt ở DẤU CÂU gần nhất (≥ 4 từ) — không cắt giữa cụm (bản đầu ra "So I took a job at the…") */
export function rutChu(s: string, maxTu = 10): string {
  const c = s.trim(); const w = c.split(/\s+/);
  if (w.length <= maxTu) return c;
  const m = [...c.matchAll(/[.,;:!?—]/g)].map((x) => x.index!).filter((i) => c.slice(0, i).split(/\s+/).length >= 4 && c.slice(0, i).split(/\s+/).length <= maxTu);
  return m.length ? c.slice(0, m.at(-1)! + 1).replace(/[,;:—]$/, '…') : c;
}
export function khuonQcPhim(ten: string, lang: 'en' | 'es', nguon: string, loi: string[]) {
  const nen = NEN[nguon] ?? 'our app';
  const chu = loi.map((l, i) => (i === 0 ? `${rutChu(l)}\n${lang === 'es' ? 'MINISERIE' : 'SHORT DRAMA'}: "${ten}"` : rutChu(l)));
  const theCuoi = lang === 'es'
    ? { chu: `"${ten}"\nMÍRALA GRATIS · TOCA MÁS INFORMACIÓN`, loi: `Mira "${ten}" gratis. Toca Más información.` }
    : { chu: `"${ten}"\nWATCH FREE · TAP LEARN MORE`, loi: `Watch "${ten}" free. Tap Learn More.` };
  return {
    chu,
    qcTen: lang === 'es' ? `${ten} — miniserie, gratis en ${nen}` : `${ten} — short drama, free on ${nen}`,
    theCuoi: { ...theCuoi, anh: 'Movie key art poster composition of the main characters from the reference poster, dramatic backlight, empty dark space in the lower third for title text, vertical 9:16.', dong: 'Slow cinematic push-in on the key art, light flares, characters hold still.' },
  };
}

/** QUY TRÌNH STUDIO cho QC phim ngắn (cổng keyframe/video của studio, 19/10/2026): khung truyện 4 nhịp, phân cảnh, vai từng shot, máy, khối diễn. */
export const BEATS_QC_PHIM = [
  { ten: 'Mở', mo_ta: 'cảnh kịch tính nhất + tên phim trong 2 giây đầu', cam_xuc: 2 },
  { ten: 'Bất công', mo_ta: 'nhân vật chính bị chà đạp / phản bội — người xem tức thay', cam_xuc: -3 },
  { ten: 'Lật ngược', mo_ta: 'bí mật / sức mạnh lộ ra, kẻ ác bắt đầu trả giá', cam_xuc: 3 },
  { ten: 'Chốt', mo_ta: 'tên phim + xem miễn phí, bấm Learn More', cam_xuc: 4 },
];
const PC = (ten: string, beat: string, muc_tieu: string, xung_dot: string, dau: number, cuoi: number) => ({ ten, an_y: '', beat, nhip: 'nhanh', muc_tieu, xung_dot, cam_xuc_dau: dau, cam_xuc_cuoi: cuoi });
export const PHAN_CANH_QC_PHIM = [
  PC('hook', 'Mở', 'giây đầu giữ tay bằng khoảnh khắc đỉnh', 'nhân vật bị coi thường vs sự thật', 2, 1),
  PC('bat_cong', 'Bất công', 'người xem thấy nhân vật bị đối xử bất công', 'kẻ phản bội / kẻ khinh thường', -1, -3),
  PC('nut_that', 'Bất công', 'đẩy bất công lên đỉnh', 'cả thế giới quay lưng', -3, -3),
  PC('lat_nguoc', 'Lật ngược', 'sức mạnh / thân phận thật lộ ra', 'kẻ ác bắt đầu sợ', 0, 3),
  PC('dinh', 'Lật ngược', 'khoảnh khắc trả thù / thắng thế', 'kẻ ác cúi đầu', 3, 4),
  PC('cta', 'Chốt', 'tên phim + xem miễn phí, bấm Learn More', '', 4, 4),
];
/** shot 1..7 → phân đoạn + cỡ cảnh + chuyển động (≤ 2 shot máy đứng yên) */
export const SHOT_QC_PHIM: Record<number, { phan_doan: string; co_canh: string; chuyen_dong: string; muc_dich: string }> = {
  1: { phan_doan: 'hook', co_canh: 'cu', chuyen_dong: 'day_vao', muc_dich: 'dừng lướt bằng khoảnh khắc đỉnh' },
  2: { phan_doan: 'bat_cong', co_canh: 'ms', chuyen_dong: 'cam_tay', muc_dich: 'người xem tức thay nhân vật' },
  3: { phan_doan: 'bat_cong', co_canh: 'ms', chuyen_dong: 'truot_ngang', muc_dich: 'người xem tức thay nhân vật' },
  4: { phan_doan: 'nut_that', co_canh: 'ws', chuyen_dong: 'lia', muc_dich: 'bất công lên đỉnh' },
  5: { phan_doan: 'lat_nguoc', co_canh: 'mcu', chuyen_dong: 'day_vao', muc_dich: 'sức mạnh lộ ra' },
  6: { phan_doan: 'dinh', co_canh: 'ws', chuyen_dong: 'cau', muc_dich: 'thắng thế, hả hê' },
  7: { phan_doan: 'cta', co_canh: 'ms', chuyen_dong: 'zoom_cham', muc_dich: 'kêu gọi xem phim' },
};
export type QcGoc = { ma: string; page: string; ngay: number };
/** nguồn tham khảo cho mọi câu (chữ màn + lời đọc): QC thật của app gốc cho đúng phim (spy.on.tc · ethopex_uu_tien) */
export const thamKhaoQcGoc = (cau: string[], g: QcGoc) => cau.filter((c) => c.trim()).map((c) => ({ cau: c, nguon: [{ ma: g.ma, link: `https://www.facebook.com/ads/library/?id=${g.ma}`, loai: 'qc_thang', nguon: 'qc_meta',
  trich: `QC của chính app gốc cho đúng phim này (${g.page} · đang chạy ${g.ngay} ngày, Meta ${g.ma}) — cùng cốt truyện, kể bất công → lật ngược → xem phim`,
  ky_thuat: 'Kể ngôi thứ nhất theo cốt truyện chính thức của phim (khuôn video thắng #1 Ethopex)' }] }));
export const briefQcPhim = (ten: string, nen: string, lang: 'en' | 'es') => `QC Facebook Ads cho PHIM NGẮN "${ten}" (${nen}, ${lang === 'es' ? 'tiếng Tây Ban Nha' : 'tiếng Anh'}). Sản phẩm = bộ phim; người xem là người lướt Facebook mê phim ngắn drama. Mục tiêu duy nhất: tò mò cốt truyện → bấm nút 'Learn More' để xem phim miễn phí trên trang phim. Không bán hàng, không giảm giá. Khuôn: hook kịch tính ngay giây đầu, kể ngôi thứ nhất 6 nhịp, chữ trên màn ngắn, thẻ cuối tên phim + 'xem miễn phí, bấm Learn More'.`;
export const nenCua = (nguon: string) => NEN[nguon] ?? 'our app';
