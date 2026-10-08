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
import { dayViecAnh, dayViecAm, giaAnhSv } from '@/lib/xuong-video/hoan-tat';
import { MO_HINH_AM, giaAm, moHinhAm, dongThoai, giaGiong, GIONG_MAC_DINH } from '@/lib/xuong-video/am-thanh';
import { dsMoHinhGiong, giongCua, dauVaoGiongTheoModel, coElevenTrucTiep, type MoHinhGiong } from '@/lib/xuong-video/giong';
import { boVaoThungRac, boAnhVaoThungRac, dsRac, khoiPhucRac, type MucRac } from '@/lib/xuong-video/thung-rac';
import { sinhAnh, batDauVeo, docVeo, taiVeo, taiAnhBase64, type AnhVao } from '@/lib/xuong-video/google';
import { docFal, batDauNangCap, danhMucFal, dauVaoTheoSchema, guiFal, type ModelFal } from '@/lib/xuong-video/fal';
import { type DungChu } from '@/lib/xuong-video/claude';
import { docTrangSanPham } from '@/lib/xuong-video/claude';
import { tachCanh, vietKichBan, promptAnhMau, promptBienThe, goiYBienThe, goiYKinhThanh, goiYAnchor, goiYBoAnchor, goiYBrief, goiYCanh, type NguCanhPhim } from '@/lib/xuong-video/claude';
import { MAU_PHIM } from '@/lib/xuong-video/mau';
import { lamSachKyThuat, promptKyThuatAnh, promptKyThuatVideo } from '@/lib/xuong-video/dien-anh';
import { ghepThoai } from '@/lib/xuong-video/kieu';
import {
  docKinhThanh, giaAnhCents, giaVideoCents, giaChuCents, thanhPhanCanh, MO_HINH_ANH, MO_HINH_VIDEO, NANG_CAP, NHOM_BIEN_THE, type BienThe,
  type Phim, type NhanVat, type Tap, type Canh, type Job, type KinhThanh, type LoaiPhim, type LoaiNhanVat, type TrangThaiCanh,
} from '@/lib/xuong-video/kieu';

type Row = Record<string, unknown>;
type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
/** Mảng số → literal mảng Postgres dạng chuỗi ('{1,2}'). Truyền mảng JS thẳng vào sql`` thì postgres-js gửi phần tử số thô
 *  và ném ERR_INVALID_ARG_TYPE ("Received type number (4)") — sinh keyframe hỏng 08/10/2026. */
const mangInt = (xs: number[]) => `{${xs.map((x) => Math.trunc(Number(x))).filter(Number.isFinite).join(',')}}`;
/** Giá theo danh mục fal (động) nếu là model fal:, không thì bảng tĩnh. */
async function giaVideoSv(model: string, dpg: '720p' | '1080p', giay: number): Promise<number> {
  if (model.startsWith('fal:')) {
    const m = (await danhMucFal()).find((x) => x.id === model.slice(4));
    const g = m?.gia.chinh[dpg]; if (g != null) return g * giay;
    const clip = m?.gia.clip[dpg]; if (clip) return clip[1];
  }
  return giaVideoCents(model, dpg, giay);
}

/** Danh mục model cho ô chọn: Google/OpenAI (cố định) + fal (động, ~100 model) kèm giá. */
export type MoHinhChon = { key: string; label: string; nhom: string; giaCents: number | null; donVi: 'giay' | 'anh' | 'khac'; giaText?: string; gia?: import('@/lib/xuong-video/gia-fal').GiaTom };
export async function dsMoHinh(): Promise<{ anh: MoHinhChon[]; video: MoHinhChon[] }> {
  if (!(await admin())) return { anh: [], video: [] };
  const fal: ModelFal[] = await danhMucFal().catch(() => []);
  const nhomFal = (id: string) => (id.split('/')[0] === 'fal-ai' ? id.split('/')[1] : id.split('/')[0]) ?? 'fal';
  return {
    anh: [
      ...MO_HINH_ANH.map((m) => ({ key: m.key, label: m.label.split(' (')[0]!, nhom: m.key.startsWith('gpt') ? 'OpenAI' : 'Google', giaCents: m.gia1k, donVi: 'anh' as const })),
      ...fal.filter((m) => m.loai === 'anh').map((m) => ({ key: `fal:${m.id}`, label: m.ten, nhom: `fal · ${nhomFal(m.id)}`, giaCents: m.giaCents, donVi: m.donVi, giaText: m.giaText, gia: m.gia })),
    ],
    video: [
      ...MO_HINH_VIDEO.filter((m) => !m.key.startsWith('fal:')).map((m) => ({ key: m.key, label: m.label.split(' (')[0]!, nhom: 'Google', giaCents: m.giaGiay['720p'], donVi: 'giay' as const })),
      ...fal.filter((m) => m.loai === 'video').map((m) => ({ key: `fal:${m.id}`, label: m.ten, nhom: `fal · ${nhomFal(m.id)}`, giaCents: m.giaCents, donVi: m.donVi, giaText: m.giaText, gia: m.gia })),
    ],
  };
}

const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });

async function admin() {
  const me = await getCurrentUser();
  return me && me.role === 'admin' ? me : null;
}
const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => (v == null ? '' : String(v));
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

// ── Đọc ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const KHO = 'studio';   // xv_phim.project khi tạo mới. Danh sách hiện MỌI phim (kể cả phim tạo lúc còn nằm trong mos2, project='bra') — app riêng = một kho.

export async function dsPhim(): Promise<Phim[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  try {
    const r = await db.execute(sql`
      SELECT p.*,
        (SELECT count(*) FROM xv_tap t WHERE t.phim_id = p.id) AS so_tap,
        (SELECT count(*) FROM xv_nhan_vat v WHERE v.phim_id = p.id) AS so_nhan_vat,
        (SELECT count(*) FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = p.id) AS so_canh,
        (SELECT coalesce(sum(j.chi_phi_cents), 0) FROM xv_job j WHERE j.phim_id = p.id) AS chi_phi_cents
      FROM xv_phim p ORDER BY p.updated_at DESC`);
    return (r as unknown as Row[]).map(mapPhim);
  } catch { return []; }
}
const mapPhim = (r: Row): Phim => ({
  id: n(r.id), project: s(r.project), ten: s(r.ten), loai: s(r.loai) as LoaiPhim, mo_ta: s(r.mo_ta),
  kinh_thanh: (r.kinh_thanh && typeof r.kinh_thanh === 'object' ? r.kinh_thanh : {}) as KinhThanh, trang_thai: s(r.trang_thai),
  so_tap: n(r.so_tap), so_nhan_vat: n(r.so_nhan_vat), so_canh: n(r.so_canh), chi_phi_cents: n(r.chi_phi_cents), updated_at: s(r.updated_at),
});

/** dangSinh: job ảnh còn chạy (≤10 phút) — F5 vẫn thấy "đang sinh" vì trạng thái ở sổ job máy chủ, không ở trình duyệt. */
/** Thống kê gọn cả phim cho đầu ngăn phim (anh yêu cầu 08/10/2026). */
export type ThongKePhim = { soCanh: number; giay: number; coKf: number; duyet: number; nhap: number; cuoi: number; anhGoc: number; bienThe: number; btCoAnh: number; soLanSinh: number; tienAnh: number; tienVideo: number; tienChu: number };
export type PhimDayDu = { thongKe: ThongKePhim; phim: Phim; nhanVat: NhanVat[]; tap: Tap[]; dangSinh: { nhanVat: number[]; bienThe: number[] }; loiAnh: { nhanVat: Record<number, string>; bienThe: Record<number, string> }; ganDay: Job[]; tongTien: number };
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
    const nvs = (nv as unknown as Row[]).map(mapNhanVat);
    const [bt, ds, gd, tg, la, tkc, tkj] = await Promise.all([
      db.execute(sql`SELECT b.* FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id WHERE v.phim_id = ${id} ORDER BY b.nhom, b.id`),
      db.execute(sql`SELECT j.nhan_vat_id, j.bien_the_id FROM xv_job j JOIN xv_nhan_vat v ON v.id = j.nhan_vat_id
        WHERE v.phim_id = ${id} AND j.loai = 'anh' AND j.trang_thai = 'cho' AND j.created_at > now() - interval '10 minutes'`),
      db.execute(sql`SELECT * FROM xv_job WHERE phim_id = ${id} ORDER BY id DESC LIMIT 6`),
      db.execute(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS t FROM xv_job WHERE phim_id = ${id}`),
      // Lần sinh ảnh gần nhất của mỗi anchor/biến thể — lỗi thì hiện dưới thẻ (việc chạy nền nên lỗi không trả về nút nữa).
      db.execute(sql`SELECT DISTINCT ON (j.nhan_vat_id, coalesce(j.bien_the_id, 0)) j.nhan_vat_id, j.bien_the_id, j.trang_thai, j.loi
        FROM xv_job j JOIN xv_nhan_vat v ON v.id = j.nhan_vat_id WHERE v.phim_id = ${id} AND j.loai = 'anh'
        ORDER BY j.nhan_vat_id, coalesce(j.bien_the_id, 0), j.id DESC`),
      db.execute(sql`SELECT count(*) AS so, coalesce(sum(c.thoi_luong_s), 0) AS giay, count(c.keyframe_url) AS kf,
          count(*) FILTER (WHERE c.trang_thai = 'duyet') AS duyet, count(c.video_url) AS nhap, count(c.video_cuoi_url) AS cuoi
        FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${id}`),
      db.execute(sql`SELECT count(*) AS so, coalesce(sum(chi_phi_cents) FILTER (WHERE loai = 'anh'), 0) AS anh,
          coalesce(sum(chi_phi_cents) FILTER (WHERE loai IN ('video', 'nang_cap')), 0) AS video,
          coalesce(sum(chi_phi_cents) FILTER (WHERE loai NOT IN ('anh', 'video', 'nang_cap')), 0) AS chu
        FROM xv_job WHERE phim_id = ${id} AND trang_thai = 'xong'`),
    ]);
    const loiAnh = { nhanVat: {} as Record<number, string>, bienThe: {} as Record<number, string> };
    for (const r of la as unknown as Row[]) {
      if (s(r.trang_thai) !== 'loi') continue;
      if (r.bien_the_id == null) loiAnh.nhanVat[n(r.nhan_vat_id)] = s(r.loi); else loiAnh.bienThe[n(r.bien_the_id)] = s(r.loi);
    }
    const bts = (bt as unknown as Row[]).map(mapBienThe);
    for (const v of nvs) v.bien_the = bts.filter((b) => b.nhan_vat_id === v.id);
    const dsr = ds as unknown as Row[];
    const c0 = (tkc as unknown as Row[])[0] ?? {}; const j0 = (tkj as unknown as Row[])[0] ?? {};
    const thongKe: ThongKePhim = {
      soCanh: n(c0.so), giay: n(c0.giay), coKf: n(c0.kf), duyet: n(c0.duyet), nhap: n(c0.nhap), cuoi: n(c0.cuoi),
      anhGoc: nvs.reduce((a, v) => a + v.anh_ref.length, 0), bienThe: bts.length, btCoAnh: bts.filter((b) => b.anh_url).length,
      soLanSinh: n(j0.so), tienAnh: n(j0.anh), tienVideo: n(j0.video), tienChu: n(j0.chu),
    };
    return {
      thongKe, phim: mapPhim(p[0]), nhanVat: nvs, tap: (tap as unknown as Row[]).map(mapTap),
      ganDay: (gd as unknown as Row[]).map(mapJob), tongTien: n((tg as unknown as Row[])[0]?.t), loiAnh,
      dangSinh: { nhanVat: dsr.filter((r) => r.bien_the_id == null).map((r) => n(r.nhan_vat_id)), bienThe: dsr.filter((r) => r.bien_the_id != null).map((r) => n(r.bien_the_id)) },
    };
  } catch { return null; }
}
const mapBienThe = (r: Row): BienThe => ({ id: n(r.id), nhan_vat_id: n(r.nhan_vat_id), nhom: s(r.nhom), ten: s(r.ten), mo_ta: s(r.mo_ta), anh_url: r.anh_url == null ? null : s(r.anh_url) });
const mapNhanVat = (r: Row): NhanVat => ({ id: n(r.id), phim_id: n(r.phim_id), loai: s(r.loai) as LoaiNhanVat, ten: s(r.ten), mo_ta: s(r.mo_ta), anh_ref: arr<string>(r.anh_ref), giong: s(r.giong), giong_model: s(r.giong_model), giong_id: s(r.giong_id), giong_mau_url: r.giong_mau_url == null ? null : s(r.giong_mau_url) });
const mapTap = (r: Row): Tap => ({ id: n(r.id), phim_id: n(r.phim_id), so: n(r.so), ten: s(r.ten), brief: s(r.brief), noi_khung: r.noi_khung === true, nhac_url: r.nhac_url == null ? null : s(r.nhac_url), nhac_mo_ta: s(r.nhac_mo_ta), nhac_phan_canh: (r.nhac_phan_canh && typeof r.nhac_phan_canh === 'object' ? r.nhac_phan_canh : {}) as Record<string, string>, beats: arr<Tap['beats'][number]>(r.beats), phan_canh: arr<Tap['phan_canh'][number]>(r.phan_canh), kich_ban: s(r.kich_ban), tom_tat: s(r.tom_tat), trang_thai: s(r.trang_thai), video_url: r.video_url == null ? null : s(r.video_url), so_canh: n(r.so_canh) });
const mapCanh = (r: Row): Canh => ({
  id: n(r.id), tap_id: n(r.tap_id), thu_tu: n(r.thu_tu), canh: s(r.canh), goc_may: s(r.goc_may), hanh_dong: s(r.hanh_dong), loi_thoai: s(r.loi_thoai), am_thanh: s(r.am_thanh), thoai_url: r.thoai_url == null ? null : s(r.thoai_url), am_thanh_url: r.am_thanh_url == null ? null : s(r.am_thanh_url), phan_doan: s(r.phan_doan), cam_xuc: n(r.cam_xuc), thoai: arr<Canh['thoai'][number]>(r.thoai), trang_phuc: s(r.trang_phuc),
  ky_thuat: (r.ky_thuat && typeof r.ky_thuat === 'object' ? r.ky_thuat : {}) as Canh['ky_thuat'],
  thoi_luong_s: n(r.thoi_luong_s), nhan_vat: arr<number>(r.nhan_vat).map(Number), bien_the: arr<number>(r.bien_the).map(Number), dang_sinh_anh: r.dang_sinh_anh === true, dang_sinh_am: r.dang_sinh_am === true, prompt_anh: s(r.prompt_anh), prompt_video: s(r.prompt_video),
  keyframe_url: r.keyframe_url == null ? null : s(r.keyframe_url), keyframe_uv: arr<string>(r.keyframe_uv), video_url: r.video_url == null ? null : s(r.video_url), video_cuoi_url: r.video_cuoi_url == null ? null : s(r.video_cuoi_url), nguon_video: (r.nguon_video && typeof r.nguon_video === 'object' ? r.nguon_video : {}) as Record<string, unknown>, video_phien_ban: arr<Canh['video_phien_ban'][number]>(r.video_phien_ban),
  trang_thai: s(r.trang_thai) as TrangThaiCanh, loi: s(r.loi), chi_phi_cents: n(r.chi_phi_cents),
});
const mapJob = (r: Row): Job => ({
  phim_id: r.phim_id == null ? null : n(r.phim_id), nhan: s(r.nhan), tokens_in: n(r.tokens_in), tokens_out: n(r.tokens_out), phim_ten: s(r.phim_ten),
  id: n(r.id), canh_id: r.canh_id == null ? null : n(r.canh_id), nhan_vat_id: r.nhan_vat_id == null ? null : n(r.nhan_vat_id), loai: s(r.loai), provider: s(r.provider), model: s(r.model),
  trang_thai: s(r.trang_thai), task_id: r.task_id == null ? null : s(r.task_id), output_url: r.output_url == null ? null : s(r.output_url), chi_phi_cents: n(r.chi_phi_cents), loi: s(r.loi), created_at: s(r.created_at),
});

export async function dsCanh(tapId: number): Promise<Canh[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  try {
    const r = await db.execute(sql`SELECT c.*, EXISTS (SELECT 1 FROM xv_job j WHERE j.canh_id = c.id AND j.loai = 'anh' AND j.trang_thai = 'cho' AND j.created_at > now() - interval '10 minutes') AS dang_sinh_anh,
      EXISTS (SELECT 1 FROM xv_job j WHERE j.canh_id = c.id AND j.loai = 'am' AND j.trang_thai = 'cho' AND j.created_at > now() - interval '10 minutes') AS dang_sinh_am FROM xv_canh c WHERE c.tap_id = ${tapId} ORDER BY c.thu_tu, c.id`);
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

/** Sổ chi phí (trang /log): mọi lần gọi AI, mới nhất trước. */
export async function soChiPhi(opts: { phimId?: number; ngay?: number }): Promise<{ jobs: Job[]; theoNgay: { ngay: string; tien: number; so: number }[]; theoLoai: { loai: string; tien: number; so: number }[] }> {
  const db = getDb();
  if (!db || !(await admin())) return { jobs: [], theoNgay: [], theoLoai: [] };
  const ngay = Math.max(1, Math.min(365, opts.ngay ?? 30));
  const loc = opts.phimId ? sql`AND j.phim_id = ${opts.phimId}` : sql``;
  const [jobs, nd, ll] = await Promise.all([
    db.execute(sql`SELECT j.*, p.ten AS phim_ten FROM xv_job j LEFT JOIN xv_phim p ON p.id = j.phim_id
      WHERE j.created_at > now() - make_interval(days => ${ngay}) ${loc} ORDER BY j.id DESC LIMIT 1000`),
    db.execute(sql`SELECT to_char(j.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS ngay, sum(j.chi_phi_cents) AS tien, count(*) AS so
      FROM xv_job j WHERE j.created_at > now() - make_interval(days => ${ngay}) ${loc} GROUP BY 1 ORDER BY 1 DESC`),
    db.execute(sql`SELECT j.loai, sum(j.chi_phi_cents) AS tien, count(*) AS so FROM xv_job j WHERE j.created_at > now() - make_interval(days => ${ngay}) ${loc} GROUP BY 1 ORDER BY 2 DESC`),
  ]);
  return {
    jobs: (jobs as unknown as Row[]).map(mapJob),
    theoNgay: (nd as unknown as Row[]).map((r) => ({ ngay: s(r.ngay), tien: n(r.tien), so: n(r.so) })),
    theoLoai: (ll as unknown as Row[]).map((r) => ({ loai: s(r.loai), tien: n(r.tien), so: n(r.so) })),
  };
}

/** Trạng thái khoá: trang báo thiếu gì thay vì để nút Sinh lỗi âm thầm. Chỉ trả có/không, không trả giá trị. */
export async function trangThaiKhoa(): Promise<{ google: boolean; anthropic: boolean; r2: boolean; openai: boolean; fal: boolean }> {
  if (!(await admin())) return { google: false, anthropic: false, r2: false, openai: false, fal: false };
  return {
    fal: !!process.env.FAL_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    google: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    r2: !!(process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET),
  };
}

// ── Phim ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function taoPhim(ten: string, loai: LoaiPhim): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!ten.trim()) return loi('thiếu tên');
  const kt: KinhThanh = loai === 'quang_cao' ? { ti_le: '9:16' } : {};
  const r = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, kinh_thanh) VALUES (${KHO}, ${ten.trim()}, ${loai}, ${JSON.stringify(kt)}::jsonb) RETURNING id`)) as unknown as Row[];
  // Short / quảng cáo: một tập sẵn, khỏi bắt người bấm "thêm tập".
  const id = n(r[0]?.id);
  if (loai !== 'phim') await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten) VALUES (${id}, 1, ${ten.trim()})`);
  return { ok: true, data: id };
}

/** Tạo phim từ mẫu dựng sẵn (mỗi định dạng một mẫu): kinh thánh + anchor + kịch bản tập 1 đã điền. */
export async function taoPhimMau(key: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const m = MAU_PHIM.find((x) => x.key === key) ?? MAU_PHIM.find((x) => x.loai === key);
  if (!m) return loi('không có mẫu cho loại này');
  const r = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh) VALUES (${KHO}, ${m.ten}, ${m.loai}, ${m.mo_ta}, ${JSON.stringify(m.kinh_thanh)}::jsonb) RETURNING id`)) as unknown as Row[];
  const id = n(r[0]?.id);
  for (const v of m.nhan_vat) await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, giong) VALUES (${id}, ${v.loai}, ${v.ten}, ${v.mo_ta}, ${v.giong ?? ''})`);
  let so = 0;
  const tapIds: number[] = [];
  for (const t of m.tap) {
    so += 1;
    const tr = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, kich_ban) VALUES (${id}, ${so}, ${t.ten}, ${t.kich_ban}) RETURNING id`)) as unknown as Row[];
    tapIds.push(n(tr[0]?.id));
  }
  // Mẫu phải mở ra là có storyboard ngay (anh hỏi "storyboard chưa có à?" 08/10/2026): tách cảnh bằng Claude luôn; lỗi (thiếu khoá) thì phim vẫn tạo, bảng cảnh trống + báo lỗi ở drawer.
  for (const tapId of tapIds) await tachCanhTap(tapId, 0).catch(() => undefined);
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
  // Quảng cáo: sản phẩm khai ở kinh thánh → anchor sản phẩm cùng tên (tạo nếu chưa có), ảnh thật lên ĐẦU anh_ref để mọi keyframe tham chiếu đúng hàng.
  const q = d.kinh_thanh?.qc;
  if (q?.ten.trim()) {
    const co = (await db.execute(sql`SELECT id, anh_ref, mo_ta FROM xv_nhan_vat WHERE phim_id = ${id} AND loai = 'san_pham' ORDER BY (lower(ten) = lower(${q.ten.trim()})) DESC, id LIMIT 1`)) as unknown as Row[];
    const anh = [...new Set([...q.anh, ...arr<string>(co[0]?.anh_ref)])].slice(0, 10);
    if (co[0]) await db.execute(sql`UPDATE xv_nhan_vat SET ten = ${q.ten.trim()}, anh_ref = ${JSON.stringify(anh)}::jsonb, mo_ta = CASE WHEN mo_ta = '' THEN ${q.diem_noi_bat} ELSE mo_ta END, updated_at = now() WHERE id = ${n(co[0].id)}`);
    else await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref) VALUES (${id}, 'san_pham', ${q.ten.trim()}, ${q.diem_noi_bat}, ${JSON.stringify(anh)}::jsonb)`);
  }
  return { ok: true, data: undefined };
}

export async function xoaPhim(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boVaoThungRac(db, 'phim', [id], me.email);   // vào thùng rác, khôi phục được — không xoá thật (#1192)
  return { ok: true, data: undefined };
}

// ── Anchor ───────────────────────────────────────────────────────────────────────────────────────────────────────

export async function luuNhanVat(d: { id?: number; phim_id: number; loai: LoaiNhanVat; ten: string; mo_ta: string; anh_ref: string[]; giong: string }): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!d.ten.trim()) return loi('thiếu tên');
  const anh = JSON.stringify(d.anh_ref.filter(Boolean).slice(0, 10));
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
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boVaoThungRac(db, 'nhan_vat', [id], me.email);   // vào thùng rác, khôi phục được — không xoá thật (#1192)
  return { ok: true, data: undefined };
}

/** Sinh "ảnh mẫu" cho anchor từ mô tả (character sheet). Ảnh thêm vào anh_ref; các cảnh sau dùng nó làm tham chiếu. */
export async function sinhAnhMau(nhanVatId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy anchor');
  const nv = mapNhanVat(r[0]);
  if (!nv.mo_ta.trim()) return loi('anchor chưa có mô tả — tả ngoại hình/đặc tính trước rồi mới sinh ảnh mẫu');
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const job = await taoJob({ nhan: `Ảnh gốc · ${nv.ten}`, nhan_vat_id: nhanVatId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { prompt: promptAnhMau(nv, kt, nv.anh_ref.length) } });
  await dayViecAnh({ job, model: kt.mo_hinh_anh, prompt: promptAnhMau(nv, kt, nv.anh_ref.length), thamChieuUrl: nv.anh_ref.slice(0, 3), tiLe: nv.loai === 'boi_canh' ? kt.ti_le : '1:1', thuMuc: `anchor/${nhanVatId}` });
  return { ok: true, data: job };
}

/** Bỏ ảnh vào thùng rác (ảnh gốc / ảnh biến thể / ứng viên keyframe): gỡ khỏi danh sách, khôi phục được; file R2 giữ nguyên (#1192). */
export async function xoaAnhGoc(nhanVatId: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boAnhVaoThungRac(db, 'anh_goc', nhanVatId, url, me.email);
  return { ok: true, data: undefined };
}
export async function xoaAnhBienThe(bienTheId: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boAnhVaoThungRac(db, 'anh_bien_the', bienTheId, '', me.email);
  return { ok: true, data: undefined };
}
export async function xoaKeyframe(canhId: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boAnhVaoThungRac(db, 'keyframe', canhId, url, me.email);
  return { ok: true, data: undefined };
}
/** Thùng rác: phimId = null → các PHIM đã xoá (trang chủ); có phimId → mọi thứ đã xoá trong phim đó. */
export async function dsThungRac(phimId: number | null): Promise<MucRac[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  return dsRac(db, phimId);
}
export async function khoiPhuc(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = await khoiPhucRac(db, id);
  return r.ok ? { ok: true, data: undefined } : loi(r.loi);
}

/** Chọn một ảnh gốc làm ảnh chính (đưa lên đầu anh_ref) — ảnh đầu là ảnh thẻ hiện + tham chiếu ưu tiên khi sinh cảnh. */
export async function datAnhChinh(nhanVatId: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_nhan_vat SET anh_ref = (${JSON.stringify([url])}::jsonb || (anh_ref - ${url})), updated_at = now()
    WHERE id = ${nhanVatId} AND anh_ref ? ${url}`);
  return { ok: true, data: undefined };
}

// ── Biến thể anchor (biểu cảm · trang phục · tư thế · góc máy · thời điểm…) ───────────────────────────────────────

export async function luuBienThe(d: { id?: number; nhan_vat_id: number; nhom: string; ten: string; mo_ta: string }): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!d.ten.trim()) return loi('thiếu tên biến thể');
  if (d.id) {
    await db.execute(sql`UPDATE xv_bien_the SET nhom = ${d.nhom}, ten = ${d.ten.trim()}, mo_ta = ${d.mo_ta}, updated_at = now() WHERE id = ${d.id}`);
    return { ok: true, data: d.id };
  }
  const r = (await db.execute(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta) VALUES (${d.nhan_vat_id}, ${d.nhom}, ${d.ten.trim()}, ${d.mo_ta}) RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]?.id) };
}

export async function xoaBienThe(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boVaoThungRac(db, 'bien_the', [id], me.email);   // vào thùng rác, khôi phục được — không xoá thật (#1192)
  return { ok: true, data: undefined };
}

/** Claude đọc kịch bản các tập → đề xuất biến thể cần cho anchor này → tạo luôn (chưa có ảnh). */
export async function goiYAIBienThe(nhanVatId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy anchor');
  const nc = await nguCanhPhim(db, n(r[0].phim_id));
  if (!nc) return loi('không thấy phim');
  const a = nc.nhanVat.find((v) => v.id === nhanVatId)!;
  const nhom = NHOM_BIEN_THE[a.loai] ?? NHOM_BIEN_THE.nhan_vat;
  const kq = await goiYBienThe(nc, a, nhom);
  await ghiChu(n(r[0].phim_id), `AI đề xuất biến thể · ${a.ten}`, kq);
  if (!kq.ok) return loi(kq.loi);
  const daCo = new Set((a.bien_the ?? []).map((b) => `${b.nhom}/${b.ten}`.toLowerCase()));
  let them = 0;
  for (const b of kq.data.bien_the) {
    const k = nhom.some((x) => x.key === b.nhom) ? b.nhom : nhom[0]!.key;
    if (daCo.has(`${k}/${b.ten}`.toLowerCase())) continue;
    await db.execute(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta) VALUES (${nhanVatId}, ${k}, ${b.ten.trim()}, ${b.mo_ta})`);
    them++;
  }
  return { ok: true, data: them };
}

/** Sinh ảnh một biến thể TỪ ảnh gốc của anchor (tham chiếu) → giữ danh tính, chỉ đổi phần biến thể. */
export async function sinhAnhBienThe(bienTheId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT b.*, v.loai AS v_loai, v.ten AS v_ten, v.mo_ta AS v_mo_ta, v.anh_ref AS v_anh, p.kinh_thanh AS kt
    FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id JOIN xv_phim p ON p.id = v.phim_id WHERE b.id = ${bienTheId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy biến thể');
  const b = mapBienThe(r[0]);
  const anhGoc = arr<string>(r[0].v_anh);
  if (!anhGoc.length) return loi('anchor chưa có ảnh gốc — bấm "Sinh ảnh mẫu" của anchor trước để biến thể bám theo');
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const a = { loai: s(r[0].v_loai) as LoaiNhanVat, ten: s(r[0].v_ten), mo_ta: s(r[0].v_mo_ta) };
  const prompt = promptBienThe(a, b, kt);
  const job = await taoJob({ nhan: `Biến thể · ${a.ten} · ${b.ten}`, nhan_vat_id: b.nhan_vat_id, bien_the_id: bienTheId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { prompt } });
  await dayViecAnh({ job, model: kt.mo_hinh_anh, prompt, thamChieuUrl: anhGoc.slice(0, 2), tiLe: a.loai === 'boi_canh' ? kt.ti_le : '1:1', thuMuc: `bien-the/${bienTheId}` });
  return { ok: true, data: job };
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

export async function suaTap(id: number, d: { ten?: string; brief?: string; kich_ban?: string; tom_tat?: string; so?: number; noi_khung?: boolean; nhac_mo_ta?: string }): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_tap SET ten = coalesce(${d.ten ?? null}, ten), brief = coalesce(${d.brief ?? null}, brief), kich_ban = coalesce(${d.kich_ban ?? null}, kich_ban),
    tom_tat = coalesce(${d.tom_tat ?? null}, tom_tat), so = coalesce(${d.so ?? null}, so), noi_khung = coalesce(${d.noi_khung ?? null}, noi_khung), nhac_mo_ta = coalesce(${d.nhac_mo_ta ?? null}, nhac_mo_ta), updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

export async function xoaTap(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boVaoThungRac(db, 'tap', [id], me.email);   // vào thùng rác, khôi phục được — không xoá thật (#1192)
  return { ok: true, data: undefined };
}

async function boiCanhTap(db: NonNullable<ReturnType<typeof getDb>>, tapId: number) {
  const r = (await db.execute(sql`SELECT t.*, p.loai AS p_loai, p.kinh_thanh AS kt, p.id AS p_id FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[];
  if (!r[0]) return null;
  const tap = mapTap(r[0]);
  const nv = (await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${tap.phim_id} ORDER BY loai, id`)) as unknown as Row[];
  const nvKem = await kemBienThe(db, nv.map(mapNhanVat));
  const truoc = (await db.execute(sql`SELECT tom_tat FROM xv_tap WHERE phim_id = ${tap.phim_id} AND so < ${tap.so} AND tom_tat <> '' ORDER BY so`)) as unknown as Row[];
  return { tap, loai: s(r[0].p_loai) as LoaiPhim, kt: (r[0].kt ?? {}) as KinhThanh, nhanVat: nvKem, tapTruoc: truoc.map((x) => s(x.tom_tat)) };
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
  await ghiChu(bc.tap.phim_id, `Viết kịch bản · tập ${bc.tap.so}`, kq);
  await db.execute(sql`UPDATE xv_tap SET brief = ${brief}, kich_ban = ${kq.kichBan}, updated_at = now() WHERE id = ${tapId}`);
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
  const btToId = new Map(bc.nhanVat.flatMap((v) => (v.bien_the ?? []).map((b) => [`${v.ten} · ${b.ten}`.trim().toLowerCase(), b.id] as [string, number])));
  // Cảnh nháp cũ bị thay bằng bộ cảnh mới → vào thùng rác (khôi phục được), không xoá thật (#1192).
  const nhapCu = (await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND trang_thai = 'nhap'`)) as unknown as Row[];
  await boVaoThungRac(db, 'canh', nhapCu.map((x) => n(x.id)), (await admin())!.email, `${nhapCu.length} cảnh nháp cũ (tách lại cảnh · ${bc.tap.ten})`);
  const giu = (await db.execute(sql`SELECT coalesce(max(thu_tu), 0) AS m FROM xv_canh WHERE tap_id = ${tapId}`)) as unknown as Row[];
  let thuTu = n(giu[0]?.m);
  for (const c of kq.canh) {
    thuTu += 1;
    const ids = c.nhan_vat.map((t) => tenToId.get(t.trim().toLowerCase())).filter((x): x is number => typeof x === 'number');
    const bts = (c.bien_the ?? []).map((t) => btToId.get(t.replace(/\s*[·\-–|]\s*/, ' · ').trim().toLowerCase())).filter((x): x is number => typeof x === 'number');
    const thoai = (c.thoai ?? []).filter((d) => d.loi.trim());
    await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, goc_may, hanh_dong, loi_thoai, thoai, am_thanh, thoi_luong_s, nhan_vat, bien_the, prompt_anh, prompt_video, phan_doan, cam_xuc, ky_thuat, trang_phuc)
      VALUES (${tapId}, ${thuTu}, ${c.canh}, ${c.goc_may}, ${c.hanh_dong}, ${thoai.length ? ghepThoai(thoai) : c.loi_thoai}, ${JSON.stringify(thoai)}::jsonb, ${c.am_thanh}, ${c.thoi_luong_s}, ${JSON.stringify(ids)}::jsonb, ${JSON.stringify(bts)}::jsonb, ${c.prompt_anh}, ${c.prompt_video},
        ${c.phan_doan}, ${c.cam_xuc}, ${JSON.stringify(lamSachKyThuat(c.ky_thuat as unknown as Record<string, unknown>))}::jsonb, ${c.trang_phuc ?? ''})`);
  }
  // Beat + phân cảnh của tập (đường cong cảm xúc, mục tiêu/xung đột từng phân cảnh) — tách lại thì thay bản mới.
  await db.execute(sql`UPDATE xv_tap SET tom_tat = CASE WHEN tom_tat = '' THEN ${kq.tomTat} ELSE tom_tat END, beats = ${JSON.stringify(kq.beats)}::jsonb,
    phan_canh = ${JSON.stringify(kq.phanCanh)}::jsonb, trang_thai = 'storyboard', updated_at = now() WHERE id = ${tapId}`);
  await ghiChu(bc.tap.phim_id, `Tách cảnh · tập ${bc.tap.so} (${kq.canh.length} cảnh)`, kq);
  return { ok: true, data: kq.canh.length };
}

// ── Cảnh ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Sắp lại thứ tự cảnh của một tập theo danh sách id (kéo thả trên timeline). Một câu UPDATE, cảnh ngoài tập không bị đụng. */
export async function xepCanh(tapId: number, ids: number[]): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_canh c SET thu_tu = x.i, updated_at = now()
    FROM unnest(${mangInt(ids)}::int[]) WITH ORDINALITY AS x(id, i) WHERE c.id = x.id AND c.tap_id = ${tapId}`);
  return { ok: true, data: undefined };
}

export async function suaCanh(id: number, d: Partial<Pick<Canh, 'canh' | 'goc_may' | 'hanh_dong' | 'loi_thoai' | 'am_thanh' | 'thoi_luong_s' | 'nhan_vat' | 'bien_the' | 'prompt_anh' | 'prompt_video' | 'thu_tu' | 'phan_doan' | 'cam_xuc' | 'ky_thuat' | 'thoai' | 'trang_phuc'>>): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  // Thoại theo dòng: lưu dòng + ghép lại loi_thoai; dòng nào đổi lời thì bỏ file giọng cũ của dòng đó (đọc sai lời).
  if (d.thoai) {
    const cu = ((await db.execute(sql`SELECT thoai FROM xv_canh WHERE id = ${id}`)) as unknown as Row[])[0];
    const cuDs = arr<Canh['thoai'][number]>(cu?.thoai);
    const moi = d.thoai.filter((x) => x.loi.trim() || x.nhan_vat.trim()).map((x) => { const c0 = cuDs.find((y) => y.loi === x.loi && y.nhan_vat === x.nhan_vat); return { nhan_vat: x.nhan_vat, dien_xuat: x.dien_xuat, loi: x.loi, url: c0?.url ?? null }; });
    d = { ...d, loi_thoai: ghepThoai(moi) };
    await db.execute(sql`UPDATE xv_canh SET thoai = ${JSON.stringify(moi)}::jsonb, thoai_url = ${moi[0]?.url ?? null} WHERE id = ${id}`);
  }
  await db.execute(sql`UPDATE xv_canh SET
    canh = coalesce(${d.canh ?? null}, canh), goc_may = coalesce(${d.goc_may ?? null}, goc_may), hanh_dong = coalesce(${d.hanh_dong ?? null}, hanh_dong),
    loi_thoai = coalesce(${d.loi_thoai ?? null}, loi_thoai), am_thanh = coalesce(${d.am_thanh ?? null}, am_thanh), thoi_luong_s = coalesce(${d.thoi_luong_s ?? null}, thoi_luong_s),
    nhan_vat = coalesce(${d.nhan_vat ? JSON.stringify(d.nhan_vat) : null}::jsonb, nhan_vat), bien_the = coalesce(${d.bien_the ? JSON.stringify(d.bien_the) : null}::jsonb, bien_the), prompt_anh = coalesce(${d.prompt_anh ?? null}, prompt_anh),
    prompt_video = coalesce(${d.prompt_video ?? null}, prompt_video), thu_tu = coalesce(${d.thu_tu ?? null}, thu_tu),
    phan_doan = coalesce(${d.phan_doan ?? null}, phan_doan), cam_xuc = coalesce(${d.cam_xuc ?? null}, cam_xuc), trang_phuc = coalesce(${d.trang_phuc ?? null}, trang_phuc),
    ky_thuat = coalesce(${d.ky_thuat ? JSON.stringify(lamSachKyThuat(d.ky_thuat as unknown as Record<string, unknown>)) : null}::jsonb, ky_thuat), updated_at = now() WHERE id = ${id}`);
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
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boVaoThungRac(db, 'canh', [id], me.email);   // vào thùng rác, khôi phục được — không xoá thật (#1192)
  return { ok: true, data: undefined };
}

async function boiCanhCanh(db: NonNullable<ReturnType<typeof getDb>>, canhId: number) {
  const r = (await db.execute(sql`SELECT c.*, p.kinh_thanh AS kt, p.id AS p_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id JOIN xv_phim p ON p.id = t.phim_id WHERE c.id = ${canhId}`)) as unknown as Row[];
  if (!r[0]) return null;
  const canh = mapCanh(r[0]);
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const nv = canh.nhan_vat.length
    ? await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE id = ANY(${mangInt(canh.nhan_vat)}::int[])`)) as unknown as Row[]).map(mapNhanVat))
    : [];
  return { canh, kt, nhanVat: nv };
}

/** Prompt ảnh cuối = phong cách bộ phim + prompt cảnh + nhắc giữ đúng anchor theo ảnh tham chiếu. */
function ghepPromptAnh(prompt: string, phongCach: string, nv: NhanVat[], kyThuatAnh = '', trangPhuc = ''): string {
  // Kỹ thuật điện ảnh của shot (cỡ cảnh, góc, ống kính, ánh sáng, màu — thư viện dien-anh.ts) đứng ngay sau phong cách.
  const dong = [phongCach ? `Visual style: ${phongCach}.` : '', kyThuatAnh ? `Cinematography: ${kyThuatAnh}.` : '', prompt.trim()];
  // DANH TÍNH ≠ TRANG PHỤC: người giữ y mặt/tóc/tuổi/dáng; quần áo theo shot nếu shot ghi trang phục. Trước đây "giữ ĐÚNG như mô tả"
  // khoá luôn bộ đồ trong mô tả anchor → shot khoe áo bra bị chồng lên áo thun (09/10/2026).
  const nguoi = nv.filter((v) => v.loai === 'nhan_vat');
  const vat = nv.filter((v) => v.loai !== 'nhan_vat');
  if (nguoi.length) {
    dong.push(trangPhuc.trim()
      ? `Keep the SAME person(s) as in the reference images — identical face, hair, age, skin and body type: ${nguoi.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}. CLOTHING IN THIS SHOT overrides any clothing in that description: ${trangPhuc.trim()}. Do not add any other garment or outer layer that is not stated.`
      : `Keep these people EXACTLY as described (and as shown in the reference images): ${nguoi.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}. Do not redesign them.`);
  }
  if (vat.length) dong.push(`Keep these products / places / props EXACTLY as described and as in the reference images (same color, shape, details): ${vat.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}.`);
  return dong.filter(Boolean).join(' ');
}

/** Sinh keyframe: `so` ứng viên (1-3), nối vào keyframe_uv; cảnh chưa có ảnh chọn thì tự chọn ảnh đầu. */
export async function sinhKeyframe(canhId: number, so = 1, moHinh?: string): Promise<Kq<number[]>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return loi('không thấy cảnh');
  if (!bc.canh.prompt_anh.trim()) return loi('cảnh chưa có prompt ảnh');
  if (moHinh && (moHinh.startsWith('fal:') || MO_HINH_ANH.some((m) => m.key === moHinh))) bc.kt.mo_hinh_anh = moHinh as typeof bc.kt.mo_hinh_anh;
  await db.execute(sql`UPDATE xv_canh SET loi = '' WHERE id = ${canhId}`);
  const tp = thanhPhanCanh(bc.canh, bc.nhanVat);
  if (tp.thieu.length) return loi(`Chưa chuẩn bị đủ thành phần: ${tp.thieu.join('; ')}. Làm ở mục 2 (Tuyến nhân vật) rồi sinh lại.`);
  // Mỗi anchor: ảnh biến thể cảnh chọn (nếu đã sinh) đứng TRƯỚC, rồi ảnh gốc — model bám biến thể mà vẫn giữ danh tính.
  const btCanh = (v: NhanVat) => (v.bien_the ?? []).find((b) => bc.canh.bien_the.includes(b.id));
  const urlRef = bc.nhanVat.flatMap((v) => { const b = btCanh(v); return [...(b?.anh_url ? [b.anh_url] : []), ...v.anh_ref.slice(0, b?.anh_url ? 1 : 2)]; }).slice(0, 10);
  const ghiChuBt = bc.nhanVat.map((v) => { const b = btCanh(v); return b ? `${v.ten} in this shot: ${b.mo_ta || b.ten}.` : ''; }).filter(Boolean).join(' ');
  const prompt = [ghepPromptAnh(bc.canh.prompt_anh, bc.kt.phong_cach, bc.nhanVat, promptKyThuatAnh(bc.canh.ky_thuat), bc.canh.trang_phuc), ghiChuBt].filter(Boolean).join(' ');
  const jobs: number[] = [];
  for (let i = 0; i < Math.max(1, Math.min(3, so)); i++) {
    const job = await taoJob({ nhan: `Keyframe · cảnh #${bc.canh.thu_tu} ${bc.canh.canh}`, canh_id: canhId, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { prompt, thamChieu: urlRef.length } });
    jobs.push(job);
    await dayViecAnh({ job, model: bc.kt.mo_hinh_anh, prompt, thamChieuUrl: urlRef, tiLe: bc.kt.ti_le, thuMuc: `keyframe/${canhId}` });
  }
  return { ok: true, data: jobs };
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
    const r = (await db.execute(sql`UPDATE xv_canh SET trang_thai = 'duyet', loi = '', updated_at = now() WHERE id = ${canhId} AND keyframe_url IS NOT NULL RETURNING id`)) as unknown as Row[];
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
export async function sinhVideoCanh(canhId: number, moHinh?: string, ban: 'nhap' | 'cuoi' = 'nhap'): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return loi('không thấy cảnh');
  if (bc.canh.trang_thai !== 'duyet' && bc.canh.trang_thai !== 'loi' && bc.canh.trang_thai !== 'xong') return loi('cảnh chưa duyệt keyframe');
  if (!bc.canh.keyframe_url) return loi('cảnh chưa có keyframe');
  if (moHinh && (moHinh.startsWith('fal:') || MO_HINH_VIDEO.some((m) => m.key === moHinh))) bc.kt.mo_hinh_video = moHinh as typeof bc.kt.mo_hinh_video;
  const prompt = [bc.kt.phong_cach ? `Visual style: ${bc.kt.phong_cach}.` : '', bc.canh.prompt_video.trim() || bc.canh.hanh_dong, bc.canh.trang_phuc.trim() ? `Clothing stays exactly: ${bc.canh.trang_phuc.trim()}; no extra garments.` : '', promptKyThuatVideo(bc.canh.ky_thuat)].filter(Boolean).join(' ');
  const giay = (bc.canh.thoi_luong_s <= 4 ? 4 : bc.canh.thoi_luong_s <= 6 ? 6 : 8) as 4 | 6 | 8;
  const laFal = bc.kt.mo_hinh_video.startsWith('fal:');
  // Nối cảnh: khung cuối = keyframe cảnh kế (cùng tập) khi tập bật noi_khung → các clip ghép liền mạch, bản cuối khớp bố cục bản nháp.
  const ke = (await db.execute(sql`SELECT c2.keyframe_url, t.noi_khung FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id
    LEFT JOIN LATERAL (SELECT keyframe_url FROM xv_canh x WHERE x.tap_id = c.tap_id AND x.thu_tu > c.thu_tu ORDER BY x.thu_tu LIMIT 1) c2 ON true WHERE c.id = ${canhId}`)) as unknown as Row[];
  const khungCuoi = ke[0]?.noi_khung === true && ke[0]?.keyframe_url ? s(ke[0].keyframe_url) : null;
  const job = await taoJob({ nhan: `Video ${ban === 'cuoi' ? 'BẢN CUỐI' : 'nháp'} · cảnh #${bc.canh.thu_tu} ${bc.canh.canh} · ${giay}s`, canh_id: canhId, loai: 'video', provider: laFal ? 'fal' : 'google', model: bc.kt.mo_hinh_video, request: { prompt, giay, doPhanGiai: bc.kt.do_phan_giai, tiLe: bc.kt.ti_le, ban, khungDau: bc.canh.keyframe_url, khungCuoi } });
  let kq: { ok: true; taskId: string } | { ok: false; loi: string };
  if (laFal) {
    const id = bc.kt.mo_hinh_video.slice(4);
    kq = await guiFal(id, await dauVaoTheoSchema(id, { prompt, anhDau: bc.canh.keyframe_url, anhCuoi: khungCuoi, giay: bc.canh.thoi_luong_s || giay, tiLe: bc.kt.ti_le }));
  } else {
    const anhDau = await taiAnhBase64(bc.canh.keyframe_url);
    if (!anhDau) { await xongJob(job, { loi: 'không tải được keyframe' }); return loi('không tải được keyframe'); }
    const anhCuoi = khungCuoi ? await taiAnhBase64(khungCuoi) : null;
    kq = await batDauVeo({ model: bc.kt.mo_hinh_video, prompt, anhDau, anhCuoi, tiLe: bc.kt.ti_le, doPhanGiai: bc.kt.do_phan_giai, giay });
  }
  if (!kq.ok) {
    await xongJob(job, { loi: kq.loi });
    await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = ${kq.loi}, updated_at = now() WHERE id = ${canhId}`);
    return loi(kq.loi);
  }
  await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${kq.taskId}, updated_at = now() WHERE id = ${job}`);
  await db.execute(sql`UPDATE xv_canh SET trang_thai = 'dang_sinh', loi = '', updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: job };
}

/** Chọn một phiên bản đã sinh làm nháp hoặc bản cuối đang dùng (không tốn tiền). */
export async function chonPhienBan(canhId: number, url: string, ban: 'nhap' | 'cuoi'): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (ban === 'cuoi') await db.execute(sql`UPDATE xv_canh SET video_cuoi_url = ${url}, updated_at = now() WHERE id = ${canhId} AND video_phien_ban @> ${JSON.stringify([{ url }])}::jsonb`);
  else await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${canhId} AND video_phien_ban @> ${JSON.stringify([{ url }])}::jsonb`);
  return { ok: true, data: undefined };
}

/** Bản cuối = NÂNG CẤP chính clip nháp (Topaz qua fal) → chuyển động, bố cục, nhân vật giống bản nháp 100%. */
export async function nangCapCanh(canhId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const c = (await db.execute(sql`SELECT thu_tu, canh, video_url, thoi_luong_s FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[];
  if (!c[0]?.video_url) return loi('cảnh chưa có video nháp để nâng cấp');
  const giay = n(c[0].thoi_luong_s) || 8;
  const job = await taoJob({ nhan: `Nâng cấp bản cuối · cảnh #${n(c[0].thu_tu)} ${s(c[0].canh)}`, canh_id: canhId, loai: 'video', provider: 'fal', model: NANG_CAP.model, request: { nangCap: true, ban: 'cuoi', giay, tu: s(c[0].video_url) } });
  const kq = await batDauNangCap(NANG_CAP.model, s(c[0].video_url), 2);
  if (!kq.ok) { await xongJob(job, { loi: kq.loi }); await db.execute(sql`UPDATE xv_canh SET loi = ${kq.loi} WHERE id = ${canhId}`); return loi(kq.loi); }
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
    const kq = r.provider === 'fal' ? await docFal(r.task_id!) : await docVeo(r.task_id!);
    if (!kq.done) { conChay++; continue; }
    if (!kq.ok) {
      await xongJob(r.id, { loi: kq.loi });
      await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = ${kq.loi}, updated_at = now() WHERE id = ${r.canh_id}`);
      continue;
    }
    const buf = r.provider === 'fal' ? await fetch(kq.uri).then((x) => (x.ok ? x.arrayBuffer().then((a) => Buffer.from(a)) : null)).catch(() => null) : await taiVeo(kq.uri);
    const url = buf ? await uploadToR2(`xuong-video/clip/${r.canh_id}-${randomUUID()}.mp4`, buf, 'video/mp4') : null;
    if (!url) {
      await xongJob(r.id, { loi: 'tải/lưu video thất bại' });
      await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = 'tải/lưu video thất bại', updated_at = now() WHERE id = ${r.canh_id}`);
      continue;
    }
    const req = (await db.execute(sql`SELECT request, model FROM xv_job WHERE id = ${r.id}`)) as unknown as Row[];
    const rq = (req[0]?.request ?? {}) as { giay?: number; doPhanGiai?: '720p' | '1080p'; ban?: 'nhap' | 'cuoi'; nangCap?: boolean; prompt?: string; khungDau?: string; khungCuoi?: string | null };
    const gia = rq.nangCap ? NANG_CAP.giaGiayCents * (rq.giay ?? 8) : await giaVideoSv(s(req[0]?.model), rq.doPhanGiai ?? '720p', rq.giay ?? 8);
    await xongJob(r.id, { output_url: url, chi_phi_cents: gia });
    const pb = JSON.stringify([{ url, ban: rq.ban === 'cuoi' || rq.nangCap ? 'cuoi' : 'nhap', model: s(req[0]?.model), job: r.id, luc: new Date().toISOString() }]);
    await db.execute(sql`UPDATE xv_canh SET video_phien_ban = video_phien_ban || ${pb}::jsonb WHERE id = ${r.canh_id}`);
    if (rq.ban === 'cuoi' || rq.nangCap) {
      await db.execute(sql`UPDATE xv_canh SET video_cuoi_url = ${url}, trang_thai = 'xong', loi = '', chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${r.canh_id}`);
    } else {
      // Nháp: lưu NGUỒN để bản cuối tái lập đúng (model, prompt, khung đầu/cuối).
      const nguon = { model: s(req[0]?.model), prompt: rq.prompt ?? '', khung_dau: rq.khungDau ?? null, khung_cuoi: rq.khungCuoi ?? null, giay: rq.giay ?? null, job: r.id };
      await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, nguon_video = ${JSON.stringify(nguon)}::jsonb, trang_thai = 'xong', loi = '', chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${r.canh_id}`);
    }
    vuaXong++;
  }
  return { conChay, vuaXong };
}

/** Tải ảnh tham chiếu (data URL từ trình duyệt) lên R2 — thay cho ImageAttach của mos2. */
export async function taiAnhLen(dataUrl: string): Promise<Kq<string>> {
  if (!(await admin())) return loi('không có quyền');
  const m = (dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/s);
  if (!m) return loi('không phải ảnh');
  const buf = Buffer.from(m[2]!, 'base64');
  if (buf.length > 8_000_000) return loi('ảnh quá lớn (>8MB)');
  const url = await uploadToR2(`xuong-video/ref/${randomUUID()}.${duoi(m[1]!)}`, buf, m[1]!);
  return url ? { ok: true, data: url } : loi('R2 không nhận ảnh (thiếu cấu hình storage?)');
}

async function kemBienThe(db: NonNullable<ReturnType<typeof getDb>>, nvs: NhanVat[]): Promise<NhanVat[]> {
  if (!nvs.length) return nvs;
  const bt = ((await db.execute(sql`SELECT * FROM xv_bien_the WHERE nhan_vat_id = ANY(${mangInt(nvs.map((v) => v.id))}::int[]) ORDER BY nhom, id`)) as unknown as Row[]).map(mapBienThe);
  for (const v of nvs) v.bien_the = bt.filter((b) => b.nhan_vat_id === v.id);
  return nvs;
}

/** Ghi một lần gọi Claude vào sổ chi phí (token → cents). */
async function ghiChu(phimId: number | null, nhan: string, r: { ok: boolean } & Partial<DungChu>): Promise<void> {
  if (!r.ok || !r.model || !r.tokens) return;
  const db = getDb()!;
  const gia = giaChuCents(r.model, r.tokens.in, r.tokens.out);
  await db.execute(sql`INSERT INTO xv_job (phim_id, nhan, loai, provider, model, trang_thai, chi_phi_cents, tokens_in, tokens_out)
    VALUES (${phimId}, ${nhan}, 'chu', 'anthropic', ${r.model}, 'xong', ${Math.round(gia * 100) / 100}, ${r.tokens.in}, ${r.tokens.out})`);
}

// ── Gợi ý AI cho mọi form (đọc ngữ cảnh cả phim) ──────────────────────────────────────────────────────────────

async function nguCanhPhim(db: NonNullable<ReturnType<typeof getDb>>, phimId: number): Promise<NguCanhPhim | null> {
  const p = (await db.execute(sql`SELECT * FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  if (!p[0]) return null;
  const nv = (await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY loai, id`)) as unknown as Row[];
  const tap = (await db.execute(sql`SELECT so, ten, tom_tat, kich_ban FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so`)) as unknown as Row[];
  return {
    loai: s(p[0].loai) as LoaiPhim, ten: s(p[0].ten), mo_ta: s(p[0].mo_ta), kinhThanh: (p[0].kinh_thanh ?? {}) as KinhThanh, nhanVat: await kemBienThe(db, nv.map(mapNhanVat)),
    tap: tap.map((t) => ({ so: n(t.so), ten: s(t.ten), tom_tat: s(t.tom_tat), kich_ban: s(t.kich_ban) })),
  };
}

export async function goiYAIKinhThanh(phimId: number): Promise<Kq<{ phong_cach: string; mo_ta: string; the_loai?: string; logline?: string; chu_de?: string }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const nc = await nguCanhPhim(db, phimId);
  if (!nc) return loi('không thấy phim');
  const r = await goiYKinhThanh(nc);
  await ghiChu(phimId, 'AI gợi ý kinh thánh', r);
  return r.ok ? { ok: true, data: r.data } : loi(r.loi);
}

export async function goiYAIAnchor(phimId: number, a: { loai: LoaiNhanVat; ten: string; mo_ta: string }): Promise<Kq<{ mo_ta: string; giong: string }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!a.ten.trim()) return loi('đặt tên anchor trước');
  const nc = await nguCanhPhim(db, phimId);
  if (!nc) return loi('không thấy phim');
  const r = await goiYAnchor(nc, a);
  await ghiChu(phimId, `AI tả anchor · ${a.ten}`, r);
  return r.ok ? { ok: true, data: r.data } : loi(r.loi);
}

/** AI đề xuất tuyến nhân vật còn thiếu từ tiền đề + kịch bản → TẠO luôn các anchor (người sửa lại sau). */
export async function goiYAIBoAnchor(phimId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const nc = await nguCanhPhim(db, phimId);
  if (!nc) return loi('không thấy phim');
  if (!nc.mo_ta.trim() && !nc.tap.some((t) => t.kich_ban.trim())) return loi('viết tiền đề (kinh thánh) hoặc kịch bản trước để AI có gì mà đề xuất');
  const r = await goiYBoAnchor(nc);
  await ghiChu(phimId, 'AI đề xuất tuyến nhân vật', r);
  if (!r.ok) return loi(r.loi);
  const daCo = new Set(nc.nhanVat.map((v) => v.ten.trim().toLowerCase()));
  let them = 0;
  for (const a of r.data.anchors) {
    if (daCo.has(a.ten.trim().toLowerCase())) continue;
    await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, giong) VALUES (${phimId}, ${a.loai}, ${a.ten.trim()}, ${a.mo_ta}, ${a.giong})`);
    them++;
  }
  return { ok: true, data: them };
}

export async function goiYAIBrief(tapId: number, thoiLuongS: number): Promise<Kq<string>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const t = (await db.execute(sql`SELECT phim_id, so FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return loi('không thấy tập');
  const nc = await nguCanhPhim(db, n(t[0].phim_id));
  if (!nc) return loi('không thấy phim');
  const r = await goiYBrief(nc, n(t[0].so), thoiLuongS);
  await ghiChu(n(t[0].phim_id), `AI gợi ý brief · tập ${n(t[0].so)}`, r);
  if (r.ok) await db.execute(sql`UPDATE xv_tap SET brief = ${r.data.brief}, updated_at = now() WHERE id = ${tapId}`);
  return r.ok ? { ok: true, data: r.data.brief } : loi(r.loi);
}

/** AI viết lại một cảnh (điền form, chưa lưu) — đọc cảnh trước/sau + anchor để khớp mạch. */
export async function goiYAICanh(canhId: number, nhap: { canh: string; goc_may: string; hanh_dong: string; loi_thoai: string; nhan_vat: number[] }): Promise<Kq<Partial<Canh>>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const c = (await db.execute(sql`SELECT c.thu_tu, c.tap_id, t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${canhId}`)) as unknown as Row[];
  if (!c[0]) return loi('không thấy cảnh');
  const nc = await nguCanhPhim(db, n(c[0].phim_id));
  if (!nc) return loi('không thấy phim');
  const thuTu = n(c[0].thu_tu);
  const lanCan = (await db.execute(sql`SELECT thu_tu, canh, hanh_dong FROM xv_canh WHERE tap_id = ${n(c[0].tap_id)} AND thu_tu IN (${thuTu - 1}, ${thuTu + 1})`)) as unknown as Row[];
  const ta = (r?: Row) => (r ? `${s(r.canh)} — ${s(r.hanh_dong)}` : undefined);
  const tenNv = nhap.nhan_vat.map((id) => nc.nhanVat.find((v) => v.id === id)?.ten).filter((x): x is string => !!x);
  const r = await goiYCanh(nc, { thu_tu: thuTu, ...nhap, nhan_vat: tenNv }, ta(lanCan.find((x) => n(x.thu_tu) === thuTu - 1)), ta(lanCan.find((x) => n(x.thu_tu) === thuTu + 1)));
  await ghiChu(n(c[0].phim_id), `AI viết lại cảnh #${thuTu}`, r);
  if (!r.ok) return loi(r.loi);
  const tenToId = new Map(nc.nhanVat.map((v) => [v.ten.trim().toLowerCase(), v.id]));
  const ids = r.data.nhan_vat.map((t) => tenToId.get(t.trim().toLowerCase())).filter((x): x is number => typeof x === 'number');
  return { ok: true, data: { canh: r.data.canh, goc_may: r.data.goc_may, hanh_dong: r.data.hanh_dong, loi_thoai: r.data.loi_thoai, am_thanh: r.data.am_thanh, thoi_luong_s: r.data.thoi_luong_s, nhan_vat: ids.length ? ids : nhap.nhan_vat, prompt_anh: r.data.prompt_anh, prompt_video: r.data.prompt_video, cam_xuc: Math.max(-5, Math.min(5, Math.round(r.data.cam_xuc))), ky_thuat: lamSachKyThuat(r.data.ky_thuat as unknown as Record<string, unknown>), thoai: (r.data.thoai ?? []).filter((d) => d.loi.trim()), trang_phuc: r.data.trang_phuc ?? '' } };
}

// ── Job ──────────────────────────────────────────────────────────────────────────────────────────────────────────

async function taoJob(d: { phim_id?: number; nhan?: string; canh_id?: number; nhan_vat_id?: number; bien_the_id?: number; loai: string; provider: string; model: string; request: unknown; xong?: boolean }): Promise<number> {
  const db = getDb()!;
  // phim_id tính trước bằng truy vấn riêng: nhét cùng một tham số số vào subquery của INSERT làm postgres-js đoán kiểu
  // text cho nó rồi ném ERR_INVALID_ARG_TYPE (sinh keyframe hỏng hẳn 08/10/2026).
  let phimId: number | null = d.phim_id ?? null;
  if (phimId == null && d.canh_id != null) {
    const q = (await db.execute(sql`SELECT t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${d.canh_id}`)) as unknown as Row[];
    phimId = q[0] ? n(q[0].phim_id) : null;
  }
  if (phimId == null && d.nhan_vat_id != null) {
    const q = (await db.execute(sql`SELECT phim_id FROM xv_nhan_vat WHERE id = ${d.nhan_vat_id}`)) as unknown as Row[];
    phimId = q[0] ? n(q[0].phim_id) : null;
  }
  const r = (await db.execute(sql`INSERT INTO xv_job (phim_id, nhan, canh_id, nhan_vat_id, bien_the_id, loai, provider, model, request, trang_thai)
    VALUES (${phimId}, ${d.nhan ?? ''}, ${d.canh_id ?? null}, ${d.nhan_vat_id ?? null}, ${d.bien_the_id ?? null}, ${d.loai}, ${d.provider}, ${d.model}, ${JSON.stringify(d.request ?? {})}::jsonb, ${d.xong ? 'xong' : 'cho'}) RETURNING id`)) as unknown as Row[];
  return n(r[0]?.id);
}
async function xongJob(id: number, d: { output_url?: string; model?: string; chi_phi_cents?: number; loi?: string }) {
  const db = getDb()!;
  if (d.model?.startsWith('gpt-')) await db.execute(sql`UPDATE xv_job SET provider = 'openai' WHERE id = ${id}`);
  await db.execute(sql`UPDATE xv_job SET trang_thai = ${d.loi ? 'loi' : 'xong'}, output_url = coalesce(${d.output_url ?? null}, output_url), model = coalesce(${d.model ?? null}, model),
    chi_phi_cents = ${Math.round((d.chi_phi_cents ?? 0) * 1000) / 1000}, loi = ${d.loi ?? ''}, updated_at = now() WHERE id = ${id}`);
}
const duoi = (mime: string) => (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');

// ── Giọng · hiệu ứng âm thanh · nhạc nền (08/10/2026) ──────────────────────────────────────────────────────────
// Mỗi lượt sinh = một job 'am' (tiền tính trước theo ký tự/giây, ghi vào request.gia) → hàng đợi Cloudflare → file R2 → gắn vào shot/tập.
// Chỉ chạy khi anh bấm (mỗi bấm một lượt, giá hiện trên nút).

/** Model giọng (ElevenLabs tài khoản anh nếu có khoá + mọi TTS của fal) — cho ô chọn. */
export async function dsGiongModel(): Promise<MoHinhGiong[]> {
  if (!(await admin())) return [];
  return dsMoHinhGiong();
}
/** Giọng có sẵn của một model (đọc từ OpenAPI fal / tài khoản ElevenLabs). */
export async function dsGiongCua(model: string): Promise<{ id: string; ten: string }[]> {
  if (!(await admin())) return [];
  return giongCua(model);
}

/** Chọn giọng cố định cho nhân vật (model + voice) — mọi shot nhân vật này nói dùng giọng này, cả bộ phim. */
export async function chonGiong(nhanVatId: number, model: string, voice: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!model) return loi('chọn model giọng');
  const ds = await giongCua(model);
  if (ds.length && !ds.some((g) => g.id === voice)) return loi('giọng không có trong danh sách của model');
  await db.execute(sql`UPDATE xv_nhan_vat SET giong_model = ${model}, giong_id = ${voice}, giong_mau_url = NULL, updated_at = now() WHERE id = ${nhanVatId}`);
  return { ok: true, data: undefined };
}

const MODEL_GIONG_MAC_DINH = () => (coElevenTrucTiep() ? 'elevenlabs:eleven_v3' : GIONG_MAC_DINH.model);
async function giongMacDinh(model: string): Promise<string> {
  const ds = await giongCua(model);
  return ds.find((g) => g.id === GIONG_MAC_DINH.voice)?.id ?? ds[0]?.id ?? '';
}

/** Sinh giọng đọc lời thoại cho các shot (một shot hoặc mọi shot có thoại của tập). */
/** tuy: chọn từ bảng ＋ trên timeline (#1202) — model/giọng cho lượt này (không đổi giọng cố định của nhân vật), cảm xúc, chỉ dòng chưa có giọng. */
export type TuyGiong = { model?: string; voice?: string; camXuc?: number; chiThieu?: boolean;
  /** giọng cho từng người nói của lượt này (khoá = tên nhân vật, '' = lời dẫn) — chọn trong bảng ＋ (#1203) */
  theoNguoi?: Record<string, { model: string; voice: string }> };
export async function sinhGiong(tapId: number, canhIds?: number[], tuy: TuyGiong = {}): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const ds = (await dsCanh(tapId)).filter((c) => (!canhIds || canhIds.includes(c.id)) && dongThoai(c, bc.nhanVat).length > 0);
  if (!ds.length) return loi('không có shot nào có lời thoại');
  const dm = await dsMoHinhGiong();
  let so = 0;
  for (const c of ds) {
    // Thoại theo dòng (kịch bản phim): mỗi dòng một file, giọng của đúng người nói dòng đó. Shot cũ chỉ có chuỗi → tách dòng và LƯU
    // vào c.thoai trước, để file giọng gắn đúng dòng (cùng một cách đọc với thẻ shot/timeline: dongThoai).
    if (!c.thoai.length && c.loi_thoai.trim()) {
      c.thoai = dongThoai(c, bc.nhanVat);
      await db.execute(sql`UPDATE xv_canh SET thoai = ${JSON.stringify(c.thoai)}::jsonb WHERE id = ${c.id}`);
    }
    if (c.thoai.length) {
      for (const [i, d] of c.thoai.entries()) {
        if (!d.loi.trim() || (tuy.chiThieu && d.url)) continue;
        const v = bc.nhanVat.find((x) => x.ten.toLowerCase() === d.nhan_vat.trim().toLowerCase()) ?? null;
        const chon = tuy.theoNguoi?.[d.nhan_vat.trim()] ?? tuy.theoNguoi?.[(v?.ten ?? '')];
        const model = chon?.model || tuy.model || v?.giong_model || MODEL_GIONG_MAC_DINH();
        const voice = chon?.voice || (tuy.model ? tuy.voice : '') || (v?.giong_model === model ? v.giong_id : '') || await giongMacDinh(model);
        const text = d.loi.trim();
        const g = giaGiong(dm.find((m) => m.key === model), text.length);
        const gia = g ?? 0;   // model không công bố giá → sổ ghi 0 và nhãn job ghi "giá chưa rõ" để sổ chi phí không hiểu nhầm là miễn phí
        const job = await taoJob({ nhan: `Giọng · shot #${c.thu_tu} dòng ${i + 1} · ${v?.ten ?? 'lời dẫn'} (${voice})${g == null ? ' · giá chưa rõ' : ''}`, canh_id: c.id, nhan_vat_id: v?.id, loai: 'am', provider: model.startsWith('elevenlabs:') ? 'elevenlabs' : 'fal', model: model.startsWith('elevenlabs:') ? model : `fal:${model}`, request: { dich: 'thoai', dong: i, gia, text, voice } });
        await dayViecAm({ kieu: 'am', job, model, input: await dauVaoGiongTheoModel(model, { text: d.dien_xuat && /eleven/.test(model) && /v3/.test(model) ? `[${d.dien_xuat}] ${text}` : text, voice, ngonNgu: bc.kt.ngon_ngu ?? 'vi', camXuc: tuy.camXuc ?? c.cam_xuc, theLoai: bc.kt.the_loai ?? '' }), thuMuc: `thoai/${c.id}-${i}` });
        so++;
      }
    }
  }
  return { ok: true, data: so };
}

/** Nghe thử giọng của một nhân vật (một câu ngắn). */
export async function ngheThuGiong(nhanVatId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy nhân vật');
  const v = mapNhanVat(r[0]); const kt = docKinhThanh(r[0].kt as KinhThanh);
  if (!v.giong_model) return loi('chọn giọng trước');
  const text = kt.ngon_ngu === 'vi' ? `Xin chào, mình là ${v.ten}. Đây là giọng của mình trong cả bộ phim.` : `Hi, I'm ${v.ten}. This is how I sound in the whole series.`;
  const g = giaGiong((await dsMoHinhGiong()).find((m) => m.key === v.giong_model), text.length);
  const gia = g ?? 0;
  const job = await taoJob({ nhan: `Nghe thử giọng · ${v.ten} (${v.giong_id})${g == null ? ' · giá chưa rõ' : ''}`, nhan_vat_id: v.id, loai: 'am', provider: v.giong_model.startsWith('elevenlabs:') ? 'elevenlabs' : 'fal', model: v.giong_model.startsWith('elevenlabs:') ? v.giong_model : `fal:${v.giong_model}`, request: { dich: 'giong_mau', gia, text } });
  await dayViecAm({ kieu: 'am', job, model: v.giong_model, input: await dauVaoGiongTheoModel(v.giong_model, { text, voice: v.giong_id, ngonNgu: kt.ngon_ngu, camXuc: 0, theLoai: kt.the_loai }), thuMuc: `giong/${v.id}` });
  return { ok: true, data: job };
}

/** Sinh hiệu ứng âm thanh cho shot: có clip → từ clip (khớp hành động); chưa có → từ mô tả âm thanh + kỹ thuật âm thanh của shot. */
/** tuy (#1202): nguồn (từ clip / từ mô tả), model, mô tả sửa tay, số giây. */
export type TuyAm = { nguon?: 'clip' | 'mo_ta'; model?: string; moTa?: string; giay?: number };
export async function sinhAmThanh(tapId: number, canhIds?: number[], moHinhChu = 'sonilo/v1.1/text-to-sound-effects', tuy: TuyAm = {}): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const ds = (await dsCanh(tapId)).filter((c) => !canhIds || canhIds.includes(c.id));
  let so = 0;
  for (const c of ds) {
    const clip = tuy.nguon === 'mo_ta' ? null : c.video_cuoi_url || c.video_url;
    const moTa = tuy.moTa?.trim() || [c.am_thanh, promptKyThuatVideo({ am_thanh: c.ky_thuat.am_thanh }).replace(/^Sound:\s*/, '')].filter(Boolean).join('. ');
    if (!clip && !moTa.trim()) continue;
    const giay = tuy.giay || c.thoi_luong_s || 5;
    const model = clip ? (tuy.model && moHinhAm(tuy.model)?.loai === 'sfx_video' ? tuy.model : 'mirelo-ai/sfx-v1/video-to-audio') : (tuy.model && moHinhAm(tuy.model)?.loai === 'sfx_chu' ? tuy.model : moHinhChu);
    const gia = giaAm(model, giay);
    const input: Record<string, unknown> = clip ? { video_url: clip, duration: giay, num_samples: 1, text_prompt: moTa }
      : model.includes('elevenlabs') ? { text: moTa, duration_seconds: giay } : { prompt: moTa, duration: giay };
    const job = await taoJob({ nhan: `Âm thanh · shot #${c.thu_tu} ${clip ? '(từ clip)' : '(từ mô tả)'}`, canh_id: c.id, loai: 'am', provider: 'fal', model: `fal:${model}`, request: { dich: 'sfx', gia, moTa } });
    await dayViecAm({ kieu: 'am', job, model, input, thuMuc: `sfx/${c.id}` });
    so++;
  }
  return so ? { ok: true, data: so } : loi('không shot nào có clip hoặc mô tả âm thanh');
}

/** Sinh nhạc nền: theo TỪNG PHÂN CẢNH (mặc định — mỗi đoạn đúng không khí + cảm xúc của phân cảnh, dài bằng phân cảnh) hoặc một bài cả tập.
 *  phanDoan: tên một phân cảnh · '*' = mọi phân cảnh · undefined = một bài cả tập. */
export async function sinhNhac(tapId: number, model = 'cassetteai/music-generator', phanDoan?: string, moTaThem = ''): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  if (!moHinhAm(model) || moHinhAm(model)!.loai !== 'nhac') return loi('model nhạc không hợp lệ');
  const ds = await dsCanh(tapId);
  const tl = bc.kt.the_loai ? `Genre: ${bc.kt.the_loai.replace('_', ' ')}` : '';
  const dauVao = (prompt: string, giay: number) => (model.includes('elevenlabs') ? { prompt, music_length_ms: giay * 1000, force_instrumental: true } : { prompt, duration: giay });
  const nhacCua = (shots: typeof ds) => [...new Set(shots.map((c) => promptKyThuatVideo({ nhac: c.ky_thuat.nhac }).replace(/^Music:\s*/, '').replace(/\.$/, '')).filter(Boolean))];
  if (phanDoan === undefined) {
    const giay = Math.max(10, ds.reduce((a, c) => a + (c.thoi_luong_s || 5), 0));
    const cx = ds.map((c) => c.cam_xuc);
    const prompt = [moTaThem || bc.tap.nhac_mo_ta, tl, nhacCua(ds).length ? `Style: ${nhacCua(ds).join('; ')}` : '', cx.length ? `emotional arc from ${cx[0]} to ${cx[cx.length - 1]} (scale -5..5)` : '', 'instrumental background score, no vocals'].filter(Boolean).join('. ');
    const gia = giaAm(model, giay);
    const job = await taoJob({ phim_id: bc.tap.phim_id, nhan: `Nhạc nền cả tập ${bc.tap.so} (${giay}s)`, loai: 'am', provider: 'fal', model: `fal:${model}`, request: { dich: 'nhac', gia, tap_id: tapId, prompt } });
    if (moTaThem) await db.execute(sql`UPDATE xv_tap SET nhac_mo_ta = ${moTaThem}, updated_at = now() WHERE id = ${tapId}`);
    await dayViecAm({ kieu: 'am', job, model, input: dauVao(prompt, giay), thuMuc: `nhac/${tapId}` });
    return { ok: true, data: 1 };
  }
  const tenPc = phanDoan === '*' ? [...new Set(ds.map((c) => c.phan_doan).filter(Boolean))] : [phanDoan];
  if (!tenPc.length) return loi('tập chưa có phân cảnh — tách lại cảnh để có phân cảnh, hoặc sinh một bài cả tập');
  for (const ten of tenPc) {
    const shots = ds.filter((c) => c.phan_doan === ten);
    if (!shots.length) continue;
    const pc = bc.tap.phan_canh.find((x) => x.ten === ten);
    const giay = Math.max(5, shots.reduce((a, c) => a + (c.thoi_luong_s || 5), 0));
    const nhip = pc?.nhip === 'nhanh' ? 'fast tempo' : pc?.nhip === 'cham' ? 'slow tempo' : 'medium tempo';
    const prompt = [moTaThem, tl, nhacCua(shots).length ? `Style: ${nhacCua(shots).join('; ')}` : '', pc ? `Scene mood moves from ${pc.cam_xuc_dau} to ${pc.cam_xuc_cuoi} on a -5..5 scale (${pc.cam_xuc_cuoi > pc.cam_xuc_dau ? 'building hope/energy' : pc.cam_xuc_cuoi < pc.cam_xuc_dau ? 'darkening, tension or sadness' : 'steady'})` : '', nhip, 'instrumental cue, no vocals, clean start and ending'].filter(Boolean).join('. ');
    const gia = giaAm(model, giay);
    const job = await taoJob({ phim_id: bc.tap.phim_id, nhan: `Nhạc phân cảnh · ${ten} (${giay}s)`, loai: 'am', provider: 'fal', model: `fal:${model}`, request: { dich: 'nhac', gia, tap_id: tapId, phan_doan: ten, prompt } });
    await dayViecAm({ kieu: 'am', job, model, input: dauVao(prompt, giay), thuMuc: `nhac/${tapId}` });
  }
  return { ok: true, data: tenPc.length };
}

/** Ước giá trước khi bấm (hiện trên nút). */
export async function uocAm(tapId: number): Promise<{ giong: number; soThoai: number; sfx: number; soSfx: number; nhac: Record<string, number>; giay: number; soPhanCanh: number; dangNhac: number; dangPhanDoan: string[]; dangCaTap: boolean }> {
  const db = getDb();
  const bc = db ? await boiCanhTap(db, tapId) : null;
  const ds = await dsCanh(tapId);
  const dm = await dsMoHinhGiong();
  let giong = 0, soThoai = 0, sfx = 0, soSfx = 0;
  for (const c of ds) {
    const dsT = bc ? dongThoai(c, bc.nhanVat) : c.thoai;
    if (dsT.length) {
      for (const d of dsT) { const v = bc?.nhanVat.find((x) => x.ten.toLowerCase() === d.nhan_vat.trim().toLowerCase()); giong += giaGiong(dm.find((m) => m.key === (v?.giong_model || MODEL_GIONG_MAC_DINH())), d.loi.length) ?? 0; }
      soThoai++;
    }
    const clip = c.video_cuoi_url || c.video_url;
    if (clip || c.am_thanh.trim() || c.ky_thuat.am_thanh?.length) { sfx += giaAm(clip ? 'mirelo-ai/sfx-v1/video-to-audio' : 'sonilo/v1.1/text-to-sound-effects', c.thoi_luong_s || 5); soSfx++; }
  }
  const giay = Math.max(10, ds.reduce((a, c) => a + (c.thoi_luong_s || 5), 0));
  const nhac = Object.fromEntries(MO_HINH_AM.filter((m) => m.loai === 'nhac').map((m) => [m.key, giaAm(m.key, giay)]));
  // Nhạc đang sinh: theo phân cảnh nào / cả tập — timeline phủ sọc đúng khối đó (#1205).
  const dn = db ? ((await db.execute(sql`SELECT request->>'phan_doan' AS pd FROM xv_job WHERE loai = 'am' AND trang_thai = 'cho' AND request->>'dich' = 'nhac' AND request->>'tap_id' = ${String(tapId)} AND created_at > now() - interval '10 minutes'`)) as unknown as Row[]) : [];
  return { giong, soThoai, sfx, soSfx, nhac, giay, soPhanCanh: new Set(ds.map((c) => c.phan_doan).filter(Boolean)).size, dangNhac: dn.length,
    dangPhanDoan: dn.map((r) => s(r.pd)).filter(Boolean), dangCaTap: dn.some((r) => !r.pd) };
}

/** Đọc trang sản phẩm (link anh dán) → điền sẵn thông tin quảng cáo + ảnh sản phẩm thật (#1201). Claude chỉ đọc chữ của trang, ~$0.01. */
export async function layTuLinkSanPham(phimId: number, link: string): Promise<Kq<import('@/lib/xuong-video/kieu').ThongTinQc>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!/^https?:\/\//.test(link.trim())) return loi('link phải bắt đầu bằng http(s)://');
  let html = '';
  try {
    const r = await fetch(link.trim(), { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36', accept: 'text/html' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return loi(`trang trả ${r.status}`);
    html = await r.text();
  } catch (e) { return loi(`không mở được trang: ${e instanceof Error ? e.message : String(e)}`); }
  const meta = (k: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']+)`, 'i'))?.[1] ?? '';
  const tuyet = (u: string) => { try { return new URL(u.replace(/&amp;/g, '&'), link).toString(); } catch { return ''; } };
  // Ảnh: og:image + ảnh trong JSON-LD Product + mọi <img> lớn trên trang (bỏ icon/logo/svg).
  const anh = new Set<string>();
  const og = meta('og:image'); if (og) anh.add(tuyet(og));
  for (const m of html.matchAll(/"image"\s*:\s*(\[[^\]]*\]|"[^"]+")/g)) { for (const u of m[1]!.matchAll(/"(https?:[^"]+)"/g)) anh.add(tuyet(u[1]!)); }
  for (const m of html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi)) { const u = tuyet(m[1]!); if (u && !/\.svg|logo|icon|sprite|badge|payment|flag/i.test(u)) anh.add(u); }
  const chu = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;|&#\d+;/g, ' ').replace(/\s+/g, ' ');
  const r0 = (await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  const kt = docKinhThanh(r0[0]?.kinh_thanh as KinhThanh);
  const kq = await docTrangSanPham(link.trim(), { tieuDe: meta('og:title') || (html.match(/<title>([^<]*)/i)?.[1] ?? ''), moTa: meta('og:description') || meta('description'), chu, anh: [...anh].filter(Boolean) }, kt);
  await ghiChu(phimId, 'AI đọc trang sản phẩm', kq);
  if (!kq.ok) return loi(kq.loi);
  // Ảnh trên trang → kéo về R2 (link shop có thể chặn/đổi; model ảnh cần URL ổn định).
  const anhR2: string[] = [];
  for (const u of kq.data.anh.slice(0, 6)) {
    try {
      const f = await fetch(u, { signal: AbortSignal.timeout(15000) });
      const mime = f.headers.get('content-type')?.split(';')[0] || '';
      if (!f.ok || !mime.startsWith('image/')) continue;
      const url = await uploadToR2(`xuong-video/ref/${randomUUID()}.${duoi(mime)}`, Buffer.from(await f.arrayBuffer()), mime);
      if (url) anhR2.push(url);
    } catch { /* bỏ ảnh lỗi */ }
  }
  return { ok: true, data: { ten: kq.data.ten, link: link.trim(), diem_noi_bat: kq.data.diem_noi_bat, doi_tuong: kq.data.doi_tuong, uu_dai: kq.data.uu_dai, thi_truong: kq.data.thi_truong, anh: anhR2 } };
}

