'use server';

// Xưởng video AI — server actions: phim (bộ) · anchor (nhân vật/sản phẩm/bối cảnh) · tập · cảnh (storyboard) · job (ảnh/video).
// Mạch: kịch bản → tachCanhTap (Claude) → sinhKeyframe (Gemini, ứng viên → chọn) → duyệt → sinhVideoCanh (Veo, async) → kiemVideo (poll).
// Admin-only. Mọi lần gọi model ghi xv_job kèm tiền (cents) để bảng tổng kết chi phí của phim không phải đoán.
import 'server-only';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2 } from '@/lib/r2';
import { sinhAnh, batDauVeo, docVeo, taiVeo, taiAnhBase64, type AnhVao } from '@/lib/xuong-video/google';
import { tachCanh, vietKichBan, promptAnhMau } from '@/lib/xuong-video/claude';
import {
  docKinhThanh, giaAnhCents, giaVideoCents,
  type Phim, type NhanVat, type Tap, type Canh, type Job, type KinhThanh, type LoaiPhim, type LoaiNhanVat, type TrangThaiCanh,
} from '@/lib/xuong-video/kieu';

type Row = Record<string, unknown>;
type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });

async function admin() {
  const me = await getCurrentUser();
  return me && me.role === 'admin' ? me : null;
}
const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => (v == null ? '' : String(v));
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

// ── Đọc ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function dsPhim(project: string): Promise<Phim[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  try {
    const r = await db.execute(sql`
      SELECT p.*,
        (SELECT count(*) FROM xv_tap t WHERE t.phim_id = p.id) AS so_tap,
        (SELECT count(*) FROM xv_nhan_vat v WHERE v.phim_id = p.id) AS so_nhan_vat,
        (SELECT count(*) FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = p.id) AS so_canh,
        (SELECT coalesce(sum(c.chi_phi_cents), 0) FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = p.id)
          + (SELECT coalesce(sum(j.chi_phi_cents), 0) FROM xv_job j JOIN xv_nhan_vat v ON v.id = j.nhan_vat_id WHERE v.phim_id = p.id) AS chi_phi_cents
      FROM xv_phim p WHERE p.project = ${project} ORDER BY p.updated_at DESC`);
    return (r as unknown as Row[]).map(mapPhim);
  } catch { return []; }
}
const mapPhim = (r: Row): Phim => ({
  id: n(r.id), project: s(r.project), ten: s(r.ten), loai: s(r.loai) as LoaiPhim, mo_ta: s(r.mo_ta),
  kinh_thanh: (r.kinh_thanh && typeof r.kinh_thanh === 'object' ? r.kinh_thanh : {}) as KinhThanh, trang_thai: s(r.trang_thai),
  so_tap: n(r.so_tap), so_nhan_vat: n(r.so_nhan_vat), so_canh: n(r.so_canh), chi_phi_cents: n(r.chi_phi_cents), updated_at: s(r.updated_at),
});

export type PhimDayDu = { phim: Phim; nhanVat: NhanVat[]; tap: Tap[] };
export async function docPhim(id: number): Promise<PhimDayDu | null> {
  const db = getDb();
  if (!db || !(await admin())) return null;
  try {
    const p = (await db.execute(sql`SELECT p.*, 0 AS so_tap, 0 AS so_nhan_vat, 0 AS so_canh, 0 AS chi_phi_cents FROM xv_phim p WHERE p.id = ${id}`)) as unknown as Row[];
    if (!p[0]) return null;
    const [nv, tap] = await Promise.all([
      db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${id} ORDER BY loai, id`),
      db.execute(sql`SELECT t.*, (SELECT count(*) FROM xv_canh c WHERE c.tap_id = t.id) AS so_canh FROM xv_tap t WHERE t.phim_id = ${id} ORDER BY so`),
    ]);
    return { phim: mapPhim(p[0]), nhanVat: (nv as unknown as Row[]).map(mapNhanVat), tap: (tap as unknown as Row[]).map(mapTap) };
  } catch { return null; }
}
const mapNhanVat = (r: Row): NhanVat => ({ id: n(r.id), phim_id: n(r.phim_id), loai: s(r.loai) as LoaiNhanVat, ten: s(r.ten), mo_ta: s(r.mo_ta), anh_ref: arr<string>(r.anh_ref), giong: s(r.giong) });
const mapTap = (r: Row): Tap => ({ id: n(r.id), phim_id: n(r.phim_id), so: n(r.so), ten: s(r.ten), kich_ban: s(r.kich_ban), tom_tat: s(r.tom_tat), trang_thai: s(r.trang_thai), video_url: r.video_url == null ? null : s(r.video_url), so_canh: n(r.so_canh) });
const mapCanh = (r: Row): Canh => ({
  id: n(r.id), tap_id: n(r.tap_id), thu_tu: n(r.thu_tu), canh: s(r.canh), goc_may: s(r.goc_may), hanh_dong: s(r.hanh_dong), loi_thoai: s(r.loi_thoai), am_thanh: s(r.am_thanh),
  thoi_luong_s: n(r.thoi_luong_s), nhan_vat: arr<number>(r.nhan_vat).map(Number), prompt_anh: s(r.prompt_anh), prompt_video: s(r.prompt_video),
  keyframe_url: r.keyframe_url == null ? null : s(r.keyframe_url), keyframe_uv: arr<string>(r.keyframe_uv), video_url: r.video_url == null ? null : s(r.video_url),
  trang_thai: s(r.trang_thai) as TrangThaiCanh, loi: s(r.loi), chi_phi_cents: n(r.chi_phi_cents),
});
const mapJob = (r: Row): Job => ({
  id: n(r.id), canh_id: r.canh_id == null ? null : n(r.canh_id), nhan_vat_id: r.nhan_vat_id == null ? null : n(r.nhan_vat_id), loai: s(r.loai), provider: s(r.provider), model: s(r.model),
  trang_thai: s(r.trang_thai), task_id: r.task_id == null ? null : s(r.task_id), output_url: r.output_url == null ? null : s(r.output_url), chi_phi_cents: n(r.chi_phi_cents), loi: s(r.loi), created_at: s(r.created_at),
});

export async function dsCanh(tapId: number): Promise<Canh[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  try {
    const r = await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`);
    return (r as unknown as Row[]).map(mapCanh);
  } catch { return []; }
}

export async function dsJobPhim(phimId: number): Promise<Job[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  try {
    const r = await db.execute(sql`
      SELECT j.* FROM xv_job j
      LEFT JOIN xv_canh c ON c.id = j.canh_id LEFT JOIN xv_tap t ON t.id = c.tap_id LEFT JOIN xv_nhan_vat v ON v.id = j.nhan_vat_id
      WHERE t.phim_id = ${phimId} OR v.phim_id = ${phimId} ORDER BY j.id DESC LIMIT 200`);
    return (r as unknown as Row[]).map(mapJob);
  } catch { return []; }
}

/** Trạng thái khoá: trang báo thiếu gì thay vì để nút Sinh lỗi âm thầm. Chỉ trả có/không, không trả giá trị. */
export async function trangThaiKhoa(): Promise<{ google: boolean; anthropic: boolean; r2: boolean }> {
  if (!(await admin())) return { google: false, anthropic: false, r2: false };
  return {
    google: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    r2: !!(process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET),
  };
}

// ── Phim ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function taoPhim(project: string, ten: string, loai: LoaiPhim): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!ten.trim()) return loi('thiếu tên');
  const kt: KinhThanh = loai === 'quang_cao' ? { ti_le: '9:16' } : {};
  const r = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, kinh_thanh) VALUES (${project}, ${ten.trim()}, ${loai}, ${JSON.stringify(kt)}::jsonb) RETURNING id`)) as unknown as Row[];
  // Short / quảng cáo: một tập sẵn, khỏi bắt người bấm "thêm tập".
  const id = n(r[0]?.id);
  if (loai !== 'phim') await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten) VALUES (${id}, 1, ${ten.trim()})`);
  return { ok: true, data: id };
}

export async function suaPhim(id: number, d: { ten?: string; loai?: LoaiPhim; mo_ta?: string; kinh_thanh?: KinhThanh; trang_thai?: string }): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_phim SET
    ten = coalesce(${d.ten ?? null}, ten), loai = coalesce(${d.loai ?? null}, loai), mo_ta = coalesce(${d.mo_ta ?? null}, mo_ta),
    kinh_thanh = coalesce(${d.kinh_thanh ? JSON.stringify(d.kinh_thanh) : null}::jsonb, kinh_thanh), trang_thai = coalesce(${d.trang_thai ?? null}, trang_thai),
    updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

export async function xoaPhim(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`DELETE FROM xv_phim WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

// ── Anchor ───────────────────────────────────────────────────────────────────────────────────────────────────────

export async function luuNhanVat(d: { id?: number; phim_id: number; loai: LoaiNhanVat; ten: string; mo_ta: string; anh_ref: string[]; giong: string }): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!d.ten.trim()) return loi('thiếu tên');
  const anh = JSON.stringify(d.anh_ref.filter(Boolean).slice(0, 6));
  if (d.id) {
    await db.execute(sql`UPDATE xv_nhan_vat SET loai = ${d.loai}, ten = ${d.ten.trim()}, mo_ta = ${d.mo_ta}, anh_ref = ${anh}::jsonb, giong = ${d.giong}, updated_at = now() WHERE id = ${d.id}`);
    return { ok: true, data: d.id };
  }
  const r = (await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, giong) VALUES (${d.phim_id}, ${d.loai}, ${d.ten.trim()}, ${d.mo_ta}, ${anh}::jsonb, ${d.giong}) RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]?.id) };
}

export async function xoaNhanVat(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`DELETE FROM xv_nhan_vat WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

/** Sinh "ảnh mẫu" cho anchor từ mô tả (character sheet). Ảnh thêm vào anh_ref; các cảnh sau dùng nó làm tham chiếu. */
export async function sinhAnhMau(nhanVatId: number): Promise<Kq<string>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy anchor');
  const nv = mapNhanVat(r[0]);
  if (!nv.mo_ta.trim()) return loi('anchor chưa có mô tả — tả ngoại hình/đặc tính trước rồi mới sinh ảnh mẫu');
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const thamChieu = (await Promise.all(nv.anh_ref.slice(0, 3).map(taiAnhBase64))).filter((x): x is AnhVao => !!x);
  const job = await taoJob({ nhan_vat_id: nhanVatId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { prompt: promptAnhMau(nv, kt) } });
  const kq = await sinhAnh({ model: kt.mo_hinh_anh, prompt: promptAnhMau(nv, kt), thamChieu, tiLe: nv.loai === 'boi_canh' ? kt.ti_le : '1:1', kichCo: '1K' });
  if (!kq.ok) { await xongJob(job, { loi: kq.loi }); return loi(kq.loi); }
  const url = await uploadToR2(`xuong-video/anchor/${nhanVatId}-${randomUUID()}.${duoi(kq.mimeType)}`, kq.data, kq.mimeType);
  if (!url) { await xongJob(job, { loi: 'R2 không nhận ảnh' }); return loi('R2 không nhận ảnh (thiếu cấu hình storage?)'); }
  await xongJob(job, { output_url: url, model: kq.model, chi_phi_cents: giaAnhCents(kq.model) });
  await db.execute(sql`UPDATE xv_nhan_vat SET anh_ref = (anh_ref || ${JSON.stringify([url])}::jsonb), updated_at = now() WHERE id = ${nhanVatId}`);
  return { ok: true, data: url };
}

// ── Tập ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function taoTap(phimId: number, ten: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten) VALUES (${phimId}, (SELECT coalesce(max(so), 0) + 1 FROM xv_tap WHERE phim_id = ${phimId}), ${ten.trim()}) RETURNING id`)) as unknown as Row[];
  await db.execute(sql`UPDATE xv_phim SET updated_at = now() WHERE id = ${phimId}`);
  return { ok: true, data: n(r[0]?.id) };
}

export async function suaTap(id: number, d: { ten?: string; kich_ban?: string; tom_tat?: string; so?: number }): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_tap SET ten = coalesce(${d.ten ?? null}, ten), kich_ban = coalesce(${d.kich_ban ?? null}, kich_ban),
    tom_tat = coalesce(${d.tom_tat ?? null}, tom_tat), so = coalesce(${d.so ?? null}, so), updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

export async function xoaTap(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`DELETE FROM xv_tap WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

async function boiCanhTap(db: NonNullable<ReturnType<typeof getDb>>, tapId: number) {
  const r = (await db.execute(sql`SELECT t.*, p.loai AS p_loai, p.kinh_thanh AS kt, p.id AS p_id FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[];
  if (!r[0]) return null;
  const tap = mapTap(r[0]);
  const nv = (await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${tap.phim_id} ORDER BY loai, id`)) as unknown as Row[];
  const truoc = (await db.execute(sql`SELECT tom_tat FROM xv_tap WHERE phim_id = ${tap.phim_id} AND so < ${tap.so} AND tom_tat <> '' ORDER BY so`)) as unknown as Row[];
  return { tap, loai: s(r[0].p_loai) as LoaiPhim, kt: (r[0].kt ?? {}) as KinhThanh, nhanVat: nv.map(mapNhanVat), tapTruoc: truoc.map((x) => s(x.tom_tat)) };
}

/** Claude viết kịch bản từ brief → lưu vào tập (người sửa tiếp trong ô kịch bản). */
export async function vietKichBanTap(tapId: number, brief: string, thoiLuongS: number): Promise<Kq<string>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  if (!brief.trim()) return loi('thiếu brief');
  const kq = await vietKichBan({ loai: bc.loai, kinhThanh: bc.kt, nhanVat: bc.nhanVat, brief, tapSo: bc.loai === 'phim' ? bc.tap.so : undefined, tapTruoc: bc.tapTruoc, thoiLuongS });
  if (!kq.ok) return loi(kq.loi);
  await db.execute(sql`UPDATE xv_tap SET kich_ban = ${kq.kichBan}, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: kq.kichBan };
}

/** Tách kịch bản thành cảnh. Thay toàn bộ cảnh đang là NHÁP của tập; cảnh đã có keyframe/video giữ nguyên (không mất tiền đã tốn). */
export async function tachCanhTap(tapId: number, soCanh: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  if (!bc.tap.kich_ban.trim()) return loi('tập chưa có kịch bản');
  const kq = await tachCanh({ loai: bc.loai, kinhThanh: bc.kt, nhanVat: bc.nhanVat, kichBan: bc.tap.kich_ban, soCanh, tapTruoc: bc.tapTruoc });
  if (!kq.ok) return loi(kq.loi);
  const tenToId = new Map(bc.nhanVat.map((v) => [v.ten.trim().toLowerCase(), v.id]));
  await db.execute(sql`DELETE FROM xv_canh WHERE tap_id = ${tapId} AND trang_thai = 'nhap'`);
  const giu = (await db.execute(sql`SELECT coalesce(max(thu_tu), 0) AS m FROM xv_canh WHERE tap_id = ${tapId}`)) as unknown as Row[];
  let thuTu = n(giu[0]?.m);
  for (const c of kq.canh) {
    thuTu += 1;
    const ids = c.nhan_vat.map((t) => tenToId.get(t.trim().toLowerCase())).filter((x): x is number => typeof x === 'number');
    await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, goc_may, hanh_dong, loi_thoai, am_thanh, thoi_luong_s, nhan_vat, prompt_anh, prompt_video)
      VALUES (${tapId}, ${thuTu}, ${c.canh}, ${c.goc_may}, ${c.hanh_dong}, ${c.loi_thoai}, ${c.am_thanh}, ${c.thoi_luong_s}, ${JSON.stringify(ids)}::jsonb, ${c.prompt_anh}, ${c.prompt_video})`);
  }
  await db.execute(sql`UPDATE xv_tap SET tom_tat = CASE WHEN tom_tat = '' THEN ${kq.tomTat} ELSE tom_tat END, trang_thai = 'storyboard', updated_at = now() WHERE id = ${tapId}`);
  await taoJob({ loai: 'chu', provider: 'anthropic', model: kq.model, request: { tapId, tokens: kq.tokens }, xong: true });
  return { ok: true, data: kq.canh.length };
}

// ── Cảnh ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function suaCanh(id: number, d: Partial<Pick<Canh, 'canh' | 'goc_may' | 'hanh_dong' | 'loi_thoai' | 'am_thanh' | 'thoi_luong_s' | 'nhan_vat' | 'prompt_anh' | 'prompt_video' | 'thu_tu'>>): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_canh SET
    canh = coalesce(${d.canh ?? null}, canh), goc_may = coalesce(${d.goc_may ?? null}, goc_may), hanh_dong = coalesce(${d.hanh_dong ?? null}, hanh_dong),
    loi_thoai = coalesce(${d.loi_thoai ?? null}, loi_thoai), am_thanh = coalesce(${d.am_thanh ?? null}, am_thanh), thoi_luong_s = coalesce(${d.thoi_luong_s ?? null}, thoi_luong_s),
    nhan_vat = coalesce(${d.nhan_vat ? JSON.stringify(d.nhan_vat) : null}::jsonb, nhan_vat), prompt_anh = coalesce(${d.prompt_anh ?? null}, prompt_anh),
    prompt_video = coalesce(${d.prompt_video ?? null}, prompt_video), thu_tu = coalesce(${d.thu_tu ?? null}, thu_tu), updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

export async function themCanh(tapId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh) VALUES (${tapId}, (SELECT coalesce(max(thu_tu), 0) + 1 FROM xv_canh WHERE tap_id = ${tapId}), 'Cảnh mới') RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]?.id) };
}

export async function xoaCanh(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`DELETE FROM xv_canh WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

async function boiCanhCanh(db: NonNullable<ReturnType<typeof getDb>>, canhId: number) {
  const r = (await db.execute(sql`SELECT c.*, p.kinh_thanh AS kt, p.id AS p_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id JOIN xv_phim p ON p.id = t.phim_id WHERE c.id = ${canhId}`)) as unknown as Row[];
  if (!r[0]) return null;
  const canh = mapCanh(r[0]);
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const nv = canh.nhan_vat.length
    ? ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE id = ANY(${canh.nhan_vat}::int[])`)) as unknown as Row[]).map(mapNhanVat)
    : [];
  return { canh, kt, nhanVat: nv };
}

/** Prompt ảnh cuối = phong cách bộ phim + prompt cảnh + nhắc giữ đúng anchor theo ảnh tham chiếu. */
function ghepPromptAnh(prompt: string, phongCach: string, nv: NhanVat[]): string {
  const dong = [phongCach ? `Visual style: ${phongCach}.` : '', prompt.trim()];
  if (nv.length) {
    dong.push(`Keep these subjects EXACTLY as described (and as shown in the reference images, in the same order): ${nv.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}. Do not redesign them.`);
  }
  return dong.filter(Boolean).join(' ');
}

/** Sinh keyframe: `so` ứng viên (1-3), nối vào keyframe_uv; cảnh chưa có ảnh chọn thì tự chọn ảnh đầu. */
export async function sinhKeyframe(canhId: number, so = 1): Promise<Kq<string[]>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return loi('không thấy cảnh');
  if (!bc.canh.prompt_anh.trim()) return loi('cảnh chưa có prompt ảnh');
  const thamChieu = (await Promise.all(bc.nhanVat.flatMap((v) => v.anh_ref.slice(0, 2)).slice(0, 8).map(taiAnhBase64))).filter((x): x is AnhVao => !!x);
  const prompt = ghepPromptAnh(bc.canh.prompt_anh, bc.kt.phong_cach, bc.nhanVat);
  const urls: string[] = [];
  let loiCuoi = '';
  for (let i = 0; i < Math.max(1, Math.min(3, so)); i++) {
    const job = await taoJob({ canh_id: canhId, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { prompt, thamChieu: thamChieu.length } });
    const kq = await sinhAnh({ model: bc.kt.mo_hinh_anh, prompt, thamChieu, tiLe: bc.kt.ti_le, kichCo: '1K' });
    if (!kq.ok) { loiCuoi = kq.loi; await xongJob(job, { loi: kq.loi }); continue; }
    const url = await uploadToR2(`xuong-video/keyframe/${canhId}-${randomUUID()}.${duoi(kq.mimeType)}`, kq.data, kq.mimeType);
    if (!url) { loiCuoi = 'R2 không nhận ảnh'; await xongJob(job, { loi: loiCuoi }); continue; }
    const gia = giaAnhCents(kq.model);
    await xongJob(job, { output_url: url, model: kq.model, chi_phi_cents: gia });
    urls.push(url);
    await db.execute(sql`UPDATE xv_canh SET keyframe_uv = (keyframe_uv || ${JSON.stringify([url])}::jsonb),
      keyframe_url = coalesce(keyframe_url, ${url}), trang_thai = CASE WHEN trang_thai = 'nhap' THEN 'co_keyframe' ELSE trang_thai END,
      chi_phi_cents = chi_phi_cents + ${Math.round(gia)}, loi = '', updated_at = now() WHERE id = ${canhId}`);
  }
  if (!urls.length) {
    await db.execute(sql`UPDATE xv_canh SET loi = ${loiCuoi}, updated_at = now() WHERE id = ${canhId}`);
    return loi(loiCuoi || 'không sinh được ảnh');
  }
  return { ok: true, data: urls };
}

export async function chonKeyframe(canhId: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${url}, keyframe_uv = CASE WHEN keyframe_uv @> ${JSON.stringify([url])}::jsonb THEN keyframe_uv ELSE keyframe_uv || ${JSON.stringify([url])}::jsonb END,
    trang_thai = CASE WHEN trang_thai IN ('nhap', 'loi') THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: undefined };
}

/** Duyệt keyframe (gate trước khi tốn tiền video). `duyet=false` trả về co_keyframe. */
export async function duyetCanh(canhId: number, duyet: boolean): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (duyet) {
    const r = (await db.execute(sql`UPDATE xv_canh SET trang_thai = 'duyet', updated_at = now() WHERE id = ${canhId} AND keyframe_url IS NOT NULL RETURNING id`)) as unknown as Row[];
    if (!r[0]) return loi('cảnh chưa có keyframe để duyệt');
  } else {
    await db.execute(sql`UPDATE xv_canh SET trang_thai = 'co_keyframe', updated_at = now() WHERE id = ${canhId} AND trang_thai = 'duyet'`);
  }
  return { ok: true, data: undefined };
}

/** Ước tiền trước khi bấm: ảnh × số cảnh, video × tổng giây. */
export async function uocTien(tapId: number): Promise<{ anh1: number; videoTong: number; soCanhDuyet: number; giayDuyet: number }> {
  const db = getDb();
  if (!db || !(await admin())) return { anh1: 0, videoTong: 0, soCanhDuyet: 0, giayDuyet: 0 };
  const r = (await db.execute(sql`SELECT p.kinh_thanh AS kt, (SELECT count(*) FROM xv_canh c WHERE c.tap_id = t.id AND c.trang_thai = 'duyet') AS so_duyet,
    (SELECT coalesce(sum(thoi_luong_s), 0) FROM xv_canh c WHERE c.tap_id = t.id AND c.trang_thai = 'duyet') AS giay
    FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[];
  if (!r[0]) return { anh1: 0, videoTong: 0, soCanhDuyet: 0, giayDuyet: 0 };
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const giay = n(r[0].giay);
  return { anh1: giaAnhCents(kt.mo_hinh_anh), videoTong: giaVideoCents(kt.mo_hinh_video, kt.do_phan_giai, giay), soCanhDuyet: n(r[0].so_duyet), giayDuyet: giay };
}

/** Bắt đầu sinh video Veo cho một cảnh ĐÃ DUYỆT (keyframe làm khung đầu). Async: trả job id, UI gọi kiemVideo để poll. */
export async function sinhVideoCanh(canhId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return loi('không thấy cảnh');
  if (bc.canh.trang_thai !== 'duyet' && bc.canh.trang_thai !== 'loi' && bc.canh.trang_thai !== 'xong') return loi('cảnh chưa duyệt keyframe');
  if (!bc.canh.keyframe_url) return loi('cảnh chưa có keyframe');
  const anhDau = await taiAnhBase64(bc.canh.keyframe_url);
  if (!anhDau) return loi('không tải được keyframe');
  const prompt = [bc.kt.phong_cach ? `Visual style: ${bc.kt.phong_cach}.` : '', bc.canh.prompt_video.trim() || bc.canh.hanh_dong].filter(Boolean).join(' ');
  const giay = (bc.canh.thoi_luong_s <= 4 ? 4 : bc.canh.thoi_luong_s <= 6 ? 6 : 8) as 4 | 6 | 8;
  const job = await taoJob({ canh_id: canhId, loai: 'video', provider: 'google', model: bc.kt.mo_hinh_video, request: { prompt, giay, doPhanGiai: bc.kt.do_phan_giai, tiLe: bc.kt.ti_le } });
  const kq = await batDauVeo({ model: bc.kt.mo_hinh_video, prompt, anhDau, tiLe: bc.kt.ti_le, doPhanGiai: bc.kt.do_phan_giai, giay });
  if (!kq.ok) {
    await xongJob(job, { loi: kq.loi });
    await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = ${kq.loi}, updated_at = now() WHERE id = ${canhId}`);
    return loi(kq.loi);
  }
  await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${kq.taskId}, updated_at = now() WHERE id = ${job}`);
  await db.execute(sql`UPDATE xv_canh SET trang_thai = 'dang_sinh', loi = '', updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: job };
}

/** Poll mọi job video đang chạy của tập: xong → tải về R2, ghi tiền, cảnh = xong. Gọi từ UI mỗi 10s khi có cảnh dang_sinh. */
export async function kiemVideo(tapId: number): Promise<{ conChay: number; vuaXong: number }> {
  const db = getDb();
  if (!db || !(await admin())) return { conChay: 0, vuaXong: 0 };
  const jobs = (await db.execute(sql`SELECT j.* FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE c.tap_id = ${tapId} AND j.loai = 'video' AND j.trang_thai = 'chay' AND j.task_id IS NOT NULL`)) as unknown as Row[];
  let conChay = 0, vuaXong = 0;
  for (const r of jobs.map(mapJob)) {
    const kq = await docVeo(r.task_id!);
    if (!kq.done) { conChay++; continue; }
    if (!kq.ok) {
      await xongJob(r.id, { loi: kq.loi });
      await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = ${kq.loi}, updated_at = now() WHERE id = ${r.canh_id}`);
      continue;
    }
    const buf = await taiVeo(kq.uri);
    const url = buf ? await uploadToR2(`xuong-video/clip/${r.canh_id}-${randomUUID()}.mp4`, buf, 'video/mp4') : null;
    if (!url) {
      await xongJob(r.id, { loi: 'tải/lưu video thất bại' });
      await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = 'tải/lưu video thất bại', updated_at = now() WHERE id = ${r.canh_id}`);
      continue;
    }
    const req = (await db.execute(sql`SELECT request, model FROM xv_job WHERE id = ${r.id}`)) as unknown as Row[];
    const rq = (req[0]?.request ?? {}) as { giay?: number; doPhanGiai?: '720p' | '1080p' };
    const gia = giaVideoCents(s(req[0]?.model), rq.doPhanGiai ?? '720p', rq.giay ?? 8);
    await xongJob(r.id, { output_url: url, chi_phi_cents: gia });
    await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, trang_thai = 'xong', loi = '', chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${r.canh_id}`);
    vuaXong++;
  }
  return { conChay, vuaXong };
}

// ── Job ──────────────────────────────────────────────────────────────────────────────────────────────────────────

async function taoJob(d: { canh_id?: number; nhan_vat_id?: number; loai: string; provider: string; model: string; request: unknown; xong?: boolean }): Promise<number> {
  const db = getDb()!;
  const r = (await db.execute(sql`INSERT INTO xv_job (canh_id, nhan_vat_id, loai, provider, model, request, trang_thai)
    VALUES (${d.canh_id ?? null}, ${d.nhan_vat_id ?? null}, ${d.loai}, ${d.provider}, ${d.model}, ${JSON.stringify(d.request ?? {})}::jsonb, ${d.xong ? 'xong' : 'cho'}) RETURNING id`)) as unknown as Row[];
  return n(r[0]?.id);
}
async function xongJob(id: number, d: { output_url?: string; model?: string; chi_phi_cents?: number; loi?: string }) {
  const db = getDb()!;
  await db.execute(sql`UPDATE xv_job SET trang_thai = ${d.loi ? 'loi' : 'xong'}, output_url = coalesce(${d.output_url ?? null}, output_url), model = coalesce(${d.model ?? null}, model),
    chi_phi_cents = ${Math.round(d.chi_phi_cents ?? 0)}, loi = ${d.loi ?? ''}, updated_at = now() WHERE id = ${id}`);
}
const duoi = (mime: string) => (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
