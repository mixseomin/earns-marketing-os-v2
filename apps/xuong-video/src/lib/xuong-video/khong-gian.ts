// NGUỒN KHÔNG GIAN CHUNG cho mọi bộ chấm (anh 24/10/2026: "còn phần nào chấm điểm ngu lại chỉ áp dụng cho phim 3D?" → "sửa triệt để luật rồi mới sửa
// cảnh phim"). Trước đây cổng mạch tập, Murch, câu hỏi kiểm khung, soi mặt, chấm prompt đọc thẳng may_3d / khung_xam: phim KHÔNG 3D bị bỏ qua im lặng
// hoặc được điểm mặc định. Phim không 3D có đủ dữ kiện tương đương — SƠ ĐỒ CẢNH (so-do-canh.ts, xv_tap.khong_gian.so_do + ky_thuat.sd / sd_ket từng
// shot), SỔ DÁNG + SỔ ĐỒ VẬT (so-vat.ts) — module này trả cùng những câu hỏi 3D trả: ai trong khung · ai thấy mặt · nhìn phía nào · đứng đâu trên màn ·
// dáng gì · đi bao xa · lỗi mạch tập. Bộ chấm: có may_3d → nhánh 3D như cũ; không → hỏi đây; không có cả hai → "chưa chấm", KHÔNG cho điểm.
// Thuần — tự kiểm: khong-gian.test.mts
import { doSau, huongMan, khoangCach, loiCanMat, loiTruc, NUA_LUNG, phiaSang, viTriMan, type ManhSoDo, type SoDo } from './so-do-canh';
import { daMat, loiSoVat, trangThai, type LucKhung, type SoVat, benTay, diChuyenKhongGhi } from './so-vat';

/** xv_tap.khong_gian — ghi bởi scripts/dung-phim-reelshort.mts từ bảng mảnh. */
export type KhongGian = { so_do: SoDo; /** tên nhân vật NGƯỜI (khác mốc / đồ) */ nguoi: string[]; so_vat?: SoVat; so_dang?: SoVat; ten_en?: Record<string, string> };
/** xv_tap.khong_gian: mỗi CẢNH (phan_doan) một sơ đồ riêng. */
export type KhongGianTap = Record<string, KhongGian>;
export const kgCua = (t: KhongGianTap | null | undefined, c: { phan_doan?: string }): KhongGian | null => t?.[c.phan_doan ?? ''] ?? null;
export type ShotKg = { id: number; thu_tu: number; phan_doan?: string; ky_thuat?: { sd?: ManhSoDo; sd_ket?: Partial<ManhSoDo>; co_canh?: string } | null; dan_dung?: { noi?: string; mo?: string; ket?: string } | null; /** lời thoại của shot (ai nói) — luật người nghe nhìn người nói */ thoai?: { nhan_vat: string }[] | null };
type Shot = Pick<ShotKg, 'ky_thuat'>;

/** Sơ đồ của shot ở khung ĐẦU / CUỐI (cuối = sd đè sd_ket). */
export function sdLuc(c: Shot, luc: LucKhung = 'dau'): ManhSoDo | null {
  const a = c.ky_thuat?.sd; if (!a) return null; const k = luc === 'ket' ? c.ky_thuat?.sd_ket : null;
  return k ? { ...a, ...k, o: { ...a.o, ...(k.o ?? {}) } } as ManhSoDo : a;
}
export const coKhongGian = (kg: KhongGian | null | undefined, c: Shot): kg is KhongGian => !!kg?.so_do && !!c.ky_thuat?.sd;
/** Người THẤY trong khung (null = shot không có sơ đồ). */
export function nguoiKhung(kg: KhongGian | null | undefined, c: Shot, luc: LucKhung = 'dau'): string[] | null {
  const m = sdLuc(c, luc); if (!kg || !m) return null; return kg.nguoi.filter((n) => m.o[n] != null && (!m.khung || m.khung.includes(n)));
}
/** Người có chỗ trong cảnh mà NGOÀI khung (model hay tự vẽ thêm khi câu diễn nhắc tên). */
export function nguoiNgoai(kg: KhongGian | null | undefined, c: Shot, luc: LucKhung = 'dau'): string[] {
  const m = sdLuc(c, luc); if (!kg || !m || !m.khung) return []; return kg.nguoi.filter((n) => m.o[n] != null && !m.khung!.includes(n));
}
/** Ngoài khung CẢ shot: có chỗ trong cảnh mà không thấy lúc mở, lúc kết, cũng không đi vào — chữ cho họ làm chủ ngữ là model vẽ thêm người. */
export function ngoaiCaShot(kg: KhongGian, c: Shot): string[] {
  const d = nguoiKhung(kg, c, 'dau') ?? [], k = nguoiKhung(kg, c, 'ket') ?? []; const vao = Object.keys(sdLuc(c, 'dau')?.vao ?? {});
  return [...new Set([...nguoiNgoai(kg, c, 'dau'), ...nguoiNgoai(kg, c, 'ket')])].filter((n) => !d.includes(n) && !k.includes(n) && !vao.includes(n));
}
/** Thấy mặt: true = nhìn ngang / về phía máy · false = quay lưng hoặc nửa lưng (so-do-canh › NUA_LUNG) · null = không khai nhìn đâu. */
export function thayMat(kg: KhongGian, c: Shot, ten: string, luc: LucKhung = 'dau'): boolean | null {
  const m = sdLuc(c, luc); const b = m?.nhin?.[ten]; if (!m || !b) return null; const s = doSau(kg.so_do, m, ten, b); return s == null ? null : s <= NUA_LUNG;
}
/** Phía màn của ánh nhìn (−1 trái, +1 phải, 0 thẳng về máy) — null khi không khai hoặc quay lưng (không đo được mắt). */
export function nhinCan(kg: KhongGian, c: Shot, ten: string, luc: LucKhung = 'dau'): -1 | 0 | 1 | null {
  const m = sdLuc(c, luc); const b = m?.nhin?.[ten]; if (!m || !b) return null; const s = doSau(kg.so_do, m, ten, b) ?? 0; return s > 0.7 ? null : huongMan(kg.so_do, m, ten, b);
}
export const dichNhin = (c: Shot, ten: string, luc: LucKhung = 'dau'): string | null => sdLuc(c, luc)?.nhin?.[ten] ?? null;
/** Chỗ trên màn −1 trái … +1 phải (người đang VÀO: phía mốc vào). */
export function viTri(kg: KhongGian, c: Shot, ten: string, luc: LucKhung = 'dau'): number | null {
  const m = sdLuc(c, luc); if (!m || m.o[ten] == null) return null; return viTriMan(kg.so_do, m, m.vao?.[ten] ?? ten);
}
/** Người đi vào khung trong shot: hướng trên màn (dx > 0 = sang phải) + quãng đi (m, mốc vào → chỗ đứng cuối). */
export function diChuyen(kg: KhongGian, c: Shot): { ten: string; dx: number; met: number }[] {
  const m = sdLuc(c, 'dau'), k = sdLuc(c, 'ket'); if (!m || !k) return [];
  return Object.entries(m.vao ?? {}).flatMap(([ten, tu]) => { const a = kg.so_do.moc[tu]; const den = k.o[ten]; const b = Array.isArray(den) ? den : den ? kg.so_do.moc[den] : null; if (!a || !b) return [];
    return [{ ten, dx: huongMan(kg.so_do, m, tu, ten), met: Math.hypot(b[0] - a[0], b[1] - a[1]) }]; });
}
/** Quãng đi dài nhất trong shot (cm) theo sơ đồ — bản 2D của ngu-phap-may › diCm (vi_tri 3D), cho ngữ pháp máy chọn chuyển động. */
export const diCmShot = (t: KhongGianTap | null | undefined, c: Shot & { phan_doan?: string }): number => { const k = kgCua(t, c); return k && c.ky_thuat?.sd ? Math.round(Math.max(0, ...diChuyen(k, c).map((d) => d.met)) * 100) : 0; };
/** Dáng của người ở khung đầu / cuối (sổ dáng: mốc có ai = người đó) — chữ đọc tiếng Việt + câu tiếng Anh. */
export function dang(kg: KhongGian | null | undefined, thuTu: number, ten: string, luc: LucKhung = 'dau'): { vi: string; en: string; doi: boolean } | null {
  const ds = dangTung(kg, thuTu, ten, luc); if (!ds.length) return null;
  return { vi: ds.map((x) => x.vi).join(' · '), en: ds.map((x) => x.en).join('; '), doi: ds.some((x) => x.doi) };
}
/** CHỖ ĐỨNG là một dòng sổ riêng (tên bắt đầu "Chỗ đứng", vd "Chỗ đứng Hạ": ngoài sảnh → TRONG cabin thang) cạnh dòng dáng — người có thể nhiều dòng sổ dáng.
 *  Phim #353 #17: Hạ phải đứng trong thang mà khung vẽ đứng ngoài — không dòng sổ nào nói, nên prompt lẫn cổng không biết. */
export const laChoDung = (mon: string) => /^chỗ đứng/i.test(mon);
export function dangTung(kg: KhongGian | null | undefined, thuTu: number, ten: string, luc: LucKhung = 'dau'): { mon: string; vi: string; en: string; doi: boolean }[] {
  if (!kg?.so_dang) return []; return Object.entries(trangThai(kg.so_dang, thuTu, luc)).filter(([, m]) => m.ai === ten).map(([mon, m]) => ({ mon, vi: m.vi, en: m.cach, doi: m.tu === thuTu && !!m.su_kien }));
}
/** Đồ người đó đang giữ / đeo ở khung đầu / cuối (sổ đồ vật). */
export function doCam(kg: KhongGian | null | undefined, thuTu: number, ten: string, luc: LucKhung = 'dau'): { mon: string; vi: string; doi: boolean; tay: 'phai' | 'trai' | null }[] {
  if (!kg?.so_vat) return []; return Object.entries(trangThai(kg.so_vat, thuTu, luc)).filter(([, m]) => m.ai === ten).map(([mon, m]) => ({ mon, vi: m.vi, doi: m.tu === thuTu && !!m.su_kien, tay: benTay(m.cach) }));
}
/** Đồ người đó TỪNG giữ / đeo mà giờ đã sang tay khác (sổ đồ vật) — phải VẮNG khỏi người họ (so-vat › cauVat câu vắng mặt, cùng luật). */
export function doDaMat(kg: KhongGian | null | undefined, thuTu: number, ten: string, luc: LucKhung = 'dau'): string[] {
  return kg?.so_vat ? daMat(kg.so_vat, thuTu, ten, luc) : [];
}
const CO_TONG = new Set(['ews', 'ws', 'est']);
/** tầm với để chạm người khác (m) · câu dáng có chạm */
export const TAM_VOI = 1.0; export const LECH_CHEN = 45; const CHAM = /\b(touch\w*|on the [\w ]*? on \w+'s|grip\w*|grab\w*|yank\w*|hand on|fingertips|clench\w* around)\b/i;
/** Bậc cỡ cảnh (luật 30° / 2 bậc) — dùng chung 3D (bo-set-3d) và 2D. */
export const BAC_CO: Record<string, number> = { ews: 0, ws: 1, two: 2, ms: 2, pov: 2, ots: 3, mcu: 3, cu: 4, insert: 4, ecu: 5 };
export const gocLech = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
/** LỖI MẠCH TẬP từ sơ đồ (thay cho bo-set-3d › loiMachTap khi shot không có 3D). Câu mang từ khoá để diem-murch › loai xếp đúng tiêu chí:
 *  "qua trục liền nhau" → mặt phẳng màn hình · "NHÌN → THẤY" → truyện (chuỗi chú ý) · "TỔNG THỂ" → truyện · "đứt mạch" → không gian. */
export function loiMach2d(kg: KhongGian | null | undefined, ds0: ShotKg[]): Record<number, string[]> {
  const out: Record<number, string[]> = {}; if (!kg?.so_do) return out;
  const ds = ds0.filter((c) => c.ky_thuat?.sd).sort((a, b) => a.thu_tu - b.thu_tu); const s = kg.so_do;
  const them = (id: number, x: string) => { (out[id] ??= []).push(x); };
  const theoSo = new Map(ds.map((c) => [c.thu_tu, c]));
  for (let i = 0; i < ds.length; i++) {
    const c = ds[i]!; const a = i > 0 && ds[i - 1]!.phan_doan === c.phan_doan ? ds[i - 1]! : null;
    for (const l of loiCanMat(s, [{ ...sdLuc(c, 'dau')!, thu_tu: c.thu_tu, co: c.ky_thuat?.co_canh }])) them(c.id, `máy không thấy mặt: ${l}`);
    // CẬN mà người trong khung NỬA LƯNG suốt shot (đầu lẫn cuối) — cận cảm xúc mất mặt; vai tiền cảnh khung qua vai (nhìn người khác trong khung) thì đúng ý
    if (/^(cu|mcu|ecu)$/.test(c.ky_thuat?.co_canh ?? '')) for (const n of nguoiKhung(kg, c, 'dau') ?? []) {
      const dich = dichNhin(c, n, 'dau'); if (dich && (nguoiKhung(kg, c, 'dau') ?? []).includes(dich)) continue;
      if (thayMat(kg, c, n, 'dau') === false && thayMat(kg, c, n, 'ket') === false) them(c.id, `máy không thấy mặt: #${c.thu_tu} cận "${sdLuc(c)!.may}" mà ${n} quay lưng / nửa lưng cả shot (nhìn ${dich}) — đổi đích nhìn hoặc đặt máy về phía ${n} đang nhìn`);
    }
    if (!a) continue;
    // TRỤC 180° qua đường cắt: khung CUỐI shot trước ↔ khung ĐẦU shot này
    for (const l of loiTruc(s, [{ ...sdLuc(a, 'ket')!, thu_tu: a.thu_tu }, { ...sdLuc(c, 'dau')!, thu_tu: c.thu_tu }], kg.nguoi)) them(c.id, `qua trục liền nhau: ${l}`);
    // CHUỖI NHÌN → THẤY: cắt theo ánh mắt (noi = 'nhin') thì shot sau phải cho thấy thứ được nhìn — người đó trong khung, mốc đó trên màn, hoặc người đang đi vào từ mốc đó
    if (a.dan_dung?.noi === 'nhin') {
      const k = sdLuc(a, 'ket')!; const d = sdLuc(c, 'dau')!; const thay = nguoiKhung(kg, c, 'dau') ?? [];
      const dich = (nguoiKhung(kg, a, 'ket') ?? []).flatMap((n) => (k.nhin?.[n] ? [[n, k.nhin[n]!] as const] : []));
      // cận chèn đồ người đó đang cầm (#8 Hạ nhìn nắm tay Vivian → #9 cận tay cầm thẻ) cũng là cho thấy người đó
      const chenDo = (x: string) => c.ky_thuat?.co_canh === 'insert' && kg.nguoi.includes(x) && doCam(kg, c.thu_tu, x, 'dau').length > 0;
      const thayDuoc = (x: string) => thay.includes(x) || chenDo(x) || Object.values(d.vao ?? {}).includes(x) || (!kg.nguoi.includes(x) && s.moc[x] != null && Math.abs(viTriMan(s, d, x) ?? 9) <= 1);
      if (dich.length && !dich.some(([, x]) => thayDuoc(x))) them(c.id, `đứt chuỗi NHÌN → THẤY: cuối #${a.thu_tu} ${dich.map(([n, x]) => `${n} nhìn ${x}`).join(', ')} — #${c.thu_tu} cắt theo ánh mắt mà không cho thấy thứ được nhìn`);
    }
  }
  for (let i = 0; i < ds.length; i++) {
    const c = ds[i]!; const a = i > 0 && ds[i - 1]!.phan_doan === c.phan_doan ? ds[i - 1]! : null; const d = sdLuc(c, 'dau')!;
    // NGƯỜI NGHE NHÌN NGƯỜI NÓI (anh 24/10/2026, #12→#13: "Thần hiện ra bên trái mà Hạ quay mặt sang phải thì nhìn cái gì? Phải đớp lại đoạn Thần nói"):
    // shot trước có người nói, shot này không thấy người nói → người trong khung thấy mặt phải nhìn người nói (cố ý né: sd.ne_nhin)
    if (a) { const noi = [...new Set((a.thoai ?? []).map((x) => x.nhan_vat).filter((n) => kg.nguoi.includes(n)))]; const trong = nguoiKhung(kg, c, 'dau') ?? [];
      if (noi.length && !noi.some((n) => trong.includes(n))) for (const y of trong) {
        if (noi.includes(y) || d.ne_nhin?.includes(y) || thayMat(kg, c, y) === false) continue; const dn = dichNhin(c, y, 'dau');
        if (!dn || !noi.includes(dn)) them(c.id, `phản ứng không NHÌN người vừa nói: #${c.thu_tu} ${y} nhìn ${dn ?? '(không khai)'} — cuối #${a.thu_tu} ${noi.join(', ')} vừa nói; người nghe phải nhìn người nói (cố ý né thì khai sd.ne_nhin)`); } }
    // CẬN CHÈN ĐỔI PHÍA (#8→#9: nắm tay vào từ phải, cận chèn quay máy khác lại chìa từ trái): cận chèn đồ trên tay người X phải quay CÙNG HƯỚNG máy
    // với shot trước (lệch ≤ LECH_CHEN°) — phía bàn tay trong ảnh AI đi theo góc máy, không đoán được từ chỗ đứng
    if (a && c.ky_thuat?.co_canh === 'insert' && kg.nguoi.some((n) => d.o[n] != null && doCam(kg, c.thu_tu, n, 'dau').length)) {
      const ma = s.may[sdLuc(a, 'ket')!.may], mc = s.may[d.may];
      if (ma && mc) { const h = (m: { dat: [number, number]; nhin: [number, number] }) => Math.atan2(m.nhin[1] - m.dat[1], m.nhin[0] - m.dat[0]) * 180 / Math.PI; const l = gocLech(h(ma), h(mc));
        if (l > LECH_CHEN) them(c.id, `cận chèn đổi phía: #${c.thu_tu} quay máy "${d.may}" lệch ${Math.round(l)}° so máy "${sdLuc(a, 'ket')!.may}" của #${a.thu_tu} — đồ trên tay sẽ vào khung từ phía khác; dùng máy cùng hướng #${a.thu_tu}`); }
    }
    // CHẠM MÀ ĐỨNG XA (#5–#7: Vivian vươn tay tới thẻ trên ngực Hạ mà sơ đồ đặt cách 1,5 m → clip #7 Vivian đứng cách cả sải tay): dáng của A nhắc chạm B
    // (tay trên / nắm / giật / chạm) thì A–B trong sơ đồ phải ≤ TAM_VOI m
    for (const luc of ['dau', 'ket'] as const) { const m = sdLuc(c, luc)!;
      for (const A of nguoiKhung(kg, c, luc) ?? []) { const dg = dang(kg, c.thu_tu, A, luc)?.en ?? ''; if (!CHAM.test(dg)) continue;
        for (const B of kg.nguoi.filter((n) => n !== A && m.o[n] != null && dg.includes(n.split(' ').pop()!))) { const pa = diemO(kg, m, A), pb = diemO(kg, m, B); if (!pa || !pb) continue; const kc = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
          if (kc > TAM_VOI) them(c.id, `đứt mạch khoảng cách: #${c.thu_tu} ${luc === 'dau' ? 'đầu' : 'cuối'} ${A} chạm ${B} (sổ dáng) mà sơ đồ đặt cách ${kc.toFixed(1)} m — dời chỗ đứng trong sơ đồ về ≤ ${TAM_VOI} m`); } } }
  }
  // TỔNG THỂ: cảnh có ≥ 2 người mà không shot toàn nào cho thấy họ cùng khung — khán giả không biết ai đứng đâu
  for (const pd of new Set(ds.map((c) => c.phan_doan ?? ''))) {
    const cua = ds.filter((c) => (c.phan_doan ?? '') === pd); const nguoi = new Set(cua.flatMap((c) => nguoiKhung(kg, c, 'dau') ?? []));
    if (nguoi.size >= 2 && !cua.some((c) => CO_TONG.has(c.ky_thuat?.co_canh ?? '') && (nguoiKhung(kg, c, 'dau') ?? []).length >= 2)) them(cua[0]!.id, `cảnh "${pd}" thiếu shot TỔNG THỂ: ${[...nguoi].join(', ')} chưa lần nào cùng khung toàn`);
  }
  // ĐỔI CHỖ ĐỨNG không ghi sổ (vào / ra thang, phòng, xe): shot có người đi vào / ra mà sổ không có mốc mới của người đó ở shot đó
  for (const l of diChuyenKhongGhi(ds.map((c) => ({ thu_tu: c.thu_tu, chu: `${c.dan_dung?.mo ?? ''} ${c.dan_dung?.ket ?? ''}`, nguoi: [...new Set([...(nguoiKhung(kg, c, 'dau') ?? []), ...(nguoiKhung(kg, c, 'ket') ?? [])])] })), { ...(kg.so_dang ?? {}), ...(kg.so_vat ?? {}) })) {
    const n = Number(/#(\d+)/.exec(l)?.[1]); const c = theoSo.get(n); if (c) them(c.id, `đứt mạch chỗ đứng: ${l}`);
  }
  // SỔ DÁNG / SỔ ĐỒ VẬT: đổi trạng thái thiếu sự kiện / sự kiện ngoài khung — gắn vào shot có mốc đó
  for (const [so, ten] of [[kg.so_dang, 'dáng'], [kg.so_vat, 'đồ vật']] as const) if (so) for (const l of loiSoVat(so, (n) => (theoSo.has(n) ? nguoiKhung(kg, theoSo.get(n)!, 'ket') : null))) {
    const n = Number(/#(\d+)/.exec(l)?.[1]); const c = theoSo.get(n) ?? ds[0]; if (c) them(c.id, `đứt mạch ${ten}: ${l}`);
  }
  return out;
}
/** Lỗi mạch cả tập: từng cảnh với sơ đồ của nó. */
export function loiMachTap2d(t: KhongGianTap | null | undefined, ds: ShotKg[]): Record<number, string[]> {
  const out: Record<number, string[]> = {}; if (!t) return out;
  for (const pd of new Set(ds.map((c) => c.phan_doan ?? ''))) Object.assign(out, loiMach2d(t[pd], ds.filter((c) => (c.phan_doan ?? '') === pd)));
  return out;
}
const diemO = (kg: KhongGian, m: ManhSoDo, ten: string): [number, number] | null => { const o = m.o[ten]; return o == null ? null : Array.isArray(o) ? o : kg.so_do.moc[o] ?? null; };
/** CẢNH BÁO (không chặn) từ sơ đồ — bản 2D của bo-set-3d › canhBaoMachTap: luật 30° · khoảng nhìn · ống kính lệch cỡ cảnh / quá nhiều tiêu cự. */
export function canhBao2d(kg: KhongGian | null | undefined, ds0: ShotKg[]): Record<number, string[]> {
  const out: Record<number, string[]> = {}; if (!kg?.so_do) return out; const them = (id: number, x: string) => { (out[id] ??= []).push(x); };
  const ds = ds0.filter((c) => c.ky_thuat?.sd).sort((a, b) => a.thu_tu - b.thu_tu); const s = kg.so_do;
  for (let i = 0; i < ds.length; i++) {
    const c = ds[i]!; const d = sdLuc(c, 'dau')!; const co = c.ky_thuat?.co_canh ?? ''; const may = s.may[d.may];
    // luật 30° / 2 bậc: cùng chủ thể chính, máy quanh nó xoay < 30° và cỡ đổi < 2 bậc
    const a = i > 0 && ds[i - 1]!.phan_doan === c.phan_doan ? ds[i - 1]! : null;
    if (a && may) { const k = sdLuc(a, 'ket')!; const sb = (nguoiKhung(kg, c, 'dau') ?? [])[0]; const ma = s.may[k.may];
      if (sb && ma && (nguoiKhung(kg, a, 'ket') ?? [])[0] === sb) { const pa = diemO(kg, k, sb), pb = diemO(kg, d, sb);
        if (pa && pb) { const g = (x: [number, number], p: [number, number]) => (Math.atan2(x[1] - p[1], x[0] - p[0]) * 180) / Math.PI; const lech = gocLech(g(ma.dat, pa), g(may.dat, pb));
          const ca = BAC_CO[a.ky_thuat?.co_canh ?? ''], cb = BAC_CO[co];
          if (lech < 30 && ca != null && cb != null && Math.abs(ca - cb) < 2) them(c.id, `luật 30°: gần như cùng góc máy với #${a.thu_tu} (chỉ xoay ${Math.round(lech)}°) và cỡ cảnh gần nhau (${a.ky_thuat?.co_canh} → ${co}) — cắt sẽ giật như nhảy hình — xoay máy ít nhất 30° quanh ${sb}, hoặc đổi cỡ cảnh hai bậc`); } } }
    // khoảng nhìn: nhìn sang phía nào thì trước mặt phải còn chỗ
    if (!['pov', 'insert'].includes(co)) for (const n of nguoiKhung(kg, c, 'dau') ?? []) { const h = nhinCan(kg, c, n); const x = viTri(kg, c, n); if (h == null || x == null || d.vao?.[n] || thayMat(kg, c, n) !== true) continue;   // khoảng nhìn chỉ có nghĩa khi thấy mặt
      if (h > 0 && x > 0.25) them(c.id, `khoảng nhìn: ${n} nhìn sang phải mà đứng lệch phải màn — trước mặt không còn chỗ — dời máy cho ${n} về phần ba bên trái khung`);
      if (h < 0 && x < -0.25) them(c.id, `khoảng nhìn: ${n} nhìn sang trái mà đứng lệch trái màn — trước mặt không còn chỗ — dời máy cho ${n} về phần ba bên phải khung`); }
    // ống kính hợp cỡ cảnh: cận mặt góc rộng làm méo mặt, toàn cảnh tele làm dẹt không gian
    const ong = may?.ong ?? 35; const bac = BAC_CO[co];
    if (bac != null && bac >= 4 && co !== 'insert' && ong < 50) them(c.id, `ống kính: cỡ ${co} mà máy "${d.may}" ${ong} mm — cận mặt bằng góc rộng làm méo mũi / mặt — dùng 60–85 mm`);
    if (bac != null && bac <= 1 && ong > 40) them(c.id, `ống kính: cỡ ${co} mà máy "${d.may}" ${ong} mm — toàn cảnh tele làm dẹt không gian — dùng 24–35 mm`);
  }
  // bộ ống kính: > 3 tiêu cự trong một cảnh
  for (const pd of new Set(ds.map((c) => c.phan_doan ?? ''))) {
    const cua = ds.filter((c) => (c.phan_doan ?? '') === pd); const dem = new Map<number, number>(); for (const c of cua) { const o = s.may[sdLuc(c, 'dau')!.may]?.ong ?? 35; dem.set(o, (dem.get(o) ?? 0) + 1); }
    if (dem.size > 3) { const it = Math.min(...dem.values()); for (const c of cua) { const o = s.may[sdLuc(c, 'dau')!.may]?.ong ?? 35; if (dem.get(o) === it) them(c.id, `bộ ống kính: cảnh này dùng ${dem.size} tiêu cự (${[...dem.keys()].sort((p, q) => p - q).join(' / ')} mm), ngành giữ 2–3 — đổi máy "${sdLuc(c, 'dau')!.may}" (${o} mm) về tiêu cự đã dùng`); } }
  }
  return out;
}
export function canhBaoTap2d(t: KhongGianTap | null | undefined, ds: ShotKg[]): Record<number, string[]> {
  const out: Record<number, string[]> = {}; if (!t) return out;
  for (const pd of new Set(ds.map((c) => c.phan_doan ?? ''))) Object.assign(out, canhBao2d(t[pd], ds.filter((c) => (c.phan_doan ?? '') === pd)));
  return out;
}
/** KỲ VỌNG DÁNG đo được bằng máy, đọc từ câu sổ dáng (tiếng Anh): đầu (−1 cúi · 0 ngang · +1 ngẩng) + từng tay theo giải phẫu (cao · giua · thap). */
export type KyVongDang = { dau?: -1 | 0 | 1; phai?: 'cao' | 'giua' | 'thap'; trai?: 'cao' | 'giua' | 'thap' };
export function kyVongDang(en: string): KyVongDang {
  const r: KyVongDang = {}; const l = en.toLowerCase();
  if (/\b(bowed|eyes (lowered|dropped|down)|looking down)\b/.test(l.replace(/not looking down/g, ''))) r.dau = -1;
  else if (/(tilted up|chin raised|eyes (lifted|raised))/.test(l)) r.dau = 1;
  else if (/(chin level|head level|not looking down)/.test(l)) r.dau = 0;
  const lop = (v: string): KyVongDang['phai'] => (/(raised beside|raised high|above (her|his) head|held up high)/.test(v) ? 'cao' : /(down at (her|his) sides?|relaxed down|hanging down|lowered to (the )?waist|\barms? down\b)/.test(v) ? 'thap' : /(extended|stretched|on the badge|chest|pulled back|reaching)/.test(v) ? 'giua' : undefined);
  for (const ve of l.split(/[;]/)) {
    if (/both arms/.test(ve)) { const c = lop(ve); if (c) { r.phai = c; r.trai = c; } continue; }
    if (/right (arm|hand|fist)/.test(ve)) { const c = lop(ve); if (c) r.phai = c; }
    if (/left (arm|hand|fist)/.test(ve)) { const c = lop(ve); if (c) r.trai = c; }
  }
  return r;
}
/** So dáng đo được (soi-mat.py: nhin.doc = độ CÚI, + = cúi xuống; tay) với kỳ vọng — chỉ báo chỗ trái ngược rõ (cúi ↔ ngẩng, buông ↔ giơ). NGUONG_CUI: độ. */
export const NGUONG_CUI = 12;
export function loiDoDang(ten: string, kv: KyVongDang, k: { nhin?: { doc: number }; tay?: { phai?: string | null; trai?: string | null } }): string[] {
  const out: string[] = []; const d = k.nhin?.doc;   // d > 0 = cúi
  if (d != null && kv.dau === -1 && d < NGUONG_CUI / 2) out.push(`${ten} không cúi (đo ${d}°), sổ dáng cần cúi`);
  if (d != null && kv.dau === 0 && d > NGUONG_CUI) out.push(`${ten} đang cúi (đo ${d}°), sổ dáng cần cằm ngang`);
  if (d != null && kv.dau === 1 && d > 0) out.push(`${ten} không ngẩng (đo ${d}°), sổ dáng cần ngẩng`);
  const TEN = { cao: 'giơ cao', giua: 'ngang ngực', thap: 'buông' } as const;
  // TAY: so CẶP trạng thái hai tay, không bám bên — máy đo tư thế lẫn trái / phải (đo #353 #10: Vivian giơ thẻ bằng tay phải, máy ghi trái) và model đổi tay
  // thì người xem cũng không thấy khác; chỉ báo khi SỐ tay giơ cao / buông lệch rõ với sổ (buông ↔ giơ cao, vươn tới ↔ buông thõng)
  const canDs = [kv.phai, kv.trai].filter(Boolean) as string[]; const coDs = [k.tay?.phai, k.tay?.trai].filter(Boolean) as string[];
  if (canDs.length && coDs.length) { const dem = (ds: string[], x: string) => ds.filter((v) => v === x).length;
    if (dem(coDs, 'cao') > dem(canDs, 'cao') && canDs.every((v) => v !== 'giua') && coDs.length >= canDs.length) out.push(`${ten} có tay giơ cao, sổ dáng cần ${canDs.map((v) => TEN[v as keyof typeof TEN]).join(' + ')}`);
    else if (dem(canDs, 'cao') > dem(coDs, 'cao') && dem(coDs, 'thap') >= coDs.length && coDs.length >= canDs.length) out.push(`${ten} buông cả hai tay, sổ dáng cần một tay giơ cao`);
    else if (canDs.includes('giua') && coDs.length >= canDs.length && coDs.every((v) => v === 'thap')) out.push(`${ten} buông thõng hai tay, sổ dáng cần vươn tới`); }
  return out;
}
// ── ĐO ĐẦU RA cho các luật trước đây CHỈ LÀ CHỮ (anh 25/10/2026: "đa phần đều kiểu update vào prompt chứ không có giải pháp kỹ thuật") ────────────────
// Mỗi luật: KỲ VỌNG từ sơ đồ / sổ → SO với số đo trên khung thật (soi-mat.py: net.ha, nhin.doc, sang, hop). Ngưỡng ban đầu ghi cạnh; mức 'canh' cho tới khi
// hiệu chỉnh trên bộ mẫu thật (scripts/hieu-chinh-do.mts), 'chan' khi đã đo được tỉ lệ báo nhầm.
export type MucDo = 'chan' | 'canh';
export type DoMat = { ten: string; tin?: boolean; o?: { x: number; y: number }; hop?: number[]; sang?: number; nhin?: { doc: number; net?: { ha: number; cuoi: number; nhiu: number; mim: number } } };
/** Kỳ vọng ÁNH NHÌN DỌC của A (−1 ngước lên · 1 nhìn xuống · 0 ngang · null không khai) — từ chiều cao mắt (sơ đồ mat_cao) của A và người A nhìn. */
export function kyVongDoc(kg: KhongGian, c: Shot, ten: string, luc: LucKhung = 'dau'): -1 | 0 | 1 | null {
  const b = dichNhin(c, ten, luc); const ha = kg.so_do.mat_cao?.[ten], hb = b ? kg.so_do.mat_cao?.[b] : undefined; if (ha == null || hb == null) return null;
  return hb - ha >= 0.08 ? -1 : ha - hb >= 0.08 ? 1 : 0;
}
/** Kỳ vọng PHÍA SÁNG trên mặt (−1 trái màn · 1 phải màn · 0 trước / sau · null không khai đèn). */
export function kyVongSang(kg: KhongGian, c: Shot, luc: LucKhung = 'dau'): -1 | 0 | 1 | null {
  const m = sdLuc(c, luc); if (!m) return null; const p = phiaSang(kg.so_do, m, kg.nguoi); if (!p) return null; return Math.abs(p.ngang) < 0.25 ? 0 : p.ngang < 0 ? -1 : 1;
}
/** Kỳ vọng KHOẢNG CÁCH A–B ('sat' ≤ 1,2 m · 'xa' ≥ 3 m · null giữa chừng / không khai). */
export function kyVongKhoangCach(kg: KhongGian, c: Shot, a: string, b: string, luc: LucKhung = 'dau'): 'sat' | 'xa' | null {
  const m = sdLuc(c, luc); if (!m) return null; const kc = khoangCach(kg.so_do, m, a, b); return kc == null ? null : kc <= 1.2 ? 'sat' : kc >= 3 ? 'xa' : null;
}
export const NGUONG_DO = {
  /** jawOpen trên mức này ở shot KHÔNG thoại = miệng mở như đang nói (đo cần hiệu chỉnh: nói ~0,3–0,6, khép < 0,1) */ ha_mieng: 0.22,
  /** độ cúi (°) ngược chiều kỳ vọng quá mức này mới báo (ngước lên = doc âm) */ doc_nguoc: 8,
  /** |sang| dưới mức này coi như sáng đều — không phán phía */ sang_min: 0.06,
  /** tỉ số khoảng cách hai tâm mặt / bề rộng mặt trung bình: sát ≤ 3,5 · xa ≥ 7 (chỉ khi hai mặt cùng cỡ ±40%, cùng độ sâu) */ sat_max: 3.5, xa_min: 7,
} as const;
/** So số đo một khung với kỳ vọng — trả lỗi kèm mức. coThoai = shot có lời của người trong khung (miệng được mở). */
export function loiDoThem(kg: KhongGian, c: Shot & { thu_tu: number }, luc: LucKhung, ket: DoMat[], coThoai: boolean): { chu: string; muc: MucDo }[] {
  const out: { chu: string; muc: MucDo }[] = []; const tin = ket.filter((k) => k.tin !== false);
  for (const k of tin) {
    // MIỆNG KHÉP khi không thoại (luat im_lang_khep_mieng)
    if (!coThoai && k.nhin?.net && k.nhin.net.ha > NGUONG_DO.ha_mieng) out.push({ chu: `${k.ten} há miệng (${k.nhin.net.ha}) ở shot không có thoại — như đang nói`, muc: 'canh' });
    // ÁNH NHÌN DỌC (luat anh_mat_doc_goc_may): ngước lên = doc âm
    // sổ dáng ghi cúi / cụp mắt ở khung này → ánh nhìn dọc theo sổ dáng, không đòi ngước (#13 cuối: Hạ nghe Thần rồi cụp mắt)
    const dg = dang(kg, c.thu_tu, k.ten, luc); const kdDang = dg ? kyVongDang(dg.en).dau : undefined;
    const kd = kdDang === -1 || kdDang === 1 ? null : kyVongDoc(kg, c, k.ten, luc); const d = k.nhin?.doc;   // 'cằm ngang' trong sổ vẫn cho mắt ngước theo người cao hơn
    // kỳ vọng ngước lên (kd = −1) mà đo cúi rõ (d > ngưỡng), hoặc kỳ vọng nhìn xuống (kd = 1) mà đo ngẩng rõ (d < −ngưỡng)
    if (kd != null && d != null && ((kd === -1 && d > NGUONG_DO.doc_nguoc) || (kd === 1 && d < -NGUONG_DO.doc_nguoc))) out.push({ chu: `${k.ten} ${kd < 0 ? 'lẽ ra ngước lên' : 'lẽ ra nhìn xuống'} (người kia ${kd < 0 ? 'cao' : 'thấp'} hơn) mà đo ${d > 0 ? 'cúi' : 'ngẩng'} ${Math.abs(d)}°`, muc: 'canh' });
    // PHÍA SÁNG (luat lien_tuc_anh_sang)
    const ks = kyVongSang(kg, c, luc);
    if (ks != null && ks !== 0 && k.sang != null && Math.abs(k.sang) >= NGUONG_DO.sang_min && Math.sign(k.sang) !== ks) out.push({ chu: `${k.ten} sáng từ ${k.sang > 0 ? 'PHẢI' : 'TRÁI'} màn (${k.sang}), đèn chính trong sơ đồ ở ${ks < 0 ? 'TRÁI' : 'PHẢI'}`, muc: 'canh' });
  }
  // KHOẢNG CÁCH hai người cùng khung (luat cham_tam_voi): tỉ số khoảng tâm / bề rộng mặt
  for (let i = 0; i < tin.length; i++) for (let j = i + 1; j < tin.length; j++) { const a = tin[i]!, b = tin[j]!; if (!a.o || !b.o || !a.hop || !b.hop) continue;
    const wa = a.hop[2]!, wb = b.hop[2]!; if (!wa || !wb || Math.max(wa, wb) / Math.min(wa, wb) > 1.4) continue;   // khác cỡ mặt = khác độ sâu, tỉ số vô nghĩa
    const ti = Math.abs(a.o.x - b.o.x) / ((wa + wb) / 2); const kv = kyVongKhoangCach(kg, c, a.ten, b.ten, luc);
    if (kv === 'sat' && ti > NGUONG_DO.xa_min) out.push({ chu: `${a.ten} và ${b.ten} cách nhau ${ti.toFixed(1)} bề rộng mặt — sơ đồ nói đứng sát`, muc: 'canh' });
    if (kv === 'xa' && ti < NGUONG_DO.sat_max) out.push({ chu: `${a.ten} và ${b.ten} chỉ cách ${ti.toFixed(1)} bề rộng mặt — sơ đồ nói đứng xa`, muc: 'canh' }); }
  return out;
}
