// NGUỒN KHÔNG GIAN CHUNG cho mọi bộ chấm (anh 24/10/2026: "còn phần nào chấm điểm ngu lại chỉ áp dụng cho phim 3D?" → "sửa triệt để luật rồi mới sửa
// cảnh phim"). Trước đây cổng mạch tập, Murch, câu hỏi kiểm khung, soi mặt, chấm prompt đọc thẳng may_3d / khung_xam: phim KHÔNG 3D bị bỏ qua im lặng
// hoặc được điểm mặc định. Phim không 3D có đủ dữ kiện tương đương — SƠ ĐỒ CẢNH (so-do-canh.ts, xv_tap.khong_gian.so_do + ky_thuat.sd / sd_ket từng
// shot), SỔ DÁNG + SỔ ĐỒ VẬT (so-vat.ts) — module này trả cùng những câu hỏi 3D trả: ai trong khung · ai thấy mặt · nhìn phía nào · đứng đâu trên màn ·
// dáng gì · đi bao xa · lỗi mạch tập. Bộ chấm: có may_3d → nhánh 3D như cũ; không → hỏi đây; không có cả hai → "chưa chấm", KHÔNG cho điểm.
// Thuần — tự kiểm: khong-gian.test.mts
import { doSau, huongMan, loiCanMat, loiTruc, NUA_LUNG, viTriMan, type ManhSoDo, type SoDo } from './so-do-canh';
import { loiSoVat, trangThai, type LucKhung, type SoVat } from './so-vat';

/** xv_tap.khong_gian — ghi bởi scripts/dung-phim-reelshort.mts từ bảng mảnh. */
export type KhongGian = { so_do: SoDo; /** tên nhân vật NGƯỜI (khác mốc / đồ) */ nguoi: string[]; so_vat?: SoVat; so_dang?: SoVat; ten_en?: Record<string, string> };
/** xv_tap.khong_gian: mỗi CẢNH (phan_doan) một sơ đồ riêng. */
export type KhongGianTap = Record<string, KhongGian>;
export const kgCua = (t: KhongGianTap | null | undefined, c: { phan_doan?: string }): KhongGian | null => t?.[c.phan_doan ?? ''] ?? null;
export type ShotKg = { id: number; thu_tu: number; phan_doan?: string; ky_thuat?: { sd?: ManhSoDo; sd_ket?: Partial<ManhSoDo>; co_canh?: string } | null; dan_dung?: { noi?: string } | null };
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
  if (!kg?.so_dang) return null; const m = Object.values(trangThai(kg.so_dang, thuTu, luc)).find((x) => x.ai === ten);
  return m ? { vi: m.vi, en: m.cach, doi: m.tu === thuTu && !!m.su_kien } : null;
}
/** Đồ người đó đang giữ / đeo ở khung đầu / cuối (sổ đồ vật). */
export function doCam(kg: KhongGian | null | undefined, thuTu: number, ten: string, luc: LucKhung = 'dau'): { mon: string; vi: string; doi: boolean }[] {
  if (!kg?.so_vat) return []; return Object.entries(trangThai(kg.so_vat, thuTu, luc)).filter(([, m]) => m.ai === ten).map(([mon, m]) => ({ mon, vi: m.vi, doi: m.tu === thuTu && !!m.su_kien }));
}
const CO_TONG = new Set(['ews', 'ws', 'est']);
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
  // TỔNG THỂ: cảnh có ≥ 2 người mà không shot toàn nào cho thấy họ cùng khung — khán giả không biết ai đứng đâu
  for (const pd of new Set(ds.map((c) => c.phan_doan ?? ''))) {
    const cua = ds.filter((c) => (c.phan_doan ?? '') === pd); const nguoi = new Set(cua.flatMap((c) => nguoiKhung(kg, c, 'dau') ?? []));
    if (nguoi.size >= 2 && !cua.some((c) => CO_TONG.has(c.ky_thuat?.co_canh ?? '') && (nguoiKhung(kg, c, 'dau') ?? []).length >= 2)) them(cua[0]!.id, `cảnh "${pd}" thiếu shot TỔNG THỂ: ${[...nguoi].join(', ')} chưa lần nào cùng khung toàn`);
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
  for (const b of ['phai', 'trai'] as const) { const can = kv[b], co = k.tay?.[b]; if (!can || !co || can === co) continue;
    // chỉ chỗ TRÁI NGƯỢC RÕ: buông ↔ giơ cao, vươn tới ↔ buông thõng (tay đan trước bụng 'giua' khi sổ ghi buông là AI vẽ tự nhiên, không phải lỗi nối)
    if ((can === 'thap' && co === 'cao') || (can === 'cao' && co === 'thap') || (can === 'giua' && co === 'thap')) out.push(`${ten} tay ${b === 'phai' ? 'phải' : 'trái'} ${TEN[co as keyof typeof TEN]}, sổ dáng cần ${TEN[can]}`); }
  return out;
}
