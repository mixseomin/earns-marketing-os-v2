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

/** mẫu creative etp (apps/etp2/src/lib/etp-mau-cr.json) để gắn bản thiết kế vào đúng mẫu; tệp nằm cùng repo trên box3 */
export async function dsMauCrS2(): Promise<{ ma: string; ten: string; mo_ta: string; nhom: string }[]> {
  if (!(await nguoi())) return [];
  for (const p of [path.join(process.cwd(), '../etp2/src/lib/etp-mau-cr.json'), path.join(process.cwd(), 'apps/etp2/src/lib/etp-mau-cr.json')]) {
    try { const j = JSON.parse(await readFile(p, 'utf8')) as { mau?: Row[] };
      return (j.mau ?? []).map((m) => ({ ma: String(m.ma ?? ''), ten: String(m.ten ?? ''), mo_ta: String(m.mo_ta ?? '').slice(0, 300), nhom: String(m.nhom ?? '') })).filter((m) => m.ma); }
    catch { /* thử đường kế */ }
  }
  console.error('[thiết kế] không đọc được etp-mau-cr.json từ', process.cwd());
  return [];
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
