// BỘ SET 3D — phần thuần (14/10/2026). Bối cảnh là DỮ LIỆU toạ độ (xv_bo_set), không phải chữ: mọi shot cùng set đứng trên CÙNG một bộ đồ đạc,
// máy ảo của từng shot (xv_canh.may_3d) render ra khung xám + bản đồ độ sâu (scripts/bo-set/dung-set.py, Blender trên box) làm khung xương
// cho keyframe. Ở đây: shot thuộc set nào, mã đầu vào (đổi là phải dựng lại), bảng đầu vào cho Blender, kiểm trục 180° bằng hình học,
// và cổng (chanKhungXam). Tự kiểm: bo-set-3d.test.mts
import type { BienThe, BoSet, Canh, KhoiSet, KhungXam, May3d, NhanVat, PhanCanh, VatThay } from './kieu';
import { laKinh, tenCoMat, vatHien } from './kieu';
import { duongMay, hopVat } from './duong-may';
import { MOCAP_DANG } from './mocap-kho';
import { BAC_CO, canhBaoTap2d, gocLech, loiMachTap2d, type KhongGianTap, type ShotKg } from './khong-gian';

/** Bộ set của shot = bộ set CHUNG của mọi anchor bối cảnh gắn ở shot. null = shot không dựng 3D: không có bối cảnh thuộc set (Trái Đất,
 *  Hà Nội trên cao) hoặc shot đi XUYÊN hai thế giới (bay qua ô cửa sổ vào bàn: một bối cảnh có set, một không) — khung đầu nằm ngoài set. */
export function boSetCuaShot(c: Pick<Canh, 'nhan_vat'>, nhanVat: Pick<NhanVat, 'id' | 'loai' | 'bo_set_id'>[]): number | null {
  const bc = c.nhan_vat.map((id) => nhanVat.find((x) => x.id === id)).filter((v) => v?.loai === 'boi_canh');
  const sets = new Set(bc.map((v) => v!.bo_set_id ?? null));
  return sets.size === 1 ? [...sets][0]! : null;
}

/** Khối đại diện của một tên nhân vật / đạo cụ trong may_3d.vi_tri (khớp tên anchor, không phân biệt hoa thường). */
/** DẤU 3D của một biến thể (vết bẩn / vết thương / hoạ tiết dán lên người — dung-set.py › vet_): khối dẹt bám mặt trước bộ phận `cho`, rộng / cao
 *  theo phần bộ phận, lech = [ngang, cao] (0..1, 0,5 = giữa). MỘT định nghĩa trong biến thể → mọi shot cùng hình dạng, màu, cỡ, vị trí. */
export type Dan3d = { cho: 'nguc' | 'dau'; mau: string; rong: number; cao: number; lech?: [number, number] };
export type BienTheDan = BienThe & { dan_3d?: Dan3d[] | null };
type NvKhoi = Pick<NhanVat, 'ten' | 'khoi_3d'> & { bien_the?: BienTheDan[] };
/** Khối 3D của một anchor + bảng DẤU của các biến thể có dan_3d (khoá = tên biến thể, chữ thường) — dựng 3D tra dấu theo giá trị sổ người; nằm trong
 *  mã khung xám nên đổi dấu là khung tự cũ. */
export const khoiCua = (ten: string, nhanVat: NvKhoi[]) => {
  const v = nhanVat.find((x) => x.ten.trim().toLowerCase() === ten.trim().toLowerCase()); if (!v?.khoi_3d) return null;
  const dan = Object.fromEntries((v.bien_the ?? []).filter((b) => b.dan_3d?.length).map((b) => [b.ten.trim().toLowerCase(), b.dan_3d!]));
  return Object.keys(dan).length ? { ...v.khoi_3d, dan } : v.khoi_3d;
};

/** PHIÊN BẢN CÁCH DỰNG (scripts/bo-set/dung-set.py): nằm trong mã khung xám → đổi script dựng thì mọi khung tự thành cũ và lượt dựng thường
 *  tự làm lại, không phải ép dựng cả tập (--tat-ca). bo-set-3d.test.mts băm dung-set.py: sửa script mà quên tăng số này là test đỏ. */
export const BAN_DUNG = 117;
/** Mã đầu vào của khung xám: cách dựng + set (dữ liệu) + máy + vị trí + khối nhân vật — khác mã là khung xám cũ hết hiệu lực. */
const bam = (x: unknown) => { const s = JSON.stringify(x); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
/** Mã từng PHẦN đầu vào của khung xám — lưu kèm khung (khung_xam.ma_phan) để biết lần sau vì sao phải dựng lại (bộ set / máy / khối / cách dựng). */
/** Phần máy ĐI VÀO HÌNH: bỏ các khai chỉ cổng kể chuyện đọc (lam) — khai thêm "Tango chạm phích" không làm khung đã dựng thành cũ. */
const hinhMay = (m: May3d): May3d => (m.vi_tri.some((v) => v.lam || v.lam_o) ? { ...m, vi_tri: m.vi_tri.map(({ lam: _l, lam_o: _o, ...v }) => v) } : m);
/** NÉT MẶT ở khung mở + khung kết của từng người (bieu_cam[].dau / .cuoi) — mặt MPFB diễn theo (mesh/nguoi.py › BIEU_CAM_ARKIT); đổi nét là khung cũ
 *  hết hiệu lực. Từ BAN_DUNG 82 mọi shot dựng khung KẾT (storyboard đầu → kết) nên nét cuối cũng vào mã. */
export const netMo = (bieu?: { nv: string; dau: string; cuoi?: string }[] | null) => (bieu ?? []).map((b) => [b.nv, b.dau, b.cuoi ?? b.dau]);
/** Cú máy vào mã khung: mọi shot dựng khung KẾT với máy ở cuối đường máy (BAN_DUNG 82) — đổi cú máy là khung kết đổi. Máy đứng yên không vào mã. */
const chayMa = (cd?: string | null) => (cd && cd !== 'tinh' ? cd : null);
export const maPhan = (set: Pick<BoSet, 'id' | 'du_lieu'>, m: May3d, nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[], bieu?: { nv: string; dau: string; cuoi?: string }[] | null, chuyenDong?: string | null, anhSang?: string | null) => ({ ban: String(BAN_DUNG), set: bam([set.id, set.du_lieu.vat]), may: bam(hinhMay(m)), khoi: bam(m.vi_tri.map((v) => khoiCua(v.ten, nhanVat))), ...(bieu?.length ? { net: bam(netMo(bieu)) } : {}), ...(chayMa(chuyenDong) ? { chay: chayMa(chuyenDong)! } : {}), ...(anhSang ? { den: anhSang } : {}) });
/** anhSang: khoá ánh sáng của thẻ shot — bộ đèn khung màu đổi theo (dung-set.py › DEN_KIEU) nên đổi ánh sáng = khung cũ. Không khai thì không vào băm. */
export function maKhungXam(set: Pick<BoSet, 'id' | 'du_lieu'>, m: May3d, nhanVat: NvKhoi[], bieu?: { nv: string; dau: string; cuoi?: string }[] | null, chuyenDong?: string | null, anhSang?: string | null): string {
  const s = JSON.stringify([BAN_DUNG, set.id, set.du_lieu.vat, hinhMay(m), m.vi_tri.map((v) => khoiCua(v.ten, nhanVat)), ...(bieu?.length ? [netMo(bieu)] : []), ...(chayMa(chuyenDong) ? [chayMa(chuyenDong)] : []), ...(anhSang ? [`den:${anhSang}`] : [])]);
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Bảng đầu vào cho dung-set.py: vật của set + khối nhân vật + các shot (ma = id shot). Thiếu khối của một tên → lỗi (không đoán cỡ). */
export function bangDung(set: Pick<BoSet, 'du_lieu'>, shots: ({ id: number; thu_tu: number; may_3d: May3d; truc?: ReturnType<typeof rangBuocTruc>; /** máy đã khớp keyframe đã sinh — bộ giải không dời */ khoa_may?: boolean } & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung' | 'ky_thuat' | 'thoai' | 'bieu_cam'>>)[], nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]): { ok: true; bang: unknown } | { ok: false; loi: string } {
  const mau: Record<string, unknown> = {}; const thieu = new Set<string>();
  for (const s of shots) for (const v of s.may_3d.vi_tri) { const k = khoiCua(v.ten, nhanVat); if (k) mau[v.ten] = k; else thieu.add(v.ten); }
  if (thieu.size) return { ok: false, loi: `chưa khai khối 3D cho: ${[...thieu].join(', ')} — ghi khoi_3d (hình + cỡ cm) cho anchor đó` };
  return { ok: true, bang: { vat: set.du_lieu.vat, nhan_vat_mau: mau, shot: shots.map((s) => ({ ma: String(s.id), so: s.thu_tu, may: { dat: s.may_3d.dat, nhin: s.may_3d.nhin, ong_kinh: s.may_3d.ong_kinh, chay: duongMay(s.may_3d, s.ky_thuat?.chuyen_dong, hopVat(set.du_lieu.vat, s.may_3d.them ?? []), (t) => Number((mau[t] as { co?: number[] } | undefined)?.co?.[2] ?? 2)) }, nhan_vat: s.may_3d.vi_tri,
    bat_buoc: chuThe(s.may_3d), co_canh: s.ky_thuat?.co_canh ?? '', mat: nguoiNoiTrongKhung(s), mat_nguong: ['ws', 'ews', 'two'].includes(s.ky_thuat?.co_canh ?? '') ? 100 : 80, giai: !!s.may_3d.tu_dong && !s.khoa_may, nhac: vatDuocNhac(s, set), truc: s.truc ?? null, them: s.may_3d.them ?? [], den_ban: !!s.may_3d.den_ban, net: Object.fromEntries((s.bieu_cam ?? []).map((b) => [b.nv, [b.dau, b.cuoi]])),
    // ÁNH SÁNG THEO KỊCH BẢN (anh 19/10/2026): khoá anh_sang của thẻ shot (dien-anh.ts › nhóm anh_sang) → bộ đèn khung màu (dung-set.py › DEN_KIEU).
    anh_sang: s.ky_thuat?.anh_sang ?? '',
    // MẮT NHÌN NGƯỜI ĐƯỢC NHÌN: toạ độ mắt (cm) của đích lúc mở / kết — Blender xoay mắt bằng khoá eyeLook* (mesh/nguoi.py › mat_nhin).
    nhin_mat: Object.fromEntries(['mo', 'ket'].map((k) => [k, Object.fromEntries(s.may_3d.vi_tri.filter((v) => (mau[v.ten] as KhoiSet | undefined)?.hinh === 'nguoi' && !v.cam).flatMap((v) => {
      const nguoi = s.may_3d.vi_tri.filter((x) => (mau[x.ten] as KhoiSet | undefined)?.hinh === 'nguoi' && !x.cam);
      const d = dichNhin(v, nguoi, k === 'ket'); if (!d) return [];
      const cao = Number((mau[d.ten] as KhoiSet | undefined)?.co?.[2] ?? 170); return [[v.ten, [d.q[0]!, d.q[1]!, (d.q[2] ?? 0) + cao * 0.93]]];
    }))])) })) } };
}

/** NGƯỜI ĐANG NÓI là chủ thể trong khung (không phải giọng ngoài khung) — keyframe AI = khung mở phải thấy mặt họ: luật kiem-ai-3d.ts › matNguoiNoi và
 *  bộ giải máy trong Blender (dung-set.py › mat_sai) dùng CÙNG danh sách + ngưỡng (17/10/2026 #6: bộ giải dời máy ra sau lưng Thần đang nói). */
export const nguoiNoiTrongKhung = (c: { may_3d?: May3d | null } & Partial<Pick<Canh, 'thoai'>>): string[] => {
  const noi = new Set((c.thoai ?? []).filter((d) => d.loi?.trim()).map((d) => d.nhan_vat.trim().toLowerCase()));
  return c.may_3d ? chuThe(c.may_3d).filter((t) => noi.has(t.trim().toLowerCase()) && !c.may_3d!.vi_tri.find((v) => v.ten === t)?.an) : [];
};

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

/** ĐỐI ĐÁP CÙNG PHÍA TRỤC (shot – ngược shot): hai shot cùng có ≥ 2 nhân vật chung và máy ở CÙNG phía trục nối họ — ngữ pháp chuẩn khi hai
 *  người nói chuyện: máy quay từ sau vai người này sang sau vai người kia, hướng nhìn đổi 120–180° mà hướng trên màn giữ nguyên. Luật nối hướng
 *  máy (> 100°) không áp cho cặp này (tập 122, 17/10/2026: 7 cặp đối đáp bị chặn như "cắt sang nơi khác"). */
export function doiDapCungPhia(truoc: May3d, sau: May3d, laNhanVat: (ten: string) => boolean = () => true): boolean {
  const chung = sau.vi_tri.map((v) => v.ten).filter((t) => laNhanVat(t) && truoc.vi_tri.some((v) => v.ten === t));
  if (chung.length < 2) return false;
  const p1 = phia(truoc, chung[0]!, chung[1]!); const p2 = phia(sau, chung[0]!, chung[1]!);
  return !!p1 && p1 === p2;
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
/** Vật che KHÔNG tính là che: đồ do chính chủ thể cầm, hoặc do người đang cầm / đeo chủ thể cầm (Hạ ôm thùng che ngực Hạ và thẻ Hạ đeo — #132 #16 cận giật thẻ;
 *  cùng luật thayRo bên dưới). */
const cheThat = (c: Pick<Canh, 'may_3d'>, chu: string, o: string) => { const vt = (t: string) => c.may_3d?.vi_tri.find((v) => v.ten === t); const cam = vt(o)?.cam; return !cam || (cam !== chu && cam !== vt(chu)?.cam); };
export const loiHinhHoc = (c: Pick<Canh, 'may_3d' | 'khung_xam'>) => { const ct = c.may_3d ? chuThe(c.may_3d) : []; return (c.khung_xam?.kiem ?? []).filter((k) => (k.bat_buoc ?? ct.includes(k.nhan_vat)) && (!k.trong_khung || k.bi_che_boi.some((o) => cheThat(c, k.nhan_vat, o)))); };

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
    // VẬT MẢNH / RỖNG (vòng tay, chuỗi hạt, dây): phủ ít điểm ảnh mà trải rộng giữa khung là đọc rõ — tập 122 #22 chuỗi hạt 1,8% điểm ảnh, trải 30% bề ngang
    const h = t?.hop; const giua = !!h && h[0]! > 0.01 && h[1]! > 0.01 && h[2]! < 0.99 && h[3]! < 0.99; const trai = h ? Math.max(h[2]! - h[0]!, h[3]! - h[1]!) : 0;
    return t && t.pt < 5 && !(giua && trai >= 0.2) ? [`${k.nhan_vat} (chủ thể) chỉ chiếm ${Math.round(t.pt * 10) / 10}% khung ở cỡ ${c.ky_thuat?.co_canh ?? '?'} — dời máy cho nó nằm rõ trong khung (không bị nhân vật che, không ở quá xa)`] : [];
  });
};
/** CỠ CẢNH KHỚP 3D (15/10/2026, tờ toàn cảnh tập 19): thẻ khai cỡ trung (ms / two / mcu) mà nhân vật chính trong khung 3D chỉ cao 9–15% khung
 *  (#8 two 10,7%, #13 ms 11%, #14 ms 9,4%) — thực chất là toàn cảnh; keyframe sinh theo chữ "medium shot" vẽ to gấp ba 3D (3D ↔ frame lệch bố cục).
 *  Đo NHÂN VẬT CHÍNH (cao nhất trong số nhân vật chủ thể): nhân vật phụ đứng xa hơn là dàn cảnh theo chiều sâu, không phải lỗi. Sàn theo khung dọc,
 *  nhân vật nặn cao ~2–3 cm: ms ≥ 20%, two ≥ 15%, mcu ≥ 30%. Không đạt → kéo máy lại (giữ hướng máy) hoặc khai cỡ cảnh đúng cái 3D cho thấy. */
export const SAN_CO: Record<string, number> = { ms: 20, two: 15, mcu: 30 };
/** Toàn cảnh PHIM NGƯỜI THẬT: nhân vật chính ≥ 10% chiều cao khung (tập 122 #15: hai người 2% trong phòng trống — AI vẽ phòng rỗng, người như chấm).
 *  Hoạt hình không xét: nhân vật đồ chơi tí hon trong toàn cảnh macro nhỏ là đúng ý. */
export const SAN_WS_NGUOI = 10;
export const coCanhLech = (c: Pick<Canh, 'khung_xam'> & Partial<Pick<Canh, 'ky_thuat'>>, laNhanVat: (ten: string) => boolean, laNguoi: (ten: string) => boolean = () => false): string[] => {
  const co = c.ky_thuat?.co_canh ?? ''; const san = SAN_CO[co] ?? (co === 'ws' && (c.khung_xam?.kiem ?? []).some((k) => k.bat_buoc && laNguoi(k.nhan_vat)) ? SAN_WS_NGUOI : 0); if (!san) return [];
  const nv = (c.khung_xam?.kiem ?? []).filter((k) => k.bat_buoc && k.trong_khung && laNhanVat(k.nhan_vat));
  if (!nv.length) return [];
  const chinh = nv.reduce((a, b) => (b.cao_khung_pt > a.cao_khung_pt ? b : a));
  return chinh.cao_khung_pt < san ? [`cỡ cảnh: thẻ khai ${co} mà ${chinh.nhan_vat} (nhân vật chính) chỉ cao ${chinh.cao_khung_pt}% khung 3D (cần ≥ ${san}%) — keyframe sẽ vẽ to hơn 3D — kéo máy lại gần (giữ hướng), hoặc khai cỡ cảnh rộng hơn cho đúng 3D`] : [];
};
/** laNguoi: NGƯỜI THẬT (ma-nơ-canh khoi_3d.hinh 'nguoi') không xét — cỡ cảnh người cắt theo dải thân (BANG_NGUOI: ots / ms / two là ngực / thắt lưng
 *  trở lên), chiếm > 70% chiều cao khung là đúng ý (tập 122: 5 shot qua vai / trung cảnh bị chặn oan khi đo cả người). */
export const chuTheQuaTo = (c: Pick<Canh, 'khung_xam'> & Partial<Pick<Canh, 'ky_thuat'>>, set?: Pick<BoSet, 'du_lieu'> | null, laNguoi: (ten: string) => boolean = () => false): string[] => ['cu', 'ecu', 'insert', 'mcu'].includes(c.ky_thuat?.co_canh ?? '') ? [] : (c.khung_xam?.kiem ?? []).filter((k) => k.bat_buoc && k.cao_khung_pt > 70 && !vatDet(set).has(k.nhan_vat) && !laNguoi(k.nhan_vat)).map((k) => `${k.nhan_vat} cao ${k.cao_khung_pt}% khung ở cỡ ${c.ky_thuat?.co_canh ?? '?'} — máy dí sát: lùi máy / đặt tay`);

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
  const co = new Set([...tenCoMat(set.du_lieu.vat, them), ...(c.may_3d?.vi_tri ?? []).map((v) => v.ten.trim().toLowerCase())]);
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
export const khoiLapKhung = (c: Pick<Canh, 'khung_xam'>, set: Pick<BoSet, 'du_lieu'> | null) => { const nen = new Set((set?.du_lieu.vat ?? []).filter((v) => v.nen || laKinh(v)).map((v) => v.ten)); return (c.khung_xam?.thay ?? []).filter((t) => t.pt >= 85 && !nen.has(t.ten) && !laKinh(t)); };

/** VẬT ĐƯỢC NHẮC MÀ KHÔNG THẤY: chữ tả khung (bố cục / mở / kết / prompt ảnh) nhắc một vật của set mà khung 3D không thấy nó (< 1% khung) — thử
 *  7.3 tập 19: bố cục "ấn tay lên đế cắm sát phích" mà máy đứng sau lưng Tango, đế cắm không có trong khung → keyframe vẽ một cảnh khác. */
export const nhacMaKhongThay = (c: Pick<Canh, 'khung_xam' | 'may_3d'> & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>, set: Pick<BoSet, 'du_lieu'>): string[] => {
  const thay = new Set((c.khung_xam?.thay ?? []).filter((t) => t.pt >= 1).map((t) => t.ten)); const hien = new Set(vatHien(set.du_lieu.vat, c.may_3d?.them).map((v) => v.ten));
  return vatDuocNhac(c, set).filter((t) => !thay.has(t) && !set.du_lieu.vat.find((v) => v.ten === t && (v.nen || !hien.has(t))));
};

/** Vật của set mà chữ tả khung có nhắc (cố ý có trong khung) — bộ giải máy trong Blender không né những vật này. */
export const vatDuocNhac = (c: Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>, set: Pick<BoSet, 'du_lieu'>): string[] => { const chu = chuKhung(c); return set.du_lieu.vat.map((v) => v.ten).filter((t) => tenGoi(t, set).some((g) => nhac(g, chu))); };

/** VẬT CHẮN TIỀN CẢNH: vật của set nằm GIỮA máy và chủ thể, chiếm ≥ 12% khung, mà chữ tả khung không hề nhắc — máy đặt sau / xuyên đồ đạc,
 *  khung xám ra một mảng khối vô nghĩa (anh 14/10/2026: "cảnh 6 và 7 tay khổng lồ ở vị trí lung tung" — thật ra là lưng iMac vàng chắn máy).
 *  Mặt nền (nen: mặt bàn, tường, kệ) không tính. Dữ liệu từ khung_xam.thay (dung-set.py › nhin_thay). */
export function vatChanTienCanh(c: Pick<Canh, 'may_3d' | 'khung_xam'> & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung'>>, set: Pick<BoSet, 'du_lieu'> | null, nhanVat: { ten: string; mo_ta?: string }[] = []): VatThay[] {
  const ct = c.may_3d ? chuThe(c.may_3d) : []; const chu = chuKhung(c);
  const nen = new Set((set?.du_lieu.vat ?? []).filter((v) => v.nen || laKinh(v)).map((v) => v.ten));   // kính: nhìn xuyên, không phải vật chắn
  // TÊN TIẾNG ANH của đạo cụ (danh từ chính trong vế đầu mô tả: "Plain brown cardboard office box" → box): tên đồ tiếng Việt không khớp chữ bố cục tiếng
  // Anh — "Thùng đồ cá nhân" với "box edge in foreground" bị báo vật chắn không được nhắc (#11)
  const tenEn = (t: string) => { const m = nhanVat.find((v) => v.ten === t)?.mo_ta; if (!m) return []; const dau = (m.split(/,|:| with | on | in /)[0] ?? '').trim().split(/\s+/); return [dau[dau.length - 1] ?? ''].filter((x) => x.length >= 3); };
  // TÊN GỌI TẮT của nhân vật (19/10/2026 #3: bố cục "Over Hạ’s shoulder… foreground" mà cổng báo Lâm Hạ chắn tiền cảnh không được nhắc — tên đầy đủ
  // không có trong chữ, còn "Hạ" dưới 3 ký tự bị nhac bỏ qua): tên ≥ 2 chữ thì chữ cuối (tên gọi) cũng tính, cho phép 2 ký tự.
  const goiTat = (t: string) => { const w = t.trim().split(/\s+/); return w.length >= 2 && nhanVat.some((v) => v.ten === t) ? [w[w.length - 1]!] : []; };
  const nhacTat = (g: string) => new RegExp(`(^|[^\\p{L}])${g.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(chu);
  return (c.khung_xam?.thay ?? []).filter((t) => t.tien && t.pt >= 12 && !nen.has(t.ten) && !laKinh(t) && !ct.includes(t.ten) && ![...(set ? tenGoi(t.ten, set) : [t.ten]), ...tenEn(t.ten)].some((g) => nhac(g, chu)) && !goiTat(t.ten).some(nhacTat));
}

/** MÁY TRONG THÂN NGƯỜI (19/10/2026, tổng tài 2.0c: góc nhìn đặt máy ở mắt Thần, Thần khai 'an' — thân 3D vẫn dựng, khung trắng kín, mất một lượt GPU):
 *  máy cách trục thân (chỗ mở hoặc chỗ kết) < 30 cm ngang và thấp hơn đỉnh đầu → chặn trước khi dựng. Góc nhìn (POV) thì bỏ người đó khỏi chỗ đứng. */
export function mayTrongNguoi(m: Pick<May3d, 'dat' | 'vi_tri' | 'tu_dong'>, khoiNguoi: (ten: string) => { co?: number[] } | null): string[] {
  const out: string[] = [];
  if (m.tu_dong) return out;   // máy tự đặt: bộ giải Blender (giai_may) tự dời khi chủ thể bị che — chỉ chặn máy ĐẶT TAY
  for (const v of m.vi_tri) {
    const k = v.cam ? null : khoiNguoi(v.ten); if (!k) continue;
    const co = k.co ?? [50, 30, 175]; const r = Math.max(co[0]!, co[1]!) / 2;
    const d = Math.min(...[v.tam, ...(v.den ? [v.den] : [])].map((p) => Math.hypot(m.dat[0]! - p[0]!, m.dat[1]! - p[1]!)));
    if (d < r && (m.dat[2] ?? 0) < co[2]! + 5) out.push(`máy đặt TRONG thân ${v.ten} (cách trục thân ${Math.round(d)} cm, thân rộng ${Math.round(r)} cm) — thân 3D vẫn dựng dù khai 'an', lấp kín khung: góc nhìn thì bỏ ${v.ten} khỏi chỗ đứng, còn lại lùi máy ra ngoài thân`);
  }
  return out;
}

/** NỐI MÁY giữa shot này và shot so trục (shotSoTruc) — mặt chủ thể thấy được ở shot phản ứng, hướng nhìn không quay > 100° (trừ đối đáp cùng
 *  phía trục), không vượt trục 180°. CHỈ cần toạ độ máy, không cần khung xám đã dựng → cổng keyframe (chanKhungXam) và bộ chấm tại chỗ trước khi
 *  thuê máy dựng (scripts/du-lieu/tong-tai/kiem.mts) gọi CÙNG hàm này (17/10/2026: phải dựng 3 lượt GPU mới lộ hết lỗi nối máy). */
export function loiNoiMay(c: Pick<Canh, 'may_3d'> & Partial<Pick<Canh, 'ky_thuat' | 'phan_doan'>>, nhanVat: Pick<NhanVat, 'id' | 'ten' | 'loai' | 'bo_set_id'>[], set: Pick<BoSet, 'id'>, truoc?: Pick<Canh, 'nhan_vat' | 'may_3d'> & Partial<Pick<Canh, 'phan_doan'>> | null): string[] {
  const out: string[] = [];
  if (!c.may_3d) return out;
  out.push(...matQuayDi(c, (t) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten === t)));
  if (c.may_3d.dat) out.push(...mayTrongNguoi(c.may_3d, (t) => { const k = (nhanVat as { ten: string; khoi_3d?: KhoiSet | null }[]).find((x) => x.ten === t)?.khoi_3d; return k?.hinh === 'nguoi' ? { co: k.co } : null; }));
  // NỐI HƯỚNG MÁY: hai shot liền nhau CÙNG cảnh mà hướng nhìn của máy lệch > 100° → hậu cảnh + cỡ đổi hẳn, cắt như sang nơi khác (5.4 → 5.5
  // tập 19: một máy nhìn về iMac từ góc sau, một máy nhìn rừng cáp từ bên trái). Cố ý (POV, lật trục) thì khai qua_truc.
  if (!c.may_3d.qua_truc && truoc?.may_3d && c.phan_doan && truoc.phan_doan === c.phan_doan && boSetCuaShot(truoc, nhanVat) === set.id) {
    const h = (m: May3d) => Math.atan2(m.nhin[1]! - m.dat[1]!, m.nhin[0]! - m.dat[0]!);
    const lech = Math.abs(((((h(c.may_3d) - h(truoc.may_3d)) * 180) / Math.PI + 540) % 360) - 180);
    if (lech > 100 && !doiDapCungPhia(truoc.may_3d, c.may_3d, (t) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten.trim().toLowerCase() === t.trim().toLowerCase()))) out.push(`máy đổi hướng nhìn ${Math.round(lech)}° so với shot trước cùng cảnh — hậu cảnh đổi hẳn, cắt như sang nơi khác: đặt máy gần hướng shot trước, hoặc khai qua_truc nếu cố ý`);
  }
  if (!c.may_3d.qua_truc && truoc?.may_3d && boSetCuaShot(truoc, nhanVat) === set.id) { const v = vuotTruc(truoc.may_3d, c.may_3d, (t) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten.trim().toLowerCase() === t.trim().toLowerCase())); if (v) out.push(v); }
  return out;
}

/** Cổng khung xám của một shot (rỗng = qua). Shot không thuộc set nào → không chặn (ngoại lệ đã khai: không có anchor bối cảnh có set). */
export function chanKhungXam(c: Pick<Canh, 'nhan_vat' | 'may_3d' | 'khung_xam'> & Partial<Pick<Canh, 'prompt_anh' | 'dan_dung' | 'ky_thuat' | 'phan_doan' | 'bieu_cam'>>, nhanVat: Pick<NhanVat, 'id' | 'ten' | 'loai' | 'bo_set_id' | 'khoi_3d'>[], set: Pick<BoSet, 'id' | 'du_lieu'> | null, truoc?: Pick<Canh, 'nhan_vat' | 'may_3d'> & Partial<Pick<Canh, 'phan_doan'>> | null): string[] {
  if (!set) return [];
  if (!c.may_3d) return ['shot thuộc bộ set 3D mà chưa đặt máy ảo + vị trí nhân vật (may_3d)'];
  const out: string[] = [];
  const thieu = thieuTrongSet(c, nhanVat, set);
  if (thieu.length) out.push(`bộ set / chỗ đứng chưa có: ${thieu.join(', ')} — thêm vào bộ set (đồ cố định) hoặc vào chỗ đứng của shot`);
  const kx = c.khung_xam;
  if (!kx || kx.ma !== maKhungXam(set, c.may_3d, nhanVat, c.bieu_cam, c.ky_thuat?.chuyen_dong, c.ky_thuat?.anh_sang)) out.push('chưa dựng khung xám (hoặc set / máy / vị trí đã đổi sau lần dựng) — chạy 🧊 Dựng khung xám');
  else if (!kx.thay) out.push('khung xám đời cũ chưa đo "thấy gì trong khung" — chạy 🧊 Dựng khung xám lại');
  else {
    // XUYÊN NHAU (dung-set.py › do_lun): đạo cụ lún vào người / đạo cụ khác / đồ set > 1 cm — keyframe AI vẽ đúng cái sai đó (#11 thẻ chìm vào thùng)
    for (const x of kx.xuyen ?? []) out.push(`${x} — dời món / đổi dáng cho hết xuyên`);
    for (const k of loiHinhHoc(c)) out.push(!k.trong_khung ? `${k.nhan_vat} (chủ thể) nằm ngoài khung` : `${k.nhan_vat} (chủ thể) bị ${k.bi_che_boi.filter((o) => cheThat(c, k.nhan_vat, o)).join(', ')} che`);
    out.push(...chuTheQuaTo(c, set, (t) => nhanVat.some((x) => x.ten === t && x.khoi_3d?.hinh === 'nguoi')));
    out.push(...chuTheQuaNho(c));
    out.push(...coCanhLech(c, (t) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten === t), (t) => nhanVat.some((x) => x.ten === t && x.khoi_3d?.hinh === 'nguoi')));
    // 'Bố cục nhắc mà khung không thấy' (dò tên trong chữ) KHÔNG chặn nữa — báo nhầm (chữ 'cable' khớp mọi sợi cáp); bộ giải máy vẫn dùng nó làm
    // gợi ý. Vật BẮT BUỘC thấy khai thẳng ở may_3d.khung (đồ của set cũng được) → kiểm như chủ thể (anh 15/10/2026: 3D là nguồn, không dò chữ).
    for (const t of khoiLapKhung(c, set)) out.push(`${t.ten} lấp ${t.pt}% khung — máy dí sát hoặc lọt trong vật: lùi máy / đổi cỡ cảnh`);
    for (const v of vatChanTienCanh(c, set, nhanVat as { ten: string; mo_ta?: string }[])) out.push(`${v.ten} chắn tiền cảnh ${v.pt}% khung mà bố cục không nhắc — máy đang đặt sau đồ đạc: dời máy (phía / dat) hoặc ghi nó vào bố cục nếu cố ý`);
  }
  // GÓC MÁY 3D phải khớp góc máy khai ở thẻ shot (15/10/2026: 7.1a khai ngang tầm mà bộ giải đẩy máy lên cao 59° — keyframe bỏ qua khung 3D,
  // vẽ ngang tầm theo chữ, mất luôn cú quay đầu). Lệch → đặt tay máy hoặc đổi góc khai cho đúng điều muốn quay.
  { const g = gocMayLech(c.may_3d, c.ky_thuat?.goc); if (g) out.push(g); }
  out.push(...loiNoiMay(c, nhanVat, set, truoc));
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
export const BAN_MAY = 8;   // 7: món người thật đang cầm nhắm chỗ tay · 8: góc thấp người thật ngửa ~15°, bỏ hạ 0,3 thân
//   // 6: người đi trong shot không cho tràn mép · 5: bề ngang đo vuông góc hướng máy
//   // 3–4 (17/10/2026): người thật khung theo dải cơ thể từ đỉnh đầu (BANG_NGUOI), thêm OTS / two / insert
export type DatMay = { vi_tri: May3d['vi_tri']; phia?: number; khung?: string[]; nhay?: string };
/** CỠ CẢNH NGƯỜI THẬT (anh 17/10/2026, previs tổng tài: shot "cận" ra toàn thân): PHAN_KHUNG viết cho nhân vật Tango tí hon (cận = ôm cả khối,
 *  nhắm giữa người). Người (khối 'nguoi', đứng) thì cận / trung cận / trung cảnh là một DẢI cơ thể tính từ đỉnh đầu — chuẩn ngành: CU đầu + vai,
 *  MCU từ ngực, MS từ thắt lưng — dải đó lấp ~90% khung dọc, máy nhắm giữa dải. Cảnh rộng / two / OTS vẫn ôm cả người. */
export const BANG_NGUOI: Record<string, number> = { ecu: 0.08, cu: 0.2, mcu: 0.33, insert: 0.33, ots: 0.4, ms: 0.55, two: 0.6 };   // OTS: ngực trở lên + vai tiền cảnh; two-shot: thắt lưng trở lên; insert vào thân người: vùng ngực
export const TAM_MAT_CM = 150;
export function datMayTuDong(o: DatMay, kt: { co_canh?: string; goc?: string; ong_kinh?: string; chuyen_dong?: string }, khoi: (ten: string) => { co: number[]; hinh?: string } | null): May3d {
  const ong = ONG_MM[kt.ong_kinh ?? ''] ?? ONG_THEO_CO[kt.co_canh ?? ''] ?? 35;
  const ten = o.khung?.length ? o.khung : o.vi_tri.filter((v) => !v.an).slice(0, 2).map((v) => v.ten);
  const chu = o.vi_tri.filter((v) => ten.includes(v.ten));
  // Khung ôm cả chỗ mở lẫn chỗ kết của chủ thể (shot có di chuyển: chủ thể không chạy ra khỏi khung giữa chừng).
  // Món đang CẦM bởi người thật (rig ma-nơ-canh — dung-set.py › gan_tay đặt món vào bàn tay): khung nhắm chỗ TAY ước tính (trước ngực người cầm
  // 35 cm, cao 0,6 thân), không nhắm toạ độ khai của món (#9 tổng tài: máy cận điện thoại nằm trong người Hạ).
  const choCam = (v: DatMay['vi_tri'][number], p: number[]): number[] => {
    const ng = v.cam ? o.vi_tri.find((x) => x.ten === v.cam) : undefined; const kh = ng ? khoi(ng.ten) : null;
    if (!ng || kh?.hinh !== 'nguoi') return p;
    const a = (((p === v.den ? ng.huong_den ?? ng.huong : ng.huong) ?? 0) * Math.PI) / 180; const q = p === v.den && ng.den ? ng.den : ng.tam;
    return [q[0]! + 35 * Math.sin(a), q[1]! - 35 * Math.cos(a), (q[2] ?? 0) + 0.6 * (kh.co[2] ?? 170)];
  };
  // Máy ĐI THEO người (dẫn trước / bám theo / trượt ngang): khung mở chỉ ôm chỗ ĐẦU shot — máy đi cùng, không cần lùi xa ôm cả quãng đi (tập 122 #15:
  // ôm cả lối vào cửa → hai người 0,5% khung).
  const theoNguoi = ['dan_truoc', 'theo', 'truot_ngang'].includes(kt.chuyen_dong ?? '');
  const ds = (chu.length ? chu : o.vi_tri).flatMap((v) => { const c = khoi(v.ten)?.co ?? [2, 2, 2]; const h = v.nam ? c[1]! : c[2]!; return [v.tam, ...(v.den && !theoNguoi ? [v.den] : [])].map((p0) => { const p = choCam(v, p0); return { x: p[0]!, y: p[1]!, z: p[2] ?? 0, h, w: c[0]! }; }); });
  const cx = ds.reduce((a, d) => a + d.x, 0) / ds.length, cy = ds.reduce((a, d) => a + d.y, 0) / ds.length;
  const H = Math.max(...ds.map((d) => d.z + d.h)) - Math.min(...ds.map((d) => d.z));
  // Bề NGANG đo VUÔNG GÓC hướng máy (trước 17/10/2026 luôn đo theo trục x của phòng: máy nhìn dọc trục x thì hai người đứng đối mặt theo y
  // bị tính "rộng 40 cm" → máy dí sát, two-shot trống trơn). Phía a: máy ở tâm + (sin a, −cos a) → trục ngang khung = (cos a, sin a).
  const a0 = ((o.phia ?? 0) * Math.PI) / 180; const ngangCua = (d: { x: number; y: number }) => d.x * Math.cos(a0) + d.y * Math.sin(a0);
  const W = Math.max(...ds.map((d) => ngangCua(d) + d.w / 2)) - Math.min(...ds.map((d) => ngangCua(d) - d.w / 2));
  let cz = Math.min(...ds.map((d) => d.z)) + H * 0.5;
  const tanV = 18 / ong, tanH = (18 * 9 / 16) / ong;   // nửa khung dọc / ngang trên tiêu cự
  let f = PHAN_KHUNG[kt.co_canh ?? ''] ?? 0.4;
  const bang = BANG_NGUOI[kt.co_canh ?? ''];
  const laNguoi = !!bang && chu.length > 0 && chu.every((v) => khoi(v.ten)?.hinh === 'nguoi' && !v.nam);
  let hKhung = H, wKhung = W;
  if (laNguoi) {
    const dinh = Math.max(...ds.map((d) => d.z + d.h)); hKhung = (dinh - Math.min(...ds.map((d) => d.z))) * bang;
    cz = dinh - hKhung * 0.5; f = 0.9;
    // một người ĐỨNG YÊN cận: vai được tràn mép ngang; đang đi trong shot thì khung phải ôm trọn quãng đi (#19 tổng tài: Thần đi ra khỏi khung)
    if (chu.length === 1 && !chu.some((v) => v.den && Math.hypot(v.den[0]! - v.tam[0]!, v.den[1]! - v.tam[1]!) > 20)) wKhung = W * 0.5;
  }
  // Máy luôn đứng NGOÀI khối chủ thể: tối thiểu một cỡ chủ thể + 1 cm tính từ tâm.
  const d = Math.max(Math.max(laNguoi ? hKhung : H, W) + 1, hKhung / (f * 2 * tanV), wKhung / (0.85 * 2 * tanH));
  const a = ((o.phia ?? 0) * Math.PI) / 180;
  const ngoc = { sat_dat: -1, thap: -12, ngang: 0, cao: 35, tren_xuong: 85, nghieng: 0, selfie: 0 }[kt.goc ?? 'ngang'] ?? 0;
  const e = (ngoc * Math.PI) / 180;
  const ngang = d * Math.cos(Math.abs(e));
  // Người thật đứng + góc NGANG TẦM: máy ở TẦM MẮT chuẩn (150 cm) cho mọi shot — không ở giữa thân (84 cm ở cảnh rộng) và không đổi theo
  // chiều cao từng diễn viên; cổng "chiều cao máy" đòi các shot ngang tầm trong cảnh cùng một tầm (±4 cm).
  const tamMat = (kt.goc ?? 'ngang') === 'ngang' && chu.length > 0 && chu.every((v) => khoi(v.ten)?.hinh === 'nguoi' && !v.nam);
  // Góc thấp cho NGƯỜI THẬT: máy không xuống dưới ~0,35 thân (đầu gối–hông) — cảnh rộng đi xa thì công thức cũ hạ máy xuống 0,4 cm (sát thảm, cỡ đồ chơi).
  const sanNguoi = chu.length && chu.every((v) => khoi(v.ten)?.hinh === 'nguoi') ? 0.35 * Math.max(...chu.map((v) => khoi(v.ten)?.co[2] ?? 170)) : 0.4;
  // Góc thấp NGƯỜI THẬT = máy dưới tầm mắt ngửa ~15° lên tâm khung (chuẩn ngành), KHÔNG hạ thêm 0,3 thân: hạ cố định đó đúng ở cảnh rộng nhưng ở
  // cận trung đẩy máy xuống sát gối (tập 122 #20: máy 58 cm ngửa gắt → khung thấy trần, FLUX vẽ thành sảnh).
  const e2 = laNguoi && kt.goc === 'thap' ? (-15 * Math.PI) / 180 : e;
  const z = kt.goc === 'sat_dat' ? 0.5 : tamMat ? TAM_MAT_CM : Math.max(sanNguoi, cz + d * Math.sin(e2) + (kt.goc === 'thap' && !laNguoi ? -H * 0.3 : 0));
  const r = (x: number) => Math.round(x * 10) / 10;
  return { dat: [r(cx + ngang * Math.sin(a)), r(cy - ngang * Math.cos(a)), r(z)], nhin: [r(cx), r(cy), r(cz)], ong_kinh: ong, vi_tri: o.vi_tri, ...(o.khung?.length ? { khung: o.khung } : {}), ...(o.nhay ? { nhay: o.nhay } : {}), tu_dong: { phia: o.phia ?? 0 } };
}

/** CÂU CHUYỂN ĐỘNG cho video, viết từ số đo 3D (khung_xam.di): ai đi từ đâu tới đâu trên màn — cùng nguồn với khung màu nên không mâu thuẫn hình.
 *  Món dịch < 4% khung coi như đứng yên. tenEn: tên tiếng Anh (khối nhân vật giữ tên riêng). */
/** laNguoi: chỉ NGƯỜI vào câu "stay in place" (đồ đứng yên không cần nói — từng ra "the coffee cup stays in place" ở mọi shot). */
/** diThat(ten): món có DỊCH CHUYỂN THẬT trong set (vi_tri.den khác tam) — món chỉ trôi trên màn vì MÁY đi (push-in, lia) thì coi như đứng yên:
 *  tả nó "moves screen-left" là bảo Veo cho diễn viên đi (tập 122 #6 21/10/2026: máy đẩy vào → Vivian bước đi, bìa hồ sơ tự hiện, Thần quay lại). */
export function moTaChuyenDong(di: KhungXam['di'] | undefined, goi: (ten: string) => string = (t) => t, laNguoi: (ten: string) => boolean = () => true, diThat: (ten: string) => boolean = () => true): string {
  const o = (u: number[]) => `${u[1]! < 0.36 ? 'upper' : u[1]! > 0.64 ? 'lower' : 'middle'} ${u[0]! < 0.36 ? 'left' : u[0]! > 0.64 ? 'right' : 'centre'}`;
  const dich = (d: NonNullable<KhungXam['di']>[number]) => diThat(d.ten) && Math.hypot(d.den[0]! - d.tu[0]!, d.den[1]! - d.tu[1]!) >= 0.04;
  const ds = (di ?? []).filter(dich).map((d) => {
    const dx = d.den[0]! - d.tu[0]!, dy = d.den[1]! - d.tu[1]!;
    const huong = [Math.abs(dx) > 0.03 ? (dx > 0 ? 'screen-right' : 'screen-left') : '', Math.abs(dy) > 0.03 ? (dy < 0 ? 'upward' : 'downward') : ''].filter(Boolean).join(' and ');
    return `${goi(d.ten)} moves ${huong} from the ${o(d.tu)} of the frame to the ${o(d.den)}`;
  });
  const yen = (di ?? []).filter((d) => !dich(d) && laNguoi(d.ten)).map((d) => goi(d.ten));
  // Chỉ máy đi (mọi món trôi trên màn đều đứng yên trong set): nói thẳng người giữ chỗ — im lặng thì Veo tự cho đi lại.
  const mayDi = (di ?? []).some((d) => !dich(d) && Math.hypot(d.den[0]! - d.tu[0]!, d.den[1]! - d.tu[1]!) >= 0.04);
  if (!ds.length && mayDi && yen.length) return `Blocking (from the 3D layout): ${yen.join(', ')} keep${yen.length === 1 ? 's' : ''} the exact same position and facing for the whole clip — no one walks or turns; only the camera moves.`;
  return ds.length ? `Blocking (from the 3D layout — follow it exactly): ${ds.join('; ')}.${yen.length ? ` ${yen.join(', ')} stay${yen.length === 1 ? 's' : ''} in place.` : ''} The last frame shows where everyone ends up.` : '';
}

/** Danh sách khối trong khung xám, gọi tên từng khối cho mô hình ảnh (vị trí trên màn + % khung) — để nó không đoán một khối vàng là bàn tay.
 *  Bỏ khối < 2% khung. Chỉ những thứ này có trong khung: không thêm tay / người / vật không có tên ở đây. */
/** enCua(ten): cách gọi vật cho model ảnh — mô tả anchor (sinh-anh.ts) thắng tên trơn của set ('Orange Card' → ví da cam có thẻ xanh, đúng ảnh mẫu);
 *  trang = trạng thái lúc dựng (đã chia mảnh). */
/** NGƯỠNG "THẤY TRONG KHUNG 3D" (% diện tích) — MỘT số cho nhãn khối, đạo cụ tự kèm ảnh mẫu, và lọc ảnh mẫu đạo cụ ngoài khung (doc-db / sinh-anh).
 *  15/10/2026 #32 tập 19: nhãn lấy ≥ 2% còn câu sau ghi "Nothing else is in this frame" → Lint 1.7% đứng sau phích bị coi như không có. */
export const PT_THAY = 1;
/** CHỦ THỂ shot (may_3d.khung → khung_xam.kiem bat_buoc) mà bộ đo 3D thấy trong khung: luôn tính là THẤY dù chiếm < PT_THAY — đồ nhỏ làm chủ thể
 *  (thẻ, bút, nhẫn) vẫn phải vẽ. Tập 122 #11: thẻ nhân viên 0,6% khung → prompt ghi "Not in frame: badge", bỏ ảnh mẫu thẻ, keyframe vẽ tay buông. */
export const chuTheThay = (kx: { kiem?: { nhan_vat: string; bat_buoc?: boolean; trong_khung?: boolean }[] } | null | undefined, ten: string) => !!kx?.kiem?.some((k) => k.nhan_vat === ten && k.bat_buoc && k.trong_khung);
/** Một mục khung_xam.thay có tính là THẤY trong khung không — MỘT luật cho nhãn khối, ảnh mẫu, câu ngoài khung, hướng nhân vật. */
export const thayRo = (kx: Parameters<typeof chuTheThay>[0], t: { ten: string; pt: number }) => t.pt >= PT_THAY || chuTheThay(kx, t.ten);
/** NGƯỠNG "CÓ XUẤT HIỆN" để tính đối tượng xuyên suốt (% khung) — thấp hơn PT_THAY: bảng số tầng 0,6–0,8%, thư pháp 0,5% vẫn đọc được trên ảnh. */
export const PT_XUAT_HIEN = 0.3;
/** ĐỐI TƯỢNG XUYÊN SUỐT (anh 22/10/2026: "cái gì xuất hiện hơn 1 shot thì phải cho hết vào mục đối tượng được định nghĩa hình ảnh, đặc điểm, ảnh mẫu
 *  đầy đủ" — logo "LU GROUP", bảng số tầng, tranh, ghế, người phụ… chỉ là khối trong set 3D thì mỗi shot model vẽ một kiểu). Vật của set CÓ XUẤT HIỆN (≥ PT_XUAT_HIEN)
 *  trong ≥ 2 shot của phim phải trỏ tới một đối tượng (vat.anchor, hoặc trùng tên) CÓ ảnh mẫu. Mặt nền (nen: sàn, tường, trần, mặt bàn) thuộc đối tượng
 *  BỐI CẢNH của set — giữ bằng ảnh chuẩn bối cảnh (doc-db.ts › anhSet). Trả vật thiếu, nhiều shot trước. Thuần — kiểm ở bo-set-3d.test. */
export type ThieuDoiTuong = { ten: string; so_shot: number; ly_do: 'chua_co' | 'thieu_anh'; nguoi: boolean; vat?: VatSet };
type VatSet = BoSet['du_lieu']['vat'][number];
export function doiTuongThieu(shots: { khung_xam?: Pick<KhungXam, 'thay' | 'kiem'> | null }[], vat: VatSet[], doiTuong: { ten: string; anh: number }[]): ThieuDoiTuong[] {
  const dem = new Map<string, number>();
  for (const c of shots) for (const t of new Set((c.khung_xam?.thay ?? []).filter((t) => t.pt >= PT_XUAT_HIEN || chuTheThay(c.khung_xam, t.ten)).map((t) => t.ten))) dem.set(t, (dem.get(t) ?? 0) + 1);
  const dt = (ten: string) => doiTuong.find((d) => d.ten.trim().toLowerCase() === ten.trim().toLowerCase());
  const ra: ThieuDoiTuong[] = [];
  for (const [ten, so] of dem) {
    if (so < 2) continue;
    const v = vat.find((x) => x.ten === ten);
    if (v?.nen) continue;
    const d = dt(v?.anchor ?? ten);
    if (!d) { if (v) ra.push({ ten, so_shot: so, ly_do: 'chua_co', nguoi: 'ao' in v || 'tu_the' in v, vat: v }); continue; }   // không phải vật set, không đối tượng = khối lạ: bộ kiểm 3D lo
    if (!d.anh) ra.push({ ten, so_shot: so, ly_do: 'thieu_anh', nguoi: !!v && ('ao' in v || 'tu_the' in v), vat: v });
  }
  return ra.sort((a, b) => b.so_shot - a.so_shot);
}
/** Vật chạm mép khung (hộp thấy 0..1) → "cut off by the bottom edge — only a 10% strip shows": model không được vẽ cả món. */
export function catMep(h: number[]): string {
  const m: string[] = []; const e = 0.015;
  if (h[3]! >= 1 - e && h[1]! > 0.5) m.push(`the bottom edge — only a ${Math.round((1 - h[1]!) * 100)}% strip shows`);
  else if (h[1]! <= e && h[3]! < 0.5) m.push(`the top edge — only a ${Math.round(h[3]! * 100)}% strip shows`);
  if (h[0]! <= e && h[2]! < 0.5) m.push(`the left edge — only ${Math.round(h[2]! * 100)}% of the width shows`);
  else if (h[2]! >= 1 - e && h[0]! > 0.5) m.push(`the right edge — only ${Math.round((1 - h[0]!) * 100)}% of the width shows`);
  return m.length ? `, cut off by ${m.join(' and ')}` : '';
}
export function moTaThay(thay: VatThay[] | undefined, enCua?: (ten: string) => string | undefined, kx?: Parameters<typeof chuTheThay>[0]): string {
  const ngang = (x: number) => (x < 0.36 ? 'left' : x > 0.64 ? 'right' : 'centre'); const doc = (y: number) => (y < 0.36 ? 'top' : y > 0.64 ? 'bottom' : 'middle');
  const ds = (thay ?? []).filter((t) => thayRo(kx, t)).map((t) => `${enCua?.(t.ten) ?? t.en ?? t.ten}${t.trang ? ` [${t.trang}]` : ''} (${doc((t.hop[1] + t.hop[3]) / 2)}-${ngang((t.hop[0] + t.hop[2]) / 2)}, ${Math.round(t.pt)}%${t.tien ? ', foreground' : ''}${catMep(t.hop)})`);
  // 3D LÀ NGUỒN DUY NHẤT của "có gì, ở đâu, to bao nhiêu" (anh 15/10/2026, keyframe #35: đế cắm 3D chỉ ló một dải ở đáy → ảnh vẽ cả cái đế to; chữ thẻ
  // shot "a cable loop trailing behind" → ảnh thêm vòng cáp): chữ chỉ thêm chất liệu, biểu cảm, dáng, hành động — chữ gọi tên thứ ngoài danh sách = ngoài khung.
  return ds.length ? `Blocks in that layout image, by name: ${ds.join('; ')}. Nothing else is in this frame — do not add hands, people or objects that are not in this list; every desk, table and shelf holds ONLY the listed objects — leave all other surfaces bare (no extra cups, notebooks, papers, pens, phones, plants or decor); framed pictures and screens show exactly what the layout image shows; the BACKGROUND is exactly what those blocks show (a far room wall stays a plain dim wall — never add monitors, computers or extra cables there). This list and Image 1 are the ONLY authority on WHAT is in the frame, WHERE and HOW BIG: if any other sentence of this prompt names a character or object that is not in this list, it is OFF-SCREEN at this instant — do not draw it or any trace of it. The rest of the prompt only adds look, material, expression, pose and action to what IS listed; a block cut off by the frame edge stays cut off exactly that much.` : '';
}

// ── ĐỒ ĐỂ LẠI (anh 15/10/2026: "đồ ở các cảnh liên quan trước và sau phải chú ý để không bị mất hình") ──────────────────────────────────
// Bộ set có TRẠNG THÁI theo thời gian: đạo cụ / sản phẩm đặt xuống ở shot trước nằm nguyên chỗ cuối cùng nó được thấy trong mọi shot sau cùng
// set — tự thêm vào chỗ đứng của shot (an, de_lai) cho tới khi nó được khai lại (đổi chỗ), được cầm lên (cam), hoặc rời bộ set (het).
// Khung 3D / khung màu / keyframe vì thế luôn có món đó nếu máy nhìn thấy chỗ nó nằm — không phải nhớ khai lại từng shot.
export function mayDayDu<T extends { id: number; may_3d?: May3d | null; canh?: string }>(ds: T[], laDoVat: (ten: string) => boolean, phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[]): Map<number, May3d> {
  const con = new Map<string, { tam: number[]; huong?: number; nam?: boolean; chia?: number }>(); const out = new Map<number, May3d>();
  const noi = noiHookup(ds, phanCanh).may;   // chỗ / hướng / dáng / trạng thái MỞ = lúc KẾT shot trước (hookup) — trước khi tính đồ để lại
  for (const c of ds) {
    const m = noi.get(c.id) ?? c.may_3d; if (!m) continue;
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

/** Lỗi liền mạch theo từng shot (id → câu). ds = các shot CÙNG bộ set theo thứ tự phát; shot không có may_3d bỏ qua. */
/** Cảnh của một shot trong phân cảnh tập: shot ghi 'Cảnh 4 · Cục bụi biết sợ', phân cảnh ghi 'Cục bụi biết sợ'. */
export const canhCuaShot = <P extends Pick<PhanCanh, 'ten'>>(canh: string | undefined, pc: P[] | undefined): P | undefined =>
  canh && pc?.length ? pc.find((x) => x.ten.trim() === canh.trim() || canh.split('·').pop()!.trim() === x.ten.trim()) : undefined;
/** SỔ BỀ NGOÀI (script supervisor, chuẩn bị phim người thật — anh 16/10/2026): các thuộc tính bề ngoài theo dõi qua cú cắt. MỘT bảng khai cho
 *  hookup (noiHookup), cổng (lienMachTap), cảnh báo thiếu khai (thieuKhaiNguoi), sổ (so-lien-mach.ts) và prompt (trangThaiVat).
 *  giu 'ngay' = qua ngày truyện mới (hoặc shot khai nhay) được đổi: ngủ dậy thay đồ, gội đầu · 'mai' = không tự hết, kể cả qua ngày / nhay:
 *  vết thương, băng, sẹo — chỉ đổi khi khai _den. mac_dinh: giá trị khi không khai (trang: '' = bình thường); không có = chưa biết. */
export const SO_NGUOI = [
  { k: 'trang', ten: 'trạng thái cơ thể', en: '', giu: 'ngay', mac_dinh: '' },
  { k: 'trang_phuc', ten: 'trang phục', en: 'wearing', giu: 'ngay' },
  { k: 'toc', ten: 'tóc', en: 'hair', giu: 'ngay' },
  { k: 'trang_diem', ten: 'trang điểm', en: 'makeup', giu: 'ngay' },
  { k: 'do_deo', ten: 'đồ trên người', en: 'accessories on body', giu: 'ngay' },
  { k: 'vet', ten: 'vết thương / dấu trên người', en: 'visible marks', giu: 'mai' },
] as const satisfies readonly { k: string; ten: string; en: string; giu: 'ngay' | 'mai'; mac_dinh?: string }[];
export type KhoaNguoi = (typeof SO_NGUOI)[number]['k'];
type ViTriNguoi = Partial<Record<KhoaNguoi | `${KhoaNguoi}_den`, string>>;
/** Giá trị bề ngoài lúc mở / kết của một chỗ đứng (undefined = chưa khai). */
export const ngoaiMo = (v: ViTriNguoi, k: KhoaNguoi): string | undefined => { const x = v[k] ?? (SO_NGUOI.find((s) => s.k === k) as { mac_dinh?: string }).mac_dinh; return x == null ? undefined : x.trim(); };
export const ngoaiKet = (v: ViTriNguoi, k: KhoaNguoi): string | undefined => { const x = v[`${k}_den`]; return x == null ? ngoaiMo(v, k) : x.trim(); };

/** LUỒNG CẢNH của từng shot (script supervisor): 'ngay' = sang ngày truyện khác (reset hết) · 'canh' = cảnh mới khai lien_truoc: false (thời gian
 *  nhảy: reset chỗ / hướng / dáng / đồ cầm, trạng thái cơ thể giữ) · '' = cùng luồng. MỘT luật cho hookup, cổng liền mạch và sổ. */
export function luongShot<T extends { id: number; canh?: string }>(ds: T[], phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[]): Map<number, '' | 'ngay' | 'canh'> {
  const out = new Map<number, '' | 'ngay' | 'canh'>(); let canhTruoc: string | undefined; let ngayTruoc: string | undefined;
  for (const c of ds) {
    let l: '' | 'ngay' | 'canh' = ''; const pc = canhCuaShot(c.canh, phanCanh);
    if (pc && pc.ten !== canhTruoc) {
      const ngay = pc.ngay?.trim() || ngayTruoc;
      if (canhTruoc !== undefined) l = ngay !== ngayTruoc ? 'ngay' : pc.lien_truoc === false ? 'canh' : '';
      canhTruoc = pc.ten; ngayTruoc = ngay;
    }
    out.set(c.id, l);
  }
  return out;
}

/** HOOKUP (cách xưởng hoạt hình nối hai shot — anh 16/10/2026 "có làm đi"): người diễn hoạt NHẬN tư thế khung cuối shot trước làm tư thế mở
 *  shot mình, không tự khai lại. Trong một luồng cảnh, chỗ / hướng / dáng / trạng thái MỞ của mỗi nhân vật = lúc KẾT lần cuối thấy nó; shot sau
 *  khai lệch thì máy dùng kết shot trước và ghi vào lech (sổ báo nhẹ: dữ liệu khai thừa / sai). Sửa chỗ kết của shot trước = shot sau tự đổi theo.
 *  Không nối: shot hoặc nhân vật khai nhay (cố ý cắt thời gian), món đang được cầm (theo người cầm), sang ngày truyện khác (reset hết),
 *  cảnh lien_truoc: false (reset chỗ / hướng / dáng, trạng thái cơ thể giữ). Dáng chỉ nối khi nhân vật CÓ MẶT ở shot liền trước (vắng một shot =
 *  thời gian trôi ngoài khung). Trường _den shot không khai thì theo chỗ mở mới (đứng yên / giữ dáng) — riêng HƯỚNG: shot khai hướng khác thì đó là
 *  hướng shot cần, nhân vật quay đầu tới đó trong shot. Món nối được ghi noi_tu = số shot nguồn. */
export function noiHookup<T extends { id: number; thu_tu?: number; may_3d?: May3d | null; canh?: string }>(ds: T[], phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[]): { may: Map<number, May3d>; lech: Record<number, string[]> } {
  type Ket = { p: number[]; huong?: number; nam: boolean; shot: number };
  const ket = new Map<string, Ket>(); const ngoai = new Map<string, Partial<Record<KhoaNguoi, string>>>(); let truocCo = new Set<string>();
  const quenNgay = () => { for (const r of ngoai.values()) for (const x of SO_NGUOI) if (x.giu === 'ngay') delete r[x.k]; };
  const may = new Map<number, May3d>(); const lech: Record<number, string[]> = {}; const luong = luongShot(ds, phanCanh);
  const r = (p: number[]) => `(${p.map((x) => Math.round(x * 10) / 10).join(', ')})`;
  for (const c of ds) {
    const l = luong.get(c.id);
    if (l === 'ngay') { ket.clear(); quenNgay(); truocCo = new Set(); } else if (l === 'canh') { ket.clear(); truocCo = new Set(); }
    const m = c.may_3d; if (!m) continue;
    const so = c.thu_tu ?? c.id;
    const vi_tri = m.vi_tri.map((v) => {
      if (v.cam) return v;
      const n: typeof v = { ...v }; let doi = false;
      // BỀ NGOÀI: shot trước đã khai thì shot này mở đúng như thế (không phải khai lại); cắt thời gian (nhay) được đổi, vết thương thì không.
      const rn = ngoai.get(v.ten);
      if (rn) for (const x of SO_NGUOI) {
        const t = rn[x.k]; if (t === undefined || ((m.nhay || v.nhay) && x.giu === 'ngay')) continue;
        const mo = ngoaiMo(v, x.k);
        if (mo !== undefined && mo !== t) (lech[c.id] ??= []).push(x.k === 'trang'
          ? `nối: ${v.ten} khai mở "${mo || 'bình thường'}" mà kết shot trước "${t || 'bình thường'}" — máy nối theo shot trước; đổi thì khai trang_den`
          : `nối: ${v.ten} khai mở ${x.ten} "${mo || 'không'}" mà kết shot trước "${t || 'không'}" — máy nối theo shot trước; đổi trong shot thì khai ${x.k}_den`);
        n[x.k] = t; if (v[`${x.k}_den`] == null) n[`${x.k}_den`] = t; doi = true;
      }
      if (m.nhay || v.nhay) return doi ? n : v;
      const k = ket.get(v.ten);
      if (!k && !doi) return v;
      if (k) {
        const d = Math.hypot(v.tam[0]! - k.p[0]!, v.tam[1]! - k.p[1]!, (v.tam[2] ?? 0) - (k.p[2] ?? 0));
        if (d > 0.5) (lech[c.id] ??= []).push(`nối: ${v.ten} khai mở ở ${r(v.tam)} mà kết #${k.shot} ở ${r(k.p)} (lệch ${Math.round(d * 10) / 10} cm) — máy nối theo kết #${k.shot}; cố ý cắt thời gian thì khai nhay`);
        n.tam = [...k.p];
        if (k.huong != null) {
          // hướng shot khai khác hướng nối mà không khai huong_den = hướng shot CẦN (nhìn người kia): mở theo hookup rồi DIỄN quay đầu tới đó.
          if (v.huong != null && v.huong_den == null && gocLech(k.huong, v.huong) > 15) n.huong_den = v.huong;
          n.huong = k.huong;
        }
        if (truocCo.has(v.ten)) {
          if (k.nam !== !!v.nam) (lech[c.id] ??= []).push(`nối: ${v.ten} khai mở ${v.nam ? 'nằm' : 'đứng'} mà kết #${k.shot} ${k.nam ? 'nằm' : 'đứng'} — máy nối theo #${k.shot}; đổi dáng thì diễn trong shot (nam_den + động tác nga / day)`);
          n.nam = k.nam; if (v.nam_den == null) n.nam_den = k.nam;
        }
        n.noi_tu = k.shot;
      }
      return n;
    });
    may.set(c.id, { ...m, vi_tri });
    for (const v of vi_tri) {
      const rn = ngoai.get(v.ten) ?? {}; for (const x of SO_NGUOI) { const e = ngoaiKet(v, x.k); if (e !== undefined) rn[x.k] = e; } ngoai.set(v.ten, rn);
      if (v.cam) { ket.delete(v.ten); continue; }
      ket.set(v.ten, { p: v.den ?? v.tam, huong: v.huong_den ?? v.huong, nam: !!(v.nam_den ?? v.nam), shot: so });
    }
    truocCo = new Set(vi_tri.map((v) => v.ten));
  }
  return { may, lech };
}

/** DÁNG CƠ THỂ qua cú cắt (anh 19/10/2026, tổng tài #5 → #6: "cuối cảnh trước Hạ đang quỳ, cắt sang cảnh sau đã đứng sẵn — cụt"). Ngành: dáng là
 *  một mục của sổ liên tục (script supervisor — Rowlands, *The Continuity Supervisor*; Murch: cắt giữa động tác thì động tác phải nối) — đổi dáng phải
 *  DIỄN trong khung (hoặc khai nhay). Trước đây cổng chỉ biết NẰM / ĐỨNG. Bảng: mã diễn → [dáng đầu, dáng cuối]; cùng tên với mesh/mocap.py › MOCAP. */
export type Dang = 'dung' | 'ngoi' | 'quy' | 'nam';
export const TEN_DANG: Record<Dang, string> = { dung: 'ĐỨNG', ngoi: 'NGỒI', quy: 'QUỲ', nam: 'NẰM' };
export const DANG_DIEN: Record<string, [Dang, Dang]> = {
  ...MOCAP_DANG,   // mã mocap đổi dáng — sổ mocap-kho.ts
  quy_khoc: ['dung', 'quy'], nga_ngoi: ['dung', 'ngoi'], nga: ['dung', 'nam'], day: ['nam', 'dung'],
};
/** Động tác máy gợi ý cho từng lần đổi dáng (đặt ở shot TRƯỚC, cuối shot). */
const DOI_DANG: Partial<Record<`${Dang}>${Dang}`, string>> = {
  'quy>dung': "dien: 'mc_dung_len_quy@0.6-1'", 'ngoi>dung': "dien: 'mc_dung_day_ghe@0.6-1'", 'nam>dung': "nam_den: false + 'day'",
  'dung>quy': "dien: 'mc_quy_xuong@0.6-1'", 'dung>ngoi': "dien: 'mc_ngoi_xuong@0.6-1' (ngã: 'nga_ngoi')", 'dung>nam': "nam_den: true + 'nga'",
};
type CoDang = { nam?: boolean; nam_den?: boolean; dien?: string[] };
const dienDoiDang = (v: CoDang) => (v.dien ?? []).map((x) => { const [ten, mt] = String(x).split('@'); const b = mt ? Number(mt.split('-')[1] || 1) : 1; return { d: DANG_DIEN[ten!], b }; })
  .filter((x): x is { d: [Dang, Dang]; b: number } => !!x.d).sort((a, b) => a.b - b.b);
/** Dáng lúc MỞ shot: nằm theo cờ nam; còn lại theo động tác đổi dáng SỚM nhất (đứng dậy từ quỳ → mở bằng quỳ), không có thì mã 'ngoi…' = ngồi. */
export function dangMo(v: CoDang): Dang {
  if (v.nam) return 'nam';
  const dd = dienDoiDang(v)[0]; if (dd) return dd.d[0] === 'nam' ? 'dung' : dd.d[0];
  return (v.dien ?? []).some((x) => /^ngoi/.test(String(x))) ? 'ngoi' : 'dung';
}
/** Dáng lúc KẾT shot: nam_den thắng; còn lại theo động tác đổi dáng KẾT MUỘN nhất. */
export function dangKet(v: CoDang): Dang {
  const nam = v.nam_den ?? v.nam;
  if (nam) return 'nam';
  const ds = dienDoiDang(v).filter((x) => x.d[1] !== 'nam'); const l = ds[ds.length - 1];
  if (l) return l.d[1];
  const mo = dangMo(v); return mo === 'nam' ? 'dung' : mo;
}

export function lienMachTap<T extends { id: number; thu_tu: number; may_3d?: May3d | null; canh?: string }>(ds0: T[], khoi: (ten: string) => { co: number[] } | null, phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[]): Record<number, string[]> {
  // Kiểm trên bản ĐÃ NỐI hookup (noiHookup) — đúng thứ Blender / keyframe dựng. Chỗ khai lệch KHÔNG phải lỗi (máy đã dựng đúng): sổ hiện thành ghi chú, cổng không chặn.
  const hk = noiHookup(ds0, phanCanh); const ds = ds0.map((c) => (hk.may.has(c.id) ? { ...c, may_3d: hk.may.get(c.id)! } : c));
  const cuoi = new Map<string, { p: number[]; huong?: number; dang: Dang; shot: number }>(); const out: Record<number, string[]> = {};
  // ĐỒ ĐANG CẦM (nối thử #22→#24 tập 19: bình xịt trong tay Mr. Wipe ở 5.4 và 5.6 mà 5.5 không có): người cầm còn trong shot thì món đồ phải còn —
  // tới khi nó xuất hiện KHÔNG còn cầm (đặt xuống), hoặc người cầm khai nhảy / shot khai nhảy.
  const camBoi = new Map<string, { nguoi: string; shot: number }>();
  // TRẠNG THÁI VẬT (15/10/2026: kẹo đã bẻ đôi ở cảnh 4 mà 7.1a / 7.4a dựng con gấu nguyên): một món đã chia mảnh thì mọi lần xuất hiện sau phải
  // khai chia ≥ số mảnh đó — vật không tự lành.
  const daChia = new Map<string, { n: number; shot: number }>();
  // SỔ TRẠNG THÁI (script supervisor, 15/10/2026): trạng thái cơ thể / bề mặt (trang) shot trước ĐỂ LẠI phải là trạng thái shot sau MỞ — xù lông
  // không tự phẳng, bẹp không tự tròn; chỉ đổi trong shot (trang_den) hoặc khi khai nhay.
  const trangCuoi = new Map<string, Partial<Record<KhoaNguoi, { t: string; shot: number }>>>();   // bề ngoài (SO_NGUOI) lúc kết lần cuối thấy
  let truocCo = new Set<string>();
  // NẰM MÀ DI CHUYỂN (anh 16/10/2026: "#10 con Tango đang nằm mà vẫn di chuyển được"): thân nằm không tự đi — phải khai CÁCH di chuyển trong
  // dien (lan_tron = cuộn tròn lăn, truot = trượt: xe trượt / băng / dây) hoặc đang được người khác cầm.
  const CACH_NAM = /^(lan_tron|truot)\b/;
  for (const c of ds) for (const v of c.may_3d?.vi_tri ?? []) {
    if (!v.den || v.cam || !(v.nam && (v.nam_den ?? v.nam))) continue;
    const d = Math.hypot(v.den[0]! - v.tam[0]!, v.den[1]! - v.tam[1]!);
    if (d > 1 && !(v.dien ?? []).some((x) => CACH_NAM.test(x))) (out[c.id] ??= []).push(`${v.ten} đang NẰM mà đi ${Math.round(d * 10) / 10} cm trong shot — thân nằm không tự đi: khai cách di chuyển trong dien (lan_tron = cuộn tròn lăn, truot = trượt) hoặc cho đứng dậy / người khác cầm`);
  }
  // LUỒNG CẢNH (script supervisor, anh 16/10/2026: "đang lái xe hết cảnh, cảnh sau sáng hôm sau đang nằm ngủ là bình thường"): sổ liền mạch
  // theo từng nhân vật chỉ giữ trong một luồng thời gian. Sang cảnh khai NGÀY TRUYỆN khác → reset hết (trừ vật đã chia: thời gian không làm lành);
  // cảnh khai lien_truoc: false (thời gian nhảy) → reset chỗ / hướng / dáng / đồ đang cầm, trạng thái cơ thể giữ tới khi đổi ngày.
  const luong = luongShot(ds, phanCanh);
  for (const c of ds) {
    const l = luong.get(c.id);
    if (l === 'ngay') { cuoi.clear(); camBoi.clear(); for (const r of trangCuoi.values()) for (const x of SO_NGUOI) if (x.giu === 'ngay') delete r[x.k]; truocCo = new Set(); }
    else if (l === 'canh') { cuoi.clear(); camBoi.clear(); truocCo = new Set(); }
    const m = c.may_3d; if (!m) continue;
    const co = new Set(m.vi_tri.map((v) => v.ten));
    for (const v of m.vi_tri) {
      const r = trangCuoi.get(v.ten) ?? {};
      for (const x of SO_NGUOI) {
        const tr = r[x.k]; const mo = ngoaiMo(v, x.k);
        if (tr && mo !== undefined && mo !== tr.t && !(x.giu === 'ngay' && (m.nhay || v.nhay))) (out[c.id] ??= []).push(x.k === 'trang'
          ? `${v.ten} kết #${tr.shot} ở trạng thái "${tr.t || 'bình thường'}" mà mở shot này ${mo ? `"${mo}"` : 'không khai trang (bình thường)'} — khai trang: '${tr.t}' (trạng thái không tự đổi qua cú cắt), hoặc trang_den ở shot trước / nhay nếu cố ý`
          : `${v.ten} đứt mạch ${x.ten}: kết #${tr.shot} "${tr.t || 'không'}" mà mở shot này "${mo || 'không'}" — ${x.giu === 'mai' ? 'không tự hết kể cả qua ngày' : 'không tự đổi trong ngày truyện'}; đổi trong shot thì khai ${x.k}_den`);
        const e = ngoaiKet(v, x.k); if (e !== undefined) r[x.k] = { t: e, shot: c.thu_tu };
      }
      trangCuoi.set(v.ten, r);
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
        // Dáng đủ bốn trạng thái (đứng / ngồi / quỳ / nằm — anh 19/10/2026): quỳ cuối #5 mà #6 mở đứng là đứt như đứng → nằm.
        const mo = dangMo(v);
        if (tr.dang !== mo && truocCo.has(v.ten)) (out[c.id] ??= []).push(`${v.ten} kết #${tr.shot} đang ${TEN_DANG[tr.dang]} mà mở shot này ${TEN_DANG[mo]} — dáng không tự đổi qua cú cắt: cho đổi dáng trong #${tr.shot} (${DOI_DANG[`${tr.dang}>${mo}`] ?? 'thêm động tác đổi dáng'}), hoặc mở shot này bằng động tác đổi dáng, hoặc chèn shot thấy động tác (góc nhìn / cắt xen), hoặc khai nhay nếu cố ý cắt thời gian`);
        if (tr.huong != null && v.huong != null && gocLech(tr.huong, v.huong) > 60) (out[c.id] ??= []).push(`${v.ten} quay ngoắt ${Math.round(gocLech(tr.huong, v.huong))}° qua cú cắt (kết #${tr.shot} nhìn ${tr.huong}°, mở shot này ${v.huong}°)`);
      }
      cuoi.set(v.ten, { p: v.den ?? v.tam, huong: v.huong_den ?? v.huong, dang: dangKet(v), shot: c.thu_tu });
    }
    truocCo = co;
  }
  return out;
}

// ── NHẤT QUÁN · LIÊN TỤC (15/10/2026, luat-dung.ts › luật của thợ). Hai mức theo Murch: CHẶN (loiMachTap) và CẢNH BÁO (canhBaoMachTap).
type ShotMach = { id: number; thu_tu: number; phan_doan?: string; may_3d?: May3d | null; ky_thuat?: { vai?: string; co_canh?: string; goc?: string } | null; khung_xam?: Canh['khung_xam'] | null; prompt_video?: string; hanh_dong?: string; dan_dung?: { bo_cuc?: string } | null };
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
/** MÔ TẢ ↔ ĐỘNG TÁC (anh 16/10/2026: "cần lưu làm chuẩn và có bộ tính điểm, kiểm soát nếu thiếu"): mô tả hành động của shot nhắc một động tác thân
 *  thể (ngã, đứng dậy, lăn, nhảy, run, phồng, xẹp, cười, xoay tít, tóc rũ / dựng) mà KHÔNG nhân vật nào trong shot khai động tác đó (dien / nam_den)
 *  → bản diễn 3D sẽ thiếu đúng cái kịch bản viết. Luật thư viện: luat-dung.ts › mo_ta_dong_tac. */
export const DONG_TAC_MO_TA: { ten: string; tu: RegExp; co: (v: May3d['vi_tri'][number]) => boolean; /** nét MẶT cũng đủ (shot khai biểu cảm — mặt 3D diễn theo bieu_cam) */ mat?: boolean }[] = [
  { ten: 'ngã', tu: /(ngã|té xuống|úp mặt|đổ (vật|xuống)|falls?|trips?)/i, co: (v) => !!v.nam || !!v.nam_den || (v.dien ?? []).some((x) => /^(nga|nga_ngoi)/.test(x)) },   // đang nằm sẵn = mô tả trạng thái, không đòi cú ngã
  { ten: 'đứng dậy / bung ra', tu: /(đứng dậy|bung ra|ngồi dậy|gets? up|stands? up)/i, co: (v) => (!!v.nam && v.nam_den === false) || (v.dien ?? []).some((x) => /^day/.test(x) || (DANG_DIEN[String(x).split('@')[0]!]?.[1] === 'dung' && DANG_DIEN[String(x).split('@')[0]!]?.[0] !== 'dung')) },   // đứng dậy từ quỳ / ghế (bảng DANG_DIEN) cũng là đứng dậy
  { ten: 'lăn tròn', tu: /(lăn (vèo|theo|tới|tiếp|đi|lông lốc)|rolls?\b)/i /* phải có LĂN — 'cuộn tròn' tại chỗ là tư thế */, co: (v) => (v.dien ?? []).some((x) => /^lan_tron/.test(x)) },
  { ten: 'nhảy', tu: /(nhảy|jumps?|leaps?)/i /* 'bật lên' hay nói về tóc — không tính */, co: (v) => (v.dien ?? []).some((x) => /^(nhay|cuoi_lan)/.test(x)) },
  { ten: 'run', tu: /(run bần bật|rùng mình|run rẩy|trembl|shiver)/i, co: (v) => (v.dien ?? []).some((x) => /^run/.test(x)) },
  { ten: 'phồng to', tu: /(phồng (to|lên)|puffs? up|inflat)/i, co: (v) => (v.dien ?? []).some((x) => /^phong/.test(x)) },
  { ten: 'xẹp', tu: /(xẹp|deflat)/i, co: (v) => (v.dien ?? []).some((x) => /^(xep|phong0)/.test(x)) },
  { ten: 'cười', tu: /(cười lăn|cười|laugh)/i, co: (v) => (v.dien ?? []).some((x) => /^(cuoi_lan|nheo_mat)/.test(x)), mat: true },   // người thật: nụ cười là nét mặt (bieu_cam → mặt MPFB), không phải động tác thân
  { ten: 'xoay tít', tu: /(xoay tít|spins?\b)/i, co: (v) => (v.dien ?? []).some((x) => /^xoay_tit/.test(x)) },
  { ten: 'tóc rũ', tu: /(tóc rũ|sợi tóc rũ|droop)/i, co: (v) => (v.dien ?? []).some((x) => /^toc_ru/.test(x)) },
  { ten: 'tóc / chỉ dựng', tu: /((tóc|sợi chỉ|lông)[^.;]{0,25}(dựng|bật)|BOING)/i, co: (v) => (v.dien ?? []).some((x) => /^(toc_dung|toc_bat)/.test(x)) },
  // NGƯỜI (rig ma-nơ-canh, mesh/nguoi.py › TU_THE_NGUOI — 17/10/2026): kịch bản viết động tác thân người mà 3D vẫn đứng thẳng tay buông → ảnh 3D
  // (ảnh số 1 của keyframe) nói một đằng, chữ nói một nẻo, AI tự đoán. Khai mã tư thế ở vi_tri.dien.
  { ten: 'quỳ', tu: /(quỳ|kneel)/i, co: (v) => (v.dien ?? []).some((x) => /^(quy|mc_quy)/.test(x)) },
  { ten: 'hất / ném', tu: /(hất|ném|throws?\b)/i, co: (v) => (v.dien ?? []).some((x) => /^hat/.test(x)) },
  { ten: 'giật', tu: /(giật|snatch)/i, co: (v) => (v.dien ?? []).some((x) => /^giat/.test(x)) },
  { ten: 'giơ', tu: /(giơ|raises?\b|holds? up)/i, co: (v) => (v.dien ?? []).some((x) => /^(gio_cao|dua_truoc_mat|gioi_thieu)/.test(x)) },
  { ten: 'chống tay', tu: /(chống[^.;]{0,15}(tay|bàn)|palms? on|hands? on the table)/i, co: (v) => (v.dien ?? []).some((x) => /^(chong_ban|mc_chong)/.test(x)) },
  { ten: 'ôm', tu: /(ôm thùng|ôm hộp|carry(ing)? a (cardboard )?box)/i, co: (v) => (v.dien ?? []).some((x) => /^om_thung/.test(x)) },
  { ten: 'cúi người', tu: /(cúi (xuống|người|sát)|leans? in)/i, co: (v) => (v.dien ?? []).some((x) => /^(cui_nguoi|quy|chong_ban|mc_quy|mc_chong|mc_nhat_do)/.test(x)) },
  // KHO MOCAP MỞ RỘNG (19/10/2026, mocap-kho.ts): động tác có mã mocap riêng — chỉ những cụm từ hẹp, đọc ra là đúng một động tác
  { ten: 'ngồi xuống', tu: /(ngồi xuống|sits? down)/i, co: (v) => (v.dien ?? []).some((x) => /^(mc_ngoi_xuong|nga_ngoi|ngoi)/.test(x)) },
  { ten: 'bắt tay', tu: /(bắt tay|shakes? hands)/i, co: (v) => (v.dien ?? []).some((x) => /^mc_bat_tay/.test(x)) },
  { ten: 'nghe điện thoại', tu: /(nghe (điện thoại|máy)|áp (điện thoại|máy) (lên|vào) tai|answers? the phone|on the phone)/i, co: (v) => (v.dien ?? []).some((x) => /^nghe_dien_thoai/.test(x)) },
  { ten: 'kéo tay', tu: /(kéo (tay|cánh tay|khuỷu)|lôi (tay|đi)|pulls? [^.;]{0,20}by the (arm|elbow))/i, co: (v) => (v.dien ?? []).some((x) => /^(mc_keo_tay|mc_bi_keo)/.test(x)) },
  { ten: 'đặt tay lên vai', tu: /((đặt|vỗ|đặt nhẹ) tay (lên )?vai|hand on [^.;]{0,15}shoulder)/i, co: (v) => (v.dien ?? []).some((x) => /^mc_dat_tay_vai/.test(x)) },
  { ten: 'nhặt', tu: /(nhặt|cúi lượm|picks? up)/i, co: (v) => (v.dien ?? []).some((x) => /^(mc_nhat_do|quy|mc_quy|mc_dang_quy|mc_dung_len_quy)/.test(x)) },   // quỳ nhặt rồi đứng lên cũng là nhặt (tập 135 #5, #8, #9 báo oan)
  { ten: 'đập bàn', tu: /(đập (bàn|tay xuống bàn)|pounds? the (table|desk))/i, co: (v) => (v.dien ?? []).some((x) => /^mc_dap_ban_chi/.test(x)) },
];
export function thieuDongTac(c: Pick<ShotMach, 'hanh_dong' | 'may_3d'> & { bieu_cam?: unknown[] | null }): string[] {
  const m = c.may_3d; const mt = c.hanh_dong ?? ''; if (!m || !mt.trim()) return [];
  const coMat = (c.bieu_cam ?? []).length > 0;
  return DONG_TAC_MO_TA.filter((d) => d.tu.test(mt) && !(d.mat && coMat) && !m.vi_tri.some((v) => d.co(v))).map((d) => `thiếu động tác: mô tả có "${d.ten}" mà chưa nhân vật nào khai (dien / nam_den) — bản diễn 3D sẽ thiếu đúng cái kịch bản viết`);
}
/** THIẾU KHAI BỀ NGOÀI (bảng trang phục theo ngày của script supervisor): nhân vật đã khai một thuộc tính bề ngoài ở BẤT KỲ đâu trong tập (tức là
 *  phim theo dõi nó — phim hoạt hình không khai thì không bị đòi) thì mỗi ngày truyện, lần xuất hiện đầu phải có giá trị — sau đó hookup tự nối.
 *  Không khai = AI vẽ bộ khác mỗi shot. ds = shot cùng nhánh theo thứ tự phát (đã nối hay chưa đều được). */
export function thieuKhaiNguoi<T extends { id: number; thu_tu?: number; may_3d?: May3d | null; canh?: string }>(ds: T[], phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[]): Record<number, string[]> {
  const hk = noiHookup(ds, phanCanh).may; const luong = luongShot(ds, phanCanh); const out: Record<number, string[]> = {};
  const theoDoi = new Map<string, Set<KhoaNguoi>>();
  for (const c of ds) for (const v of c.may_3d?.vi_tri ?? []) for (const x of SO_NGUOI) if (x.k !== 'trang' && x.k !== 'vet' && (v[x.k] != null || v[`${x.k}_den`] != null)) theoDoi.set(v.ten, (theoDoi.get(v.ten) ?? new Set()).add(x.k));
  let daBao = new Set<string>(); let ngay = 1;
  for (const c of ds) {
    if (luong.get(c.id) === 'ngay') { daBao = new Set(); ngay++; }
    for (const v of hk.get(c.id)?.vi_tri ?? []) {
      if (v.cam) continue;
      for (const k of theoDoi.get(v.ten) ?? []) {
        if (ngoaiMo(v, k) !== undefined || daBao.has(`${v.ten}|${k}`)) continue;
        daBao.add(`${v.ten}|${k}`);
        (out[c.id] ??= []).push(`thiếu khai ${SO_NGUOI.find((x) => x.k === k)!.ten}: ${v.ten} xuất hiện mà chưa khai ${k} cho ngày truyện này — AI sẽ vẽ bộ khác mỗi shot; khai ở lần xuất hiện đầu của ngày, các shot sau tự nối`);
      }
    }
  }
  return out;
}

export function canhBaoMachTap<T extends ShotMach & { canh?: string }>(ds: T[], laNhanVat: (ten: string) => boolean, phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[], /** sơ đồ 2D theo cảnh — shot không 3D cảnh báo theo đây */ kgt?: KhongGianTap | null): Record<number, string[]> {
  const out: Record<number, string[]> = {}; const them = (id: number, s: string) => (out[id] ??= []).push(s);
  for (const [k, v] of Object.entries(canhBaoTap2d(kgt, ds.filter((c) => !c.may_3d) as unknown as ShotKg[]))) for (const x of v) them(Number(k), x);
  for (const c of ds) for (const x of thieuDongTac(c)) them(c.id, x);
  for (const [id, xs] of Object.entries(thieuKhaiNguoi(ds, phanCanh))) for (const x of xs) them(Number(id), x);
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
/** ÁNH MẮT (eyeline) cho prompt hình — anh 19/10/2026: "phim AI rất hay bị nhân vật nhìn vào máy quay trực diện". Phim thật: diễn viên quay người về
 *  máy nhưng MẮT đặt lên bạn diễn ngay sát mép ống kính (eyeline just off-lens), không bao giờ nhìn vào ống kính trừ khi cố ý phá bức tường thứ tư.
 *  Chữ "facing the camera" + ảnh mẫu / ảnh học LoRA (chân dung nhìn máy) làm model vẽ mắt nhìn thẳng máy (#12 Thần + Hạ, #14 Hạ). Đích nhìn = người
 *  (kể cả người ngoài khung) gần hướng mặt nhất (< 75°); phía trên màn = đích nằm bên nào của người đó trên khung. Không có đích → vẫn cấm nhìn máy. */
/** NGƯỜI ĐƯỢC NHÌN của v (lúc mở / kết): người khác gần hướng mặt nhất (< 75°), kể cả ngoài khung. MỘT luật cho chữ ánh mắt trong prompt (nhinCau)
 *  và mắt ma-nơ-canh 3D (bangDung › nhin_mat — dung-set.py xoay mắt bằng khoá eyeLook*), để ảnh 3D và chữ cùng nói một hướng nhìn. */
export function dichNhin(v: ViTri, nguoi: ViTri[], ket = false): { ten: string; q: number[]; lech: number } | undefined {
  const h = ket ? v.huong_den ?? v.huong : v.huong; if (h == null) return undefined;
  const p = ket ? v.den ?? v.tam : v.tam;
  return nguoi.filter((x) => x.ten !== v.ten).map((x) => { const q = ket ? x.den ?? x.tam : x.tam; return { ten: x.ten, q, lech: gocLech(h, huongToi(p, q)) }; })
    .filter((x) => x.lech < 75).sort((a, b) => a.lech - b.lech)[0];
}
/** PHÍA MÀN người `ten` phải nhìn ở khung mở (+1 phải / −1 trái; 0 = không có người để nhìn) — cổng hướng nhìn đo trên keyframe (khung.ts › loiNhin). */
export function canNhin(m: Pick<May3d, 'dat' | 'nhin' | 'vi_tri'>, ten: string, laNguoi: (t: string) => boolean): 1 | -1 | 0 {
  if (!m.dat || !m.nhin) return 0;
  const nguoi = m.vi_tri.filter((x) => laNguoi(x.ten) && !x.cam); const v = nguoi.find((x) => x.ten === ten); if (!v) return 0;
  const d = dichNhin(v, nguoi); if (!d) return 0;
  const fx = m.nhin[0]! - m.dat[0]!, fy = m.nhin[1]! - m.dat[1]!;
  return (d.q[0]! - v.tam[0]!) * fy + (d.q[1]! - v.tam[1]!) * -fx >= 0 ? 1 : -1;
}
/** Bỏ vế "không nhìn máy" khỏi câu hướng của MỘT người — khung có ≥ 2 người thì câu đó nói MỘT lần cho cả khung (tập 135 #16: ba người mỗi người một
 *  "NOT looking into the camera" → bộ chấm prompt trừ lặp, bước 1 FLUX vượt 300 từ). Giữ phần "eyes on X, just off the lens toward …". */
export const boCauMay = (s: string): string => s.replace(/\s*—\s*NOT looking into the camera/gi, '').replace(/,?\s*(?:eyes just off the lens,\s*)?NOT looking (?:into|at) the camera/gi, '')
  .replace(/,\s*not at the camera/gi, '').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();
export function nhinCau(m: Pick<May3d, 'dat' | 'nhin'>, v: ViTri, nguoi: ViTri[], ket = false): string {
  const h = ket ? v.huong_den ?? v.huong : v.huong; if (h == null) return '';
  const p = ket ? v.den ?? v.tam : v.tam;
  const fx = m.nhin[0]! - m.dat[0]!, fy = m.nhin[1]! - m.dat[1]!; const rx = fy, ry = -fx;   // vectơ phải-màn-hình của máy
  const dich = dichNhin(v, nguoi, ket);
  const sat = gocLech(h, huongToi(p, m.dat)) <= 35;
  if (!dich) return sat ? 'eyes just off the lens, NOT looking into the camera' : 'NOT looking at the camera';
  const ben = (dich.q[0]! - p[0]!) * rx + (dich.q[1]! - p[1]!) * ry >= 0 ? 'screen-right' : 'screen-left';
  return sat ? `eyes on ${dich.ten}, just off the lens toward ${ben} — NOT looking into the camera` : `eyes on ${dich.ten} (${ben}), not at the camera`;
}

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
// ── SỔ TRANG PHỤC (look book — anh 17/10/2026: "vết bẩn về hình dáng, màu sắc cũng phải chuẩn hoá… tổng hợp vào bộ chấm, kiểm soát đồng nhất chứ
// không nhắc đâu vá đó"): mọi bề ngoài NHÌN THẤY ĐƯỢC của người thật (trang phục, trạng thái, vết) là một BIẾN THỂ chuẩn hoá của nhân vật — mô tả
// cố định (hình dạng · màu · cỡ · vị trí), ảnh tham chiếu, dấu 3D. Sổ người (SO_NGUOI) chỉ ghi TÊN biến thể; chữ prompt, ảnh tham chiếu keyframe và
// dấu trên bản 3D đều suy từ biến thể đó — không chỗ nào tự tả lại.
// Thiết kế sản xuất — MỌI khía cạnh bề ngoài (SO_NGUOI) là một look-book key có biến thể + ảnh mẫu riêng: trang phục, tóc, trang điểm, kính/phụ kiện,
// vết, trạng thái cơ thể. Thứ tự = thứ tự nhắc trong prompt (trang phục trước). Mỗi key phải là một khoá SO_NGUOI (satisfies canh lệch).
export const KHOA_LOOK = ['trang_phuc', 'toc', 'trang_diem', 'do_deo', 'vet', 'trang'] as const satisfies readonly KhoaNguoi[];
/** Biến thể mà sổ người của vị trí v đang trỏ tới (giá trị mỗi ô look-book = tên biến thể), theo thứ tự ô. ket = trạng thái kết shot. */
export function bienTheTheoSo(v: May3d['vi_tri'][number], nv: { bien_the?: BienThe[] } | undefined, ket = false): BienThe[] {
  const out: BienThe[] = [];
  for (const k of KHOA_LOOK) {
    const t = (ket ? ngoaiKet(v as never, k) : ngoaiMo(v as never, k))?.trim().toLowerCase(); if (!t) continue;
    const b = (nv?.bien_the ?? []).find((x) => x.ten.trim().toLowerCase() === t); if (b && !out.includes(b)) out.push(b);
  }
  return out;
}
/** Look đã CARRY của một nhân vật ở một shot: các biến thể đang có hiệu lực cho mỗi look-book key. MẢNG vì một số khoá mang NHIỀU món cùng lúc
 *  (phụ kiện: đồng hồ + kính + dây chuyền · vết: vết cà phê + vết xước) — mỗi món là một thành phần độc lập có ảnh riêng (costume breakdown).
 *  Khoá một-món (trang phục / tóc / trang điểm / trạng thái) thường dài 1. Shot khai khoá nào = bộ món của khoá đó TỪ shot này (thay, không cộng dồn). */
export type LookMang = Partial<Record<KhoaNguoi, BienThe[]>>;
/** Biến thể look có hợp TẬP không: không khai dung_tap (rỗng) = dùng mọi tập; có khai = chỉ tập trong danh sách. */
export const hopTap = (b: Pick<BienThe, 'dung_tap'>, tapSo: number | null | undefined): boolean => !b.dung_tap?.length || (tapSo != null && b.dung_tap.includes(tapSo));
/** Nền look-book KHÔNG seed theo tập (theo SỰ KIỆN, phải khai tại shot): vết, trạng thái cơ thể. Còn lại (trang phục/tóc/trang điểm/kính) là bộ mặc định tập. */
const KHONG_SEED = new Set<KhoaNguoi>(['vet', 'trang']);
/** Khoá look mang NHIỀU món cùng lúc (mỗi món một biến thể) — seed mặc định theo tập chỉ lấy món GẮN ĐÚNG tập (không lấy món "mọi tập" để khỏi đeo bừa). */
export const KHOA_NHIEU = new Set<KhoaNguoi>(['do_deo', 'vet']);
/** SỔ TRANG PHỤC CARRY cho shot 2D (shot 3D đã có sổ người qua noiHookup). Khai một lần tại shot mốc → tự mang sang mọi shot sau trong tập, không phải
 *  chọn lại từng shot (anh 31/10/2026: "vết áo phải là trạng thái liền mạch, bật từ mốc rồi tự mang sang"). Nguồn look = biến thể trong c.bien_the thuộc
 *  nhân vật đó, nhóm ∈ KHOA_LOOK. Luật giữ (khớp SO_NGUOI): trang_phuc/trang reset sang ngày truyện mới (luongShot 'ngay'); vet bám TRANG PHỤC —
 *  tự hết khi đổi biến thể trang_phuc (thay đồ) hoặc sang ngày mới, còn lại thì carry kể cả shot sau không khai lại. Shot đã khai look-key nào thì ĐÈ
 *  carry cho key đó. Thuần, dùng chung cho đối chiếu (thanhPhanDuKien) và prompt (sinh-anh btCanh 2D) → một nguồn. */
export function lookMang<T extends { id: number; canh?: string; nhan_vat: number[]; bien_the: number[] }>(
  ds: T[], nhanVat: (Pick<NhanVat, 'id' | 'ten' | 'loai'> & { bien_the?: BienThe[] })[], phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[],
  /** số tập (xv_tap.so) — có thì biến thể look hợp tập (mỗi nhóm đúng một cái) làm BỘ MẶC ĐỊNH, shot khỏi khai lại; bỏ qua vết/trạng thái (theo sự kiện) */ tapSo?: number,
): Map<number, Map<string, LookMang>> {
  const luong = luongShot(ds, phanCanh);
  const btCua = new Map<number, BienThe>();   // id biến thể → biến thể (mọi nhân vật)
  for (const nv of nhanVat) for (const b of nv.bien_the ?? []) btCua.set(b.id, b);
  const GIU = Object.fromEntries(SO_NGUOI.map((x) => [x.k, x.giu])) as Record<string, 'ngay' | 'mai'>;   // mỗi look-key: 'ngay' = reset sang ngày mới · 'mai' = giữ qua ngày (vết)
  const LOOK = new Set<string>(KHOA_LOOK);
  // BỘ MẶC ĐỊNH theo tập: mỗi nhân vật — khoá một-món (trừ vết/trạng thái) có ĐÚNG MỘT biến thể hợp tập → nền; khoá nhiều-món (phụ kiện) → mọi món
  // GẮN ĐÚNG tập này. Shot/carry đè được, backfill khi trống (kể cả sau reset ngày).
  const macDinh = new Map<number, LookMang>();
  if (tapSo != null) for (const nv of nhanVat) {
    if (nv.loai !== 'nhan_vat') continue; const r: LookMang = {};
    for (const k of KHOA_LOOK) {
      if (KHONG_SEED.has(k)) continue;
      const cua = (nv.bien_the ?? []).filter((b) => b.nhom === k);
      const hop = KHOA_NHIEU.has(k) ? cua.filter((b) => b.dung_tap?.includes(tapSo)) : cua.filter((b) => hopTap(b, tapSo));
      if (KHOA_NHIEU.has(k) ? hop.length > 0 : hop.length === 1) r[k] = hop;
    }
    if (Object.keys(r).length) macDinh.set(nv.id, r);
  }
  const giu = new Map<number, LookMang>();   // nhân vật id → look đang giữ (CARRY, chỉ tiến về sau — vết KHÔNG bao giờ hiện trước shot đổ)
  const out = new Map<number, Map<string, LookMang>>();
  for (const c of ds) {
    // sang ngày truyện: sổ quên đồ ngày cũ (trang phục/tóc/trang điểm/phụ kiện/trạng thái = giu 'ngay'); VẾT (giu 'mai') giữ — trừ khi thay đồ (xử dưới).
    // Tạo object MỚI, không delete tại chỗ: object cũ còn được out giữ cho shot trước (chung tham chiếu) → mutate sẽ xoá ngược kết quả đã phát.
    if (luong.get(c.id) === 'ngay') for (const [id, r] of giu) giu.set(id, Object.fromEntries(Object.entries(r).filter(([k]) => GIU[k] !== 'ngay')) as LookMang);
    const theoShot = new Map<number, LookMang>();   // nhân vật id → look-key biến thể KHAI ở shot này (biến thể trong c.bien_the thuộc một nhóm look)
    for (const id of c.bien_the) { const b = btCua.get(id); if (!b || !LOOK.has(b.nhom)) continue; const r = theoShot.get(b.nhan_vat_id) ?? {}; const k = b.nhom as KhoaNguoi; r[k] = [...(r[k] ?? []), b]; theoShot.set(b.nhan_vat_id, r); }
    const m = new Map<string, LookMang>();
    for (const nv of nhanVat) {
      if (nv.loai !== 'nhan_vat' || !c.nhan_vat.includes(nv.id)) continue;
      const g: LookMang = { ...(giu.get(nv.id) ?? {}) }; const kh = theoShot.get(nv.id) ?? {};
      const md = macDinh.get(nv.id); if (md) for (const k of Object.keys(md) as KhoaNguoi[]) if (!g[k]?.length) g[k] = md[k];   // bộ mặc định tập: backfill key trống (sau reset ngày cũng tự về đồ mặc định của tập)
      if (kh.trang_phuc?.length && kh.trang_phuc[0]!.id !== g.trang_phuc?.[0]?.id) delete g.vet;   // thay đồ (biến thể trang phục khác) → vết bám đồ cũ hết
      for (const k of Object.keys(kh) as KhoaNguoi[]) g[k] = kh[k];   // look khai ở shot này ĐÈ carry cho đúng key đó (vết chỉ bật từ shot khai, không trước)
      giu.set(nv.id, g); m.set(nv.ten, g);
    }
    out.set(c.id, m);
  }
  return out;
}
const laNguoiThat = (nv: Pick<NhanVat, 'loai' | 'khoi_3d'> | undefined) => nv?.loai === 'nhan_vat' && nv.khoi_3d?.hinh === 'nguoi';
/** CHẶN — sổ trang phục của người thật: ô trang_phuc / trang / vet ghi chữ tự do (không phải tên biến thể) · biến thể chưa có ảnh tham chiếu ·
 *  người thật chưa khai dáng nghỉ (khoi_3d.dang — ma-nơ-canh đứng nghiêm, ảnh ra người thẳng đuỗn). Đọc trên sổ ĐÃ NỐI (noiHookup). */
export function lookChuaChuan<T extends { id: number; thu_tu?: number; may_3d?: May3d | null; canh?: string }>(ds: T[], nhanVat: (Pick<NhanVat, 'ten' | 'loai' | 'khoi_3d'> & { bien_the?: BienThe[] })[], phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[]): Record<number, string[]> {
  const out: Record<number, string[]> = {}; const hk = noiHookup(ds, phanCanh).may;
  const ten = (k: string) => SO_NGUOI.find((x) => x.k === k)!.ten;
  for (const c of ds) {
    const m = hk.get(c.id) ?? c.may_3d; if (!m) continue; const ghi = new Set<string>();
    for (const v of m.vi_tri) {
      const nv = nhanVat.find((x) => x.ten.trim().toLowerCase() === v.ten.trim().toLowerCase()); if (!laNguoiThat(nv)) continue;
      // Chuyển ngày truyện / nhảy thời gian: sổ quên trang phục ngày cũ — người thật xuất hiện mà chưa có trang phục (sau khi nối) = AI tự chọn đồ.
      // Trước 17/10/2026 chỉ là cảnh báo (thieuKhaiNguoi) và chỉ với nhân vật từng khai; phim AI thì chặn.
      if (!v.an && !ngoaiMo(v as never, 'trang_phuc')) ghi.add(`sổ trang phục: ${v.ten} xuất hiện mà chưa có trang phục cho ngày / lúc này (sang ngày truyện hoặc nhảy thời gian thì sổ quên đồ cũ) — khai trang_phuc = tên biến thể ở lần xuất hiện đầu`);
      if (!(nv!.khoi_3d as { dang?: string[] }).dang?.length) ghi.add(`sổ trang phục: ${v.ten} chưa khai dáng nghỉ (khoi_3d.dang) — ma-nơ-canh đứng nghiêm, ảnh ra người thẳng đuỗn`);
      for (const k of KHOA_LOOK) for (const ket of [false, true]) {
        const t = (ket ? ngoaiKet(v as never, k) : ngoaiMo(v as never, k))?.trim(); if (!t) continue;
        const b = (nv!.bien_the ?? []).find((x) => x.ten.trim().toLowerCase() === t.toLowerCase());
        if (!b) ghi.add(`sổ trang phục: ${v.ten} — ${ten(k)} "${t}" là chữ tự do, chưa trỏ tới biến thể chuẩn hoá — tạo biến thể (hình dạng · màu · cỡ · vị trí + ảnh + dấu 3D nếu là vết) rồi ghi đúng TÊN biến thể vào sổ`);
        else if (!b.anh_url) ghi.add(`sổ trang phục: biến thể "${b.ten}" của ${v.ten} chưa có ảnh tham chiếu`);
      }
    }
    if (ghi.size) (out[c.id] ??= []).push(...ghi);
  }
  return out;
}

export function loiMachTap<T extends ShotMach & { nhan_vat: number[]; canh?: string }>(ds: T[], nhanVat: (Pick<NhanVat, 'id' | 'ten' | 'loai' | 'bo_set_id' | 'khoi_3d'> & { bien_the?: BienThe[] })[], sets: Pick<BoSet, 'id' | 'du_lieu'>[], phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[], /** sơ đồ 2D theo cảnh (xv_tap.khong_gian) — shot KHÔNG thuộc bộ set 3D chấm theo đây thay vì bị bỏ qua */ kgt?: KhongGianTap | null): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const [k, v] of Object.entries(loiMachTap2d(kgt, ds.filter((c) => !boSetCuaShot(c, nhanVat)) as unknown as ShotKg[]))) (out[Number(k)] ??= []).push(...v);
  for (const sid of new Set(ds.map((c) => boSetCuaShot(c, nhanVat)).filter((x): x is number => !!x))) {
    const cua = ds.filter((c) => boSetCuaShot(c, nhanVat) === sid);
    const laNv = (t: string) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten === t);
    for (const r of [lienMachTap(cua, (t) => khoiCua(t, nhanVat), phanCanh), chuoiChuY(cua, choVatSet(sets.find((x) => x.id === sid))), nhipDan(cua), thieuTongThe(cua, laNv), huongDiChuyen(cua, laNv), doiMat(cua, laNv), lookChuaChuan(cua, nhanVat, phanCanh)]) for (const [k, v] of Object.entries(r)) (out[Number(k)] ??= []).push(...v);
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
/** doi(k, giá trị) — đổi giá trị ô sổ người trước khi in (tên biến thể → mô tả en của nó; null = bỏ ô đó): ô trang_phuc / trang / vet là TÊN biến thể
 *  tiếng Việt, in thẳng thành "wearing: Sơ mi trắng" (tập 122). */
export function trangThaiVat(v: May3d['vi_tri'][number], ket = false, doi?: (k: KhoaNguoi, t: string) => string | null): string | null {
  const ds: string[] = [];
  // Sổ trạng thái (script supervisor): nhân vật / vật khai trang (mở) · trang_den (kết) — bẹp, ướt, xù lông, bốc khói… đè lên ảnh mẫu.
  for (const x of SO_NGUOI) { const t0 = ket ? ngoaiKet(v, x.k) : ngoaiMo(v, x.k); const t = t0 && doi ? doi(x.k, t0) : t0; if (t) ds.push(x.en ? `${x.en}: ${t}` : t); }
  const n = v.chia ?? 1;
  if (n > 1) { const cam = !!v.cam && !(ket && v.den); ds.push(cam ? `split into ${n} pieces; only ONE piece here (the holder's share)` : `split into ${n} separate pieces lying side by side, NOT a whole one`); }
  return ds.length ? ds.join('; ') : null;
}
/** Tên này là ĐỒ VẬT (đạo cụ / sản phẩm) của phim — đồ thì nằm lại chỗ cuối cùng (mayDayDu); nhân vật thì không. MỘT luật cho dựng 3D và prompt. */
export const laDoVatPhim = (nv: Pick<NhanVat, 'ten' | 'loai'>[]) => (t: string) => nv.some((x) => (x.loai === 'dao_cu' || x.loai === 'san_pham') && x.ten.trim().toLowerCase() === t.trim().toLowerCase());
