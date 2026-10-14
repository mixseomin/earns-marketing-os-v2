// BỘ SET 3D — phần thuần (14/10/2026). Bối cảnh là DỮ LIỆU toạ độ (xv_bo_set), không phải chữ: mọi shot cùng set đứng trên CÙNG một bộ đồ đạc,
// máy ảo của từng shot (xv_canh.may_3d) render ra khung xám + bản đồ độ sâu (scripts/bo-set/dung-set.py, Blender trên box) làm khung xương
// cho keyframe. Ở đây: shot thuộc set nào, mã đầu vào (đổi là phải dựng lại), bảng đầu vào cho Blender, kiểm trục 180° bằng hình học,
// và cổng (chanKhungXam). Tự kiểm: bo-set-3d.test.mts
import type { BoSet, Canh, KhungXam, May3d, NhanVat, VatThay } from './kieu';

/** Bộ set của shot = bộ set CHUNG của mọi anchor bối cảnh gắn ở shot. null = shot không dựng 3D: không có bối cảnh thuộc set (Trái Đất,
 *  Hà Nội trên cao) hoặc shot đi XUYÊN hai thế giới (bay qua ô cửa sổ vào bàn: một bối cảnh có set, một không) — khung đầu nằm ngoài set. */
export function boSetCuaShot(c: Pick<Canh, 'nhan_vat'>, nhanVat: Pick<NhanVat, 'id' | 'loai' | 'bo_set_id'>[]): number | null {
  const bc = c.nhan_vat.map((id) => nhanVat.find((x) => x.id === id)).filter((v) => v?.loai === 'boi_canh');
  const sets = new Set(bc.map((v) => v!.bo_set_id ?? null));
  return sets.size === 1 ? [...sets][0]! : null;
}

/** Khối đại diện của một tên nhân vật / đạo cụ trong may_3d.vi_tri (khớp tên anchor, không phân biệt hoa thường). */
export const khoiCua = (ten: string, nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]) => nhanVat.find((v) => v.ten.trim().toLowerCase() === ten.trim().toLowerCase())?.khoi_3d ?? null;

/** PHIÊN BẢN CÁCH DỰNG (scripts/bo-set/dung-set.py): nằm trong mã khung xám → đổi script dựng thì mọi khung tự thành cũ và lượt dựng thường
 *  tự làm lại, không phải ép dựng cả tập (--tat-ca). bo-set-3d.test.mts băm dung-set.py: sửa script mà quên tăng số này là test đỏ. */
export const BAN_DUNG = 10;
/** Mã đầu vào của khung xám: cách dựng + set (dữ liệu) + máy + vị trí + khối nhân vật — khác mã là khung xám cũ hết hiệu lực. */
export function maKhungXam(set: Pick<BoSet, 'id' | 'du_lieu'>, m: May3d, nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]): string {
  const s = JSON.stringify([BAN_DUNG, set.id, set.du_lieu.vat, m, m.vi_tri.map((v) => khoiCua(v.ten, nhanVat))]);
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Bảng đầu vào cho dung-set.py: vật của set + khối nhân vật + các shot (ma = id shot). Thiếu khối của một tên → lỗi (không đoán cỡ). */
export function bangDung(set: Pick<BoSet, 'du_lieu'>, shots: ({ id: number; thu_tu: number; may_3d: May3d; truc?: ReturnType<typeof rangBuocTruc> } & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>)[], nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]): { ok: true; bang: unknown } | { ok: false; loi: string } {
  const mau: Record<string, unknown> = {}; const thieu = new Set<string>();
  for (const s of shots) for (const v of s.may_3d.vi_tri) { const k = khoiCua(v.ten, nhanVat); if (k) mau[v.ten] = k; else thieu.add(v.ten); }
  if (thieu.size) return { ok: false, loi: `chưa khai khối 3D cho: ${[...thieu].join(', ')} — ghi khoi_3d (hình + cỡ cm) cho anchor đó` };
  return { ok: true, bang: { vat: set.du_lieu.vat, nhan_vat_mau: mau, shot: shots.map((s) => ({ ma: String(s.id), so: s.thu_tu, may: { dat: s.may_3d.dat, nhin: s.may_3d.nhin, ong_kinh: s.may_3d.ong_kinh }, nhan_vat: s.may_3d.vi_tri,
    bat_buoc: chuThe(s.may_3d), giai: !!s.may_3d.tu_dong, nhac: vatDuocNhac(s, set), truc: s.truc ?? null, them: s.may_3d.them ?? [], den_ban: !!s.may_3d.den_ban })) } };
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

/** RÀNG BUỘC TRỤC cho bộ giải máy: trục nối hai nhân vật chung với shot so trục, phía máy tính TRONG Blender từ máy của shot đó ĐÃ GIẢI ở
 *  cùng lượt (truoc = id shot đó; dat_truoc dự phòng khi shot đó không nằm trong lượt). Trước đây phía lấy từ máy cũ trong DB → máy shot trước
 *  vừa được giải lại thì shot sau bám theo phía cũ đã sai (5.4 → 5.5 tập 19). Bộ giải loại mọi phương án máy nằm phía bên kia. */
export function rangBuocTruc(truoc: { id: number; may_3d: May3d }, sau: May3d, laNhanVat: (ten: string) => boolean): { a: number[]; b: number[]; ta: number[]; tb: number[]; truoc: string; dat_truoc: number[] } | null {
  const chung = sau.vi_tri.map((v) => v.ten).filter((t) => laNhanVat(t) && truoc.may_3d.vi_tri.some((v) => v.ten === t));
  if (chung.length < 2) return null;
  const o = (m: May3d, t: string) => m.vi_tri.find((v) => v.ten === t)!.tam.slice(0, 2);
  return { a: o(sau, chung[0]!), b: o(sau, chung[1]!), ta: o(truoc.may_3d, chung[0]!), tb: o(truoc.may_3d, chung[1]!), truoc: String(truoc.id), dat_truoc: truoc.may_3d.dat };
}

/** Chủ thể của khung (phải thấy rõ): khai ở may_3d.khung, mặc định hai vị trí đầu không cố ý che. */
export const chuThe = (m: Pick<May3d, 'khung' | 'vi_tri'>): string[] => m.khung?.length ? m.khung : m.vi_tri.filter((v) => !v.an).slice(0, 2).map((v) => v.ten);

/** Nhân vật trong khung xám có lỗi hình học thật (ngoài khung / bị che mà kịch bản không cố ý) — lưới gắn ⚠, cổng chặn. */
export const loiHinhHoc = (c: Pick<Canh, 'may_3d' | 'khung_xam'>) => { const ct = c.may_3d ? chuThe(c.may_3d) : []; return (c.khung_xam?.kiem ?? []).filter((k) => (k.bat_buoc ?? ct.includes(k.nhan_vat)) && (!k.trong_khung || k.bi_che_boi.length > 0)); };

/** CHỦ THỂ QUÁ TO: ở cỡ cảnh không phải cận (two / ms / ws…), một chủ thể chiếm > 70% chiều cao khung = máy dí sát (7.3 tập 19: gáy Tango lấp khung,
 *  đế cắm chỉ ló một mảng) — keyframe sẽ không có bố trí để bám. Cận / đặc tả được phép to. */
export const chuTheQuaTo = (c: Pick<Canh, 'khung_xam'> & Partial<Pick<Canh, 'ky_thuat'>>): string[] => ['cu', 'ecu', 'insert', 'mcu'].includes(c.ky_thuat?.co_canh ?? '') ? [] : (c.khung_xam?.kiem ?? []).filter((k) => k.bat_buoc && k.cao_khung_pt > 70).map((k) => `${k.nhan_vat} cao ${k.cao_khung_pt}% khung ở cỡ ${c.ky_thuat?.co_canh ?? '?'} — máy dí sát: lùi máy / đặt tay`);

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
  const them = new Set(c.may_3d?.them ?? []);
  const co = new Set([...set.du_lieu.vat.filter((v) => !v.tuy_chon || them.has(v.ten)).flatMap((v) => [v.ten, v.anchor ?? '']), ...(c.may_3d?.vi_tri ?? []).map((v) => v.ten)].map((t) => t.trim().toLowerCase()).filter(Boolean));
  const chu = chuKhung(c);
  // Đồ tuỳ chọn của set (laptop) mà chữ tả khung có nhắc nhưng shot chưa khai them → keyframe sẽ tự vẽ nó ở chỗ tuỳ ý.
  const tuyChon = set.du_lieu.vat.filter((v) => v.tuy_chon && !them.has(v.ten) && tenGoi(v.ten, set).some((g) => nhac(g, chu))).map((v) => `${v.ten} (đồ tuỳ chọn — khai may_3d.them)`);
  return [...nhanVat.filter((v) => ['nhan_vat', 'dao_cu', 'san_pham'].includes(v.loai) && (c.nhan_vat.includes(v.id) || nhac(v.ten, chu)) && !co.has(v.ten.trim().toLowerCase())).map((v) => v.ten), ...tuyChon];
}

/** Tên gọi được của một vật set trong chữ: tên, tên bỏ số đuôi ("Cable Jungle 2" → "Cable Jungle"), anchor, từ cuối ≥ 4 chữ ("Yellow iMac" → "imac"). */
const tenGoi = (ten: string, set: Pick<BoSet, 'du_lieu'>) => {
  const v = set.du_lieu.vat.find((x) => x.ten === ten); const goc = ten.replace(/\s+\d+$/, '');
  const cuoi = goc.split(/\s+/).pop() ?? '';
  return [ten, goc, v?.anchor ?? '', cuoi.length >= 4 ? cuoi : ''].filter(Boolean);
};

/** KHỐI LẤP KHUNG: một khối (không phải mặt nền) chiếm ≥ 85% khung — máy dí sát / nằm trong vật, khung xám thành một mảng màu vô nghĩa. */
export const khoiLapKhung = (c: Pick<Canh, 'khung_xam'>, set: Pick<BoSet, 'du_lieu'> | null) => { const nen = new Set((set?.du_lieu.vat ?? []).filter((v) => v.nen).map((v) => v.ten)); return (c.khung_xam?.thay ?? []).filter((t) => t.pt >= 85 && !nen.has(t.ten)); };

/** VẬT ĐƯỢC NHẮC MÀ KHÔNG THẤY: chữ tả khung (bố cục / mở / kết / prompt ảnh) nhắc một vật của set mà khung 3D không thấy nó (< 1% khung) — thử
 *  7.3 tập 19: bố cục "ấn tay lên đế cắm sát phích" mà máy đứng sau lưng Tango, đế cắm không có trong khung → keyframe vẽ một cảnh khác. */
export const nhacMaKhongThay = (c: Pick<Canh, 'khung_xam' | 'may_3d'> & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>, set: Pick<BoSet, 'du_lieu'>): string[] => {
  const thay = new Set((c.khung_xam?.thay ?? []).filter((t) => t.pt >= 1).map((t) => t.ten)); const them = new Set(c.may_3d?.them ?? []);
  return vatDuocNhac(c, set).filter((t) => !thay.has(t) && !set.du_lieu.vat.find((v) => v.ten === t && (v.nen || (v.tuy_chon && !them.has(t)))));
};

/** Vật của set mà chữ tả khung có nhắc (cố ý có trong khung) — bộ giải máy trong Blender không né những vật này. */
export const vatDuocNhac = (c: Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>, set: Pick<BoSet, 'du_lieu'>): string[] => { const chu = chuKhung(c); return set.du_lieu.vat.map((v) => v.ten).filter((t) => tenGoi(t, set).some((g) => nhac(g, chu))); };

/** VẬT CHẮN TIỀN CẢNH: vật của set nằm GIỮA máy và chủ thể, chiếm ≥ 12% khung, mà chữ tả khung không hề nhắc — máy đặt sau / xuyên đồ đạc,
 *  khung xám ra một mảng khối vô nghĩa (anh 14/10/2026: "cảnh 6 và 7 tay khổng lồ ở vị trí lung tung" — thật ra là lưng iMac vàng chắn máy).
 *  Mặt nền (nen: mặt bàn, tường, kệ) không tính. Dữ liệu từ khung_xam.thay (dung-set.py › nhin_thay). */
export function vatChanTienCanh(c: Pick<Canh, 'may_3d' | 'khung_xam'> & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>, set: Pick<BoSet, 'du_lieu'> | null): VatThay[] {
  const ct = c.may_3d ? chuThe(c.may_3d) : []; const chu = chuKhung(c);
  const nen = new Set((set?.du_lieu.vat ?? []).filter((v) => v.nen).map((v) => v.ten));
  return (c.khung_xam?.thay ?? []).filter((t) => t.tien && t.pt >= 12 && !nen.has(t.ten) && !ct.includes(t.ten) && !(set ? tenGoi(t.ten, set) : [t.ten]).some((g) => nhac(g, chu)));
}

/** Cổng khung xám của một shot (rỗng = qua). Shot không thuộc set nào → không chặn (ngoại lệ đã khai: không có anchor bối cảnh có set). */
export function chanKhungXam(c: Pick<Canh, 'nhan_vat' | 'may_3d' | 'khung_xam'> & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung' | 'ky_thuat' | 'phan_doan'>>, nhanVat: Pick<NhanVat, 'id' | 'ten' | 'loai' | 'bo_set_id' | 'khoi_3d'>[], set: Pick<BoSet, 'id' | 'du_lieu'> | null, truoc?: Pick<Canh, 'nhan_vat' | 'may_3d'> & Partial<Pick<Canh, 'phan_doan'>> | null): string[] {
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
    out.push(...chuTheQuaTo(c));
    for (const t of nhacMaKhongThay(c, set)) out.push(`bố cục nhắc ${t} mà khung 3D không thấy — xoay / dời máy cho nó vào khung, hoặc bỏ khỏi chữ tả nếu không cần`);
    for (const t of khoiLapKhung(c, set)) out.push(`${t.ten} lấp ${t.pt}% khung — máy dí sát hoặc lọt trong vật: lùi máy / đổi cỡ cảnh`);
    for (const v of vatChanTienCanh(c, set)) out.push(`${v.ten} chắn tiền cảnh ${v.pt}% khung mà bố cục không nhắc — máy đang đặt sau đồ đạc: dời máy (phía / dat) hoặc ghi nó vào bố cục nếu cố ý`);
  }
  // NỐI HƯỚNG MÁY: hai shot liền nhau CÙNG cảnh mà hướng nhìn của máy lệch > 100° → hậu cảnh + cỡ đổi hẳn, cắt như sang nơi khác (5.4 → 5.5
  // tập 19: một máy nhìn về iMac từ góc sau, một máy nhìn rừng cáp từ bên trái). Cố ý (POV, lật trục) thì khai qua_truc.
  if (!c.may_3d.qua_truc && truoc?.may_3d && c.phan_doan && truoc.phan_doan === c.phan_doan && boSetCuaShot(truoc, nhanVat) === set.id) {
    const h = (m: May3d) => Math.atan2(m.nhin[1]! - m.dat[1]!, m.nhin[0]! - m.dat[0]!);
    const lech = Math.abs(((((h(c.may_3d) - h(truoc.may_3d)) * 180) / Math.PI + 540) % 360) - 180);
    if (lech > 100) out.push(`máy đổi hướng nhìn ${Math.round(lech)}° so với shot trước cùng cảnh — hậu cảnh đổi hẳn, cắt như sang nơi khác: đặt máy gần hướng shot trước, hoặc khai qua_truc nếu cố ý`);
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
// ecu 0.6 / cu 0.75 / insert 0.7: trước đây ecu 1.6 (chủ thể to hơn khung) → với vật nhỏ (kẹo 2 cm) máy cách 1 cm, khung xám là một mảng đỏ (4.6 tập 19).
const PHAN_KHUNG: Record<string, number> = { ews: 0.06, ws: 0.18, ms: 0.45, mcu: 0.6, cu: 0.75, ecu: 0.6, insert: 0.7, two: 0.4, ots: 0.5, pov: 0.3 };

/** PHIÊN BẢN ĐẶT MÁY TỰ ĐỘNG: nằm trong khoá giữ máy đã giải (scripts/bo-set.mts) — đổi công thức dưới đây thì tăng số này, mọi máy tự động tính lại. */
export const BAN_MAY = 2;
export type DatMay = { vi_tri: May3d['vi_tri']; phia?: number; khung?: string[]; nhay?: string };
export function datMayTuDong(o: DatMay, kt: { co_canh?: string; goc?: string; ong_kinh?: string }, khoi: (ten: string) => { co: number[] } | null): May3d {
  const ong = ONG_MM[kt.ong_kinh ?? ''] ?? ONG_THEO_CO[kt.co_canh ?? ''] ?? 35;
  const ten = o.khung?.length ? o.khung : o.vi_tri.filter((v) => !v.an).slice(0, 2).map((v) => v.ten);
  const chu = o.vi_tri.filter((v) => ten.includes(v.ten));
  // Khung ôm cả chỗ mở lẫn chỗ kết của chủ thể (shot có di chuyển: chủ thể không chạy ra khỏi khung giữa chừng).
  const ds = (chu.length ? chu : o.vi_tri).flatMap((v) => { const c = khoi(v.ten)?.co ?? [2, 2, 2]; const h = v.nam ? c[1]! : c[2]!; return [v.tam, ...(v.den ? [v.den] : [])].map((p) => ({ x: p[0]!, y: p[1]!, z: p[2] ?? 0, h, w: c[0]! })); });
  const cx = ds.reduce((a, d) => a + d.x, 0) / ds.length, cy = ds.reduce((a, d) => a + d.y, 0) / ds.length;
  const H = Math.max(...ds.map((d) => d.z + d.h)) - Math.min(...ds.map((d) => d.z));
  const W = Math.max(...ds.map((d) => d.x + d.w / 2)) - Math.min(...ds.map((d) => d.x - d.w / 2));
  const cz = Math.min(...ds.map((d) => d.z)) + H * 0.5;
  const tanV = 18 / ong, tanH = (18 * 9 / 16) / ong;   // nửa khung dọc / ngang trên tiêu cự
  const f = PHAN_KHUNG[kt.co_canh ?? ''] ?? 0.4;
  // Máy luôn đứng NGOÀI khối chủ thể: tối thiểu một cỡ chủ thể + 1 cm tính từ tâm.
  const d = Math.max(Math.max(H, W) + 1, H / (f * 2 * tanV), W / (0.85 * 2 * tanH));
  const a = ((o.phia ?? 0) * Math.PI) / 180;
  const ngoc = { sat_dat: -1, thap: -12, ngang: 0, cao: 35, tren_xuong: 85, nghieng: 0, selfie: 0 }[kt.goc ?? 'ngang'] ?? 0;
  const e = (ngoc * Math.PI) / 180;
  const ngang = d * Math.cos(Math.abs(e));
  const z = kt.goc === 'sat_dat' ? 0.5 : Math.max(0.4, cz + d * Math.sin(e) + (kt.goc === 'thap' ? -H * 0.3 : 0));
  const r = (x: number) => Math.round(x * 10) / 10;
  return { dat: [r(cx + ngang * Math.sin(a)), r(cy - ngang * Math.cos(a)), r(z)], nhin: [r(cx), r(cy), r(cz)], ong_kinh: ong, vi_tri: o.vi_tri, ...(o.khung?.length ? { khung: o.khung } : {}), ...(o.nhay ? { nhay: o.nhay } : {}), tu_dong: { phia: o.phia ?? 0 } };
}

/** CÂU CHUYỂN ĐỘNG cho video, viết từ số đo 3D (khung_xam.di): ai đi từ đâu tới đâu trên màn — cùng nguồn với khung màu nên không mâu thuẫn hình.
 *  Món dịch < 4% khung coi như đứng yên. tenEn: tên tiếng Anh (khối nhân vật giữ tên riêng). */
export function moTaChuyenDong(di: KhungXam['di'] | undefined): string {
  const o = (u: number[]) => `${u[1]! < 0.36 ? 'upper' : u[1]! > 0.64 ? 'lower' : 'middle'} ${u[0]! < 0.36 ? 'left' : u[0]! > 0.64 ? 'right' : 'centre'}`;
  const ds = (di ?? []).filter((d) => Math.hypot(d.den[0]! - d.tu[0]!, d.den[1]! - d.tu[1]!) >= 0.04).map((d) => {
    const dx = d.den[0]! - d.tu[0]!, dy = d.den[1]! - d.tu[1]!;
    const huong = [Math.abs(dx) > 0.03 ? (dx > 0 ? 'screen-right' : 'screen-left') : '', Math.abs(dy) > 0.03 ? (dy < 0 ? 'upward' : 'downward') : ''].filter(Boolean).join(' and ');
    return `${d.ten} moves ${huong} from the ${o(d.tu)} of the frame to the ${o(d.den)}`;
  });
  const yen = (di ?? []).filter((d) => Math.hypot(d.den[0]! - d.tu[0]!, d.den[1]! - d.tu[1]!) < 0.04).map((d) => d.ten);
  return ds.length ? `Blocking (from the 3D layout — follow it exactly): ${ds.join('; ')}.${yen.length ? ` ${yen.join(', ')} stay${yen.length === 1 ? 's' : ''} in place.` : ''} The last frame shows where everyone ends up.` : '';
}

/** Danh sách khối trong khung xám, gọi tên từng khối cho mô hình ảnh (vị trí trên màn + % khung) — để nó không đoán một khối vàng là bàn tay.
 *  Bỏ khối < 2% khung. Chỉ những thứ này có trong khung: không thêm tay / người / vật không có tên ở đây. */
export function moTaThay(thay: VatThay[] | undefined): string {
  const ngang = (x: number) => (x < 0.36 ? 'left' : x > 0.64 ? 'right' : 'centre'); const doc = (y: number) => (y < 0.36 ? 'top' : y > 0.64 ? 'bottom' : 'middle');
  const ds = (thay ?? []).filter((t) => t.pt >= 2).map((t) => `${t.en ?? t.ten} (${doc((t.hop[1] + t.hop[3]) / 2)}-${ngang((t.hop[0] + t.hop[2]) / 2)}, ${Math.round(t.pt)}%${t.tien ? ', foreground' : ''})`);
  return ds.length ? `Blocks in that layout image, by name: ${ds.join('; ')}. Nothing else is in this frame — do not add hands, people or objects that are not in this list; the BACKGROUND is exactly what those blocks show (a far room wall stays a plain dim wall — never add monitors, computers or extra cables there).` : '';
}

// ── LIỀN MẠCH (anh 14/10/2026: "bản 3D phải thể hiện được sự liền mạch về chuyển động, vị trí của mọi nhân vật ở các cảnh") ──────────
// Mỗi nhân vật / đạo cụ có chỗ MỞ (tam) và chỗ KẾT (den) trong từng shot. Shot sau mở phải đúng chỗ LẦN CUỐI thấy nó kết — kể cả khi nó vắng
// vài shot ở giữa (Lint vắng ở 7.2 thì 7.2a vẫn phải đứng chỗ 7.1 kết). Lệch quá ngưỡng = đứt mạch, trừ shot khai `nhay` (thời gian trôi /
// dịch chuyển ngoài khung, ghi lý do) hoặc món khai `nhay` riêng; món đang được CẦM (`cam`) đi theo người cầm. Hướng mặt cũng thế: đổi hơn 60° qua cú cắt mà không khai = nhân vật quay ngoắt giữa hai khung.
const NGUONG_CM = (co?: number[]) => Math.max(0.8, 0.45 * Math.max(...(co ?? [2])));
const gocLech = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/** Lỗi liền mạch theo từng shot (id → câu). ds = các shot CÙNG bộ set theo thứ tự phát; shot không có may_3d bỏ qua. */
export function lienMachTap<T extends { id: number; thu_tu: number; may_3d?: May3d | null }>(ds: T[], khoi: (ten: string) => { co: number[] } | null): Record<number, string[]> {
  const cuoi = new Map<string, { p: number[]; huong?: number; shot: number }>(); const out: Record<number, string[]> = {};
  // ĐỒ ĐANG CẦM (nối thử #22→#24 tập 19: bình xịt trong tay Mr. Wipe ở 5.4 và 5.6 mà 5.5 không có): người cầm còn trong shot thì món đồ phải còn —
  // tới khi nó xuất hiện KHÔNG còn cầm (đặt xuống), hoặc người cầm khai nhảy / shot khai nhảy.
  const camBoi = new Map<string, { nguoi: string; shot: number }>();
  for (const c of ds) {
    const m = c.may_3d; if (!m) continue;
    const co = new Set(m.vi_tri.map((v) => v.ten));
    if (m.nhay) camBoi.clear();
    for (const [mon, x] of camBoi) {
      const ng = m.vi_tri.find((v) => v.ten === x.nguoi);
      if (ng?.nhay) { camBoi.delete(mon); continue; }
      if (ng && !co.has(mon)) (out[c.id] ??= []).push(`${x.nguoi} đang cầm ${mon} (từ #${x.shot}) mà shot này vắng nó — thêm ${mon} vào chỗ đứng (cam: '${x.nguoi}', an nếu ngoài khung) hoặc cho đặt xuống ở shot trước`);
    }
    // cam + den = cầm rồi ĐẶT XUỐNG trong shot (hai nửa kẹo đặt lên thẻ ở 7.1) → hết theo dõi.
    for (const v of m.vi_tri) { if (v.cam && !v.den) camBoi.set(v.ten, { nguoi: v.cam, shot: c.thu_tu }); else camBoi.delete(v.ten); }
    for (const v of m.vi_tri) {
      const tr = cuoi.get(v.ten);
      if (v.cam) { cuoi.delete(v.ten); continue; }   // đang cầm: theo người cầm, lần sau thấy không so chỗ cũ
      if (tr && !m.nhay && !v.nhay) {
        const d = Math.hypot(v.tam[0]! - tr.p[0]!, v.tam[1]! - tr.p[1]!, (v.tam[2] ?? 0) - (tr.p[2] ?? 0));
        const r = (p: number[]) => `(${p.map((x) => Math.round(x * 10) / 10).join(', ')})`;
        if (d > NGUONG_CM(khoi(v.ten)?.co)) (out[c.id] ??= []).push(`${v.ten} đứt mạch: kết #${tr.shot} ở ${r(tr.p)} mà mở shot này ở ${r(v.tam)} — lệch ${Math.round(d * 10) / 10} cm; sửa chỗ đứng / chỗ kết, hoặc khai nhay (lý do) nếu cố ý cắt thời gian`);
        if (tr.huong != null && v.huong != null && gocLech(tr.huong, v.huong) > 60) (out[c.id] ??= []).push(`${v.ten} quay ngoắt ${Math.round(gocLech(tr.huong, v.huong))}° qua cú cắt (kết #${tr.shot} nhìn ${tr.huong}°, mở shot này ${v.huong}°)`);
      }
      cuoi.set(v.ten, { p: v.den ?? v.tam, huong: v.huong_den ?? v.huong, shot: c.thu_tu });
    }
  }
  return out;
}
