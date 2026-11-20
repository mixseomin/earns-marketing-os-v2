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
export type ThietKeNgan = { id: number; ten: string; ma_mau: string | null; rong: number; cao: number; anh_xem: string | null; sua_luc: string };
export type ThietKe = ThietKeNgan & { du_lieu: unknown };

const nguoi = async () => { const me = await getCurrentUser(); return me && (me.role === 'admin' || duocS2(me.id)) ? me : null; };
const gio = (x: unknown) => { const d = x instanceof Date ? x : new Date(String(x ?? '')); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
const ngan = (r: Row): ThietKeNgan => ({ id: Number(r.id), ten: String(r.ten ?? ''), ma_mau: r.ma_mau ? String(r.ma_mau) : null, rong: Number(r.rong), cao: Number(r.cao),
  anh_xem: r.anh_xem ? String(r.anh_xem) : null, sua_luc: gio(r.updated_at) });
/** trần một bản: vhost studio2 nhận tối đa 2 MB mỗi lượt gửi (client_max_body_size) — ảnh nhúng trong lớp phải được trình duyệt thu nhỏ trước */
const TRAN_BYTE = 1_900_000;

export async function dsThietKe(): Promise<ThietKeNgan[]> {
  const db = getDb();
  if (!db || !(await nguoi())) return [];
  const r = (await db.execute(sql`SELECT id, ten, ma_mau, rong, cao, anh_xem, updated_at FROM xv_thiet_ke WHERE NOT luu_tru ORDER BY updated_at DESC LIMIT 200`)) as unknown as Row[];
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

export async function luuThietKe(d: { id?: number | null; ten: string; ma_mau?: string | null; rong: number; cao: number; du_lieu: unknown; anh_xem?: string | null }): Promise<Kq<number>> {
  const db = getDb(), me = await nguoi();
  if (!db || !me) return { ok: false, loi: 'không có quyền dùng công cụ thiết kế' };
  const ten = String(d.ten ?? '').trim().slice(0, 160), rong = Math.round(Number(d.rong)), cao = Math.round(Number(d.cao));
  if (!ten) return { ok: false, loi: 'bản thiết kế cần tên' };
  if (!(rong >= 100 && rong <= 4096 && cao >= 100 && cao <= 4096)) return { ok: false, loi: `khung ${d.rong}×${d.cao} không hợp lệ (100–4096 px mỗi chiều)` };
  if (!d.du_lieu || typeof d.du_lieu !== 'object') return { ok: false, loi: 'thiếu dữ liệu lớp' };
  const json = JSON.stringify(d.du_lieu), anh = d.anh_xem && /^data:image\/(jpeg|png|webp);base64,/.test(d.anh_xem) ? d.anh_xem : null;
  if (json.length + (anh?.length ?? 0) > TRAN_BYTE) return { ok: false, loi: `bản này nặng ${(json.length / 1e6).toFixed(1)} MB, quá trần ${(TRAN_BYTE / 1e6).toFixed(1)} MB — ảnh nhúng quá lớn, hãy dùng ảnh nhỏ hơn` };
  const ma = d.ma_mau ? String(d.ma_mau).slice(0, 80) : null;
  if (d.id) {
    const r = (await db.execute(sql`UPDATE xv_thiet_ke SET ten = ${ten}, ma_mau = ${ma}, rong = ${rong}, cao = ${cao}, du_lieu = ${json}::jsonb, anh_xem = ${anh}, updated_at = now()
      WHERE id = ${Number(d.id)} RETURNING id`)) as unknown as Row[];
    return r[0] ? { ok: true, data: Number(r[0].id) } : { ok: false, loi: `không có bản thiết kế #${d.id}` };
  }
  const r = (await db.execute(sql`INSERT INTO xv_thiet_ke (ten, ma_mau, rong, cao, du_lieu, anh_xem, user_id) VALUES (${ten}, ${ma}, ${rong}, ${cao}, ${json}::jsonb, ${anh}, ${me.id}) RETURNING id`)) as unknown as Row[];
  return r[0] ? { ok: true, data: Number(r[0].id) } : { ok: false, loi: "không ghi được bản thiết kế" };
}

export async function luuTruThietKe(id: number, cat = true): Promise<Kq<number>> {
  const db = getDb();
  if (!db || !(await nguoi())) return { ok: false, loi: 'không có quyền dùng công cụ thiết kế' };
  const r = (await db.execute(sql`UPDATE xv_thiet_ke SET luu_tru = ${!!cat}, updated_at = now() WHERE id = ${Number(id)} RETURNING id`)) as unknown as Row[];
  return r[0] ? { ok: true, data: Number(r[0].id) } : { ok: false, loi: `không có bản thiết kế #${id}` };
}
