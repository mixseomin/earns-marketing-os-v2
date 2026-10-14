// BỘ SET 3D — phần thuần (14/10/2026). Bối cảnh là DỮ LIỆU toạ độ (xv_bo_set), không phải chữ: mọi shot cùng set đứng trên CÙNG một bộ đồ đạc,
// máy ảo của từng shot (xv_canh.may_3d) render ra khung xám + bản đồ độ sâu (scripts/bo-set/dung-set.py, Blender trên box) làm khung xương
// cho keyframe. Ở đây: shot thuộc set nào, mã đầu vào (đổi là phải dựng lại), bảng đầu vào cho Blender, kiểm trục 180° bằng hình học,
// và cổng (chanKhungXam). Tự kiểm: bo-set-3d.test.mts
import type { BoSet, Canh, May3d, NhanVat } from './kieu';

/** Bộ set của shot = bộ set của anchor bối cảnh gắn ở shot (anchor đầu tiên có set). null = shot không dựng 3D (vd Trái Đất, Hà Nội trên cao). */
export function boSetCuaShot(c: Pick<Canh, 'nhan_vat'>, nhanVat: Pick<NhanVat, 'id' | 'loai' | 'bo_set_id'>[]): number | null {
  for (const id of c.nhan_vat) { const v = nhanVat.find((x) => x.id === id); if (v?.loai === 'boi_canh' && v.bo_set_id) return v.bo_set_id; }
  return null;
}

/** Khối đại diện của một tên nhân vật / đạo cụ trong may_3d.vi_tri (khớp tên anchor, không phân biệt hoa thường). */
export const khoiCua = (ten: string, nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]) => nhanVat.find((v) => v.ten.trim().toLowerCase() === ten.trim().toLowerCase())?.khoi_3d ?? null;

/** Mã đầu vào của khung xám: set (dữ liệu) + máy + vị trí + khối nhân vật — khác mã là khung xám cũ hết hiệu lực. */
export function maKhungXam(set: Pick<BoSet, 'id' | 'du_lieu'>, m: May3d, nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]): string {
  const s = JSON.stringify([set.id, set.du_lieu.vat, m, m.vi_tri.map((v) => khoiCua(v.ten, nhanVat))]);
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Bảng đầu vào cho dung-set.py: vật của set + khối nhân vật + các shot (ma = id shot). Thiếu khối của một tên → lỗi (không đoán cỡ). */
export function bangDung(set: Pick<BoSet, 'du_lieu'>, shots: { id: number; thu_tu: number; may_3d: May3d }[], nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]): { ok: true; bang: unknown } | { ok: false; loi: string } {
  const mau: Record<string, unknown> = {}; const thieu = new Set<string>();
  for (const s of shots) for (const v of s.may_3d.vi_tri) { const k = khoiCua(v.ten, nhanVat); if (k) mau[v.ten] = k; else thieu.add(v.ten); }
  if (thieu.size) return { ok: false, loi: `chưa khai khối 3D cho: ${[...thieu].join(', ')} — ghi khoi_3d (hình + cỡ cm) cho anchor đó` };
  return { ok: true, bang: { vat: set.du_lieu.vat, nhan_vat_mau: mau, shot: shots.map((s) => ({ ma: String(s.id), so: s.thu_tu, may: { dat: s.may_3d.dat, nhin: s.may_3d.nhin, ong_kinh: s.may_3d.ong_kinh }, nhan_vat: s.may_3d.vi_tri })) } };
}

/** Phía của máy so với TRỤC HÀNH ĐỘNG (đường nối hai nhân vật đầu tiên có mặt ở cả hai shot, nhìn từ trên): +1 / -1, 0 = không xác định. */
function phia(m: May3d, a: string, b: string): number {
  const pa = m.vi_tri.find((v) => v.ten === a)?.tam; const pb = m.vi_tri.find((v) => v.ten === b)?.tam;
  if (!pa || !pb) return 0;
  const cross = (pb[0]! - pa[0]!) * (m.dat[1]! - pa[1]!) - (pb[1]! - pa[1]!) * (m.dat[0]! - pa[0]!);
  return Math.abs(cross) < 1e-6 ? 0 : Math.sign(cross);
}

/** Vượt trục 180° giữa hai shot liền nhau CÙNG set: máy đổi phía trục nối hai nhân vật chung mà cú chuyển không khai là cố ý. */
export function vuotTruc(truoc: May3d, sau: May3d): string | null {
  const chung = sau.vi_tri.map((v) => v.ten).filter((t) => truoc.vi_tri.some((v) => v.ten === t));
  if (chung.length < 2) return null;
  const [a, b] = [chung[0]!, chung[1]!];
  const p1 = phia(truoc, a, b); const p2 = phia(sau, a, b);
  return p1 && p2 && p1 !== p2 ? `máy sang phía bên kia trục ${a}–${b} so với shot trước (hướng trên màn sẽ đảo)` : null;
}

/** Cổng khung xám của một shot (rỗng = qua). Shot không thuộc set nào → không chặn (ngoại lệ đã khai: không có anchor bối cảnh có set). */
export function chanKhungXam(c: Pick<Canh, 'nhan_vat' | 'may_3d' | 'khung_xam'>, nhanVat: Pick<NhanVat, 'id' | 'ten' | 'loai' | 'bo_set_id' | 'khoi_3d'>[], set: Pick<BoSet, 'id' | 'du_lieu'> | null, truoc?: Pick<Canh, 'nhan_vat' | 'may_3d'> | null): string[] {
  if (!set) return [];
  if (!c.may_3d) return ['shot thuộc bộ set 3D mà chưa đặt máy ảo + vị trí nhân vật (may_3d)'];
  const out: string[] = [];
  const kx = c.khung_xam;
  if (!kx || kx.ma !== maKhungXam(set, c.may_3d, nhanVat)) out.push('chưa dựng khung xám (hoặc set / máy / vị trí đã đổi sau lần dựng) — chạy 🧊 Dựng khung xám');
  else for (const k of kx.kiem) {
    if (!k.trong_khung) out.push(`${k.nhan_vat} nằm ngoài khung`);
    else if (k.bi_che_boi.length) out.push(`${k.nhan_vat} bị ${k.bi_che_boi.join(', ')} che`);
  }
  if (truoc?.may_3d && boSetCuaShot(truoc, nhanVat) === set.id) { const v = vuotTruc(truoc.may_3d, c.may_3d); if (v) out.push(v); }
  return out;
}
