// Dịch CẢ PHIM sang ngôn ngữ khác — MỘT đường cho server action (dichPhimSang) và script trên box (scripts/dich-phim.mts).
// 09/10/2026: bản dịch cũ chỉ dịch chữ màn/thoại/kịch bản/bài đăng; nhãn shot, hành động, diễn xuất, prompt video, tên + mô tả anchor,
// phong cách phim… vẫn tiếng Việt, và mô tả anchor + phong cách được ghép thẳng vào prompt ảnh/video nên Veo in chữ Việt lên clip.
// Cách làm: gom MỌI chuỗi có tiếng Việt (giá trị lẫn khoá JSON) của phim → bỏ trùng → dịch theo lô, lô đầu là chuỗi ngắn (tên, nhãn)
// làm bảng thuật ngữ cho các lô sau → thay lại theo đúng chuỗi gốc ở mọi chỗ. Cùng một chuỗi gốc luôn ra cùng một bản dịch, nên tên
// anchor ↔ người nói trong thoại, phân cảnh ↔ phan_doan của shot ↔ khoá nhạc theo phân cảnh, beat ↔ phan_canh.beat vẫn khớp nhau.
// Mọi bản ghi đổi được chụp vào sổ hoàn tác cùng MỘT nhóm → ↶ Hoàn tác trả lại cả phim.
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { coTiengViet, ghepThoai, giaChuCents, type DongThoai, type KinhThanh } from './kieu';
import { chupTruoc, type BangHoanTac } from './hoan-tac';
import { dichChuoi } from './claude';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;

// ── phần thuần (tự kiểm ở dich-phim.test.mts) ─────────────────────────────────────────────────────────────────────
/** Gom mọi chuỗi có tiếng Việt trong một giá trị JSON (lá chuỗi + khoá object). */
export function gomChuoi(v: unknown, out: Set<string>): void {
  if (typeof v === 'string') { if (coTiengViet(v)) out.add(v); return; }
  if (Array.isArray(v)) { for (const x of v) gomChuoi(x, out); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (coTiengViet(k)) out.add(k); gomChuoi(x, out); }
}
/** Thay từng chuỗi (lá + khoá) theo bảng dịch; chuỗi không có trong bảng giữ nguyên. */
export function thayChuoi<T>(v: T, m: Map<string, string>): T {
  if (typeof v === 'string') return (m.get(v) ?? v) as T;
  if (Array.isArray(v)) return v.map((x) => thayChuoi(x, m)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [m.get(k) ?? k, thayChuoi(x, m)])) as T;
  return v;
}
/** Chia chuỗi thành lô ≤ toiDa ký tự, ngắn trước (tên/nhãn vào lô đầu làm thuật ngữ); chuỗi dài hơn trần đứng một lô riêng. */
export function chiaLo(ds: string[], toiDa = 6000): string[][] {
  const xep = [...ds].sort((a, b) => a.length - b.length);
  const lo: string[][] = []; let cur: string[] = []; let dai = 0;
  for (const s of xep) {
    if (cur.length && dai + s.length > toiDa) { lo.push(cur); cur = []; dai = 0; }
    cur.push(s); dai += s.length;
  }
  if (cur.length) lo.push(cur);
  return lo;
}
/** Thoại sau dịch: lời đổi thì bỏ file giọng cũ của dòng đó (đọc sai ngôn ngữ), lời giữ nguyên thì giữ file. */
export const thoaiSauDich = (goc: DongThoai[], m: Map<string, string>): DongThoai[] =>
  goc.map((d) => { const moi = thayChuoi(d, m); return moi.loi !== d.loi ? { ...moi, url: null } : moi; });
/** Ước tiền (cents): đo thật 09/10/2026 — vào ≈1,1 token/ký tự, ra ≈0,7; mỗi lô thêm ~1,8k token khuôn + thuật ngữ. */
export const uocDichCents = (model: string, chars: number, soLo = 1): number => giaChuCents(model, Math.ceil(chars * 1.1) + soLo * 1800, Math.ceil(chars * 0.7) + soLo * 200);

// ── đọc / ghi DB ──────────────────────────────────────────────────────────────────────────────────────────────────
const COT_TAP = ['ten', 'brief', 'kich_ban', 'tom_tat', 'nhac_mo_ta', 'beats', 'phan_canh', 'nhac_phan_canh', 'bai_dang'] as const;
const COT_CANH = ['canh', 'goc_may', 'hanh_dong', 'am_thanh', 'phan_doan', 'trang_phuc', 'prompt_anh', 'prompt_video', 'chu_man', 'thoai', 'loi_thoai'] as const;
const COT_NV = ['ten', 'mo_ta', 'giong'] as const;
const COT_BT = ['ten', 'mo_ta'] as const;
export type NoiDungPhim = { phimId: number; kt: KinhThanh; tap: Row[]; canh: Row[]; nhanVat: Row[]; bienThe: Row[]; chuoi: string[]; chars: number; soLo: number; soCoGiong: number };

export async function docPhimDich(db: Db, phimId: number): Promise<NoiDungPhim | null> {
  const p = (await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  if (!p[0]) return null;
  const kt = (p[0].kinh_thanh ?? {}) as KinhThanh;
  const tap = (await db.execute(sql`SELECT id, ${sql.raw(COT_TAP.join(', '))} FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so`)) as unknown as Row[];
  const canh = (await db.execute(sql`SELECT c.id, c.thoai_url, ${sql.raw(COT_CANH.map((c) => `c.${c}`).join(', '))} FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${phimId} ORDER BY t.so, c.thu_tu`)) as unknown as Row[];
  const nhanVat = (await db.execute(sql`SELECT id, ${sql.raw(COT_NV.join(', '))} FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[];
  const bienThe = (await db.execute(sql`SELECT b.id, b.ten, b.mo_ta FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id WHERE v.phim_id = ${phimId}`)) as unknown as Row[];
  const s = new Set<string>();
  gomChuoi(kt, s);
  for (const r of tap) for (const c of COT_TAP) gomChuoi(r[c], s);
  // loi_thoai là chuỗi ghép từ thoai → chỉ dịch riêng khi shot không có thoai theo dòng (còn lại ghép lại sau dịch).
  for (const r of canh) for (const c of COT_CANH) if (c !== 'loi_thoai' || !(Array.isArray(r.thoai) && r.thoai.length)) gomChuoi(r[c], s);
  for (const r of nhanVat) for (const c of COT_NV) gomChuoi(r[c], s);
  for (const r of bienThe) for (const c of COT_BT) gomChuoi(r[c], s);
  const chuoi = [...s];
  return { phimId, kt, tap, canh, nhanVat, bienThe, chuoi, chars: chuoi.reduce((a, x) => a + x.length, 0), soLo: chiaLo(chuoi).length,
    soCoGiong: canh.filter((r) => (Array.isArray(r.thoai) ? (r.thoai as DongThoai[]) : []).some((d) => d.url && coTiengViet(d.loi))).length };
}

/** Ghi bản dịch: chụp hoàn tác (một nhóm) rồi UPDATE từng bản ghi có đổi; đặt ngon_ngu mới. Trả số bản ghi đã đổi. */
export async function apDungDichPhim(db: Db, nd: NoiDungPhim, sang: string, m: Map<string, string>, nguoi: string): Promise<{ soBanGhi: number; boGiong: number }> {
  let nhom: string | undefined; let so = 0; let boGiong = 0;
  const chup = async (bang: BangHoanTac, id: number, cot: string[], moTa: string) => { nhom = await chupTruoc(db, { bang, id, cot, moTa, nguoi: nhom ? '' : nguoi, nhom }); };
  const moTa = `dịch phim sang ${sang}`;
  const kt = { ...thayChuoi(nd.kt, m), ngon_ngu: sang };
  await chup('xv_phim', nd.phimId, ['kinh_thanh'], moTa);
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = ${JSON.stringify(kt)}::jsonb, updated_at = now() WHERE id = ${nd.phimId}`); so++;
  for (const r of nd.nhanVat) {
    const moi = thayChuoi({ ten: r.ten, mo_ta: r.mo_ta, giong: r.giong }, m);
    if (moi.ten === r.ten && moi.mo_ta === r.mo_ta && moi.giong === r.giong) continue;
    await chup('xv_nhan_vat', Number(r.id), [...COT_NV], moTa);
    await db.execute(sql`UPDATE xv_nhan_vat SET ten = ${String(moi.ten)}, mo_ta = ${String(moi.mo_ta ?? '')}, giong = ${String(moi.giong ?? '')}, updated_at = now() WHERE id = ${Number(r.id)}`); so++;
  }
  for (const r of nd.bienThe) {
    const moi = thayChuoi({ ten: r.ten, mo_ta: r.mo_ta }, m);
    if (moi.ten === r.ten && moi.mo_ta === r.mo_ta) continue;
    await chup('xv_bien_the', Number(r.id), [...COT_BT], moTa);
    await db.execute(sql`UPDATE xv_bien_the SET ten = ${String(moi.ten)}, mo_ta = ${String(moi.mo_ta ?? '')}, updated_at = now() WHERE id = ${Number(r.id)}`); so++;
  }
  for (const r of nd.tap) {
    const moi = Object.fromEntries(COT_TAP.map((c) => [c, thayChuoi(r[c], m)])) as Row;
    if (COT_TAP.every((c) => JSON.stringify(moi[c]) === JSON.stringify(r[c]))) continue;
    await chup('xv_tap', Number(r.id), [...COT_TAP], moTa);
    await db.execute(sql`UPDATE xv_tap SET ten = ${String(moi.ten ?? '')}, brief = ${String(moi.brief ?? '')}, kich_ban = ${String(moi.kich_ban ?? '')}, tom_tat = ${String(moi.tom_tat ?? '')},
      nhac_mo_ta = ${String(moi.nhac_mo_ta ?? '')}, beats = ${JSON.stringify(moi.beats ?? [])}::jsonb, phan_canh = ${JSON.stringify(moi.phan_canh ?? [])}::jsonb,
      nhac_phan_canh = ${JSON.stringify(moi.nhac_phan_canh ?? {})}::jsonb, bai_dang = ${moi.bai_dang == null ? null : JSON.stringify(moi.bai_dang)}::jsonb, updated_at = now() WHERE id = ${Number(r.id)}`); so++;
  }
  for (const r of nd.canh) {
    const thoaiGoc = (Array.isArray(r.thoai) ? r.thoai : []) as DongThoai[];
    const thoai = thoaiSauDich(thoaiGoc, m);
    boGiong += thoai.filter((d, i) => thoaiGoc[i]?.url && !d.url).length;
    const moi = Object.fromEntries(COT_CANH.filter((c) => c !== 'thoai' && c !== 'loi_thoai').map((c) => [c, thayChuoi(r[c], m)])) as Row;
    const loiThoai = thoai.length ? ghepThoai(thoai) : thayChuoi(String(r.loi_thoai ?? ''), m);
    const doi = Object.keys(moi).some((c) => moi[c] !== r[c]) || JSON.stringify(thoai) !== JSON.stringify(thoaiGoc) || loiThoai !== r.loi_thoai;
    if (!doi) continue;
    await chup('xv_canh', Number(r.id), [...COT_CANH, 'thoai_url'], moTa);
    await db.execute(sql`UPDATE xv_canh SET canh = ${String(moi.canh ?? '')}, goc_may = ${String(moi.goc_may ?? '')}, hanh_dong = ${String(moi.hanh_dong ?? '')}, am_thanh = ${String(moi.am_thanh ?? '')},
      phan_doan = ${String(moi.phan_doan ?? '')}, trang_phuc = ${String(moi.trang_phuc ?? '')}, prompt_anh = ${String(moi.prompt_anh ?? '')}, prompt_video = ${String(moi.prompt_video ?? '')},
      chu_man = ${String(moi.chu_man ?? '')}, thoai = ${JSON.stringify(thoai)}::jsonb, loi_thoai = ${loiThoai}, thoai_url = ${thoai[0]?.url ?? null}, updated_at = now() WHERE id = ${Number(r.id)}`); so++;
  }
  return { soBanGhi: so, boGiong };
}

/** Chạy trọn bước dịch phim (TỐN TIỀN — chỉ gọi khi anh đã duyệt con số): từng lô một, thuật ngữ = bản dịch các chuỗi ngắn (≤ 60 ký tự)
 *  đã có; mỗi lô ghi một job 'chu' kèm tiền thật; lô lỗi → dừng, KHÔNG ghi gì vào phim (tiền các lô đã chạy vẫn vào sổ). */
export async function chayDichPhim(db: Db, phimId: number, sang: string, nguoi: string, baoLo?: (i: number, tong: number) => void): Promise<{ ok: true; data: { soBanGhi: number; boGiong: number; cents: number; conViet: number } } | { ok: false; loi: string }> {
  const nd = await docPhimDich(db, phimId);
  if (!nd) return { ok: false, loi: 'không thấy phim' };
  if (!nd.chuoi.length) return { ok: false, loi: 'phim không còn chữ tiếng Việt nào để dịch' };
  const m = new Map<string, string>(); let cents = 0;
  const lo = chiaLo(nd.chuoi);
  for (const [i, ds] of lo.entries()) {
    baoLo?.(i + 1, lo.length);
    const thuatNgu = [...m.entries()].filter(([a]) => a.length <= 60).slice(0, 200);
    const kq = await dichChuoi({ kinhThanh: nd.kt, sang, ds, thuatNgu });
    if (!kq.ok) return { ok: false, loi: `lô ${i + 1}/${lo.length}: ${kq.loi}` };
    const gia = giaChuCents(kq.model, kq.tokens.in, kq.tokens.out); cents += gia;
    await db.execute(sql`INSERT INTO xv_job (phim_id, nhan, loai, provider, model, trang_thai, chi_phi_cents, tokens_in, tokens_out)
      VALUES (${phimId}, ${`Dịch phim sang ${sang} · lô ${i + 1}/${lo.length}`}, 'chu', 'anthropic', ${kq.model}, 'xong', ${Math.round(gia * 100) / 100}, ${kq.tokens.in}, ${kq.tokens.out})`);
    ds.forEach((g, k) => m.set(g, kq.data[k] ?? g));
  }
  const r = await apDungDichPhim(db, nd, sang, m, nguoi);
  const sau = await docPhimDich(db, phimId);
  return { ok: true, data: { ...r, cents, conViet: sau?.chuoi.length ?? 0 } };
}
