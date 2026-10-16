// BỘ SET 3D — phần thuần (14/10/2026). Bối cảnh là DỮ LIỆU toạ độ (xv_bo_set), không phải chữ: mọi shot cùng set đứng trên CÙNG một bộ đồ đạc,
// máy ảo của từng shot (xv_canh.may_3d) render ra khung xám + bản đồ độ sâu (scripts/bo-set/dung-set.py, Blender trên box) làm khung xương
// cho keyframe. Ở đây: shot thuộc set nào, mã đầu vào (đổi là phải dựng lại), bảng đầu vào cho Blender, kiểm trục 180° bằng hình học,
// và cổng (chanKhungXam). Tự kiểm: bo-set-3d.test.mts
import type { BoSet, Canh, KhungXam, May3d, NhanVat, VatThay } from './kieu';
import { duongMay, hopVat } from './duong-may';

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
export const BAN_DUNG = 32;
/** Mã đầu vào của khung xám: cách dựng + set (dữ liệu) + máy + vị trí + khối nhân vật — khác mã là khung xám cũ hết hiệu lực. */
const bam = (x: unknown) => { const s = JSON.stringify(x); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
/** Mã từng PHẦN đầu vào của khung xám — lưu kèm khung (khung_xam.ma_phan) để biết lần sau vì sao phải dựng lại (bộ set / máy / khối / cách dựng). */
/** Phần máy ĐI VÀO HÌNH: bỏ các khai chỉ cổng kể chuyện đọc (lam) — khai thêm "Tango chạm phích" không làm khung đã dựng thành cũ. */
const hinhMay = (m: May3d): May3d => (m.vi_tri.some((v) => v.lam || v.lam_o) ? { ...m, vi_tri: m.vi_tri.map(({ lam: _l, lam_o: _o, ...v }) => v) } : m);
export const maPhan = (set: Pick<BoSet, 'id' | 'du_lieu'>, m: May3d, nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]) => ({ ban: String(BAN_DUNG), set: bam([set.id, set.du_lieu.vat]), may: bam(hinhMay(m)), khoi: bam(m.vi_tri.map((v) => khoiCua(v.ten, nhanVat))) });
export function maKhungXam(set: Pick<BoSet, 'id' | 'du_lieu'>, m: May3d, nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]): string {
  const s = JSON.stringify([BAN_DUNG, set.id, set.du_lieu.vat, hinhMay(m), m.vi_tri.map((v) => khoiCua(v.ten, nhanVat))]);
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Bảng đầu vào cho dung-set.py: vật của set + khối nhân vật + các shot (ma = id shot). Thiếu khối của một tên → lỗi (không đoán cỡ). */
export function bangDung(set: Pick<BoSet, 'du_lieu'>, shots: ({ id: number; thu_tu: number; may_3d: May3d; truc?: ReturnType<typeof rangBuocTruc>; /** máy đã khớp keyframe đã sinh — bộ giải không dời */ khoa_may?: boolean } & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung' | 'ky_thuat'>>)[], nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]): { ok: true; bang: unknown } | { ok: false; loi: string } {
  const mau: Record<string, unknown> = {}; const thieu = new Set<string>();
  for (const s of shots) for (const v of s.may_3d.vi_tri) { const k = khoiCua(v.ten, nhanVat); if (k) mau[v.ten] = k; else thieu.add(v.ten); }
  if (thieu.size) return { ok: false, loi: `chưa khai khối 3D cho: ${[...thieu].join(', ')} — ghi khoi_3d (hình + cỡ cm) cho anchor đó` };
  return { ok: true, bang: { vat: set.du_lieu.vat, nhan_vat_mau: mau, shot: shots.map((s) => ({ ma: String(s.id), so: s.thu_tu, may: { dat: s.may_3d.dat, nhin: s.may_3d.nhin, ong_kinh: s.may_3d.ong_kinh, chay: duongMay(s.may_3d, s.ky_thuat?.chuyen_dong, hopVat(set.du_lieu.vat, s.may_3d.them ?? []), (t) => Number((mau[t] as { co?: number[] } | undefined)?.co?.[2] ?? 2)) }, nhan_vat: s.may_3d.vi_tri,
    bat_buoc: chuThe(s.may_3d), giai: !!s.may_3d.tu_dong && !s.khoa_may, nhac: vatDuocNhac(s, set), truc: s.truc ?? null, them: s.may_3d.them ?? [], den_ban: !!s.may_3d.den_ban })) } };
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
/** Vật DẸT của set (thẻ, giấy, tấm lót — cao ≤ 0,5 cm): là mặt nhân vật đứng lên, máy tầm thấp thấy nó phủ tiền cảnh là đúng ý (7.7a tập 19: thẻ
 *  trống phía trước hai bạn) — không tính "chủ thể quá to"; vật có bề dày vẫn tính. */
const vatDet = (set: Pick<BoSet, 'du_lieu'> | null | undefined) => new Set((set?.du_lieu.vat ?? []).filter((v) => 'co' in v && v.co && (v.co[2] ?? 1) <= 0.5).map((v) => v.ten));
/** Vật BẮT BUỘC thấy (may_3d.khung) mà chỉ là một mẩu ở cú CẬN (cu/ecu/insert/mcu): mỗi chủ thể ≥ 5% diện tích khung (15/10/2026 shot #32 tập 19:
 *  phích là chủ thể cú cận — "Foreground: the plug" — mà Tango đứng che, phích còn 3%; cổng chỉ hỏi "có trong khung" nên lọt, keyframe vẽ cảnh khác).
 *  Không chặn chuyện chạm mép: ở cú cận vật lớn (đế cắm 10 cm) đằng nào cũng tràn mép. Cỡ rộng không đo: nhân vật 5 cm trong toàn cảnh nhỏ là đúng ý. */
export const chuTheQuaNho = (c: Pick<Canh, 'khung_xam'> & Partial<Pick<Canh, 'ky_thuat'>>): string[] => {
  if (!['cu', 'ecu', 'insert', 'mcu'].includes(c.ky_thuat?.co_canh ?? '')) return [];
  const thay = new Map((c.khung_xam?.thay ?? []).map((t) => [t.ten, t]));
  return (c.khung_xam?.kiem ?? []).filter((k) => k.bat_buoc && k.trong_khung).flatMap((k) => {
    const t = thay.get(k.nhan_vat);
    return t && t.pt < 5 ? [`${k.nhan_vat} (chủ thể) chỉ chiếm ${Math.round(t.pt * 10) / 10}% khung ở cỡ ${c.ky_thuat?.co_canh ?? '?'} — dời máy cho nó nằm rõ trong khung (không bị nhân vật che, không ở quá xa)`] : [];
  });
};
/** CỠ CẢNH KHỚP 3D (15/10/2026, tờ toàn cảnh tập 19): thẻ khai cỡ trung (ms / two / mcu) mà nhân vật chính trong khung 3D chỉ cao 9–15% khung
 *  (#8 two 10,7%, #13 ms 11%, #14 ms 9,4%) — thực chất là toàn cảnh; keyframe sinh theo chữ "medium shot" vẽ to gấp ba 3D (3D ↔ frame lệch bố cục).
 *  Đo NHÂN VẬT CHÍNH (cao nhất trong số nhân vật chủ thể): nhân vật phụ đứng xa hơn là dàn cảnh theo chiều sâu, không phải lỗi. Sàn theo khung dọc,
 *  nhân vật nặn cao ~2–3 cm: ms ≥ 20%, two ≥ 15%, mcu ≥ 30%. Không đạt → kéo máy lại (giữ hướng máy) hoặc khai cỡ cảnh đúng cái 3D cho thấy. */
export const SAN_CO: Record<string, number> = { ms: 20, two: 15, mcu: 30 };
export const coCanhLech = (c: Pick<Canh, 'khung_xam'> & Partial<Pick<Canh, 'ky_thuat'>>, laNhanVat: (ten: string) => boolean): string[] => {
  const co = c.ky_thuat?.co_canh ?? ''; const san = SAN_CO[co]; if (!san) return [];
  const nv = (c.khung_xam?.kiem ?? []).filter((k) => k.bat_buoc && k.trong_khung && laNhanVat(k.nhan_vat));
  if (!nv.length) return [];
  const chinh = nv.reduce((a, b) => (b.cao_khung_pt > a.cao_khung_pt ? b : a));
  return chinh.cao_khung_pt < san ? [`cỡ cảnh: thẻ khai ${co} mà ${chinh.nhan_vat} (nhân vật chính) chỉ cao ${chinh.cao_khung_pt}% khung 3D (cần ≥ ${san}%) — keyframe sẽ vẽ to hơn 3D — kéo máy lại gần (giữ hướng), hoặc khai cỡ cảnh rộng hơn cho đúng 3D`] : [];
};
export const chuTheQuaTo = (c: Pick<Canh, 'khung_xam'> & Partial<Pick<Canh, 'ky_thuat'>>, set?: Pick<BoSet, 'du_lieu'> | null): string[] => ['cu', 'ecu', 'insert', 'mcu'].includes(c.ky_thuat?.co_canh ?? '') ? [] : (c.khung_xam?.kiem ?? []).filter((k) => k.bat_buoc && k.cao_khung_pt > 70 && !vatDet(set).has(k.nhan_vat)).map((k) => `${k.nhan_vat} cao ${k.cao_khung_pt}% khung ở cỡ ${c.ky_thuat?.co_canh ?? '?'} — máy dí sát: lùi máy / đặt tay`);

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
    out.push(...chuTheQuaTo(c, set));
    out.push(...chuTheQuaNho(c));
    out.push(...coCanhLech(c, (t) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten === t)));
    // 'Bố cục nhắc mà khung không thấy' (dò tên trong chữ) KHÔNG chặn nữa — báo nhầm (chữ 'cable' khớp mọi sợi cáp); bộ giải máy vẫn dùng nó làm
    // gợi ý. Vật BẮT BUỘC thấy khai thẳng ở may_3d.khung (đồ của set cũng được) → kiểm như chủ thể (anh 15/10/2026: 3D là nguồn, không dò chữ).
    for (const t of khoiLapKhung(c, set)) out.push(`${t.ten} lấp ${t.pt}% khung — máy dí sát hoặc lọt trong vật: lùi máy / đổi cỡ cảnh`);
    for (const v of vatChanTienCanh(c, set)) out.push(`${v.ten} chắn tiền cảnh ${v.pt}% khung mà bố cục không nhắc — máy đang đặt sau đồ đạc: dời máy (phía / dat) hoặc ghi nó vào bố cục nếu cố ý`);
  }
  // GÓC MÁY 3D phải khớp góc máy khai ở thẻ shot (15/10/2026: 7.1a khai ngang tầm mà bộ giải đẩy máy lên cao 59° — keyframe bỏ qua khung 3D,
  // vẽ ngang tầm theo chữ, mất luôn cú quay đầu). Lệch → đặt tay máy hoặc đổi góc khai cho đúng điều muốn quay.
  { const g = gocMayLech(c.may_3d, c.ky_thuat?.goc); if (g) out.push(g); }
  out.push(...matQuayDi(c, (t) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten === t)));
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
// BỘ ỐNG KÍNH (luật bo_ong_kinh, 15/10/2026): máy tự động chỉ dùng 3 tiêu cự — 24 rộng · 35 trung · 60 cận — để một cảnh không quá 3 tiêu cự
// (trước: 18/24/35/40/50/60 theo cỡ → cảnh 7 có 6 tiêu cự, phối cảnh đổi từng shot). Khoảng cách máy tự tính theo cỡ cảnh nên cỡ vẫn đúng.
const ONG_MM: Record<string, number> = { probe: 16, rong: 24, chuan: 35, chan_dung: 85, tele: 135, macro: 60, anamorphic: 35 };
const ONG_THEO_CO: Record<string, number> = { ews: 24, ws: 24, ms: 35, mcu: 60, cu: 60, ecu: 60, insert: 60, two: 35, ots: 35, pov: 24 };
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
/** enCua(ten): cách gọi vật cho model ảnh — mô tả anchor (sinh-anh.ts) thắng tên trơn của set ('Orange Card' → ví da cam có thẻ xanh, đúng ảnh mẫu);
 *  trang = trạng thái lúc dựng (đã chia mảnh). */
/** NGƯỠNG "THẤY TRONG KHUNG 3D" (% diện tích) — MỘT số cho nhãn khối, đạo cụ tự kèm ảnh mẫu, và lọc ảnh mẫu đạo cụ ngoài khung (doc-db / sinh-anh).
 *  15/10/2026 #32 tập 19: nhãn lấy ≥ 2% còn câu sau ghi "Nothing else is in this frame" → Lint 1.7% đứng sau phích bị coi như không có. */
export const PT_THAY = 1;
/** Vật chạm mép khung (hộp thấy 0..1) → "cut off by the bottom edge — only a 10% strip shows": model không được vẽ cả món. */
export function catMep(h: number[]): string {
  const m: string[] = []; const e = 0.015;
  if (h[3]! >= 1 - e && h[1]! > 0.5) m.push(`the bottom edge — only a ${Math.round((1 - h[1]!) * 100)}% strip shows`);
  else if (h[1]! <= e && h[3]! < 0.5) m.push(`the top edge — only a ${Math.round(h[3]! * 100)}% strip shows`);
  if (h[0]! <= e && h[2]! < 0.5) m.push(`the left edge — only ${Math.round(h[2]! * 100)}% of the width shows`);
  else if (h[2]! >= 1 - e && h[0]! > 0.5) m.push(`the right edge — only ${Math.round((1 - h[0]!) * 100)}% of the width shows`);
  return m.length ? `, cut off by ${m.join(' and ')}` : '';
}
export function moTaThay(thay: VatThay[] | undefined, enCua?: (ten: string) => string | undefined): string {
  const ngang = (x: number) => (x < 0.36 ? 'left' : x > 0.64 ? 'right' : 'centre'); const doc = (y: number) => (y < 0.36 ? 'top' : y > 0.64 ? 'bottom' : 'middle');
  const ds = (thay ?? []).filter((t) => t.pt >= PT_THAY).map((t) => `${enCua?.(t.ten) ?? t.en ?? t.ten}${t.trang ? ` [${t.trang}]` : ''} (${doc((t.hop[1] + t.hop[3]) / 2)}-${ngang((t.hop[0] + t.hop[2]) / 2)}, ${Math.round(t.pt)}%${t.tien ? ', foreground' : ''}${catMep(t.hop)})`);
  // 3D LÀ NGUỒN DUY NHẤT của "có gì, ở đâu, to bao nhiêu" (anh 15/10/2026, keyframe #35: đế cắm 3D chỉ ló một dải ở đáy → ảnh vẽ cả cái đế to; chữ thẻ
  // shot "a cable loop trailing behind" → ảnh thêm vòng cáp): chữ chỉ thêm chất liệu, biểu cảm, dáng, hành động — chữ gọi tên thứ ngoài danh sách = ngoài khung.
  return ds.length ? `Blocks in that layout image, by name: ${ds.join('; ')}. Nothing else is in this frame — do not add hands, people or objects that are not in this list; the BACKGROUND is exactly what those blocks show (a far room wall stays a plain dim wall — never add monitors, computers or extra cables there). This list and Image 1 are the ONLY authority on WHAT is in the frame, WHERE and HOW BIG: if any other sentence of this prompt names a character or object that is not in this list, it is OFF-SCREEN at this instant — do not draw it or any trace of it. The rest of the prompt only adds look, material, expression, pose and action to what IS listed; a block cut off by the frame edge stays cut off exactly that much.` : '';
}

// ── ĐỒ ĐỂ LẠI (anh 15/10/2026: "đồ ở các cảnh liên quan trước và sau phải chú ý để không bị mất hình") ──────────────────────────────────
// Bộ set có TRẠNG THÁI theo thời gian: đạo cụ / sản phẩm đặt xuống ở shot trước nằm nguyên chỗ cuối cùng nó được thấy trong mọi shot sau cùng
// set — tự thêm vào chỗ đứng của shot (an, de_lai) cho tới khi nó được khai lại (đổi chỗ), được cầm lên (cam), hoặc rời bộ set (het).
// Khung 3D / khung màu / keyframe vì thế luôn có món đó nếu máy nhìn thấy chỗ nó nằm — không phải nhớ khai lại từng shot.
export function mayDayDu<T extends { id: number; may_3d?: May3d | null }>(ds: T[], laDoVat: (ten: string) => boolean): Map<number, May3d> {
  const con = new Map<string, { tam: number[]; huong?: number; nam?: boolean; chia?: number }>(); const out = new Map<number, May3d>();
  for (const c of ds) {
    const m = c.may_3d; if (!m) continue;
    const co = new Set(m.vi_tri.map((v) => v.ten));
    const deLai = [...con].filter(([t]) => !co.has(t)).map(([ten, x]) => ({ ten, tam: x.tam, ...(x.huong != null ? { huong: x.huong } : {}), ...(x.nam ? { nam: true } : {}), ...(x.chia ? { chia: x.chia } : {}), an: true, de_lai: true }));
    out.set(c.id, deLai.length ? { ...m, vi_tri: [...m.vi_tri, ...deLai] } : m);
    for (const v of m.vi_tri) {
      if (!laDoVat(v.ten)) continue;
      if (v.het || (v.cam && !v.den)) con.delete(v.ten);   // rời bộ set / đang được cầm đi theo người
      else con.set(v.ten, { tam: v.den ?? v.tam, huong: v.huong_den ?? v.huong, nam: v.nam_den ?? v.nam, ...(v.chia ? { chia: v.chia } : {}) });
    }
  }
  return out;
}

// ── LIỀN MẠCH (anh 14/10/2026: "bản 3D phải thể hiện được sự liền mạch về chuyển động, vị trí của mọi nhân vật ở các cảnh") ──────────
// Mỗi nhân vật / đạo cụ có chỗ MỞ (tam) và chỗ KẾT (den) trong từng shot. Shot sau mở phải đúng chỗ LẦN CUỐI thấy nó kết — kể cả khi nó vắng
// vài shot ở giữa (Lint vắng ở 7.2 thì 7.2a vẫn phải đứng chỗ 7.1 kết). Lệch quá ngưỡng = đứt mạch, trừ shot khai `nhay` (thời gian trôi /
// dịch chuyển ngoài khung, ghi lý do) hoặc món khai `nhay` riêng; món đang được CẦM (`cam`) đi theo người cầm. Hướng mặt cũng thế: đổi hơn 60° qua cú cắt mà không khai = nhân vật quay ngoắt giữa hai khung.
const NGUONG_CM = (co?: number[]) => Math.max(0.8, 0.45 * Math.max(...(co ?? [2])));
const gocLech = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/** Lỗi liền mạch theo từng shot (id → câu). ds = các shot CÙNG bộ set theo thứ tự phát; shot không có may_3d bỏ qua. */
export function lienMachTap<T extends { id: number; thu_tu: number; may_3d?: May3d | null }>(ds: T[], khoi: (ten: string) => { co: number[] } | null): Record<number, string[]> {
  const cuoi = new Map<string, { p: number[]; huong?: number; nam: boolean; shot: number }>(); const out: Record<number, string[]> = {};
  // ĐỒ ĐANG CẦM (nối thử #22→#24 tập 19: bình xịt trong tay Mr. Wipe ở 5.4 và 5.6 mà 5.5 không có): người cầm còn trong shot thì món đồ phải còn —
  // tới khi nó xuất hiện KHÔNG còn cầm (đặt xuống), hoặc người cầm khai nhảy / shot khai nhảy.
  const camBoi = new Map<string, { nguoi: string; shot: number }>();
  // TRẠNG THÁI VẬT (15/10/2026: kẹo đã bẻ đôi ở cảnh 4 mà 7.1a / 7.4a dựng con gấu nguyên): một món đã chia mảnh thì mọi lần xuất hiện sau phải
  // khai chia ≥ số mảnh đó — vật không tự lành.
  const daChia = new Map<string, { n: number; shot: number }>();
  // SỔ TRẠNG THÁI (script supervisor, 15/10/2026): trạng thái cơ thể / bề mặt (trang) shot trước ĐỂ LẠI phải là trạng thái shot sau MỞ — xù lông
  // không tự phẳng, bẹp không tự tròn; chỉ đổi trong shot (trang_den) hoặc khi khai nhay.
  const trangCuoi = new Map<string, { t: string; shot: number }>();
  let truocCo = new Set<string>();
  for (const c of ds) {
    const m = c.may_3d; if (!m) continue;
    const co = new Set(m.vi_tri.map((v) => v.ten));
    for (const v of m.vi_tri) {
      const tr = trangCuoi.get(v.ten); const mo = (v.trang ?? '').trim();
      if (tr && !m.nhay && !v.nhay && mo !== tr.t) (out[c.id] ??= []).push(`${v.ten} kết #${tr.shot} ở trạng thái "${tr.t || 'bình thường'}" mà mở shot này ${mo ? `"${mo}"` : 'không khai trang (bình thường)'} — khai trang: '${tr.t}' (trạng thái không tự đổi qua cú cắt), hoặc trang_den ở shot trước / nhay nếu cố ý`);
      trangCuoi.set(v.ten, { t: (v.trang_den ?? v.trang ?? '').trim(), shot: c.thu_tu });
    }
    if (m.nhay) camBoi.clear();
    for (const [mon, x] of camBoi) {
      const ng = m.vi_tri.find((v) => v.ten === x.nguoi);
      if (ng?.nhay) { camBoi.delete(mon); continue; }
      if (ng && !co.has(mon)) (out[c.id] ??= []).push(`${x.nguoi} đang cầm ${mon} (từ #${x.shot}) mà shot này vắng nó — thêm ${mon} vào chỗ đứng (cam: '${x.nguoi}', an nếu ngoài khung) hoặc cho đặt xuống ở shot trước`);
    }
    // cam + den = cầm rồi ĐẶT XUỐNG trong shot (hai nửa kẹo đặt lên thẻ ở 7.1) → hết theo dõi.
    for (const v of m.vi_tri) { if (v.cam && !v.den) camBoi.set(v.ten, { nguoi: v.cam, shot: c.thu_tu }); else camBoi.delete(v.ten); }
    for (const v of m.vi_tri) {
      const ch = daChia.get(v.ten);
      if (ch && (v.chia ?? 1) < ch.n) (out[c.id] ??= []).push(`${v.ten} đã chia ${ch.n} mảnh từ #${ch.shot} mà shot này ${v.chia ? `chỉ ${v.chia}` : 'nguyên'} — khai chia: ${ch.n} (vật không tự lành)`);
      if ((v.chia ?? 1) > (ch?.n ?? 1)) daChia.set(v.ten, { n: v.chia!, shot: c.thu_tu });
      const tr = cuoi.get(v.ten);
      if (v.cam) { cuoi.delete(v.ten); continue; }   // đang cầm: theo người cầm, lần sau thấy không so chỗ cũ
      if (tr && !m.nhay && !v.nhay) {
        const d = Math.hypot(v.tam[0]! - tr.p[0]!, v.tam[1]! - tr.p[1]!, (v.tam[2] ?? 0) - (tr.p[2] ?? 0));
        const r = (p: number[]) => `(${p.map((x) => Math.round(x * 10) / 10).join(', ')})`;
        if (d > NGUONG_CM(khoi(v.ten)?.co)) (out[c.id] ??= []).push(`${v.ten} đứt mạch: kết #${tr.shot} ở ${r(tr.p)} mà mở shot này ở ${r(v.tam)} — lệch ${Math.round(d * 10) / 10} cm; sửa chỗ đứng / chỗ kết, hoặc khai nhay (lý do) nếu cố ý cắt thời gian`);
        // DÁNG — chỉ khi nhân vật CÓ MẶT ở shot liền trước (vắng một shot = thời gian trôi ngoài khung, #14 nằm → vắng #15 → #16 đứng là hợp lệ).
        // (anh 16/10/2026: "#8 đang đứng mà #9 đã nằm — hệ thống điểm không phát hiện được à"): đứng / nằm không tự đổi qua cú cắt — ngã phải
        // diễn trong shot (nam_den ở shot trước) hoặc khai nhay. Trước đây cổng chỉ so chỗ + hướng + trạng thái chữ.
        if (tr.nam !== !!v.nam && truocCo.has(v.ten)) (out[c.id] ??= []).push(`${v.ten} kết #${tr.shot} đang ${tr.nam ? 'NẰM' : 'ĐỨNG'} mà mở shot này ${v.nam ? 'NẰM' : 'ĐỨNG'} — cho ${tr.nam ? 'đứng dậy' : 'ngã'} trong #${tr.shot} (nam_den: ${!tr.nam}) hoặc khai nhay nếu cố ý cắt thời gian`);
        if (tr.huong != null && v.huong != null && gocLech(tr.huong, v.huong) > 60) (out[c.id] ??= []).push(`${v.ten} quay ngoắt ${Math.round(gocLech(tr.huong, v.huong))}° qua cú cắt (kết #${tr.shot} nhìn ${tr.huong}°, mở shot này ${v.huong}°)`);
      }
      cuoi.set(v.ten, { p: v.den ?? v.tam, huong: v.huong_den ?? v.huong, nam: !!(v.nam_den ?? v.nam), shot: c.thu_tu });
    }
    truocCo = co;
  }
  return out;
}

// ── NHẤT QUÁN · LIÊN TỤC (15/10/2026, luat-dung.ts › luật của thợ). Hai mức theo Murch: CHẶN (loiMachTap) và CẢNH BÁO (canhBaoMachTap).
type ShotMach = { id: number; thu_tu: number; phan_doan?: string; may_3d?: May3d | null; ky_thuat?: { vai?: string; co_canh?: string; goc?: string } | null; khung_xam?: Canh['khung_xam'] | null; prompt_video?: string; hanh_dong?: string; dan_dung?: { bo_cuc?: string } | null };
const BAC_CO: Record<string, number> = { ews: 0, ws: 1, two: 2, ms: 2, pov: 2, ots: 3, mcu: 3, cu: 4, insert: 4, ecu: 5 };
/** Véc-tơ ngang (phải màn) và sâu (vào màn) của máy trên mặt bàn. */
const trucMay = (m: Pick<May3d, 'dat' | 'nhin'>) => { const fx = m.nhin[0]! - m.dat[0]!, fy = m.nhin[1]! - m.dat[1]!; const l = Math.hypot(fx, fy) || 1; return { f: [fx / l, fy / l], r: [fy / l, -fx / l] }; };
const tamThay = (c: ShotMach, ten: string) => { const t = c.khung_xam?.thay?.find((x) => x.ten === ten); return t && t.pt >= PT_THAY ? { x: (t.hop[0] + t.hop[2]) / 2, y: (t.hop[1] + t.hop[3]) / 2, t } : null; };
const khoiCanh = <T extends ShotMach>(ds: T[]): T[][] => { const out: T[][] = []; for (const c of [...ds].sort((a, b) => a.thu_tu - b.thu_tu)) { const l = out[out.length - 1]; if (l && (l[0]!.phan_doan ?? '') === (c.phan_doan ?? '')) l.push(c); else out.push([c]); } return out; };
/** Vùng khung bằng chữ (trái trên, giữa, phải dưới…) cho câu cảnh báo — không bắt người đọc dịch phần trăm. */
const vungKhung = (x: number, y: number) => `${y < 0.36 ? 'phía trên' : y > 0.64 ? 'phía dưới' : 'giữa'}${x < 0.36 ? ' bên trái' : x > 0.64 ? ' bên phải' : x >= 0.36 && y >= 0.36 && y <= 0.64 ? ' khung' : ''}`.trim();
const ben = (chu: string) => (chu.includes('screen-right') ? 'phải' : chu.includes('screen-left') ? 'trái' : null);

/** CHẶN — Shot TỔNG THỂ đo trên 3D (luật du_diem_nhin): cảnh ≥ 3 shot có ≥ 2 nhân vật cùng lúc thì phải có một shot mọi nhân vật đó cùng lọt khung
 *  (thấy ≥ PT_THAY). Gắn vào shot đông người nhất mà vẫn thiếu — chỗ đáng lẽ là master. */
export function thieuTongThe<T extends ShotMach>(ds: T[], laNhanVat: (ten: string) => boolean): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const k of khoiCanh(ds)) {
    const co = k.filter((c) => c.may_3d && c.khung_xam?.thay); if (co.length < 3) continue;
    const nv = (c: T) => c.may_3d!.vi_tri.filter((v) => !v.an && laNhanVat(v.ten)).map((v) => v.ten);
    const max = Math.max(...co.map((c) => nv(c).length)); if (max < 2) continue;
    // "Thấy" ở shot tổng thể = lọt khung + không bị che (khung_xam.kiem) — nhân vật xa, nhỏ vẫn là thấy (toàn cảnh); thay chỉ là dự phòng.
    const thayRo = (c: T, t: string) => { const k = c.khung_xam?.kiem?.find((x) => x.nhan_vat === t); const cam = (o: string) => c.may_3d!.vi_tri.find((v) => v.ten === o)?.cam === t; return k ? k.trong_khung && k.bi_che_boi.every(cam) : !!tamThay(c, t); };   // đồ đang cầm che chính mình không tính
    const ung = co.filter((c) => nv(c).length === max);
    if (ung.some((c) => nv(c).every((t) => thayRo(c, t)))) continue;
    const c = ung[0]!; const thieu = nv(c).filter((t) => !thayRo(c, t));
    (out[c.id] ??= []).push(`cảnh "${c.phan_doan}" chưa có shot TỔNG THỂ thấy đủ ${nv(c).join(' + ')} — shot này có đủ người mà ${thieu.join(', ')} ngoài khung / bị che: lùi máy cho đủ, hoặc chọn shot khác làm tổng thể`);
  }
  return out;
}
/** CHẶN — Hướng DI CHUYỂN trên màn (screen direction): nhân vật đi trong shot (den) thì hướng trái/phải màn giữ nguyên trong cảnh; đổi chỉ sau cú
 *  TRUNG LẬP (đi thẳng vào / ra máy: ngang < nửa sâu, hoặc < 1 cm) hoặc shot khai qua_truc. Chỉ bắt khi hướng NGOÀI ĐỜI còn như cũ mà màn đảo. */
export function huongDiChuyen<T extends ShotMach>(ds: T[], laNhanVat: (ten: string) => boolean): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const k of khoiCanh(ds)) {
    const cuoi = new Map<string, { ben: 'trái' | 'phải'; goc: number; shot: number }>();
    for (const c of k) {
      const m = c.may_3d; if (!m || VAI_GOC_RIENG.has(c.ky_thuat?.vai ?? '')) continue;   // thiết lập / người thứ ba / POV: góc riêng, không nối hướng
      const { f, r } = trucMay(m);
      for (const v of m.vi_tri) {
        if (!v.den || !laNhanVat(v.ten) || v.cam) continue;
        const dx = v.den[0]! - v.tam[0]!, dy = v.den[1]! - v.tam[1]!;
        const ngang = dx * r[0]! + dy * r[1]!, sau = dx * f[0]! + dy * f[1]!;
        if (Math.abs(ngang) < 1 || Math.abs(ngang) < Math.abs(sau) / 2) { cuoi.delete(v.ten); continue; }   // cú trung lập: đặt lại hướng
        const b: 'trái' | 'phải' = ngang > 0 ? 'phải' : 'trái'; const goc = (Math.atan2(dy, dx) * 180) / Math.PI; const tr = cuoi.get(v.ten);
        // Chỉ chặn khi ngoài đời vẫn đi CÙNG hướng (lệch < 60°) mà trên màn đảo bên — tức máy đã sang phía bên kia trục chuyển động.
        // Nhân vật tự quay lại trong truyện (lùi, bỏ chạy ngược) thì hướng đời đổi theo, không phải lỗi.
        if (tr && tr.ben !== b && gocLech(tr.goc, goc) < 60 && !m.qua_truc) (out[c.id] ??= []).push(`${v.ten} vẫn đi cùng hướng ngoài đời như #${tr.shot} mà trên màn đảo (sang ${tr.ben} → sang ${b}) — máy đã sang phía bên kia trục chuyển động: dời máy cùng phía, hoặc chen một cú trung lập (đi thẳng vào / ra máy), hoặc khai qua_truc nếu cố ý`);
        cuoi.set(v.ten, { ben: b, goc, shot: c.thu_tu });
      }
    }
  }
  return out;
}
/** CHẶN — ĐỐI MẶT (eyeline match shot / reverse shot): hai shot liền nhau cùng cảnh, X là chủ thể shot trước nhìn sang một bên màn, Y là chủ thể
 *  shot này; X và Y đang quay mặt vào nhau trong 3D → ánh nhìn của Y phải sang bên NGƯỢC lại. Cùng bên = hai người như nhìn cùng một hướng. */
export function doiMat<T extends ShotMach>(ds: T[], laNhanVat: (ten: string) => boolean): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const k of khoiCanh(ds)) for (let i = 1; i < k.length; i++) {
    const a = k[i - 1]!, b = k[i]!; if (!a.may_3d || !b.may_3d) continue;
    const x = chuThe(a.may_3d).filter(laNhanVat)[0]; const y = chuThe(b.may_3d).filter(laNhanVat)[0]; if (!x || !y || x === y) continue;
    const vx = b.may_3d.vi_tri.find((v) => v.ten === x && !v.an), vy = b.may_3d.vi_tri.find((v) => v.ten === y && !v.an); const vxa = a.may_3d.vi_tri.find((v) => v.ten === x && !v.an);
    if (!vx || !vy || !vxa || vx.huong == null || vy.huong == null) continue;
    if (gocLech(vx.huong, huongToi(vx.tam, vy.tam)) > 45 || gocLech(vy.huong, huongToi(vy.tam, vx.tam)) > 45) continue;   // không phải cú đối mặt
    const hx = huongVoiMay(a.may_3d, vxa), hy = huongVoiMay(b.may_3d, vy); if (!hx || !hy) continue;
    const bx = ben(hx.chu), by = ben(hy.chu);
    if (bx && by && bx === by) (out[b.id] ??= []).push(`cú đối mặt: #${a.thu_tu} ${x} nhìn sang ${bx} màn, shot này ${y} cũng nhìn sang ${by} — hai người như nhìn cùng hướng, ánh nhìn không gặp nhau qua cú cắt: kiểm huong của ${y} / phía máy`);
  }
  return out;
}
/** CẢNH BÁO (Murch: liên tục không gian xếp cuối) — luật 30°, eye trace, khoảng nhìn + headroom, chiều cao máy, bộ ống kính. Gắn ⚠ vàng, không chặn. */
export function canhBaoMachTap<T extends ShotMach>(ds: T[], laNhanVat: (ten: string) => boolean): Record<number, string[]> {
  const out: Record<number, string[]> = {}; const them = (id: number, s: string) => (out[id] ??= []).push(s);
  for (const k of khoiCanh(ds)) {
    const co = k.filter((c) => c.may_3d);
    for (let i = 1; i < co.length; i++) {
      const a = co[i - 1]!, b = co[i]!; const ma = a.may_3d!, mb = b.may_3d!;
      // luật 30° / 2 bậc: cùng chủ thể chính, góc máy quanh nó đổi < 30° và cỡ đổi < 2 bậc
      const s = chuThe(mb)[0]; const pa = ma.vi_tri.find((v) => v.ten === s)?.tam, pb = mb.vi_tri.find((v) => v.ten === s)?.tam;
      if (s && chuThe(ma)[0] === s && pa && pb && !ma.qua_truc && !mb.qua_truc) {
        const g = (m: May3d, p: number[]) => (Math.atan2(m.dat[1]! - p[1]!, m.dat[0]! - p[0]!) * 180) / Math.PI;
        const lech = gocLech(g(ma, pa), g(mb, pb)); const ca = BAC_CO[a.ky_thuat?.co_canh ?? ''], cb = BAC_CO[b.ky_thuat?.co_canh ?? ''];
        if (lech < 30 && ca != null && cb != null && Math.abs(ca - cb) < 2) them(b.id, `luật 30°: gần như cùng góc máy với #${a.thu_tu} (chỉ xoay ${Math.round(lech)}°) và cỡ cảnh gần nhau (${a.ky_thuat?.co_canh} → ${b.ky_thuat?.co_canh}) — cắt sẽ giật như nhảy hình — xoay máy ít nhất 30° quanh ${s}, hoặc đổi cỡ cảnh hai bậc`);
      }
      // eye trace: tâm chủ thể chính shot trước ↔ shot này lệch > nửa khung
      const sa = chuThe(ma)[0]; const ta = sa ? tamThay(a, sa) : null; const tb = s ? tamThay(b, s) : null;
      const gocRieng = VAI_GOC_RIENG.has(a.ky_thuat?.vai ?? '') || VAI_GOC_RIENG.has(b.ky_thuat?.vai ?? '');   // người thứ ba / POV / thiết lập: bố cục có chủ ý khác
      if (!gocRieng && ta && tb && Math.hypot(ta.x - tb.x, ta.y - tb.y) > 0.5) them(b.id, `eye trace: cuối #${a.thu_tu} mắt khán giả đang ở ${sa} (${vungKhung(ta.x, ta.y)}), mở shot này ${s} lại ở ${vungKhung(tb.x, tb.y)} — mắt phải nhảy qua màn mỗi cú cắt — dời bố cục cho ${s} về gần ${vungKhung(ta.x, ta.y)}`);
    }
    // khoảng nhìn + headroom (shot thường, không POV)
    for (const c of co) {
      const m = c.may_3d!; if (c.ky_thuat?.vai === 'chu_quan') continue;
      for (const t of chuThe(m).filter(laNhanVat)) {
        const v = m.vi_tri.find((x) => x.ten === t && !x.an); const tt = tamThay(c, t); if (!v || !tt || tt.t.pt < 3) continue;
        const h = huongVoiMay(m, v); const b = h ? ben(h.chu) : null;
        if (b === 'phải' && tt.x > 0.6) them(c.id, `khoảng nhìn: ${t} nhìn sang phải mà đứng sát mép phải — trước mặt không còn chỗ, khung ngột ngạt — dời máy cho ${t} về phần ba bên trái khung`);
        if (b === 'trái' && tt.x < 0.4) them(c.id, `khoảng nhìn: ${t} nhìn sang trái mà đứng sát mép trái — trước mặt không còn chỗ, khung ngột ngạt — dời máy cho ${t} về phần ba bên phải khung`);
        // headroom chỉ ở máy NGANG tầm; góc cao / thấp đặt đầu nhân vật lệch khỏi mép trên là bản chất của góc. Không báo khi phần trên khung đã có
        // chủ thể / nhân vật khác (Mr. Wipe lơ lửng trên hai bạn), khi ai đó bay lên trong shot (Lint bị hút lên), hay nhân vật đang bẹp.
        const coTren = (c.khung_xam?.thay ?? []).some((x) => x.pt >= PT_THAY && x.hop[1] <= 0.3 && (laNhanVat(x.ten) || chuThe(m).includes(x.ten)));
        const bayLen = m.vi_tri.some((x) => laNhanVat(x.ten) && x.den && (x.den[2] ?? 0) > (x.tam[2] ?? 0) + 1);
        if (c.ky_thuat?.goc === 'ngang' && !v.nam && !coTren && !bayLen && ['cu', 'mcu', 'ms'].includes(c.ky_thuat?.co_canh ?? '') && tt.t.hop[1] > 0.3) them(c.id, `headroom: trên đầu ${t} trống gần nửa khung ở cỡ ${c.ky_thuat?.co_canh} — thừa khoảng trên đầu, nhân vật như bị đẩy xuống đáy — hạ khung xuống (nhìn thấp hơn) hoặc kéo máy lại gần`);
      }
    }
    // chiều cao máy: các shot "ngang" trong cảnh quanh trung vị ± 4 cm
    const ngang = co.filter((c) => c.ky_thuat?.goc === 'ngang' && !VAI_GOC_RIENG.has(c.ky_thuat?.vai ?? ''));
    if (ngang.length >= 3) {
      const z = ngang.map((c) => c.may_3d!.dat[2] ?? 0).sort((p, q) => p - q); const tv = z[Math.floor(z.length / 2)]!;
      for (const c of ngang) { const d = (c.may_3d!.dat[2] ?? 0) - tv; if (Math.abs(d) > 4) them(c.id, `chiều cao máy: máy đặt cao ${Math.round((c.may_3d!.dat[2] ?? 0) * 10) / 10} cm, các shot ngang tầm khác trong cảnh ở khoảng ${Math.round(tv * 10) / 10} cm — khán giả đổi tầm nhìn mà không có lý do — đưa máy về cùng tầm`); }
    }
    // bộ ống kính: > 3 tiêu cự trong cảnh → nhắc shot dùng tiêu cự hiếm nhất
    const thuong = co.filter((c) => !VAI_GOC_RIENG.has(c.ky_thuat?.vai ?? '') && !c.may_3d!.qua_truc);
    const dem = new Map<number, number>(); for (const c of thuong) dem.set(c.may_3d!.ong_kinh, (dem.get(c.may_3d!.ong_kinh) ?? 0) + 1);
    if (dem.size > 3) { const it = Math.min(...dem.values()); for (const c of thuong) if (dem.get(c.may_3d!.ong_kinh) === it) them(c.id, `bộ ống kính: cảnh này dùng tới ${dem.size} tiêu cự (${[...dem.keys()].sort((p, q) => p - q).join(' / ')} mm), ngành giữ 2–3 — phối cảnh đổi từng shot, cùng cái bàn lúc sâu lúc dẹt — đổi ${c.may_3d!.ong_kinh} mm của shot này về một tiêu cự đã dùng nhiều`); }
    // CHỮ LỆCH 3D (anh 15/10/2026: "bắt sinh ảnh, video phải tuân thủ tuyệt đối cái gì 3D đặt vào"): chữ của shot (prompt video, hành động, bố cục)
    // gọi tên nhân vật / đạo cụ của shot mà khung 3D không thấy và không đi vào khung → video vẽ thêm (#35: "Tango and Lint hiding behind the card").
    for (const c of co) {
      const chu = [c.prompt_video, c.hanh_dong, c.dan_dung?.bo_cuc].filter(Boolean).join(' ').toLowerCase(); if (!chu || c.ky_thuat?.vai === 'chu_quan') continue;
      const thay = new Set((c.khung_xam?.thay ?? []).filter((t) => t.pt >= PT_THAY).map((t) => t.ten));
      const vao = new Set((c.khung_xam?.di ?? []).filter((d) => d.den.every((x) => x >= 0 && x <= 1)).map((d) => d.ten));
      const lech = [...new Set(c.may_3d!.vi_tri.map((v) => v.ten))].filter((t) => !thay.has(t) && !vao.has(t) && new RegExp(`\\b${t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(chu));
      if (lech.length) them(c.id, `chữ lệch 3D: chữ của shot nhắc ${lech.join(', ')} mà khung 3D không thấy — ảnh / video sẽ vẽ thêm thứ 3D không có — sửa chữ thẻ shot cho khớp 3D, hoặc dời máy cho thấy`);
    }
  }
  return out;
}

// ── CHUỖI CHÚ Ý (anh 15/10/2026: "con T muốn làm gì nó chỉ tay vào cái sạc thì chưa có đoạn dẫn từ mắt nó đến cái sạc") ──────────────────
// Ngành gọi là eyeline match / POV cut: mỗi lần nhân vật TÁC ĐỘNG lên một món đồ (vi_tri.lam) phải đủ ba nhịp NHÌN → THẤY → LÀM. Đo bằng SỐ 3D,
// không dò chữ: trong 2 shot liền trước (cùng phân cảnh) phải có (1) shot nhân vật đó quay mặt về món đồ — hướng mặt lúc kết lệch hướng tới món
// ≤ GOC_NHIN, và (2) shot lấy món đó làm CHỦ THỂ khung (may_3d.khung) — khán giả thấy cái nhân vật thấy. Lần đầu tác động lên món đó trong cảnh
// mới xét; làm tiếp trên cùng món thì không phải dẫn lại.
export const GOC_NHIN = 35;
/** Hướng mặt (độ, cùng quy ước huong: 0 = về −y, 90 = về +x) từ điểm `tu` tới điểm `toi`. */
export const huongToi = (tu: number[], toi: number[]): number => (Math.atan2(toi[0]! - tu[0]!, -(toi[1]! - tu[1]!)) * 180) / Math.PI;
/** Chỗ của một vật CỐ ĐỊNH trong set (khối: tam, cụm: goc) — chỗ để cổng chuỗi chú ý đo hướng nhìn khi món đó không nằm trong chỗ đứng. */
export const choVatSet = (set: Pick<BoSet, 'du_lieu'> | null | undefined) => (ten: string): number[] | null => {
  const v = set?.du_lieu.vat.find((x) => x.ten === ten || x.anchor === ten); if (!v) return null;
  return 'tam' in v && v.tam ? v.tam : 'goc' in v && v.goc ? v.goc : null;
};
// ── HƯỚNG NHÂN VẬT SO VỚI MÁY (15/10/2026 #38 tập 19: 3D thấy LƯNG Tango — hai bạn quay về Mr. Wipe, máy đặt sau lưng — mà prompt không nói hướng,
// model vẽ mặt nhìn thẳng máy theo ảnh mẫu; 3D và keyframe lệch hẳn bố cục). Số 3D → chữ cho prompt + cổng chặn shot phản ứng / cận thấy lưng.
type ViTri = May3d['vi_tri'][number];
/** Nhân vật lệch bao nhiêu độ khỏi hướng nhìn thẳng máy (0 = nhìn máy, 180 = quay lưng) + chữ tả cho model hình. */
export function huongVoiMay(m: Pick<May3d, 'dat' | 'nhin'>, v: ViTri, ket = false): { lech: number; chu: string } | null {
  const h = ket ? v.huong_den ?? v.huong : v.huong; if (h == null) return null;
  const p = ket ? v.den ?? v.tam : v.tam; const lech = gocLech(h, huongToi(p, m.dat));
  const fx = m.nhin[0]! - m.dat[0]!, fy = m.nhin[1]! - m.dat[1]!; const r = Math.sin((h * Math.PI) / 180) * fy + Math.cos((h * Math.PI) / 180) * fx;
  const ben = r >= 0 ? 'screen-right' : 'screen-left';
  const chu = lech <= 35 ? 'facing the camera' : lech <= 70 ? `three-quarter view, turned toward ${ben}` : lech <= 110 ? `in profile, facing ${ben}` : lech <= 150 ? `three-quarter from behind, facing away toward ${ben}` : 'back to the camera (we see the back of the head, not the face)';
  return { lech: Math.round(lech), chu };
}
/** Shot PHẢN ỨNG mà máy không thấy ít nhất 3/4 mặt chủ thể (lệch > 80°) cả lúc mở lẫn lúc kết — cảm xúc nằm trên mặt. Shot hành động thấy lưng là bình thường
 *  (Lint bị hút lên về phía Mr. Wipe, #23), nên không đo. Hai nhân vật quay vào nhau: 'cheat to camera' (xoay cả hai ~30° về máy, như diễn viên thật). */
export function matQuayDi(c: { may_3d?: May3d | null; ky_thuat?: Canh['ky_thuat'] | null }, laNhanVat: (ten: string) => boolean): string[] {
  const m = c.may_3d; const kt = c.ky_thuat; if (!m || !kt || kt.vai === 'chu_quan') return [];
  if (kt.vai !== 'phan_ung') return [];
  return chuThe(m).filter(laNhanVat).flatMap((t) => {
    const v = m.vi_tri.find((x) => x.ten === t && !x.an); if (!v) return [];
    const a = huongVoiMay(m, v), b = huongVoiMay(m, v, true); const ng = 80;   // thấy ít nhất 3/4 mặt
    return a && a.lech > ng && (!b || b.lech > ng) ? [`máy không thấy mặt ${t} (lệch ${a.lech}° khỏi hướng nhìn máy) ở shot phản ứng — đặt máy phía trước mặt ${t}, hoặc xoay nhân vật về máy (cheat to camera)`] : [];
  });
}

// ── NHỊP DẪN của phân cảnh (15/10/2026, anh: "shot 11 đến 15 nhìn có sự dẫn dắt và liền mạch hơn hẳn"): #11–#15 máy nhìn cùng một hướng (90°/90°/90°/85°),
// cảnh 7 nhảy 145° → 136° → −10° → 129° → 52°… — hậu cảnh đổi mỗi cú cắt, người xem phải định vị lại. Mỗi phân cảnh có HƯỚNG MÁY CHỦ (hướng gom được
// nhiều shot nhất trong ±45°); shot thường lệch quá → chặn. Shot qua trục (POV, chèn) được miễn nhưng không đứng liền nhau.
export const NHIP_DAN = 45;
/** Vai kể có GÓC RIÊNG (không tính vào hướng máy chủ): shot thiết lập mở cảnh (#12 trong chuỗi #11–#15 anh khen), người thứ ba rình, góc nhìn nhân vật. */
export const VAI_GOC_RIENG = new Set(['thiet_lap', 'nguoi_thu_ba', 'chu_quan']);
export function nhipDan<T extends { id: number; thu_tu: number; phan_doan?: string; may_3d?: May3d | null; ky_thuat?: { vai?: string } | null }>(ds: T[]): Record<number, string[]> {
  const out: Record<number, string[]> = {}; const hg = (m: May3d) => (Math.atan2(m.nhin[1]! - m.dat[1]!, m.nhin[0]! - m.dat[0]!) * 180) / Math.PI;
  for (const pd of new Set(ds.map((c) => c.phan_doan ?? ''))) {
    const cua = ds.filter((c) => (c.phan_doan ?? '') === pd && c.may_3d).sort((a, b) => a.thu_tu - b.thu_tu);
    const thuong = cua.filter((c) => !c.may_3d!.qua_truc && !VAI_GOC_RIENG.has(c.ky_thuat?.vai ?? '')); if (thuong.length < 3) continue;
    const chu = thuong.map((c) => hg(c.may_3d!)).map((h, _, a) => ({ h, n: a.filter((x) => gocLech(x, h) <= NHIP_DAN).length })).sort((a, b) => b.n - a.n)[0]!.h;
    for (const c of thuong) { const l = gocLech(hg(c.may_3d!), chu); if (l > NHIP_DAN) (out[c.id] ??= []).push(`máy lệch ${Math.round(l)}° khỏi hướng máy chủ của cảnh (${Math.round(chu)}°) — hậu cảnh đổi, mất dẫn dắt: đưa máy về trong ±${NHIP_DAN}°, hoặc khai qua_truc nếu là POV / chèn`); }
    for (let i = 1; i < cua.length; i++) if (cua[i]!.may_3d!.qua_truc && cua[i - 1]!.may_3d!.qua_truc) (out[cua[i]!.id] ??= []).push(`hai shot qua trục liền nhau (#${cua[i - 1]!.thu_tu} → #${cua[i]!.thu_tu}) — người xem mất hướng: chen một shot ở hướng máy chủ, hoặc đưa shot này về hướng chủ`);
  }
  return out;
}

export function chuoiChuY<T extends { id: number; thu_tu: number; phan_doan?: string; may_3d?: May3d | null }>(ds: T[], choVat: (ten: string) => number[] | null): Record<number, string[]> {
  const out: Record<number, string[]> = {}; const daLam = new Set<string>();
  const cho = (m: May3d, ten: string) => { const v = m.vi_tri.find((x) => x.ten === ten); return v ? v.den ?? v.tam : null; };
  ds.forEach((c, i) => {
    const m = c.may_3d; if (!m) return;
    for (const v of m.vi_tri) {
      if (!v.lam) continue;
      const k = `${c.phan_doan ?? ''}|${v.ten}|${v.lam}`; if (daLam.has(k)) continue; daLam.add(k);
      const truoc = ds.slice(Math.max(0, i - 2), i).filter((p) => p.may_3d && (p.phan_doan ?? '') === (c.phan_doan ?? ''));
      const toi = (p: T) => v.lam_o ?? cho(p.may_3d!, v.lam!) ?? cho(m, v.lam!) ?? choVat(v.lam!);
      // Cú nhìn khán giả THẤY được: nhân vật là chủ thể khung của shot đó, hướng mặt lúc mở hoặc lúc kết trỏ về món đồ.
      let lechMin = Infinity; let khuat = false;
      for (const p of truoc) {
        const a = p.may_3d!.vi_tri.find((x) => x.ten === v.ten); const t = toi(p); if (!a || !t) continue;
        const lech = Math.min(...[[a.tam, a.huong], [a.den ?? a.tam, a.huong_den ?? a.huong]].filter((x): x is [number[], number] => x[1] != null).map(([o, h]) => gocLech(h, huongToi(o, t))), Infinity);
        if (lech <= GOC_NHIN && !chuThe(p.may_3d!).includes(v.ten)) { khuat = true; continue; }
        lechMin = Math.min(lechMin, lech);
      }
      const thay = truoc.some((p) => (p.may_3d!.khung ?? []).includes(v.lam!));
      const nhinLoi = lechMin <= GOC_NHIN ? '' : khuat ? `NHÌN (${v.ten} có quay về ${v.lam} nhưng không phải chủ thể khung — khán giả không thấy cú nhìn)`
        : lechMin === Infinity ? `NHÌN (2 shot trước không có ${v.ten} quay mặt về ${v.lam} — khai huong / huong_den)` : `NHÌN (${v.ten} gần nhất vẫn lệch ${Math.round(lechMin)}° khỏi ${v.lam}, cần ≤ ${GOC_NHIN}°)`;
      const thieu = [nhinLoi, !thay && `THẤY (2 shot trước không có khung lấy ${v.lam} làm chủ thể — thêm cận ${v.lam} theo mắt ${v.ten})`].filter(Boolean);
      if (thieu.length) (out[c.id] ??= []).push(`chuỗi chú ý: ${v.ten} tác động ${v.lam} mà thiếu ${thieu.join(' + ')}`);
    }
  });
  return out;
}

/** Lỗi MẠCH của cả tập theo từng bộ set: liền mạch chỗ đứng / đồ đang cầm (lienMachTap) + chuỗi chú ý nhìn → thấy → làm (chuoiChuY).
 *  MỘT chỗ cho cổng keyframe (sinh-anh.ts › lyChanKeyframe) và dấu ⚠ trên lưới (luoi-kich-ban.tsx). ds = shot nhánh dựng theo thứ tự phát. */
export function loiMachTap<T extends ShotMach & { nhan_vat: number[] }>(ds: T[], nhanVat: Pick<NhanVat, 'id' | 'ten' | 'loai' | 'bo_set_id' | 'khoi_3d'>[], sets: Pick<BoSet, 'id' | 'du_lieu'>[]): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const sid of new Set(ds.map((c) => boSetCuaShot(c, nhanVat)).filter((x): x is number => !!x))) {
    const cua = ds.filter((c) => boSetCuaShot(c, nhanVat) === sid);
    const laNv = (t: string) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten === t);
    for (const r of [lienMachTap(cua, (t) => khoiCua(t, nhanVat)), chuoiChuY(cua, choVatSet(sets.find((x) => x.id === sid))), nhipDan(cua), thieuTongThe(cua, laNv), huongDiChuyen(cua, laNv), doiMat(cua, laNv)]) for (const [k, v] of Object.entries(r)) (out[Number(k)] ??= []).push(...v);
  }
  return out;
}

/** Góc ngẩng (độ, + = máy cao nhìn xuống) hợp với từng góc máy khai — rộng tay vì nhân vật tí hon nhìn đồ dưới chân vẫn là "ngang tầm". */
export const GOC_NGANG: Record<string, [number, number]> = { sat_dat: [-90, 15], thap: [-90, 8], ngang: [-20, 35], cao: [15, 75], tren_xuong: [50, 90] };
export const gocNgang = (m: Pick<May3d, 'dat' | 'nhin'>): number => { const dx = m.nhin[0]! - m.dat[0]!, dy = m.nhin[1]! - m.dat[1]!, dz = (m.dat[2] ?? 0) - (m.nhin[2] ?? 0); return Math.round((Math.atan2(dz, Math.hypot(dx, dy)) * 180) / Math.PI); };
export function gocMayLech(m: Pick<May3d, 'dat' | 'nhin'>, goc: string | undefined): string | null {
  const k = goc ? GOC_NGANG[goc] : undefined; if (!k) return null;
  const e = gocNgang(m);
  return e < k[0] || e > k[1] ? `máy 3D ngẩng ${e}° mà thẻ shot khai góc "${goc}" (${k[0]}…${k[1]}°) — keyframe sẽ vẽ theo chữ, bỏ khung 3D: đặt tay máy (dat/nhin) hoặc đổi góc khai` : null;
}

/** TRẠNG THÁI một vật trong shot cho prompt keyframe (MỘT chữ với nhãn Blender — scripts/bo-set/dung-set.py › TRANG): đã chia mảnh, đang cầm
 *  thì chỉ mảnh của người cầm. ket = khung kết (cam + den = đã đặt xuống). null = nguyên vẹn. */
export function trangThaiVat(v: May3d['vi_tri'][number], ket = false): string | null {
  const ds: string[] = [];
  // Sổ trạng thái (script supervisor): nhân vật / vật khai trang (mở) · trang_den (kết) — bẹp, ướt, xù lông, bốc khói… đè lên ảnh mẫu.
  const t = (ket ? v.trang_den ?? v.trang : v.trang)?.trim(); if (t) ds.push(t);
  const n = v.chia ?? 1;
  if (n > 1) { const cam = !!v.cam && !(ket && v.den); ds.push(cam ? `split into ${n} pieces; only ONE piece here (the holder's share)` : `split into ${n} separate pieces lying side by side, NOT a whole one`); }
  return ds.length ? ds.join('; ') : null;
}
/** Tên này là ĐỒ VẬT (đạo cụ / sản phẩm) của phim — đồ thì nằm lại chỗ cuối cùng (mayDayDu); nhân vật thì không. MỘT luật cho dựng 3D và prompt. */
export const laDoVatPhim = (nv: Pick<NhanVat, 'ten' | 'loai'>[]) => (t: string) => nv.some((x) => (x.loai === 'dao_cu' || x.loai === 'san_pham') && x.ten.trim().toLowerCase() === t.trim().toLowerCase());
