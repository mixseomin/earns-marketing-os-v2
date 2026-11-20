'use server';
// ĐƯỜNG ĐỌC RIÊNG CHO STUDIO 2 (studio2.on.tc, apps/studio2) — anh 19/11/2026: studio.on.tc làm backend cho từng video trên studio2, người dùng
// "kiểm soát sâu hơn các bước sinh video cũng như debug". Chỉ ĐỌC, đi đường đọc song song (doc-ham.ts); studio2 gọi qua POST /api/xv/doc.
// Nhật ký = sổ xv_job của các shot trong một tập: lượt nào, model nào, xong / lỗi, tiền, và CÂU LỆNH NGUYÊN VĂN đã gửi cho model.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from './auth';
import { docPhim, dsCanh, taoPhim, taoTap, xoaAnhGoc, sinhAnhMau, sinhGiong, sinhVideoCanh, sinhNhac, sinhAmThanh } from './actions';
import { sinhKeyframeCanh } from './xuong-video/sinh-anh';
import { dichChuoi } from './xuong-video/claude';
import type { KinhThanh } from './xuong-video/kieu';
import { duocS2, quyenCua, type QuyenS2 } from './quyen-s2';
import { GOI_THE_LOAI, goiTheoKey } from './xuong-video/goi-the-loai';
import { CAU_TRUC, khoaKhung } from './xuong-video/dien-anh';
import { hieuUngKG } from './xuong-video/khan-gia';
import { luatDung } from './xuong-video/luat-dung';
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

/** CREDITS (anh 20/11/2026): 1 credit = 0,1 cent tiền thật. Mọi người hiện KHÔNG GIỚI HẠN; credit đã dùng = tổng chi_phi_cents × 10 của việc xv_job mà các lượt
 *  bước tốn tiền của người đó sinh ra (sổ xv_s2_luot, khoảng job_tu..job_den, cùng phim). Việc chạy nền tính tiền sau thì số tự lên khi việc xong. */
const CREDIT_SQL = (dk: ReturnType<typeof sql>) => sql`SELECT l.user_id, max(l.email) AS email, count(*)::int AS luot,
    coalesce(sum((SELECT sum(j.chi_phi_cents) FROM xv_job j WHERE j.id > l.job_tu AND j.id <= l.job_den
      AND coalesce(j.phim_id, (SELECT t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = j.canh_id)) IS NOT DISTINCT FROM l.phim_id)), 0)::float AS cents,
    max(l.created_at) AS luc
  FROM xv_s2_luot l WHERE l.tien AND l.ok AND l.job_tu IS NOT NULL AND ${dk} GROUP BY l.user_id`;
export type CreditS2 = { khong_gioi_han: true; da_dung: number; luot: number };
export async function creditS2(): Promise<CreditS2 | null> {
  const me = await getCurrentUser(), db = getDb();
  if (!me || !db) return null;
  const r = (await db.execute(CREDIT_SQL(sql`l.user_id = ${me.id}`))) as unknown as Record<string, unknown>[];
  return { khong_gioi_han: true, da_dung: Math.ceil(Number(r[0]?.cents ?? 0) * 10), luot: Number(r[0]?.luot ?? 0) };
}
/** quản trị: credit đã dùng của từng người (kèm tiền thật) */
export async function soCreditS2(): Promise<{ user_id: number; email: string; luot: number; credit: number; cents: number; luc: string }[]> {
  const me = await getCurrentUser(), db = getDb();
  if (!me || me.role !== 'admin' || !db) return [];
  const r = (await db.execute(CREDIT_SQL(sql`true`))) as unknown as Record<string, unknown>[];
  return r.map((x) => ({ user_id: Number(x.user_id), email: String(x.email ?? ''), luot: Number(x.luot), cents: Number(x.cents), credit: Math.ceil(Number(x.cents) * 10), luc: x.luc ? new Date(String(x.luc)).toISOString() : '' })).sort((a, b) => b.credit - a.credit);
}

export type PhimS2 = { id: number; ten: string; loai: string; updated_at: string; anh: string | null; cua_toi: boolean; chu: string; tap_tom: { id: number; so: number; ten: string; so_canh: number }[] };
/** Danh sách phim cho menu của Studio 2 — một câu SQL nhẹ (thay cho dsNhomTuDo tải cả ~7.800 phim rồi lọc). Quản trị: chưa gõ → phim không phải creative
 *  quảng cáo hàng loạt + phim do người trong đội tạo; gõ tên → tìm mọi loại. Người dùng thường (và quản trị khi chiCuaToi): chỉ phim chính họ tạo.
 *  Bỏ template, bản lưu trữ, máy dựng. */
export async function dsPhimS2(tim: string, chiCuaToi = false): Promise<{ ds: PhimS2[]; tong: number }> {
  const db = getDb(), me = await getCurrentUser();
  if (!db || !me || !(await laAdmin())) return { ds: [], tong: 0 };
  const t = String(tim ?? '').trim(), mau = `%${t.replace(/[%_\\]/g, (c) => `\\${c}`)}%`, quanTri = me.role === 'admin' && !chiCuaToi;   // chiCuaToi: quản trị bật "xem như người mới" trên Studio 2 → chỉ phim chính họ tạo, như một người trong đội
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

/** CẨM NANG theo từng loại video (Studio 2 › widget Cẩm nang — anh 20/11/2026: "cần 1 widget hay checklist về quy trình sx từng loại film, video như tài liệu tham khảo").
 *  Đọc thẳng thư viện của studio, không chép tay: gói thể loại (goi-the-loai.ts) + khung beat của gói (dien-anh.ts › CAU_TRUC) + cung cảm xúc người xem (khan-gia.ts)
 *  + luật dựng nhấn (luat-dung.ts). Thư viện đổi thì cẩm nang đổi theo. Chỉ đọc, ai dùng được Studio 2 cũng xem được. */
export async function camNangS2(): Promise<{ key: string; ten: string; ic: string; nhom: string; mo_ta: string; loai: string; ti_le: string; do_dai_s: [number, number]; tham_chieu: string;
  khung: { ten: string; beats: { ten: string; mo_ta: string }[] } | null; khan_gia: string[]; luat: { ten: string; luat: string }[] }[]> {
  return GOI_THE_LOAI.map((g) => { const k = CAU_TRUC[khoaKhung(g.loai, g.the_loai, g.khung)];
    return { key: g.key, ten: g.ten, ic: g.ic, nhom: g.nhom, mo_ta: g.mo_ta, loai: g.loai, ti_le: g.ti_le, do_dai_s: g.do_dai_s, tham_chieu: g.tham_chieu,
      khung: k ? { ten: k.ten, beats: k.beats.map((b) => ({ ten: b.ten, mo_ta: b.mo_ta })) } : null, khan_gia: g.khan_gia.map((y) => hieuUngKG(y)?.ten ?? y),
      luat: g.luat.map((l) => { const x = luatDung(l); return { ten: x?.ten ?? l, luat: x?.luat ?? '' }; }) }; });
}

/** VẼ LẠI ẢNH MẪU của một anchor (Studio 2 › nút "Vẽ lại ảnh mẫu" — anh 20/11/2026 "Đổi ảnh… phải có các nút sinh thủ công cho người dùng"): ảnh mẫu cũ vào
 *  thùng rác của studio (xoaAnhGoc, khôi phục được ở studio) rồi sinh MỘT ảnh gốc mới từ mô tả — không lấy ảnh cũ làm danh tính. TỐN TIỀN: một lượt model ảnh. */
export async function veLaiAnhMauS2(phimId: number, nhanVatId: number, yeuCau = ''): Promise<{ ok: true; data: number } | { ok: false; loi: string }> {
  const db = getDb(); if (!db) return { ok: false, loi: 'no db' };
  const r = ((await db.execute(sql`SELECT anh_ref FROM xv_nhan_vat WHERE id = ${Number(nhanVatId)} AND phim_id = ${Number(phimId)}`)) as unknown as Row[])[0];
  if (!r) return { ok: false, loi: 'mẫu này không thuộc phim' };
  // yêu cầu riêng cho mẫu = thêm vào MÔ TẢ của mẫu (mô tả là danh tính của mẫu: ảnh mẫu này và mọi cảnh về sau đều theo)
  const yc = String(yeuCau ?? '').trim().slice(0, 600);
  if (yc) await db.execute(sql`UPDATE xv_nhan_vat SET mo_ta = rtrim(coalesce(mo_ta, '')) || ${` ${yc}`}, updated_at = now() WHERE id = ${Number(nhanVatId)}`);
  for (const url of (Array.isArray(r.anh_ref) ? r.anh_ref : []) as string[]) { const x = await xoaAnhGoc(Number(nhanVatId), url); if (!x.ok) return { ok: false, loi: x.loi }; }
  const k = await sinhAnhMau(Number(nhanVatId), 1);
  return k.ok ? { ok: true, data: k.data } : { ok: false, loi: k.loi };
}

/** SINH LẠI một thứ của CẢNH kèm YÊU CẦU RIÊNG (Studio 2 — anh 20/11/2026: "ảnh, clip, voice luôn có kèm 1 nút để sinh lại; bấm vào thì hiện 1 input để thêm
 *  yêu cầu riêng (optional); không có thì sinh lại theo cấu trúc chung"). Yêu cầu của người làm (tiếng nào cũng được) được dịch sang tiếng Anh cho câu lệnh ảnh / clip.
 *   anh   → nối vào CHÍNH câu lệnh nguồn của lượt vẽ này (sinh-anh.ts › sinhKeyframeCanh, khối siết) — không sửa thẻ cảnh; ảnh mới là ứng viên
 *   giong → ghi vào chỉ dẫn diễn xuất của từng dòng lời của cảnh rồi đọc lại cảnh đó
 *   clip  → ghi thêm vào hành động của cảnh (câu lệnh clip dựng từ đó) rồi dựng lại / xếp hàng lại
 *  TỐN TIỀN như bước gốc (+ một lượt dịch nhỏ khi có yêu cầu cho ảnh / clip). */
export async function sinhLaiCanhS2(canhId: number, loai: 'anh' | 'giong' | 'clip', yeuCau = ''): Promise<{ ok: true; data: unknown } | { ok: false; loi: string }> {
  const db = getDb(), me = await getCurrentUser(); if (!db || !me) return { ok: false, loi: 'không có quyền' };
  const id = Number(canhId), yc = String(yeuCau ?? '').trim().slice(0, 600);
  const c = ((await db.execute(sql`SELECT c.tap_id, p.kinh_thanh FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id JOIN xv_phim p ON p.id = t.phim_id WHERE c.id = ${id}`)) as unknown as Row[])[0];
  if (!c) return { ok: false, loi: 'không thấy cảnh' };
  let en = '';
  if (yc && loai !== 'giong') { const d = await dichChuoi({ kinhThanh: (c.kinh_thanh ?? {}) as KinhThanh, sang: 'en', ds: [yc], thuatNgu: [] }); if (!d.ok) return { ok: false, loi: `không dịch được yêu cầu: ${d.loi}` }; en = String(d.data[0] ?? '').trim(); }
  if (loai === 'anh') return sinhKeyframeCanh(db, id, 1, undefined, undefined, false, en ? `EXTRA REQUEST FOR THIS FRAME (must be followed, everything else stays as described): ${en}` : '');
  if (loai === 'giong') {
    if (yc) await db.execute(sql`UPDATE xv_canh SET thoai = (SELECT coalesce(jsonb_agg(CASE WHEN coalesce(x->>'loi', '') <> '' THEN x || jsonb_build_object('dien_xuat', ${yc}::text) ELSE x END), '[]'::jsonb) FROM jsonb_array_elements(coalesce(thoai, '[]'::jsonb)) x), updated_at = now() WHERE id = ${id}`);
    return sinhGiong(Number(c.tap_id), [id]);
  }
  if (en) await db.execute(sql`UPDATE xv_canh SET hanh_dong = rtrim(coalesce(hanh_dong, '')) || ${` Extra direction: ${en}`}, prompt_video = rtrim(coalesce(prompt_video, '')) || ${` Extra direction: ${en}`}, updated_at = now() WHERE id = ${id}`);
  return sinhVideoCanh(id);
}

/** ÂM THANH SINH MỚI / SINH LẠI ngay trên timeline Studio 2 (anh 20/11/2026: "các phần âm thanh phải cho nút để sinh mới, sinh lại, modify với prompt thêm… ngay tại vị trí của chúng trên timeline").
 *  loai 'nhac' = nhạc nền cả tập (một bản cho cả tập, yêu cầu riêng nối vào mô tả nhạc); 'td' = tiếng động của MỘT cảnh (mô tả âm thanh của cảnh + yêu cầu riêng).
 *  Yêu cầu tiếng Việt dịch sang tiếng Anh trước (model âm thanh đọc tiếng Anh). Bọc riêng vì studio2 gửi JSON: undefined thành null, mà sinhNhac coi null khác "cả tập". */
export async function sinhAmS2(tapId: number, loai: 'nhac' | 'td', canhId: number | null = null, yeuCau = ''): Promise<{ ok: true; data: unknown } | { ok: false; loi: string }> {
  const db = getDb(), me = await getCurrentUser(); if (!db || !me) return { ok: false, loi: 'không có quyền' };
  const tap = Number(tapId), yc = String(yeuCau ?? '').trim().slice(0, 600);
  const t = ((await db.execute(sql`SELECT p.kinh_thanh FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tap}`)) as unknown as Row[])[0];
  if (!t) return { ok: false, loi: 'không thấy tập' };
  let en = '';
  if (yc) { const d = await dichChuoi({ kinhThanh: (t.kinh_thanh ?? {}) as KinhThanh, sang: 'en', ds: [yc], thuatNgu: [] }); if (!d.ok) return { ok: false, loi: `không dịch được yêu cầu: ${d.loi}` }; en = String(d.data[0] ?? '').trim(); }
  if (loai === 'nhac') return sinhNhac(tap, 'cassetteai/music-generator', undefined, en);
  if (loai !== 'td') return { ok: false, loi: 'loại âm thanh không hợp lệ' };
  const c = ((await db.execute(sql`SELECT id, am_thanh FROM xv_canh WHERE id = ${Number(canhId)} AND tap_id = ${tap}`)) as unknown as Row[])[0];
  if (!c) return { ok: false, loi: 'cảnh không thuộc tập này' };
  return sinhAmThanh(tap, [Number(c.id)], 'sonilo/v1.1/text-to-sound-effects', en ? { moTa: [String(c.am_thanh ?? '').trim(), en].filter(Boolean).join('. ') } : {});
}

export type ViecHangDoi = { id: number; canh_id: number | null; nhan_vat_id: number | null; loai: string; nhan: string; doi_tuong: string; provider: string; model: string; trang_thai: string; loi: string; cents: number; luc: string; xong_luc: string };
/** HÀNG ĐỢI SINH của cả phim (Studio 2 › widget Hàng đợi — anh 20/11/2026: "cần chỗ quản lý các queue sinh ảnh, video, voice… để xem lỗi, thành công cũng như chi phí"):
 *  300 việc mới nhất trong sổ xv_job của phim (ảnh cảnh, ảnh mẫu, giọng, nhạc, clip, chữ, xuất) + tổng theo trạng thái và tổng tiền của cả phim. Chỉ đọc. */
export async function hangDoiS2(phimId: number): Promise<{ viec: ViecHangDoi[]; tong: { cho: number; chay: number; loi: number; xong: number; cents: number } }> {
  const db = getDb(), id = Number(phimId), rong = { viec: [], tong: { cho: 0, chay: 0, loi: 0, xong: 0, cents: 0 } };
  if (!db || !id) return rong;
  const dk = sql`(j.phim_id = ${id} OR j.canh_id IN (SELECT c.id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${id}) OR j.nhan_vat_id IN (SELECT v.id FROM xv_nhan_vat v WHERE v.phim_id = ${id})) AND j.loai <> 'viec_nen'`;
  const r = (await db.execute(sql`SELECT j.id, j.canh_id, j.nhan_vat_id, j.loai, j.nhan, j.provider, j.model, j.trang_thai, j.loi, j.chi_phi_cents, j.created_at, j.updated_at, c.thu_tu, v.ten AS mau_ten
    FROM xv_job j LEFT JOIN xv_canh c ON c.id = j.canh_id LEFT JOIN xv_nhan_vat v ON v.id = j.nhan_vat_id WHERE ${dk} ORDER BY j.id DESC LIMIT 300`)) as unknown as Row[];
  const t = ((await db.execute(sql`SELECT count(*) FILTER (WHERE j.trang_thai IN ('cho', 'hang', 'hang_h3')) AS cho, count(*) FILTER (WHERE j.trang_thai = 'chay') AS chay, count(*) FILTER (WHERE j.trang_thai = 'loi') AS loi,
    count(*) FILTER (WHERE j.trang_thai = 'xong') AS xong, coalesce(sum(j.chi_phi_cents), 0) AS cents FROM xv_job j WHERE ${dk}`)) as unknown as Row[])[0] ?? {};
  return { viec: r.map((x) => ({ id: Number(x.id), canh_id: x.canh_id == null ? null : Number(x.canh_id), nhan_vat_id: x.nhan_vat_id == null ? null : Number(x.nhan_vat_id), loai: String(x.loai ?? ''), nhan: String(x.nhan ?? ''), doi_tuong: x.thu_tu != null ? `Cảnh ${Math.round(Number(x.thu_tu))}` : x.mau_ten ? `Mẫu ${String(x.mau_ten)}` : '',
      provider: String(x.provider ?? ''), model: String(x.model ?? ''), trang_thai: String(x.trang_thai ?? ''), loi: String(x.loi ?? ''), cents: Number(x.chi_phi_cents ?? 0), luc: gio(x.created_at), xong_luc: gio(x.updated_at) })),
    tong: { cho: Number(t.cho ?? 0), chay: Number(t.chay ?? 0), loi: Number(t.loi ?? 0), xong: Number(t.xong ?? 0), cents: Number(t.cents ?? 0) } };
}

/** CHẾ ĐỘ CHO PHÉP VIDEO TRẢ PHÍ của một tập (anh 20/11/2026: "B9 bật chế độ cho phép chạy trả phí") — chỉ quản trị thật. Bật = ghi ky_thuat.tra_phi cho mọi shot
 *  của tập (cổng sinh-video.ts › videoTraPhi): shot đi được đường trả phí (H3 / Seedance / model của phim) mà không phải thử VideoExpress trước. Tắt = gỡ cờ.
 *  0đ: tiền chỉ phát sinh khi lô dựng chạy. Ghi thẳng SQL vì suaCanh lọc ky_thuat qua lamSachKyThuat (bỏ mọi khoá ngoài thư viện, kể cả tra_phi). */
export async function moTraPhiS2(tapId: number, bat = true): Promise<{ ok: true; data: number } | { ok: false; loi: string }> {
  const db = getDb(), me = await getCurrentUser();
  if (!db || !me || me.role !== 'admin') return { ok: false, loi: 'chỉ quản trị mở được video trả phí' };
  const id = Number(tapId);
  const r = (bat
    ? await db.execute(sql`UPDATE xv_canh SET ky_thuat = coalesce(ky_thuat, '{}'::jsonb) || '{"tra_phi": true}'::jsonb, updated_at = now() WHERE tap_id = ${id} AND NOT coalesce(ky_thuat, '{}'::jsonb) ? 'tra_phi' RETURNING id`)
    : await db.execute(sql`UPDATE xv_canh SET ky_thuat = ky_thuat - 'tra_phi', updated_at = now() WHERE tap_id = ${id} AND coalesce(ky_thuat, '{}'::jsonb) ? 'tra_phi' RETURNING id`)) as unknown as Row[];
  return { ok: true, data: r.length };
}

// ── Studio 2 · CƠ SỞ PHÂN TÍCH TỪ ASTROLAS (anh 20/11/2026: nhóm làm video chia sẻ chiêm tinh theo GÓC NHÌN CÁ NHÂN, "sử dụng astrolas làm cơ sở
//    phân tích" — KHÔNG dùng hệ thống Kênh nội dung của Astrolas) ──────────────────────────────────────────────────────────────────────────────────
// Người làm video nêu câu hỏi + (nếu có) ngày giờ nơi sinh của người / cặp họ muốn nói tới → hỏi cầu nối mos2 của site (astrolas.com /api/v1/qa/answer,
// đúng cầu mà mos2 đang dùng cho seeding): site dựng lá số bằng máy tính lá số của nó rồi trả bản phân tích có căn cứ. Bản đó lưu theo tập (xv_s2_co_so),
// Studio 2 ghép vào đề bài của máy viết kịch bản: nhận định chiêm tinh lấy từ đây, còn quan điểm + giọng kể là của người làm video.
export type NguoiSinh = { ten?: string; ngay?: string; gio?: string; noi?: string };
export type CoSoS2 = { tap_id: number; cau_hoi: string; nguoi: NguoiSinh[]; phan_tich: string; nguon: { title: string; url: string }[];
  la_so: { ten: string; mat_troi: string; mat_trang: string; moc: string; dung_duoc: boolean }[]; usd: number; luc: string };
const coSoTu = (x: Row): CoSoS2 => ({ tap_id: Number(x.tap_id), cau_hoi: String(x.cau_hoi ?? ''), nguoi: (Array.isArray(x.nguoi) ? x.nguoi : []) as NguoiSinh[], phan_tich: String(x.phan_tich ?? ''),
  nguon: (Array.isArray(x.nguon) ? x.nguon : []) as CoSoS2['nguon'], la_so: (Array.isArray(x.la_so) ? x.la_so : []) as CoSoS2['la_so'], usd: Number(x.usd ?? 0), luc: gio(x.updated_at) });

/** Bản phân tích Astrolas đang gắn với một tập (chưa hỏi lần nào → null). */
export async function docCoSoS2(tapId: number): Promise<CoSoS2 | null> {
  const db = getDb();
  if (!db || !(await laAdmin())) return null;
  const r = (await db.execute(sql`SELECT * FROM xv_s2_co_so WHERE tap_id = ${Number(tapId)}`)) as unknown as Row[];
  return r[0] ? coSoTu(r[0]) : null;
}

/** Hỏi Astrolas cho một tập: câu hỏi + tối đa 3 người (tên, ngày sinh YYYY-MM-DD, giờ HH:MM, nơi sinh). TỐN TIỀN phía site (mô hình nhỏ, mức "standard":
 *  lá số gốc + các thế góc chiếu) — site trả kèm số tiền ước, ghi vào bảng. Hỏi lại thì bản mới thay bản cũ của tập. */
export async function phanTichAstrolasS2(tapId: number, d: { cauHoi?: string; nguoi?: NguoiSinh[]; ngonNgu?: string }): Promise<{ ok: true; data: CoSoS2 } | { ok: false; loi: string }> {
  const db = getDb(), me = await getCurrentUser();
  if (!db || !me || !(await laAdmin())) return { ok: false, loi: 'không có quyền' };
  const goc = (process.env.ASTROLAS_API_URL || '').replace(/\/+$/, ''), khoa = process.env.ASTROLAS_QA_KEY || '';
  if (!goc || !khoa) return { ok: false, loi: 'máy chủ chưa cấu hình cầu nối Astrolas (ASTROLAS_API_URL + ASTROLAS_QA_KEY)' };
  const cauHoi = String(d.cauHoi ?? '').trim();
  if (cauHoi.length < 8) return { ok: false, loi: 'câu hỏi quá ngắn: nêu rõ bạn muốn Astrolas phân tích điều gì' };
  const nguoi: NguoiSinh[] = [];
  for (const n of (Array.isArray(d.nguoi) ? d.nguoi : []).slice(0, 3)) {
    const ten = String(n?.ten ?? '').trim().slice(0, 120), ngay = String(n?.ngay ?? '').trim(), gioSinh = String(n?.gio ?? '').trim(), noi = String(n?.noi ?? '').trim().slice(0, 200);
    if (!ten && !ngay) continue;
    if (ngay && !/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { ok: false, loi: `ngày sinh "${ngay}" phải theo dạng năm-tháng-ngày, ví dụ 1990-07-23` };
    if (gioSinh && !/^\d{2}:\d{2}$/.test(gioSinh)) return { ok: false, loi: `giờ sinh "${gioSinh}" phải theo dạng giờ:phút, ví dụ 08:30` };
    nguoi.push({ ...(ten ? { ten } : {}), ...(ngay ? { ngay } : {}), ...(gioSinh ? { gio: gioSinh } : {}), ...(noi ? { noi } : {}) });
  }
  const nn = ['vi', 'en', 'es', 'fr', 'de', 'pt', 'it', 'zh', 'ja', 'ko', 'ru'].includes(String(d.ngonNgu)) ? String(d.ngonNgu) : 'vi';
  const than = { question_title: cauHoi.slice(0, 500),
    question_body: `${cauHoi}\n\n[Purpose: a video creator needs a grounded ASTROLOGICAL ANALYSIS to base a personal-viewpoint video on. For every claim, name the real chart factor behind it (planet, sign, house, aspect, with degrees when available). No social-media small talk, no greeting, no sign-off. Write in language: ${nn}.]`,
    question_lang: nn, platform: 'other', tone_target: 'expert', target_words: 380, depth: 'standard', request_id: `studio2-tap-${Number(tapId)}-${Date.now()}`,
    ...(nguoi.length ? { entities: nguoi.map((n) => ({ ...(n.ten ? { name: n.ten } : {}), ...(n.ngay ? { dob: n.ngay } : {}), ...(n.gio ? { birth_time: n.gio } : {}), ...(n.noi ? { birth_place: n.noi } : {}) })) } : {}) };
  type Tra = { ok?: boolean; answer_md?: string; error?: string; code?: string; details?: unknown; cost_estimate_usd?: number; sources?: { title?: string; url?: string }[];
    entities_used?: { name?: string; sun_sign?: string | null; moon_sign?: string | null; rising?: string | null; resolved?: boolean }[] };
  let tra: Tra | null = null, loiGoi = '';
  for (let lan = 0; lan < 2 && !tra; lan++) {   // site đứng sau Cloudflare: 52x thoáng qua thì thử lại một lần
    try {
      const r = await fetch(`${goc}/api/v1/qa/answer`, { method: 'POST', headers: { authorization: `Bearer ${khoa}`, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(than), signal: AbortSignal.timeout(95_000) });
      const j = (await r.json().catch(() => null)) as Tra | null;
      if (r.status >= 500 && r.status !== 500) { loiGoi = `Astrolas trả ${r.status}`; continue; }
      if (!j) { loiGoi = `Astrolas trả ${r.status} không đọc được`; continue; }
      tra = j; if (!r.ok && !j.error) tra.error = `Astrolas trả ${r.status}${j.details ? `: ${JSON.stringify(j.details).slice(0, 200)}` : ''}`;
    } catch (e) { loiGoi = e instanceof Error && e.name === 'TimeoutError' ? 'Astrolas nghĩ quá 95 giây chưa trả lời' : `không gọi được Astrolas: ${e instanceof Error ? e.message : String(e)}`; }
  }
  if (!tra) return { ok: false, loi: loiGoi || 'không gọi được Astrolas' };
  const vanBan = String(tra.answer_md ?? '').replace(/<details>[\s\S]*?<\/details>/gi, '').replace(/<\/?(?:details|summary)>/gi, '').replace(/\s*\[conf:\s*[\d.]+\]/gi, '').trim();
  if (tra.ok === false || !vanBan) return { ok: false, loi: /\b429\b|rate.?limit/i.test(String(tra.error)) ? 'Astrolas đang giới hạn số lượt hỏi, thử lại sau ít phút' : `Astrolas không trả được bản phân tích: ${String(tra.error || tra.code || 'trả rỗng').slice(0, 240)}` };
  const nguon = (tra.sources ?? []).filter((x) => x?.url).slice(0, 8).map((x) => ({ title: String(x.title ?? x.url), url: String(x.url) }));
  const laSo = (tra.entities_used ?? []).map((x) => ({ ten: String(x.name ?? ''), mat_troi: String(x.sun_sign ?? ''), mat_trang: String(x.moon_sign ?? ''), moc: String(x.rising ?? ''), dung_duoc: x.resolved !== false }));
  const r = (await db.execute(sql`INSERT INTO xv_s2_co_so (tap_id, user_id, cau_hoi, nguoi, phan_tich, nguon, la_so, usd)
    VALUES (${Number(tapId)}, ${me.id}, ${cauHoi}, ${JSON.stringify(nguoi)}::jsonb, ${vanBan}, ${JSON.stringify(nguon)}::jsonb, ${JSON.stringify(laSo)}::jsonb, ${Number(tra.cost_estimate_usd ?? 0)})
    ON CONFLICT (tap_id) DO UPDATE SET user_id = EXCLUDED.user_id, cau_hoi = EXCLUDED.cau_hoi, nguoi = EXCLUDED.nguoi, phan_tich = EXCLUDED.phan_tich, nguon = EXCLUDED.nguon, la_so = EXCLUDED.la_so,
      usd = xv_s2_co_so.usd + EXCLUDED.usd, updated_at = now() RETURNING *`)) as unknown as Row[];
  return { ok: true, data: coSoTu(r[0]!) };
}
