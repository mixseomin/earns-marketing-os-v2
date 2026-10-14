// BỘ SET 3D — phần thuần (14/10/2026). Bối cảnh là DỮ LIỆU toạ độ (xv_bo_set), không phải chữ: mọi shot cùng set đứng trên CÙNG một bộ đồ đạc,
// máy ảo của từng shot (xv_canh.may_3d) render ra khung xám + bản đồ độ sâu (scripts/bo-set/dung-set.py, Blender trên box) làm khung xương
// cho keyframe. Ở đây: shot thuộc set nào, mã đầu vào (đổi là phải dựng lại), bảng đầu vào cho Blender, kiểm trục 180° bằng hình học,
// và cổng (chanKhungXam). Tự kiểm: bo-set-3d.test.mts
import type { BoSet, Canh, May3d, NhanVat, VatThay } from './kieu';

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
  return { ok: true, bang: { vat: set.du_lieu.vat, nhan_vat_mau: mau, shot: shots.map((s) => ({ ma: String(s.id), so: s.thu_tu, may: { dat: s.may_3d.dat, nhin: s.may_3d.nhin, ong_kinh: s.may_3d.ong_kinh }, nhan_vat: s.may_3d.vi_tri,
    bat_buoc: chuThe(s.may_3d), giai: !!s.may_3d.tu_dong })) } };
}

/** Phía của máy so với TRỤC HÀNH ĐỘNG (đường nối hai nhân vật đầu tiên có mặt ở cả hai shot, nhìn từ trên): +1 / -1, 0 = không xác định. */
function phia(m: May3d, a: string, b: string): number {
  const pa = m.vi_tri.find((v) => v.ten === a)?.tam; const pb = m.vi_tri.find((v) => v.ten === b)?.tam;
  if (!pa || !pb) return 0;
  const cross = (pb[0]! - pa[0]!) * (m.dat[1]! - pa[1]!) - (pb[1]! - pa[1]!) * (m.dat[0]! - pa[0]!);
  return Math.abs(cross) < 1e-6 ? 0 : Math.sign(cross);
}

/** Vượt trục 180° giữa hai shot liền nhau CÙNG set: máy đổi phía trục nối hai NHÂN VẬT chung mà cú chuyển không khai là cố ý.
 *  Trục chỉ dựng giữa nhân vật (người nhìn nhau / đi về nhau) — đồ vật không làm đầu trục (5.3: "trục Lint–bình xịt" là báo sai). */
export function vuotTruc(truoc: May3d, sau: May3d, laNhanVat: (ten: string) => boolean = () => true): string | null {
  const chung = sau.vi_tri.map((v) => v.ten).filter((t) => laNhanVat(t) && truoc.vi_tri.some((v) => v.ten === t));
  if (chung.length < 2) return null;
  const [a, b] = [chung[0]!, chung[1]!];
  const p1 = phia(truoc, a, b); const p2 = phia(sau, a, b);
  return p1 && p2 && p1 !== p2 ? `máy sang phía bên kia trục ${a}–${b} so với shot trước (hướng trên màn sẽ đảo)` : null;
}

/** Chủ thể của khung (phải thấy rõ): khai ở may_3d.khung, mặc định hai vị trí đầu không cố ý che. */
export const chuThe = (m: Pick<May3d, 'khung' | 'vi_tri'>): string[] => m.khung?.length ? m.khung : m.vi_tri.filter((v) => !v.an).slice(0, 2).map((v) => v.ten);

/** Nhân vật trong khung xám có lỗi hình học thật (ngoài khung / bị che mà kịch bản không cố ý) — lưới gắn ⚠, cổng chặn. */
export const loiHinhHoc = (c: Pick<Canh, 'may_3d' | 'khung_xam'>) => { const ct = c.may_3d ? chuThe(c.may_3d) : []; return (c.khung_xam?.kiem ?? []).filter((k) => (k.bat_buoc ?? ct.includes(k.nhan_vat)) && (!k.trong_khung || k.bi_che_boi.length > 0)); };

/** Shot để so trục với shot thứ i: shot liền trước GẦN NHẤT không cố ý vượt trục (POV / lật trục có chủ đích không đặt trục mới). */
export function shotSoTruc<T extends Pick<Canh, 'may_3d'>>(ds: T[], i: number): T | null {
  for (let j = i - 1; j >= 0; j--) if (!ds[j]!.may_3d?.qua_truc) return ds[j]!;
  return null;
}

/** Chữ tả THỨ CÓ TRONG KHUNG của shot: prompt ảnh + bố cục 3 lớp + trạng thái mở / kết (không lấy "thấy" — nó kể cả thứ ngoài khung). */
export const chuKhung = (c: Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>) => [c.prompt_anh, c.dan_dung?.bo_cuc, c.dan_dung?.mo, c.dan_dung?.ket].filter(Boolean).join(' \n ').toLowerCase();
const nhac = (ten: string, chu: string) => { const t = ten.trim().toLowerCase(); return t.length >= 3 && new RegExp(`(^|[^\\p{L}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(chu); };

/** KIỂM ĐỦ ĐẠO CỤ: nhân vật / đạo cụ / sản phẩm GẮN ở shot hoặc NHẮC TÊN trong chữ tả khung (bố cục, mở, kết, prompt ảnh) mà không có trong
 *  bộ set (vật có tên hoặc anchor trùng) và không có chỗ đứng trong may_3d → thiếu. Khung xám thiếu món đó thì keyframe tự vẽ nó ở chỗ tuỳ ý
 *  (anh 14/10/2026: công tắc đèn có ở #6 mà không có ở #5; "bản 3D phải có vị trí các thành phần, đạo cụ, nhân vật xong mới được sinh keyframe"). */
export function thieuTrongSet(c: Pick<Canh, 'nhan_vat' | 'may_3d'> & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>, nhanVat: Pick<NhanVat, 'id' | 'ten' | 'loai'>[], set: Pick<BoSet, 'du_lieu'>): string[] {
  const co = new Set([...set.du_lieu.vat.flatMap((v) => [v.ten, v.anchor ?? '']), ...(c.may_3d?.vi_tri ?? []).map((v) => v.ten)].map((t) => t.trim().toLowerCase()).filter(Boolean));
  const chu = chuKhung(c);
  return nhanVat.filter((v) => ['nhan_vat', 'dao_cu', 'san_pham'].includes(v.loai) && (c.nhan_vat.includes(v.id) || nhac(v.ten, chu)) && !co.has(v.ten.trim().toLowerCase())).map((v) => v.ten);
}

/** Tên gọi được của một vật set trong chữ: tên, tên bỏ số đuôi ("Cable Jungle 2" → "Cable Jungle"), anchor, từ cuối ≥ 4 chữ ("Yellow iMac" → "imac"). */
const tenGoi = (ten: string, set: Pick<BoSet, 'du_lieu'>) => {
  const v = set.du_lieu.vat.find((x) => x.ten === ten); const goc = ten.replace(/\s+\d+$/, '');
  const cuoi = goc.split(/\s+/).pop() ?? '';
  return [ten, goc, v?.anchor ?? '', cuoi.length >= 4 ? cuoi : ''].filter(Boolean);
};

/** VẬT CHẮN TIỀN CẢNH: vật của set nằm GIỮA máy và chủ thể, chiếm ≥ 12% khung, mà chữ tả khung không hề nhắc — máy đặt sau / xuyên đồ đạc,
 *  khung xám ra một mảng khối vô nghĩa (anh 14/10/2026: "cảnh 6 và 7 tay khổng lồ ở vị trí lung tung" — thật ra là lưng iMac vàng chắn máy).
 *  Mặt nền (nen: mặt bàn, tường, kệ) không tính. Dữ liệu từ khung_xam.thay (dung-set.py › nhin_thay). */
export function vatChanTienCanh(c: Pick<Canh, 'may_3d' | 'khung_xam'> & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>, set: Pick<BoSet, 'du_lieu'> | null): VatThay[] {
  const ct = c.may_3d ? chuThe(c.may_3d) : []; const chu = chuKhung(c);
  const nen = new Set((set?.du_lieu.vat ?? []).filter((v) => v.nen).map((v) => v.ten));
  return (c.khung_xam?.thay ?? []).filter((t) => t.tien && t.pt >= 12 && !nen.has(t.ten) && !ct.includes(t.ten) && !(set ? tenGoi(t.ten, set) : [t.ten]).some((g) => nhac(g, chu)));
}

/** Cổng khung xám của một shot (rỗng = qua). Shot không thuộc set nào → không chặn (ngoại lệ đã khai: không có anchor bối cảnh có set). */
export function chanKhungXam(c: Pick<Canh, 'nhan_vat' | 'may_3d' | 'khung_xam'> & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>, nhanVat: Pick<NhanVat, 'id' | 'ten' | 'loai' | 'bo_set_id' | 'khoi_3d'>[], set: Pick<BoSet, 'id' | 'du_lieu'> | null, truoc?: Pick<Canh, 'nhan_vat' | 'may_3d'> | null): string[] {
  if (!set) return [];
  if (!c.may_3d) return ['shot thuộc bộ set 3D mà chưa đặt máy ảo + vị trí nhân vật (may_3d)'];
  const out: string[] = [];
  const thieu = thieuTrongSet(c, nhanVat, set);
  if (thieu.length) out.push(`bộ set / chỗ đứng chưa có: ${thieu.join(', ')} — thêm vào bộ set (đồ cố định) hoặc vào chỗ đứng của shot`);
  const kx = c.khung_xam;
  if (!kx || kx.ma !== maKhungXam(set, c.may_3d, nhanVat)) out.push('chưa dựng khung xám (hoặc set / máy / vị trí đã đổi sau lần dựng) — chạy 🧊 Dựng khung xám');
  else if (!kx.thay) out.push('khung xám đời cũ chưa đo "thấy gì trong khung" — chạy 🧊 Dựng khung xám lại');
  else {
    for (const k of loiHinhHoc(c)) out.push(!k.trong_khung ? `${k.nhan_vat} (chủ thể) nằm ngoài khung` : `${k.nhan_vat} (chủ thể) bị ${k.bi_che_boi.join(', ')} che`);
    for (const v of vatChanTienCanh(c, set)) out.push(`${v.ten} chắn tiền cảnh ${v.pt}% khung mà bố cục không nhắc — máy đang đặt sau đồ đạc: dời máy (phía / dat) hoặc ghi nó vào bố cục nếu cố ý`);
  }
  if (!c.may_3d.qua_truc && truoc?.may_3d && boSetCuaShot(truoc, nhanVat) === set.id) { const v = vuotTruc(truoc.may_3d, c.may_3d, (t) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten.trim().toLowerCase() === t.trim().toLowerCase())); if (v) out.push(v); }
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
  return { dat: [r(cx + ngang * Math.sin(a)), r(cy - ngang * Math.cos(a)), r(z)], nhin: [r(cx), r(cy), r(cz)], ong_kinh: ong, vi_tri: o.vi_tri, ...(o.khung?.length ? { khung: o.khung } : {}), tu_dong: { phia: o.phia ?? 0 } };
}

/** Danh sách khối trong khung xám, gọi tên từng khối cho mô hình ảnh (vị trí trên màn + % khung) — để nó không đoán một khối vàng là bàn tay.
 *  Bỏ khối < 2% khung. Chỉ những thứ này có trong khung: không thêm tay / người / vật không có tên ở đây. */
export function moTaThay(thay: VatThay[] | undefined): string {
  const ngang = (x: number) => (x < 0.36 ? 'left' : x > 0.64 ? 'right' : 'centre'); const doc = (y: number) => (y < 0.36 ? 'top' : y > 0.64 ? 'bottom' : 'middle');
  const ds = (thay ?? []).filter((t) => t.pt >= 2).map((t) => `${t.ten} (${doc((t.hop[1] + t.hop[3]) / 2)}-${ngang((t.hop[0] + t.hop[2]) / 2)}, ${Math.round(t.pt)}%${t.tien ? ', foreground' : ''})`);
  return ds.length ? `Blocks in that layout image, by name: ${ds.join('; ')}. Nothing else is in this frame — do not add hands, people or objects that are not in this list.` : '';
}
