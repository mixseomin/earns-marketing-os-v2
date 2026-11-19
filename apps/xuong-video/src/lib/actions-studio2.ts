'use server';
// ĐƯỜNG ĐỌC RIÊNG CHO STUDIO 2 (studio2.on.tc, apps/studio2) — anh 19/11/2026: studio.on.tc làm backend cho từng video trên studio2, người dùng
// "kiểm soát sâu hơn các bước sinh video cũng như debug". Chỉ ĐỌC, đi đường đọc song song (doc-ham.ts); studio2 gọi qua POST /api/xv/doc.
// Nhật ký = sổ xv_job của các shot trong một tập: lượt nào, model nào, xong / lỗi, tiền, và CÂU LỆNH NGUYÊN VĂN đã gửi cho model.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from './auth';

export type LuotSinh = { id: number; canh_id: number; loai: string; dich: string; provider: string; model: string; trang_thai: string; loi: string; cents: number;
  luc: string; xong_luc: string; output_url: string | null; nhan: string; nguon: unknown;
  /** chỉ có ở nhatKyCanh: câu lệnh / lời đọc đã gửi + các tham số còn lại của lượt (bỏ khoá, cắt chuỗi quá dài) */ cau_lenh?: string; chi_tiet?: Record<string, unknown> };
type Row = Record<string, unknown>;
const gio = (x: unknown) => { const d = x instanceof Date ? x : new Date(String(x ?? '')); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
const dong = (r: Row): LuotSinh => ({ id: Number(r.id), canh_id: Number(r.canh_id), loai: String(r.loai ?? ''), dich: String(r.dich ?? ''), provider: String(r.provider ?? ''), model: String(r.model ?? ''),
  trang_thai: String(r.trang_thai ?? ''), loi: String(r.loi ?? ''), cents: Number(r.chi_phi_cents ?? 0), luc: gio(r.created_at), xong_luc: gio(r.updated_at),
  output_url: r.output_url ? String(r.output_url) : null, nhan: String(r.nhan ?? ''), nguon: r.nguon ?? null });
/** Tham số của một lượt cho người gỡ lỗi đọc: bỏ mọi khoá trông như bí mật, chuỗi dài cắt còn 600 ký tự (ảnh base64, khung điều khiển…). */
function gonChiTiet(q: unknown): Record<string, unknown> {
  const ra: Record<string, unknown> = {};
  if (!q || typeof q !== 'object') return ra;
  for (const [k, v] of Object.entries(q as Row)) {
    if (/khoa|key|token|secret|mat_khau|password/i.test(k) || k === 'prompt' || k === 'text') continue;
    if (typeof v === 'string') ra[k] = v.length > 600 ? `${v.slice(0, 600)}… (${v.length} ký tự)` : v;
    else if (typeof v === 'number' || typeof v === 'boolean') ra[k] = v;
    else if (Array.isArray(v)) ra[k] = v.slice(0, 12).map((x) => (typeof x === 'string' ? (x.length > 300 ? `${x.slice(0, 300)}…` : x) : typeof x === 'number' ? x : '…'));
  }
  return ra;
}
const laAdmin = async () => (await getCurrentUser())?.role === 'admin';

/** Mọi lượt sinh (ảnh / video / âm) của các shot trong một tập, mới nhất trước — bản gọn, không kèm câu lệnh (đèn từng bước + danh sách lượt). */
export async function nhatKyTap(tapId: number): Promise<LuotSinh[]> {
  const db = getDb();
  if (!db || !(await laAdmin())) return [];
  try {
    const r = await db.execute(sql`SELECT j.id, j.canh_id, j.loai, j.request->>'dich' AS dich, j.provider, j.model, j.trang_thai, j.loi, j.chi_phi_cents, j.created_at, j.updated_at, j.output_url, j.nhan, j.nguon
      FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE c.tap_id = ${Number(tapId)} AND j.loai <> 'viec_nen' ORDER BY j.id DESC LIMIT 4000`);
    return (r as unknown as Row[]).map(dong);
  } catch { return []; }
}

/** Các lượt sinh của MỘT shot kèm câu lệnh nguyên văn + tham số (mở khi người dùng bấm vào một lượt). */
export async function nhatKyCanh(canhId: number): Promise<LuotSinh[]> {
  const db = getDb();
  if (!db || !(await laAdmin())) return [];
  try {
    const r = await db.execute(sql`SELECT j.id, j.canh_id, j.loai, j.request->>'dich' AS dich, j.provider, j.model, j.trang_thai, j.loi, j.chi_phi_cents, j.created_at, j.updated_at, j.output_url, j.nhan, j.nguon, j.request
      FROM xv_job j WHERE j.canh_id = ${Number(canhId)} AND j.loai <> 'viec_nen' ORDER BY j.id DESC LIMIT 300`);
    return (r as unknown as Row[]).map((x) => { const q = (x.request && typeof x.request === 'object' ? x.request : {}) as Row;
      return { ...dong(x), cau_lenh: String(q.prompt ?? q.text ?? ''), chi_tiet: gonChiTiet(q) }; });
  } catch { return []; }
}
