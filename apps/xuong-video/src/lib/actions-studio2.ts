'use server';
// ĐƯỜNG ĐỌC RIÊNG CHO STUDIO 2 (studio2.on.tc, apps/studio2) — anh 19/11/2026: studio.on.tc làm backend cho từng video trên studio2, người dùng
// "kiểm soát sâu hơn các bước sinh video cũng như debug". Chỉ ĐỌC, đi đường đọc song song (doc-ham.ts); studio2 gọi qua POST /api/xv/doc.
// Nhật ký = sổ xv_job của các shot trong một tập: lượt nào, model nào, xong / lỗi, tiền, và CÂU LỆNH NGUYÊN VĂN đã gửi cho model.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from './auth';
import { docPhim, dsCanh, taoPhim, taoTap } from './actions';
import { duocS2, quyenCua, type QuyenS2 } from './quyen-s2';
import { GOI_THE_LOAI, goiTheoKey } from './xuong-video/goi-the-loai';
import type { LoaiPhim } from './xuong-video/kieu';
import { quyTrinh, phimQt, type MucQt } from './xuong-video/quy-trinh';
import { docKinhThanh, locNhanh } from './xuong-video/kieu';
import { MAU_PHIM } from './xuong-video/mau';

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
/** quản trị, hoặc người dùng thường đang ở trong một lượt Studio 2 đã qua kiểm quyền (quyen-s2.ts) */
const laAdmin = async () => { const me = await getCurrentUser(); return !!me && (me.role === 'admin' || duocS2(me.id)); };
const laQuanTri = async () => (await getCurrentUser())?.role === 'admin';

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

/** 🎬 Quy trình của một tập — ĐÚNG hàm quyTrinh mà thanh Quy trình trên studio dùng (tap.tsx), tính ở máy chủ cho Studio 2: từng mục đạt / thiếu gì /
 *  gác cổng nào / làm thế nào. Tập chưa có cảnh → danh sách rỗng (studio2 dẫn bước đầu: brief → viết kịch bản → tách cảnh). */
export async function quyTrinhTap(phimId: number, tapId: number): Promise<MucQt[] | null> {
  if (!(await laAdmin())) return null;
  const [pd, canh] = await Promise.all([docPhim(Number(phimId)), dsCanh(Number(tapId))]);
  const tap = pd?.tap.find((t) => t.id === Number(tapId));
  if (!pd || !tap) return null;
  if (!canh.length) return [];
  try { return quyTrinh({ tap, phim: phimQt(pd.phim.loai, docKinhThanh(pd.phim.kinh_thanh)), canh: locNhanh(canh, null), canhA: locNhanh(canh, 'A'), nhanVat: pd.nhanVat }); }
  catch (e) { console.error('[studio2 quy trình]', e); return null; }
}

/** Các mẫu phim dựng sẵn (mau.ts) cho hộp "Tạo video mới" của Studio 2: tạo từ mẫu = taoPhimMau(key). */
export async function dsMauPhim(): Promise<{ key: string; nhan: string; loai: string; ten: string; mo_ta: string; so_tap: number }[]> {
  if (!(await laAdmin())) return [];
  return MAU_PHIM.map((m) => ({ key: m.key, nhan: m.nhan, loai: m.loai, ten: m.ten, mo_ta: m.mo_ta, so_tap: m.tap.length }));
}

// ── Studio 2 · nhịp 5 + 6 (anh 20/11/2026 "làm đến nhịp 6"): ai đang dùng, phim của ai, tạo phim theo gói thể loại / template, cấp quyền cho đội ──────────

/** Người đang đăng nhập + quyền Studio 2 của họ (quản trị: đủ quyền). */
export async function toiS2(): Promise<{ id: number; ten: string; role: string; quyen: QuyenS2 } | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  return { id: me.id, ten: me.displayName || me.email, role: me.role, quyen: me.role === 'admin' ? { dung: true, sinh: true } : await quyenCua(me.id) };
}

export type PhimS2 = { id: number; ten: string; loai: string; updated_at: string; anh: string | null; cua_toi: boolean; chu: string; tap_tom: { id: number; so: number; ten: string; so_canh: number }[] };
/** Danh sách phim cho menu của Studio 2 — một câu SQL nhẹ (thay cho dsNhomTuDo tải cả ~7.800 phim rồi lọc). Quản trị: chưa gõ → phim không phải creative
 *  quảng cáo hàng loạt + phim do người trong đội tạo; gõ tên → tìm mọi loại. Người dùng thường: chỉ phim của mình. Bỏ template, bản lưu trữ, máy dựng. */
export async function dsPhimS2(tim: string): Promise<{ ds: PhimS2[]; tong: number }> {
  const db = getDb(), me = await getCurrentUser();
  if (!db || !me || !(await laAdmin())) return { ds: [], tong: 0 };
  const t = String(tim ?? '').trim(), mau = `%${t.replace(/[%_\\]/g, (c) => `\\${c}`)}%`, quanTri = me.role === 'admin';
  const loc = quanTri ? (t ? sql`p.ten ILIKE ${mau}` : sql`(p.loai <> 'quang_cao' OR p.owner_user_id IS NOT NULL)`) : (t ? sql`p.owner_user_id = ${me.id} AND p.ten ILIKE ${mau}` : sql`p.owner_user_id = ${me.id}`);
  try {
    const r = (await db.execute(sql`SELECT p.id, p.ten, p.loai, p.updated_at, p.owner_user_id, count(*) OVER () AS tong,
        coalesce(p.poster_url, (SELECT c.keyframe_url FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = p.id AND c.keyframe_url IS NOT NULL ORDER BY c.updated_at DESC, c.id DESC LIMIT 1)) AS anh,
        (SELECT coalesce(m.display_name, u.name, '') FROM users u LEFT JOIN members m ON m.user_id = u.id AND m.project_id IS NULL WHERE u.id = p.owner_user_id LIMIT 1) AS chu,
        (SELECT coalesce(json_agg(json_build_object('id', t.id, 'so', t.so, 'ten', t.ten, 'so_canh', (SELECT count(*) FROM xv_canh c WHERE c.tap_id = t.id)) ORDER BY t.so), '[]'::json) FROM xv_tap t WHERE t.phim_id = p.id) AS tap_tom
      FROM xv_phim p WHERE p.loai <> 'may_dung' AND NOT (p.kinh_thanh ? 'template') AND coalesce((p.kinh_thanh->>'luu_tru')::boolean, false) = false AND ${loc}
      ORDER BY p.updated_at DESC LIMIT 30`)) as unknown as Row[];
    return { tong: Number(r[0]?.tong ?? 0), ds: r.map((x) => ({ id: Number(x.id), ten: String(x.ten ?? ''), loai: String(x.loai ?? ''), updated_at: gio(x.updated_at), anh: x.anh ? String(x.anh) : null,
      cua_toi: Number(x.owner_user_id) === me.id, chu: String(x.chu ?? ''), tap_tom: (Array.isArray(x.tap_tom) ? x.tap_tom : []).map((y: Row) => ({ id: Number(y.id), so: Number(y.so), ten: String(y.ten ?? ''), so_canh: Number(y.so_canh) })) })) };
  } catch (e) { console.error('[studio2 ds phim]', e); return { ds: [], tong: 0 }; }
}

/** 37 gói thể loại của studio (goi-the-loai.ts) cho hộp tạo video: tên, nhóm, mô tả, khung hình, độ dài. */
export async function dsGoiTheLoai(): Promise<{ key: string; ten: string; nhom: string; mo_ta: string; loai: string; ti_le: string; do_dai_s: [number, number] }[]> {
  if (!(await laAdmin())) return [];
  return GOI_THE_LOAI.map((g) => ({ key: g.key, ten: g.ten, nhom: g.nhom, mo_ta: g.mo_ta, loai: g.loai, ti_le: g.ti_le, do_dai_s: g.do_dai_s }));
}

/** Các template đang dùng được (phim đánh dấu template, chưa lưu trữ): tên, mô tả, số shot của tập 1, ảnh đại diện. Ô cần điền: docTemplate(id). */
export async function dsTemplateS2(): Promise<{ id: number; ten: string; mo_ta: string; so_shot: number; anh: string | null }[]> {
  const db = getDb();
  if (!db || !(await laAdmin())) return [];
  try {
    const r = (await db.execute(sql`SELECT p.id, p.ten, coalesce(nullif(p.kinh_thanh->'template'->>'mo_ta', ''), p.mo_ta, '') AS mo_ta,
        (SELECT count(*) FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = p.id) AS so_shot,
        coalesce(p.poster_url, (SELECT c.keyframe_url FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = p.id AND c.keyframe_url IS NOT NULL ORDER BY c.thu_tu LIMIT 1)) AS anh
      FROM xv_phim p WHERE p.kinh_thanh ? 'template' AND coalesce((p.kinh_thanh->>'luu_tru')::boolean, false) = false ORDER BY p.ten`)) as unknown as Row[];
    return r.map((x) => ({ id: Number(x.id), ten: String(x.ten ?? ''), mo_ta: String(x.mo_ta ?? '').slice(0, 300), so_shot: Number(x.so_shot), anh: x.anh ? String(x.anh) : null }));
  } catch (e) { console.error('[studio2 ds template]', e); return []; }
}

/** Tạo phim cho Studio 2 trong một lượt: phim (loại theo gói thể loại nếu chọn gói) + gắn gói vào kinh thánh (gói · thể loại · khung hình — đúng ba khoá
 *  form Kinh thánh của studio đặt khi chọn gói) + tập 1 + ý tưởng + chủ phim = người bấm. 0đ. */
export async function taoPhimS2(d: { ten?: string; loai?: string; goi?: string; brief?: string }): Promise<{ ok: true; data: { phim: number; tap: number } } | { ok: false; loi: string }> {
  const db = getDb(), me = await getCurrentUser();
  if (!db || !me || !(await laAdmin())) return { ok: false, loi: 'không có quyền' };
  const g = goiTheoKey(d.goi), loai = (g?.loai ?? d.loai ?? 'short') as LoaiPhim;
  if (!['short', 'phim', 'quang_cao'].includes(loai)) return { ok: false, loi: 'loại video này tạo ở studio' };
  const r = await taoPhim(String(d.ten ?? ''), loai);
  if (!r.ok) return r;
  const id = r.data;
  await db.execute(sql`UPDATE xv_phim SET owner_user_id = ${me.id}, kinh_thanh = coalesce(kinh_thanh, '{}'::jsonb) || ${JSON.stringify(g ? { goi: g.key, the_loai: g.the_loai, ti_le: g.ti_le } : {})}::jsonb WHERE id = ${id}`);
  let tap = Number(((await db.execute(sql`SELECT id FROM xv_tap WHERE phim_id = ${id} ORDER BY so LIMIT 1`)) as unknown as Row[])[0]?.id ?? 0);
  if (!tap) { const t = await taoTap(id, 'Tập 1'); if (!t.ok) return t; tap = t.data; }
  if (String(d.brief ?? '').trim()) await db.execute(sql`UPDATE xv_tap SET brief = ${String(d.brief).trim()}, updated_at = now() WHERE id = ${tap}`);
  return { ok: true, data: { phim: id, tap } };
}

/** Đội (chỉ quản trị): mọi thành viên mos2 kèm quyền Studio 2 và số phim họ đang giữ. */
export async function dsDoiS2(): Promise<{ user_id: number; ten: string; role: string; dung: boolean; sinh: boolean; so_phim: number }[]> {
  const db = getDb();
  if (!db || !(await laQuanTri())) return [];
  const r = (await db.execute(sql`SELECT m.user_id, coalesce(m.display_name, u.name, u.email) AS ten, m.role, coalesce(q.dung, false) AS dung, coalesce(q.sinh, false) AS sinh,
      (SELECT count(*) FROM xv_phim p WHERE p.owner_user_id = m.user_id) AS so_phim
    FROM members m JOIN users u ON u.id = m.user_id LEFT JOIN xv_s2_quyen q ON q.user_id = m.user_id WHERE m.project_id IS NULL ORDER BY (m.role = 'admin') DESC, m.role, m.user_id`)) as unknown as Row[];
  return r.map((x) => ({ user_id: Number(x.user_id), ten: String(x.ten ?? ''), role: String(x.role ?? ''), dung: !!x.dung, sinh: !!x.sinh, so_phim: Number(x.so_phim) }));
}

/** Cấp / thu quyền Studio 2 cho một thành viên (chỉ quản trị): dung = được dùng Studio 2 trên phim của mình · sinh = được bấm bước tốn tiền. Thu `dung` thì thu luôn `sinh`. */
export async function datQuyenS2(userId: number, dung: boolean, sinh: boolean): Promise<{ ok: true; data: undefined } | { ok: false; loi: string }> {
  const db = getDb(), me = await getCurrentUser();
  if (!db || !me || me.role !== 'admin') return { ok: false, loi: 'chỉ quản trị cấp được quyền' };
  const d = !!dung, s = d && !!sinh;
  await db.execute(sql`INSERT INTO xv_s2_quyen (user_id, dung, sinh, boi) VALUES (${Number(userId)}, ${d}, ${s}, ${me.id})
    ON CONFLICT (user_id) DO UPDATE SET dung = ${d}, sinh = ${s}, boi = ${me.id}, updated_at = now()`);
  return { ok: true, data: undefined };
}
