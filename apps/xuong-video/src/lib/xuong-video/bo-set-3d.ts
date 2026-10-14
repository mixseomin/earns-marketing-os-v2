// BỘ SET 3D — phần thuần (14/10/2026). Bối cảnh là DỮ LIỆU toạ độ (xv_bo_set), không phải chữ: mọi shot cùng set đứng trên CÙNG một bộ đồ đạc,
// máy ảo của từng shot (xv_canh.may_3d) render ra khung xám + bản đồ độ sâu (scripts/bo-set/dung-set.py, Blender trên box) làm khung xương
// cho keyframe. Ở đây: shot thuộc set nào, mã đầu vào (đổi là phải dựng lại), bảng đầu vào cho Blender, kiểm trục 180° bằng hình học,
// và cổng (chanKhungXam). Tự kiểm: bo-set-3d.test.mts
import type { BoSet, Canh, May3d, NhanVat } from './kieu';

/** Bộ set của shot = bộ set CHUNG của mọi anchor bối cảnh gắn ở shot. null = shot không dựng 3D: không có bối cảnh thuộc set (Trái Đất,
 *  Hà Nội trên cao) hoặc shot đi XUYÊN hai thế giới (bay qua ô cửa sổ vào bàn: một bối cảnh có set, một không) — khung đầu nằm ngoài set. */
export function boSetCuaShot(c: Pick<Canh, 'nhan_vat'>, nhanVat: Pick<NhanVat, 'id' | 'loai' | 'bo_set_id'>[]): number | null {
  const bc = c.nhan_vat.map((id) => nhanVat.find((x) => x.id === id)).filter((v) => v?.loai === 'boi_canh');
  const sets = new Set(bc.map((v) => v!.bo_set_id ?? null));
  return sets.size === 1 ? [...sets][0]! : null;
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

/** Nhân vật trong khung xám có lỗi hình học thật (ngoài khung / bị che mà kịch bản không cố ý) — lưới gắn ⚠, cổng chặn. */
export const loiHinhHoc = (c: Pick<Canh, 'may_3d' | 'khung_xam'>) => (c.khung_xam?.kiem ?? []).filter((k) => !k.trong_khung || (k.bi_che_boi.length > 0 && !c.may_3d?.vi_tri.find((v) => v.ten === k.nhan_vat)?.an));

/** Cổng khung xám của một shot (rỗng = qua). Shot không thuộc set nào → không chặn (ngoại lệ đã khai: không có anchor bối cảnh có set). */
export function chanKhungXam(c: Pick<Canh, 'nhan_vat' | 'may_3d' | 'khung_xam'>, nhanVat: Pick<NhanVat, 'id' | 'ten' | 'loai' | 'bo_set_id' | 'khoi_3d'>[], set: Pick<BoSet, 'id' | 'du_lieu'> | null, truoc?: Pick<Canh, 'nhan_vat' | 'may_3d'> | null): string[] {
  if (!set) return [];
  if (!c.may_3d) return ['shot thuộc bộ set 3D mà chưa đặt máy ảo + vị trí nhân vật (may_3d)'];
  const out: string[] = [];
  const kx = c.khung_xam;
  if (!kx || kx.ma !== maKhungXam(set, c.may_3d, nhanVat)) out.push('chưa dựng khung xám (hoặc set / máy / vị trí đã đổi sau lần dựng) — chạy 🧊 Dựng khung xám');
  else for (const k of kx.kiem) {
    if (!k.trong_khung) out.push(`${k.nhan_vat} nằm ngoài khung`);
    else if (k.bi_che_boi.length && !c.may_3d.vi_tri.find((v) => v.ten === k.nhan_vat)?.an) out.push(`${k.nhan_vat} bị ${k.bi_che_boi.join(', ')} che`);
  }
  if (truoc?.may_3d && boSetCuaShot(truoc, nhanVat) === set.id) { const v = vuotTruc(truoc.may_3d, c.may_3d); if (v) out.push(v); }
  return out;
}

// ── ĐẶT MÁY TỰ ĐỘNG (anh 14/10/2026: "nhiều shot không có 3D thì làm sao đồng bộ được?") ───────────────────────────────────────
// Từ chỗ đứng nhân vật (cm) + CỠ CẢNH / GÓC / ỐNG KÍNH đã có trong thẻ shot → máy ảo: khoảng cách để chủ thể chiếm đúng phần khung của
// cỡ cảnh (khung dọc 9:16, cảm biến 36 mm theo chiều dọc như dung-set.py), độ cao theo góc, phía máy = góc phương vị quanh chủ thể
// (0° = từ phía người ngồi nhìn vào, +90° = từ bên phải). Mọi shot mới chỉ cần chỗ đứng + phía; máy tự ra, kiểm hình học tự chạy.
const ONG_MM: Record<string, number> = { probe: 16, rong: 24, chuan: 40, chan_dung: 85, tele: 135, macro: 60, anamorphic: 40 };
const ONG_THEO_CO: Record<string, number> = { ews: 18, ws: 24, ms: 35, mcu: 50, cu: 60, ecu: 60, insert: 60, two: 35, ots: 40, pov: 24 };
/** Phần chiều cao khung chủ thể chiếm theo cỡ cảnh (ecu > 1 = cắt sát hơn cả thân). */
const PHAN_KHUNG: Record<string, number> = { ews: 0.06, ws: 0.18, ms: 0.45, mcu: 0.65, cu: 0.9, ecu: 1.6, insert: 1, two: 0.4, ots: 0.5, pov: 0.3 };

export type DatMay = { vi_tri: May3d['vi_tri']; phia?: number; khung?: string[] };
export function datMayTuDong(o: DatMay, kt: { co_canh?: string; goc?: string; ong_kinh?: string }, khoi: (ten: string) => { co: number[] } | null): May3d {
  const ong = ONG_MM[kt.ong_kinh ?? ''] ?? ONG_THEO_CO[kt.co_canh ?? ''] ?? 35;
  const ten = o.khung?.length ? o.khung : o.vi_tri.filter((v) => !v.an).slice(0, 2).map((v) => v.ten);
  const chu = o.vi_tri.filter((v) => ten.includes(v.ten));
  const ds = (chu.length ? chu : o.vi_tri).map((v) => { const c = khoi(v.ten)?.co ?? [2, 2, 2]; const h = v.nam ? c[1]! : c[2]!; return { x: v.tam[0]!, y: v.tam[1]!, z: v.tam[2] ?? 0, h, w: c[0]! }; });
  const cx = ds.reduce((a, d) => a + d.x, 0) / ds.length, cy = ds.reduce((a, d) => a + d.y, 0) / ds.length;
  const H = Math.max(...ds.map((d) => d.z + d.h)) - Math.min(...ds.map((d) => d.z));
  const W = Math.max(...ds.map((d) => d.x + d.w / 2)) - Math.min(...ds.map((d) => d.x - d.w / 2));
  const cz = Math.min(...ds.map((d) => d.z)) + H * 0.5;
  const tanV = 18 / ong, tanH = (18 * 9 / 16) / ong;   // nửa khung dọc / ngang trên tiêu cự
  const f = PHAN_KHUNG[kt.co_canh ?? ''] ?? 0.4;
  const d = Math.max(0.6, Math.max(H / (f * 2 * tanV), kt.co_canh === 'ecu' ? 0 : W / (0.85 * 2 * tanH)));
  const a = ((o.phia ?? 0) * Math.PI) / 180;
  const ngoc = { sat_dat: -1, thap: -12, ngang: 0, cao: 35, tren_xuong: 85, nghieng: 0, selfie: 0 }[kt.goc ?? 'ngang'] ?? 0;
  const e = (ngoc * Math.PI) / 180;
  const ngang = d * Math.cos(Math.abs(e));
  const z = kt.goc === 'sat_dat' ? 0.5 : Math.max(0.4, cz + d * Math.sin(e) + (kt.goc === 'thap' ? -H * 0.3 : 0));
  const r = (x: number) => Math.round(x * 10) / 10;
  return { dat: [r(cx + ngang * Math.sin(a)), r(cy - ngang * Math.cos(a)), r(z)], nhin: [r(cx), r(cy), r(cz)], ong_kinh: ong, vi_tri: o.vi_tri };
}
