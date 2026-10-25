// GÓC SPY (nguồn idea của bài đăng, anh 25/10/2026): nhãn + màu theo loại góc — cùng bảng loại với spy.on.tc (web/app.js › LOAI_GOC, app.css .loai-*),
// để chip góc trên mos2 đọc giống hệt màn "Thị trường nói gì" của spy. Loại 'ai_x' và 'x' là một.
export type GocBai = { sp: number; id: number; loai: string; ten: string };
const LOAI: Record<string, [string, string]> = {
  phan_doi: ['Phản đối', '#f97316'], ngai: ['Phản đối', '#f97316'], cach_giai: ['Cách đang giải', '#3b82f6'], chan_dung: ['Chân dung', '#2ec4b6'],
  noi_dau: ['Nỗi đau', '#ef4444'], dau: ['Nỗi đau', '#ef4444'], mong_muon: ['Mong muốn', '#10b981'], muon: ['Mong muốn', '#10b981'],
  tieu_chi: ['Tiêu chí chọn', '#84cc16'], tinh_huong: ['Tình huống', '#b47cff'], tinh_huong_mo: ['Tình huống', '#b47cff'], cu_hich: ['Cú hích', '#eab308'],
  so_sanh: ['So sánh', '#3b82f6'], nguoi_mua_ho: ['Người mua hộ', '#ff6fa8'],
};
export const loaiGoc = (l: string): [string, string] => LOAI[String(l).replace(/^ai_/, '')] ?? [l, '#64748b'];
/** spy chưa có đường dẫn tới MỘT góc — mở nhóm góc của bài (màn Thị trường nói gì) */
export const linkGoc = (g: Pick<GocBai, 'sp'>) => `https://spy.on.tc/#/goc?sp=${g.sp}`;
