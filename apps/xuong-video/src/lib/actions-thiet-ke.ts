'use server';
// CÔNG CỤ THIẾT KẾ của Studio 2 (studio2.on.tc/thiet-ke.html) — anh 20/11/2026 "Thiết kế vẫn làm": dựng mẫu creative tĩnh (poster, khung QC phim ngắn
// kiểu các mẫu etp dt_* / free_*) bằng lớp (Fabric.js) thay cho vẽ tay từng mẫu bằng PIL trong scripts/ethopex/dung-mau.py.
// Bảng xv_thiet_ke (migration 0456). Hàm đọc đi /api/xv/doc (doc-ham.ts), hàm ghi đi /api/xv/ghi (ghi-ham.ts); quyền giống mọi hàm Studio 2:
// quản trị, hoặc người được cấp quyền dùng Studio 2 (LUAT trong quyen-s2.ts, doi 'khong'). Không có hàm xoá — cất đi bằng luuTruThietKe.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from './auth';
import { duocS2 } from './quyen-s2';

type Row = Record<string, unknown>;
type Kq<T> = { ok: true; data: T } | { ok: false; loi: string };
export type ThietKeNgan = { id: number; ten: string; thu_muc: string; ma_mau: string | null; rong: number; cao: number; anh_xem: string | null; sua_luc: string };
export type ThietKe = ThietKeNgan & { du_lieu: unknown };

const nguoi = async () => { const me = await getCurrentUser(); return me && (me.role === 'admin' || duocS2(me.id)) ? me : null; };
const gio = (x: unknown) => { const d = x instanceof Date ? x : new Date(String(x ?? '')); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
const ngan = (r: Row): ThietKeNgan => ({ id: Number(r.id), ten: String(r.ten ?? ''), thu_muc: String(r.thu_muc ?? ''), ma_mau: r.ma_mau ? String(r.ma_mau) : null, rong: Number(r.rong), cao: Number(r.cao),
  anh_xem: r.anh_xem ? String(r.anh_xem) : null, sua_luc: gio(r.updated_at) });
/** trần một bản: vhost studio2 nhận tối đa 2 MB mỗi lượt gửi (client_max_body_size) — ảnh nhúng trong lớp phải được trình duyệt thu nhỏ trước */
const TRAN_BYTE = 1_900_000;
/** chuẩn hoá đường thư mục: 'a / b//c/' → 'a/b/c'; mỗi tầng tối đa 60 ký tự, tối đa 6 tầng; '' = gốc */
function chuanTM(x: unknown): string {
  return String(x ?? '').split('/').map((t) => t.trim().replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean).slice(0, 6).join('/');
}

export async function dsThietKe(): Promise<ThietKeNgan[]> {
  const db = getDb();
  if (!db || !(await nguoi())) return [];
  const r = (await db.execute(sql`SELECT id, ten, thu_muc, ma_mau, rong, cao, anh_xem, updated_at FROM xv_thiet_ke WHERE NOT luu_tru ORDER BY updated_at DESC LIMIT 1000`)) as unknown as Row[];
  return r.map(ngan);
}

export async function docThietKe(id: number): Promise<ThietKe | null> {
  const db = getDb();
  if (!db || !(await nguoi())) return null;
  const r = (await db.execute(sql`SELECT * FROM xv_thiet_ke WHERE id = ${Number(id)}`)) as unknown as Row[];
  return r[0] ? { ...ngan(r[0]), du_lieu: r[0].du_lieu } : null;
}

/** mẫu creative etp (<repo etp2>/src/lib/etp-mau-cr.json) để gắn bản thiết kế vào đúng mẫu — ĐỦ thông tin + ảnh xem trước (anh 20/11/2026: "Các mẫu này phải
 *  trực quan, cho xem trước, thông tin đầy đủ chứ không phải mỗi text"). Ảnh: 'mau-cr:<tệp>' = ảnh trong <repo etp2>/public/mau-cr (đọc lười bằng anhMauCrS2,
 *  vì vhost studio2 chỉ mở /api/xv/doc|nho|ghi) · https = QC đối thủ gốc (etp.doi_thu_qc) và creative máy đã dựng theo mẫu (etp.creative_mau → etp.creative). */
export type AnhMau = { src: string; nhan: string };
export type MauS2 = { ma: string; ten: string; mo_ta: string; nhom: string; loai: string; dang: string; nhan: string; trang_thai: string; dung_cho: string[]; the_loai: string[];
  may: string; quy_trinh: string[]; anh: AnhMau[] };
// etp2 = repo riêng (27/11/2026, github.com/mixseomin/etp2): ETP2_GOC, không có thì <cha của monorepo>/etp2 (box3 /opt/etp2 · iMac ~/Me/GitHub/etp2) — cùng luật apps/etp/goc_etp2.py.
// cwd của studio là apps/xuong-video (hoặc gốc monorepo) → gốc monorepo = thư mục có apps/.
const MONO = () => { const c = process.cwd(); return path.basename(path.dirname(c)) === 'apps' ? path.resolve(c, '../..') : c; };
const GOC_ETP2 = () => process.env.ETP2_GOC || path.resolve(MONO(), '../etp2');
const THU_MUC_MAU = () => [path.join(GOC_ETP2(), 'public/mau-cr')];
const chuoi = (x: unknown) => (x == null ? '' : String(x));
const ds = (x: unknown) => (Array.isArray(x) ? x.map(String).filter(Boolean) : []);
const tepMau = (x: unknown) => { const m = /^\/mau-cr\/([\w.-]+\.(?:jpe?g|png|webp))$/i.exec(chuoi(x)); return m ? `mau-cr:${m[1]}` : ''; };
export async function dsMauCrS2(): Promise<MauS2[]> {
  if (!(await nguoi())) return [];
  let mau: Row[] | null = null;
  for (const p of [path.join(GOC_ETP2(), 'src/lib/etp-mau-cr.json')]) {
    try { mau = ((JSON.parse(await readFile(p, 'utf8')) as { mau?: Row[] }).mau ?? []); break; } catch { /* thử đường kế */ }
  }
  if (!mau) { console.error('[thiết kế] không đọc được etp-mau-cr.json ở repo etp2', GOC_ETP2(), '— đặt ETP2_GOC hoặc clone github.com/mixseomin/etp2 cạnh monorepo'); return []; }
  // ảnh trong kho etp: QC đối thủ gốc theo tham_chieu + tối đa 4 creative mới nhất máy đã dựng theo mỗi mẫu (bảng chưa có thì bỏ, không chết cả danh sách)
  const qc = new Map<string, string>(), crMau = new Map<string, AnhMau[]>(), db = getDb();
  if (db) {
    const ids = [...new Set(mau.flatMap((m) => ds(m.tham_chieu)))].filter((x) => /^\d+$/.test(x));
    try {
      if (ids.length) for (const r of (await db.execute(sql`SELECT library_id::text AS id, anh FROM etp.doi_thu_qc WHERE anh LIKE 'https://%' AND library_id::text IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)) as unknown as Row[]) qc.set(chuoi(r.id), chuoi(r.anh));
    } catch (e) { console.error('[thiết kế] đọc QC đối thủ của mẫu lỗi:', (e as Error).message); }
    try {
      const r = (await db.execute(sql`SELECT mau, anh, ten FROM (SELECT m.mau, c.anh, p.ten, row_number() OVER (PARTITION BY m.mau ORDER BY m.luc DESC) AS hang
        FROM etp.creative_mau m JOIN etp.creative c ON c.creative_id = m.creative_id LEFT JOIN etp.phim p ON p.content_id = c.content_id WHERE c.anh LIKE 'https://%') x WHERE hang <= 4`)) as unknown as Row[];
      for (const x of r) { const k = chuoi(x.mau); crMau.set(k, [...(crMau.get(k) ?? []), { src: chuoi(x.anh), nhan: `Creative máy đã dựng · ${chuoi(x.ten) || 'phim ?'}` }]); }
    } catch (e) { console.error('[thiết kế] đọc creative theo mẫu lỗi:', (e as Error).message); }
  }
  return mau.map((m): MauS2 => {
    const ma = chuoi(m.ma), anh: AnhMau[] = [];
    const them = (src: string, nhan: string) => { if (src && !anh.some((a) => a.src === src)) anh.push({ src, nhan }); };
    them(tepMau(m.anh_dung), `Bản máy dựng${m.anh_dung_phim ? ` · ${chuoi(m.anh_dung_phim)}` : ''}`);
    for (const d of (Array.isArray(m.mau_duyet) ? m.mau_duyet : []) as Row[]) them(tepMau(d.anh), `Bản anh đã duyệt${d.phim ? ` · ${chuoi(d.phim)}` : ''}`);
    them(tepMau(m.anh), 'Bố cục');
    for (const a of crMau.get(ma) ?? []) them(a.src, a.nhan);
    for (const id of ds(m.tham_chieu)) if (qc.has(id)) them(qc.get(id)!, `QC đối thủ gốc · #${id}`);
    return { ma, ten: chuoi(m.ten), mo_ta: chuoi(m.mo_ta), nhom: chuoi(m.nhom), loai: chuoi(m.loai), dang: chuoi(m.dang), nhan: chuoi(m.nhan), trang_thai: chuoi(m.trang_thai),
      dung_cho: ds(m.dung_cho), the_loai: ds(m.the_loai), may: chuoi(m.may), quy_trinh: ds(m.quy_trinh), anh };
  }).filter((m) => m.ma);
}

const nhoAnh = new Map<string, string>();
const KIEU: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
/** ảnh mẫu trong <repo etp2>/public/mau-cr dạng data URL (chỉ tên tệp trơn, không đường dẫn) */
export async function anhMauCrS2(ten: string): Promise<string | null> {
  if (!(await nguoi())) return null;
  const m = /^([\w.-]+)\.(jpe?g|png|webp)$/i.exec(chuoi(ten).replace(/^mau-cr:/, '')); if (!m) return null;
  const k = `mau:${m[0]}`; if (nhoAnh.has(k)) return nhoAnh.get(k)!;
  for (const d of THU_MUC_MAU()) {
    try { const b = await readFile(path.join(d, m[0])); const u = `data:${KIEU[(m[2] ?? "jpg").toLowerCase()] ?? "image/jpeg"};base64,${b.toString('base64')}`; nhoAnh.set(k, u); return u; } catch { /* thử thư mục kế */ }
  }
  return null;
}

/** PHIM THẬT để xem template áp lên (anh 20/11/2026: "Chỗ đó là thiết kế Template. Theo đó mỗi phim khi áp dụng sẽ nhìn thấy kết quả khác nhau") —
 *  phim etp có ảnh bìa sạch (chưa phủ chữ QC): poster gốc máy dựng đã lưu (etp.phim_poster) + ảnh bìa trang phim (etp.noi_dung_phim.thumbnail). */
export type PhimThu = { content_id: number; ten: string; locale: string; mo_ta: string };
export async function dsPhimThuS2(): Promise<PhimThu[]> {
  const db = getDb(); if (!db || !(await nguoi())) return [];
  try {
    const r = (await db.execute(sql`SELECT x.content_id, coalesce(p.ten, x.ten, '') AS ten, coalesce(p.locale, '') AS locale, coalesce(x.mo_ta, '') AS mo_ta FROM (
        SELECT content_id::bigint AS content_id, NULL::text AS ten, NULL::text AS mo_ta, 0 AS uu FROM etp.phim_poster WHERE anh_b64 IS NOT NULL
        UNION ALL SELECT content_id, du_lieu->>'title', du_lieu->>'short_description', 1 FROM etp.noi_dung_phim WHERE du_lieu->>'thumbnail' LIKE 'https://%') x
      LEFT JOIN etp.phim p ON p.content_id = x.content_id ORDER BY x.uu, x.content_id DESC`)) as unknown as Row[];
    const da = new Set<number>();
    return r.filter((x) => { const id = Number(x.content_id); if (da.has(id)) return false; da.add(id); return true; })
      .map((x) => ({ content_id: Number(x.content_id), ten: chuoi(x.ten), locale: chuoi(x.locale), mo_ta: chuoi(x.mo_ta).slice(0, 400) })).filter((x) => x.ten);
  } catch (e) { console.error('[thiết kế] đọc phim thử lỗi:', (e as Error).message); return []; }
}
/** ảnh bìa một phim dạng data URL — máy chủ tự tải (link lấy từ kho theo content_id, không nhận link từ trình duyệt) để khung vẽ xuất ảnh được (không vướng CORS) */
export async function anhPhimS2(contentId: number): Promise<string | null> {
  const db = getDb(); if (!db || !(await nguoi())) return null;
  const id = Math.trunc(Number(contentId)); if (!(id > 0)) return null;
  const k = `phim:${id}`; if (nhoAnh.has(k)) return nhoAnh.get(k)!;
  const r = (await db.execute(sql`SELECT (SELECT anh_b64 FROM etp.phim_poster WHERE content_id = ${id}) AS b64, (SELECT du_lieu->>'thumbnail' FROM etp.noi_dung_phim WHERE content_id = ${id}) AS url`)) as unknown as Row[];
  let u: string | null = r[0]?.b64 ? `data:image/jpeg;base64,${chuoi(r[0].b64)}` : null;
  const url = chuoi(r[0]?.url);
  if (!u && /^https:\/\//.test(url)) {
    try { const t = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0' } }); const kieu = t.headers.get('content-type') || '';
      if (t.ok && /^image\//.test(kieu)) { const b = Buffer.from(await t.arrayBuffer()); if (b.length <= 6_000_000) u = `data:${kieu.split(';')[0]};base64,${b.toString('base64')}`; }
      else console.error(`[thiết kế] ảnh bìa phim ${id}: ${t.status} ${kieu}`); }
    catch (e) { console.error(`[thiết kế] ảnh bìa phim ${id} lỗi:`, (e as Error).message); }
  }
  if (u) { if (nhoAnh.size > 200) nhoAnh.clear(); nhoAnh.set(k, u); }
  return u;
}

export async function luuThietKe(d: { id?: number | null; ten: string; ma_mau?: string | null; thu_muc?: string | null; rong: number; cao: number; du_lieu: unknown; anh_xem?: string | null }): Promise<Kq<number>> {
  const db = getDb(), me = await nguoi();
  if (!db || !me) return { ok: false, loi: 'không có quyền dùng công cụ thiết kế' };
  const ten = String(d.ten ?? '').trim().slice(0, 160), rong = Math.round(Number(d.rong)), cao = Math.round(Number(d.cao));
  if (!ten) return { ok: false, loi: 'bản thiết kế cần tên' };
  if (!(rong >= 100 && rong <= 4096 && cao >= 100 && cao <= 4096)) return { ok: false, loi: `khung ${d.rong}×${d.cao} không hợp lệ (100–4096 px mỗi chiều)` };
  if (!d.du_lieu || typeof d.du_lieu !== 'object') return { ok: false, loi: 'thiếu dữ liệu lớp' };
  const json = JSON.stringify(d.du_lieu), anh = d.anh_xem && /^data:image\/(jpeg|png|webp);base64,/.test(d.anh_xem) ? d.anh_xem : null;
  if (json.length + (anh?.length ?? 0) > TRAN_BYTE) return { ok: false, loi: `bản này nặng ${(json.length / 1e6).toFixed(1)} MB, quá trần ${(TRAN_BYTE / 1e6).toFixed(1)} MB — ảnh nhúng quá lớn, hãy dùng ảnh nhỏ hơn` };
  const ma = d.ma_mau ? String(d.ma_mau).slice(0, 80) : null, tm = chuanTM(d.thu_muc);
  if (d.id) {
    const r = (await db.execute(sql`UPDATE xv_thiet_ke SET ten = ${ten}, thu_muc = ${tm}, ma_mau = ${ma}, rong = ${rong}, cao = ${cao}, du_lieu = ${json}::jsonb, anh_xem = ${anh}, updated_at = now()
      WHERE id = ${Number(d.id)} RETURNING id`)) as unknown as Row[];
    return r[0] ? { ok: true, data: Number(r[0].id) } : { ok: false, loi: `không có bản thiết kế #${d.id}` };
  }
  const r = (await db.execute(sql`INSERT INTO xv_thiet_ke (ten, thu_muc, ma_mau, rong, cao, du_lieu, anh_xem, user_id) VALUES (${ten}, ${tm}, ${ma}, ${rong}, ${cao}, ${json}::jsonb, ${anh}, ${me.id}) RETURNING id`)) as unknown as Row[];
  return r[0] ? { ok: true, data: Number(r[0].id) } : { ok: false, loi: "không ghi được bản thiết kế" };
}

export async function luuTruThietKe(id: number, cat = true): Promise<Kq<number>> {
  const db = getDb();
  if (!db || !(await nguoi())) return { ok: false, loi: 'không có quyền dùng công cụ thiết kế' };
  const r = (await db.execute(sql`UPDATE xv_thiet_ke SET luu_tru = ${!!cat}, updated_at = now() WHERE id = ${Number(id)} RETURNING id`)) as unknown as Row[];
  return r[0] ? { ok: true, data: Number(r[0].id) } : { ok: false, loi: `không có bản thiết kế #${id}` };
}

// ── thư mục: đường dạng 'a/b'. Cây = thư mục đã tạo (kể cả trống) ∪ thư mục đang có bản. Không có hàm xoá thư mục — thư mục trống chỉ là một dòng tên.
export async function dsThuMucTK(): Promise<string[]> {
  const db = getDb();
  if (!db || !(await nguoi())) return [];
  const r = (await db.execute(sql`SELECT duong FROM xv_thiet_ke_thu_muc UNION SELECT DISTINCT thu_muc FROM xv_thiet_ke WHERE NOT luu_tru AND thu_muc <> ''`)) as unknown as Row[];
  const ds = new Set<string>();
  for (const x of r) { const p = String(x.duong ?? '').split('/'); for (let i = 1; i <= p.length; i++) ds.add(p.slice(0, i).join('/')); }   // đủ cả tầng cha
  return [...ds].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
}

export async function taoThuMucTK(duong: string): Promise<Kq<string>> {
  const db = getDb();
  if (!db || !(await nguoi())) return { ok: false, loi: 'không có quyền dùng công cụ thiết kế' };
  const d = chuanTM(duong);
  if (!d) return { ok: false, loi: 'thư mục cần tên' };
  await db.execute(sql`INSERT INTO xv_thiet_ke_thu_muc (duong) VALUES (${d}) ON CONFLICT DO NOTHING`);
  return { ok: true, data: d };
}

/** chuyển một hoặc nhiều bản vào thư mục ('' = gốc) */
export async function chuyenThuMucTK(ids: number[], duong: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db || !(await nguoi())) return { ok: false, loi: 'không có quyền dùng công cụ thiết kế' };
  const ds = [...new Set((Array.isArray(ids) ? ids : [ids]).map(Number).filter((x) => Number.isInteger(x) && x > 0))];
  if (!ds.length) return { ok: false, loi: 'chưa chọn bản nào' };
  const d = chuanTM(duong);
  if (d) await db.execute(sql`INSERT INTO xv_thiet_ke_thu_muc (duong) VALUES (${d}) ON CONFLICT DO NOTHING`);
  const r = (await db.execute(sql`UPDATE xv_thiet_ke SET thu_muc = ${d} WHERE id IN (${sql.join(ds.map((x) => sql`${x}`), sql`, `)}) RETURNING id`)) as unknown as Row[];
  return { ok: true, data: r.length };
}

/** đổi tên / chuyển cả thư mục (kèm thư mục con và mọi bản bên trong): 'a/b' → 'c' thì 'a/b/x' → 'c/x' */
export async function doiThuMucTK(cu: string, moi: string): Promise<Kq<string>> {
  const db = getDb();
  if (!db || !(await nguoi())) return { ok: false, loi: 'không có quyền dùng công cụ thiết kế' };
  const a = chuanTM(cu), b = chuanTM(moi);
  if (!a || !b) return { ok: false, loi: 'thiếu tên thư mục' };
  if (a === b) return { ok: true, data: b };
  if (b.startsWith(a + '/')) return { ok: false, loi: 'không chuyển được thư mục vào chính thư mục con của nó' };
  const n = a.length;
  await db.execute(sql`UPDATE xv_thiet_ke SET thu_muc = ${b} || substr(thu_muc, ${n + 1}) WHERE thu_muc = ${a} OR thu_muc LIKE ${a + '/%'}`);
  await db.execute(sql`INSERT INTO xv_thiet_ke_thu_muc (duong) SELECT ${b} || substr(duong, ${n + 1}) FROM xv_thiet_ke_thu_muc WHERE duong = ${a} OR duong LIKE ${a + '/%'} ON CONFLICT DO NOTHING`);
  await db.execute(sql`INSERT INTO xv_thiet_ke_thu_muc (duong) VALUES (${b}) ON CONFLICT DO NOTHING`);
  await db.execute(sql`DELETE FROM xv_thiet_ke_thu_muc WHERE duong = ${a} OR duong LIKE ${a + '/%'}`);   // chỉ xoá dòng TÊN cũ (đã có bản đổi tên ở trên), không xoá bản thiết kế nào
  return { ok: true, data: b };
}
