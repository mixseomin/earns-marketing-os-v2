// Phụ thuộc của một bước sinh tốn tiền trên một shot (11/10/2026, ý lấy từ MuseFlow: chọn node chạy + cảnh báo nguồn chưa có).
// Thuần (không DB) — bảng "Sinh theo lựa chọn" (chay-chon.tsx) đọc luật này để không bỏ tiền vào một lượt chắc chắn hỏng hoặc lệch;
// phần chan khớp điều kiện server tự từ chối (sinhKeyframeCanh / batDauVideoCanh).
//   chan  = chưa chạy được (server cũng sẽ từ chối) → ô tick khoá, ghi lý do.
//   luu_y = chạy được nhưng có hệ quả nên biết trước (nối khung lệch, thoại chưa có giọng, đã có bản sẵn…).
// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/phu-thuoc.test.mts
import { thanhPhanCanh, noiKhungShot, type Canh, type NhanVat } from './kieu';
import { chanTienKy, chanShot, chanVideo, type TapQt, type PhimQt } from './quy-trinh';

export type ViecShot = 'keyframe' | 'video';
export type PhuThuoc = { chan: string[]; luu_y: string[] };

export { thieuPhanCanh, thieuMau } from './quy-trinh';

/** truoc / ke = shot liền trước / liền sau trong tập; noiKhung = tập bật "khung cuối = keyframe cảnh sau"; phanCanh = tap.phan_canh. */
export function phuThuocShot(viec: ViecShot, c: Canh, nhanVat: NhanVat[], o: { truoc?: Canh; ke?: Canh; noiKhung: boolean; tap: TapQt; phim: PhimQt; /** các shot của tập — chấm hook kịch bản */ ds?: Canh[] }): PhuThuoc {
  const chan: string[] = []; const luu_y: string[] = [];
  if (viec === 'keyframe') {
    if (c.dang_sinh_anh) chan.push('đang sinh ảnh');
    chan.push(...chanTienKy(o.tap, o.phim, o.ds, o.ds, nhanVat.filter((v) => v.loai === 'boi_canh').map((v) => v.id)), ...chanShot(c, o.tap, nhanVat));
    if (!c.prompt_anh.trim()) chan.push('chưa có prompt ảnh');
    if (c.keyframe_url) luu_y.push('đã có keyframe — ảnh mới vào dải ứng viên, phải chọn mới thay');
    if (o.truoc && noiKhungShot(false, o.truoc) && !o.truoc.keyframe_url) luu_y.push(`shot #${o.truoc.thu_tu} liền máy với shot này — sinh keyframe shot #${o.truoc.thu_tu} trước để ảnh này bám đúng chỗ, đúng tư thế`);
    if (noiKhungShot(o.noiKhung, o.truoc) && o.truoc && (o.truoc.video_url || o.truoc.video_cuoi_url)) luu_y.push(`clip shot #${o.truoc.thu_tu} lấy keyframe này làm khung cuối — đổi keyframe thì clip đó phải sinh lại mới nối liền`);
  } else {
    if (c.trang_thai === 'dang_sinh') chan.push('đang sinh video');
    chan.push(...chanVideo(c, nhanVat, o.ds ? { hoSo: o.tap.ho_so, ds: o.ds, laQc: o.phim.laQc } : undefined));
    if (noiKhungShot(o.noiKhung, c) && o.ke && !o.ke.keyframe_url) luu_y.push(`shot #${o.ke.thu_tu} chưa có keyframe — clip này sẽ không có khung cuối, nối không liền`);
    if (c.video_url || c.video_cuoi_url) luu_y.push('đã có clip — bản mới thêm vào danh sách phiên bản');
  }
  return { chan, luu_y };
}

/** Sơ đồ nguồn của một shot (11/10/2026, ý thứ hai lấy từ MuseFlow): thứ ĐÃ gửi lúc sinh keyframe / clip đang dùng, so với thứ GIỜ sẽ gửi.
 *  doi = cờ "nguồn đã đổi sau khi sinh" → bản đang dùng không còn khớp kịch bản/tham chiếu hiện tại. */
/** doi = cờ đỏ (đổi cấu trúc: keyframe khác, khung cuối, ảnh tham chiếu); cauLenh = câu thêm/bớt so với giờ sẽ gửi (vàng, để đọc). */
export type BuocNguon = { job: number; model: string; /** nguồn thật (cổng, model thật, tiền thật) — cong-ai.ts */ nguon?: string; luc: string; chi_phi_cents: number; nhan: string; prompt: string; doi: string[]; cauLenh: { them: string[]; bot: string[] } | null };
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

/** Bảng đối tượng × shot (12/10/2026): mỗi ô = đối tượng v trong shot c.
 *  thieu  (đỏ)  — gắn mà thiếu ảnh gốc / biến thể chưa có ảnh → không sinh được keyframe.
 *  khac   (vàng) — sản phẩm dùng biến thể khác ĐA SỐ các shot (màu đổi giữa chừng, lỗi kiểu #1256).
 *  nhac   (vàng, ô trống) — mô tả shot nhắc tên đối tượng mà chưa gắn → model vẽ theo chữ, không có ảnh tham chiếu. */
export type OBang = { gan: boolean; anh: string | null; bt: string | null; thieu: string[]; khac: boolean; nhac: boolean };
export function bangDoiTuong(canh: Canh[], nhanVat: NhanVat[]): { nv: NhanVat; o: OBang[] }[] {
  return nhanVat.filter((v) => v.loai !== 'phong_cach').map((v) => {
    const tp = canh.map((c) => (c.nhan_vat.includes(v.id) ? thanhPhanCanh({ nhan_vat: [v.id], bien_the: c.bien_the }, [v]).ds[0] ?? null : null));
    const dem = new Map<string, number>();
    for (const t of tp) if (t) dem.set(String(t.bt?.id ?? 'goc'), (dem.get(String(t.bt?.id ?? 'goc')) ?? 0) + 1);
    const daSo = [...dem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const ten = v.ten.trim().toLowerCase();
    return { nv: v, o: canh.map((c, i) => {
      const t = tp[i];
      if (!t) return { gan: false, anh: null, bt: null, thieu: [], khac: false, nhac: ten.length >= 3 && `${c.prompt_anh} ${c.hanh_dong} ${c.canh}`.toLowerCase().includes(ten) };
      return { gan: true, anh: t.anh, bt: t.bt?.ten ?? null, thieu: t.thieu, khac: v.loai === 'san_pham' && dem.size > 1 && String(t.bt?.id ?? 'goc') !== daSo, nhac: false };
    }) };
  });
}
