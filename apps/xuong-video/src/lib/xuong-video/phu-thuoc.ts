// Phụ thuộc của một bước sinh tốn tiền trên một shot (11/10/2026, ý lấy từ MuseFlow: chọn node chạy + cảnh báo nguồn chưa có).
// Thuần (không DB) — bảng "Sinh theo lựa chọn" (chay-chon.tsx) đọc luật này để không bỏ tiền vào một lượt chắc chắn hỏng hoặc lệch;
// phần chan khớp điều kiện server tự từ chối (sinhKeyframeCanh / batDauVideoCanh).
//   chan  = chưa chạy được (server cũng sẽ từ chối) → ô tick khoá, ghi lý do.
//   luu_y = chạy được nhưng có hệ quả nên biết trước (nối khung lệch, thoại chưa có giọng, đã có bản sẵn…).
// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/phu-thuoc.test.mts
import { thanhPhanCanh, type Canh, type NhanVat } from './kieu';
import { dongThoai } from './am-thanh';

export type ViecShot = 'keyframe' | 'video';
export type PhuThuoc = { chan: string[]; luu_y: string[] };

/** truoc / ke = shot liền trước / liền sau trong tập; noiKhung = tập bật "khung cuối = keyframe cảnh sau". */
export function phuThuocShot(viec: ViecShot, c: Canh, nhanVat: NhanVat[], o: { truoc?: Canh; ke?: Canh; noiKhung: boolean }): PhuThuoc {
  const chan: string[] = []; const luu_y: string[] = [];
  if (viec === 'keyframe') {
    if (c.dang_sinh_anh) chan.push('đang sinh ảnh');
    if (!c.prompt_anh.trim()) chan.push('chưa có prompt ảnh');
    chan.push(...thanhPhanCanh(c, nhanVat).thieu);
    if (c.keyframe_url) luu_y.push('đã có keyframe — ảnh mới vào dải ứng viên, phải chọn mới thay');
    if (o.noiKhung && o.truoc && (o.truoc.video_url || o.truoc.video_cuoi_url)) luu_y.push(`clip shot #${o.truoc.thu_tu} lấy keyframe này làm khung cuối — đổi keyframe thì clip đó phải sinh lại mới nối liền`);
  } else {
    if (c.trang_thai === 'dang_sinh') chan.push('đang sinh video');
    if (!c.keyframe_url) chan.push('chưa có keyframe');
    else if (c.trang_thai !== 'duyet' && c.trang_thai !== 'loi' && c.trang_thai !== 'xong') chan.push('chưa duyệt keyframe');
    if (o.noiKhung && o.ke && !o.ke.keyframe_url) luu_y.push(`shot #${o.ke.thu_tu} chưa có keyframe — clip này sẽ không có khung cuối, nối không liền`);
    const thieuGiong = dongThoai(c, nhanVat).filter((d) => d.loi.trim() && !d.url);
    if (thieuGiong.length) luu_y.push(`${thieuGiong.length} dòng thoại chưa sinh giọng — clip sẽ tự đọc bằng giọng của model; nên sinh giọng trước`);
    if (c.video_url || c.video_cuoi_url) luu_y.push('đã có clip — bản mới thêm vào danh sách phiên bản');
  }
  return { chan, luu_y };
}

/** Sơ đồ nguồn của một shot (11/10/2026, ý thứ hai lấy từ MuseFlow): thứ ĐÃ gửi lúc sinh keyframe / clip đang dùng, so với thứ GIỜ sẽ gửi.
 *  doi = cờ "nguồn đã đổi sau khi sinh" → bản đang dùng không còn khớp kịch bản/tham chiếu hiện tại. */
/** doi = cờ đỏ (đổi cấu trúc: keyframe khác, khung cuối, ảnh tham chiếu); cauLenh = câu thêm/bớt so với giờ sẽ gửi (vàng, để đọc). */
export type BuocNguon = { job: number; model: string; luc: string; chi_phi_cents: number; nhan: string; prompt: string; doi: string[]; cauLenh: { them: string[]; bot: string[] } | null };
export type NguonShot = {
  id: number; thu_tu: number; canh: string; ti_le: string; keyframe_url: string | null; video_url: string | null;
  thamChieu: { url: string; nhan: string }[];
  keyframe: (BuocNguon & { thamChieuUrl: string[] | null }) | null;
  video: (BuocNguon & { khungDau: string | null; khungCuoi: string | null; xuLySau: string | null }) | null;
  khungCuoiNay: string | null; promptAnhNay: string; promptVideoNay: string;
};

/** Hai câu lệnh khác nhau ở CÂU nào: tách theo dấu kết câu, trả câu chỉ có ở bản mới (them) / chỉ ở bản cũ (bot).
 *  Cờ "câu lệnh đã đổi" trơn bật trên gần hết shot cũ (cách ghép đổi theo thời gian) nên vô nghĩa — phải chỉ ra đổi CÁI GÌ. */
export function khacCauLenh(cu: string, moi: string): { them: string[]; bot: string[] } {
  const tach = (x: string) => x.split(/(?<=[.!?])\s+/).map((c) => c.trim()).filter(Boolean);
  const a = tach(cu), b = tach(moi); const A = new Set(a), B = new Set(b);
  return { them: b.filter((c) => !A.has(c)), bot: a.filter((c) => !B.has(c)) };
}
