// THƯ VIỆN (tab trang chủ ?tab=thuvien, anh 21/10/2026): MỘT chỗ tra cứu — nhánh Thiết kế (bảng thu_vien) + các trang của nhóm Library cũ
// (Catalog, Offers, Tools & Skills, Knowledge, Platforms, Technologies) nhúng nguyên vào cây. Sổ này là NGUỒN DUY NHẤT của cây:
// thêm danh mục thiết kế = thêm một dòng DANH_MUC; mẫu mới chỉ cần ghi `nhanh` = khoá nút lá.

/** Danh mục thiết kế — cây 2 tầng (nhóm → loại). Khoá lá ghi vào thu_vien.nhanh. */
export type DanhMuc = { key: string; ten: string; icon: string; mo_ta: string; con?: DanhMuc[] };
export const DANH_MUC: DanhMuc[] = [
  { key: 'video', ten: 'Video', icon: '🎬', mo_ta: 'cách dựng, chữ, chuyển cảnh', con: [
    { key: 'video-code', ten: 'Dựng bằng code', icon: '💻', mo_ta: 'three.js / canvas / shader — khung hình là hàm của thời gian, xuất bằng máy' },
    { key: 'video-chu', ten: 'Chữ động · karaoke', icon: '🔤', mo_ta: 'kinetic typography, chữ khớp lời / nhịp' },
    { key: 'video-chuyen-canh', ten: 'Chuyển cảnh · nhịp dựng', icon: '✂️', mo_ta: 'cắt theo nhịp, chuyển cảnh, hiệu ứng' },
    { key: 'video-motion', ten: 'Motion graphics', icon: '🎞', mo_ta: 'After Effects / Lottie, icon & minh hoạ chuyển động' },
    { key: 'video-mau', ten: 'Mẫu viral · prompt', icon: '🔥', mo_ta: 'video đã lan truyền kèm prompt / công thức dựng' },
  ] },
  { key: 'hieu-ung', ten: 'Hiệu ứng', icon: '✨', mo_ta: 'shader, hạt, nền động, cuộn, rê chuột — dùng cho web lẫn video', con: [
    { key: 'hieu-ung-shader', ten: 'Shader · hậu kỳ', icon: '🌈', mo_ta: 'GLSL, bloom, grain, khúc xạ, hậu kỳ three.js' },
    { key: 'hieu-ung-hat', ten: 'Hạt · chất lỏng', icon: '💧', mo_ta: 'particles, confetti, mô phỏng chất lỏng' },
    { key: 'hieu-ung-nen-3d', ten: 'Nền động 3D', icon: '🌌', mo_ta: 'nền hero chuyển động bằng three.js' },
    { key: 'hieu-ung-cuon', ten: 'Cuộn · chuyển trang', icon: '📜', mo_ta: 'cuộn mượt, hiệu ứng theo cuộn, chuyển trang' },
    { key: 'hieu-ung-hover', ten: 'Rê chuột · thành phần', icon: '👆', mo_ta: 'hover, component có hiệu ứng, animation CSS' },
  ] },
  { key: 'giao-dien', ten: 'Giao diện', icon: '🖥', mo_ta: 'web · app · dashboard', con: [
    { key: 'giao-dien-trang', ten: 'Trang đích · bán hàng', icon: '🛬', mo_ta: 'landing, trang sản phẩm, CTA' },
    { key: 'giao-dien-bang', ten: 'Bảng · dashboard', icon: '📊', mo_ta: 'bảng dữ liệu, biểu đồ, màn điều khiển' },
  ] },
  { key: 'thuong-hieu', ten: 'Thương hiệu', icon: '🏷', mo_ta: 'logo · màu · chữ', con: [
    { key: 'thuong-hieu-logo', ten: 'Logo · biểu tượng', icon: '🔷', mo_ta: 'logo, favicon, icon set' },
    { key: 'thuong-hieu-mau-chu', ten: 'Màu · phông chữ', icon: '🎨', mo_ta: 'bảng màu, cặp phông, style bible' },
  ] },
  { key: 'anh', ten: 'Ảnh · minh hoạ', icon: '🖼', mo_ta: 'ảnh bìa, minh hoạ, generative art', con: [
    { key: 'anh-bia', ten: 'Ảnh bìa · thumbnail', icon: '🧾', mo_ta: 'cover, thumbnail, pin' },
    { key: 'anh-generative', ten: 'Generative · 3D', icon: '🌀', mo_ta: 'ảnh sinh bằng code / 3D' },
  ] },
];
export const LA_THIET_KE: DanhMuc[] = DANH_MUC.flatMap((n) => n.con ?? [n]);
/** khoá nút → các khoá lá nằm dưới nó (nút lá → chính nó) */
export function laDuoi(key: string): string[] {
  const n = DANH_MUC.find((x) => x.key === key);
  if (n) return (n.con ?? [n]).map((c) => c.key);
  return LA_THIET_KE.some((l) => l.key === key) ? [key] : [];
}

/** Các trang thư viện CŨ (nhóm Library ở thanh bên) — nhúng nguyên trang vào ô phải của tab. `admin` = chỉ admin thấy. */
export type NhanhCu = { key: string; ten: string; icon: string; mo_ta: string; admin?: boolean };
export const NHANH_CU: NhanhCu[] = [
  { key: 'cong-cu', ten: 'Công cụ & Skill', icon: '🗂', mo_ta: 'tools · skill snippets dùng chung' },
  { key: 'kien-thuc', ten: 'Kiến thức', icon: '📚', mo_ta: 'playbook · prompt · template · bài học · nguồn viết', admin: true },
  { key: 'catalog', ten: 'Catalog phương pháp', icon: '📋', mo_ta: 'method library · nguồn backlink', admin: true },
  { key: 'offers', ten: 'Offers', icon: '💸', mo_ta: 'affiliate CJ · Awin · duyệt', admin: true },
  { key: 'nen-tang', ten: 'Nền tảng', icon: '🌐', mo_ta: 'catalog nền tảng' },
  { key: 'cong-nghe', ten: 'Công nghệ', icon: '⚙️', mo_ta: 'selectors · signup fields', admin: true },
];

export type MucThuVien = {
  id: number; ten: string; nhanh: string[]; mo_ta: string; cach_dung: string; nguon_url: string | null; tac_gia: string | null;
  giay_phep: string | null; anh: string[]; the: string[]; ban_luu: string | null; tao_luc: string;
};
