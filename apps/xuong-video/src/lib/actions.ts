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
import { dayViecAnh, dayViecAm, chayNen } from '@/lib/xuong-video/hoan-tat';
import { chayXuat, ghiBanXuat, gopAm } from '@/lib/xuong-video/xuat-chay';
import { MO_HINH_AM, giaAm, moHinhAm, dongThoai, giaGiong, timNv, giayNhac } from '@/lib/xuong-video/am-thanh';
import { sinhNhacTap } from '@/lib/xuong-video/sinh-nhac';
import { dsMoHinhGiong, giongCua, dauVaoGiongTheoModel, type MoHinhGiong } from '@/lib/xuong-video/giong';
import { boVaoThungRac, boAnhVaoThungRac, dsRac, khoiPhucRac, type MucRac } from '@/lib/xuong-video/thung-rac';
import { batDauNangCap, danhMucFal, guiFal, type ModelFal } from '@/lib/xuong-video/fal';
import { type DungChu } from '@/lib/xuong-video/claude';
import { docTrangSanPham, doiChieuAnchor as doiChieuAnchorClaude } from '@/lib/xuong-video/claude';
import { tachCanh, vietKichBan, vietBaiDang, phanTichMau, promptBienThe, goiYBienThe, goiYKinhThanh, goiYAnchor, goiYBoAnchor, goiYBrief, goiYCanh, type NguCanhPhim } from '@/lib/xuong-video/claude';
import { MAU_PHIM } from '@/lib/xuong-video/mau';
import { lamSachKyThuat, promptKyThuatVideo } from '@/lib/xuong-video/dien-anh';
import { ghepThoai, thieuQc, coMau, giayMau, type BaiDang, type MauQc } from '@/lib/xuong-video/kieu';
import { luuCanhTach } from '@/lib/xuong-video/luu-canh';
import { chupTruoc, ganNhat, hoanTacGanNhat, type MucHoanTac } from '@/lib/xuong-video/hoan-tac';
import { docPhimDich, uocDichCents, chayDichPhim } from '@/lib/xuong-video/dich-phim';
import { NGON_NGU } from '@/lib/xuong-video/kieu';
import { type Row, n, s, arr, mangInt, mapBienThe, mapNhanVat, mapTap, mapCanh, kemBienThe, boiCanhTap, boiCanhCanh, taoJob } from '@/lib/xuong-video/doc-db';
import { sinhAnhGoc, sinhKeyframeCanh } from '@/lib/xuong-video/sinh-anh';
import { batDauVideoCanh, kiemVideoTap } from '@/lib/xuong-video/sinh-video';
import { sinhGiongShots, MODEL_GIONG_MAC_DINH, type TuyGiong } from '@/lib/xuong-video/sinh-giong';
import { xongJob as xongJobDb, mapJob } from '@/lib/xuong-video/doc-db';
export type { TuyGiong };
import { dsKhuon, taKhuon, ghiKhuonTuCanh, ghiKhuonTuMau, type KhuonShot } from '@/lib/xuong-video/khuon-shot';
import {
  docKinhThanh, giaAnhCents, giaVideoCents, giaChuCents, MO_HINH_ANH, MO_HINH_VIDEO, NANG_CAP, KHOP_MIENG, NHOM_BIEN_THE,
  type Phim, type NhanVat, type Tap, type Canh, type Job, type KinhThanh, type LoaiPhim, type LoaiNhanVat, 
} from '@/lib/xuong-video/kieu';

type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
/** Mảng số → literal mảng Postgres dạng chuỗi ('{1,2}'). Truyền mảng JS thẳng vào sql`` thì postgres-js gửi phần tử số thô
 *  và ném ERR_INVALID_ARG_TYPE ("Received type number (4)") — sinh keyframe hỏng 08/10/2026. */
/** Giá theo danh mục fal (động) nếu là model fal:, không thì bảng tĩnh. */

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
/** Email người đang sửa (ghi vào sổ hoàn tác) — gọi sau khi đã qua admin(). */
const ai = async () => (await admin())?.email ?? '';

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
        (SELECT coalesce(sum(j.chi_phi_cents), 0) FROM xv_job j WHERE j.phim_id = p.id AND j.tinh_chi) AS chi_phi_cents
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
export type ThongKePhim = { soCanh: number; giay: number; coKf: number; duyet: number; nhap: number; cuoi: number; anhGoc: number; bienThe: number; btCoAnh: number; soLanSinh: number; tienAnh: number; tienVideo: number; tienChu: number;
  /** Chi phí THỰC TẾ nếu không phải sinh lại: chỉ lượt sinh ra thứ đang nằm trong phim (keyframe/clip/giọng/hiệu ứng/nhạc/ảnh anchor đang dùng)
   *  + lượt Claude mới nhất của mỗi việc. Khác tongTien = tiền mất vì sinh lại / bỏ / lỗi. */
  tienDung: number };
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
    const [bt, ds, gd, tg, la, tkc, tdg, tkj] = await Promise.all([
      db.execute(sql`SELECT b.* FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id WHERE v.phim_id = ${id} ORDER BY b.nhom, b.id`),
      db.execute(sql`SELECT j.nhan_vat_id, j.bien_the_id FROM xv_job j JOIN xv_nhan_vat v ON v.id = j.nhan_vat_id
        WHERE v.phim_id = ${id} AND j.loai = 'anh' AND j.trang_thai = 'cho' AND j.created_at > now() - interval '10 minutes'`),
      db.execute(sql`SELECT * FROM xv_job WHERE phim_id = ${id} ORDER BY id DESC LIMIT 6`),
      db.execute(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS t FROM xv_job WHERE phim_id = ${id} AND tinh_chi`),
      // Lần sinh ảnh gần nhất của mỗi anchor/biến thể — lỗi thì hiện dưới thẻ (việc chạy nền nên lỗi không trả về nút nữa).
      db.execute(sql`SELECT DISTINCT ON (j.nhan_vat_id, coalesce(j.bien_the_id, 0)) j.nhan_vat_id, j.bien_the_id, j.trang_thai, j.loi
        FROM xv_job j JOIN xv_nhan_vat v ON v.id = j.nhan_vat_id WHERE v.phim_id = ${id} AND j.loai = 'anh'
        ORDER BY j.nhan_vat_id, coalesce(j.bien_the_id, 0), j.id DESC`),
      db.execute(sql`SELECT count(*) AS so, coalesce(sum(c.thoi_luong_s), 0) AS giay, count(c.keyframe_url) AS kf,
          count(*) FILTER (WHERE c.trang_thai = 'duyet') AS duyet, count(c.video_url) AS nhap, count(c.video_cuoi_url) AS cuoi
        FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${id}`),
      // Tiền của thứ ĐANG DÙNG: job có output_url nằm trong tập url đang gắn vào phim (không lọc tinh_chi — tài sản đang dùng sinh từ trước
      // lúc đặt lại sổ vẫn là tiền của phim) + lượt Claude mới nhất mỗi việc (nhãn bỏ phần ngoặc cuối).
      db.execute(sql`WITH c AS (SELECT c.* FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${id}),
          dung AS (
            SELECT keyframe_url AS u FROM c UNION SELECT video_url FROM c UNION SELECT video_cuoi_url FROM c UNION SELECT thoai_url FROM c UNION SELECT am_thanh_url FROM c
            UNION SELECT d->>'url' FROM c, jsonb_array_elements(CASE WHEN jsonb_typeof(c.thoai) = 'array' THEN c.thoai ELSE '[]'::jsonb END) d
            UNION SELECT nhac_url FROM xv_tap WHERE phim_id = ${id}
            UNION SELECT x.value FROM xv_tap t, jsonb_each_text(coalesce(t.nhac_phan_canh, '{}'::jsonb)) x WHERE t.phim_id = ${id}
            UNION SELECT jsonb_array_elements_text(anh_ref) FROM xv_nhan_vat WHERE phim_id = ${id}
            UNION SELECT b.anh_url FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id WHERE v.phim_id = ${id})
        SELECT coalesce((SELECT sum(j.chi_phi_cents) FROM xv_job j WHERE j.trang_thai = 'xong' AND j.output_url IN (SELECT u FROM dung WHERE u IS NOT NULL)
            AND (j.phim_id = ${id} OR j.canh_id IN (SELECT id FROM c) OR j.nhan_vat_id IN (SELECT id FROM xv_nhan_vat WHERE phim_id = ${id}))), 0)
          + coalesce((SELECT sum(x.chi_phi_cents) FROM (SELECT DISTINCT ON (regexp_replace(nhan, '[[:space:]]*[(].*[)][[:space:]]*$', '')) chi_phi_cents FROM xv_job
            WHERE phim_id = ${id} AND loai = 'chu' AND trang_thai = 'xong' ORDER BY regexp_replace(nhan, '[[:space:]]*[(].*[)][[:space:]]*$', ''), id DESC) x), 0) AS dung`),
      db.execute(sql`SELECT count(*) AS so, coalesce(sum(chi_phi_cents) FILTER (WHERE loai = 'anh'), 0) AS anh,
          coalesce(sum(chi_phi_cents) FILTER (WHERE loai IN ('video', 'nang_cap')), 0) AS video,
          coalesce(sum(chi_phi_cents) FILTER (WHERE loai NOT IN ('anh', 'video', 'nang_cap')), 0) AS chu
        FROM xv_job WHERE phim_id = ${id} AND trang_thai = 'xong' AND tinh_chi`),
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
      soLanSinh: n(j0.so), tienAnh: n(j0.anh), tienVideo: n(j0.video), tienChu: n(j0.chu), tienDung: n(((tdg as unknown as Row[])[0] ?? {}).dung),
    };
    return {
      thongKe, phim: mapPhim(p[0]), nhanVat: nvs, tap: (tap as unknown as Row[]).map(mapTap),
      ganDay: (gd as unknown as Row[]).map(mapJob), tongTien: n((tg as unknown as Row[])[0]?.t), loiAnh,
      dangSinh: { nhanVat: dsr.filter((r) => r.bien_the_id == null).map((r) => n(r.nhan_vat_id)), bienThe: dsr.filter((r) => r.bien_the_id != null).map((r) => n(r.bien_the_id)) },
    };
  } catch { return null; }
}

export async function dsCanh(tapId: number): Promise<Canh[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  try {
    const r = await db.execute(sql`SELECT c.*, EXISTS (SELECT 1 FROM xv_job j WHERE j.canh_id = c.id AND j.loai = 'anh' AND j.trang_thai = 'cho' AND j.created_at > now() - interval '10 minutes') AS dang_sinh_anh,
      -- Cờ riêng từng loại âm (#1217: sinh giọng mà khối hiệu ứng cũng báo đang sinh).
      EXISTS (SELECT 1 FROM xv_job j WHERE j.canh_id = c.id AND j.loai = 'am' AND j.request->>'dich' = 'thoai' AND j.trang_thai = 'cho' AND j.created_at > now() - interval '10 minutes') AS dang_sinh_giong,
      EXISTS (SELECT 1 FROM xv_job j WHERE j.canh_id = c.id AND j.loai = 'am' AND j.request->>'dich' = 'sfx' AND j.trang_thai = 'cho' AND j.created_at > now() - interval '10 minutes') AS dang_sinh_sfx FROM xv_canh c WHERE c.tap_id = ${tapId} ORDER BY c.thu_tu, c.id`);
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
  // Quảng cáo: ảnh mặc định đi fal (Seedream) khi có khoá — Google Nano Banana chặn đồ lót/đồ bơi (IMAGE_SAFETY, 4 lần hỏng 08/10/2026).
  const kt: KinhThanh = loai === 'quang_cao' ? { ti_le: '9:16', ...(process.env.FAL_KEY ? { mo_hinh_anh: 'fal:bytedance/seedream/v5/pro/edit' as KinhThanh['mo_hinh_anh'] } : {}) } : {};
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
  await chupTruoc(db, { bang: 'xv_phim', id, cot: Object.keys(d), moTa: `sửa phim: ${Object.keys(d).join(', ')}`, nguoi: await ai() });
  await db.execute(sql`UPDATE xv_phim SET
    ten = coalesce(${d.ten ?? null}, ten), loai = coalesce(${d.loai ?? null}, loai), mo_ta = coalesce(${d.mo_ta ?? null}, mo_ta),
    kinh_thanh = coalesce(${d.kinh_thanh ? JSON.stringify(d.kinh_thanh) : null}::jsonb
      -- giọng lời dẫn đã khoá (sinh-giong ghi) không bị form kinh thánh đang mở từ trước ghi đè thành rỗng
      || CASE WHEN coalesce(${d.kinh_thanh ? JSON.stringify(d.kinh_thanh) : null}::jsonb->'giong_dan', 'null'::jsonb) = 'null'::jsonb AND coalesce(kinh_thanh->'giong_dan', 'null'::jsonb) <> 'null'::jsonb
         THEN jsonb_build_object('giong_dan', kinh_thanh->'giong_dan') ELSE '{}'::jsonb END, kinh_thanh), trang_thai = coalesce(${d.trang_thai ?? null}, trang_thai),
    updated_at = now() WHERE id = ${id}`);
  // Quảng cáo: sản phẩm khai ở kinh thánh → anchor sản phẩm cùng tên (tạo nếu chưa có), ảnh thật lên ĐẦU anh_ref để mọi keyframe tham chiếu đúng hàng.
  const q = d.kinh_thanh?.qc;
  if (q?.mau?.shots?.length) {
    const nvK = (await db.execute(sql`SELECT ten, loai FROM xv_nhan_vat WHERE phim_id = ${id}`)) as unknown as Row[];
    await ghiKhuonTuMau(db, q.mau.shots, nvK.map((v) => ({ ten: s(v.ten), loai: s(v.loai) as NhanVat['loai'] })), q.ten ?? '', `QC mẫu${q.mau.nguon ? ` · ${q.mau.nguon.slice(0, 60)}` : ''}`, id);
  }
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
    // Mô tả hay ảnh gốc đổi → kết quả đối chiếu cũ hết giá trị, xoá để thẻ không hiện "khớp" sai.
    await db.execute(sql`UPDATE xv_nhan_vat SET doi_chieu = CASE WHEN mo_ta IS DISTINCT FROM ${d.mo_ta} OR anh_ref::text IS DISTINCT FROM ${anh} THEN NULL ELSE doi_chieu END,
      loai = ${d.loai}, ten = ${d.ten.trim()}, mo_ta = ${d.mo_ta}, anh_ref = ${anh}::jsonb, giong = ${d.giong}, updated_at = now() WHERE id = ${d.id}`);
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
/** Thư viện khuôn shot (máy tự ghi từ QC mẫu + cảnh đã tách) — cho drawer Thư viện và ô chọn ở mục 0. */
export async function dsKhuonShot(loai?: string): Promise<KhuonShot[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  return dsKhuon(db, { loai: loai || undefined });
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
  await chupTruoc(db, { bang: 'xv_nhan_vat', id: nhanVatId, cot: ['anh_ref'], moTa: 'đặt ảnh chính của anchor', nguoi: await ai() });
  await db.execute(sql`UPDATE xv_nhan_vat SET anh_ref = (${JSON.stringify([url])}::jsonb || (anh_ref - ${url})), updated_at = now()
    WHERE id = ${nhanVatId} AND anh_ref ? ${url}`);
  return { ok: true, data: undefined };
}

// ── Biến thể anchor (biểu cảm · trang phục · tư thế · góc máy · thời điểm…) ───────────────────────────────────────

export async function luuBienThe(d: { id?: number; nhan_vat_id: number; nhom: string; ten: string; mo_ta: string }): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (d.id) await chupTruoc(db, { bang: 'xv_bien_the', id: d.id, cot: ['nhom', 'ten', 'mo_ta'], moTa: `sửa biến thể ${d.ten.trim()}`, nguoi: await ai() });
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
  const job = await taoJob(db, { nhan: `Biến thể · ${a.ten} · ${b.ten}`, nhan_vat_id: b.nhan_vat_id, bien_the_id: bienTheId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { prompt } });
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

export async function suaTap(id: number, d: { ten?: string; brief?: string; kich_ban?: string; tom_tat?: string; so?: number; noi_khung?: boolean; nhac_mo_ta?: string; thoi_luong_s?: number }): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_tap', id, cot: Object.keys(d), moTa: `sửa tập: ${Object.keys(d).join(', ')}`, nguoi: await ai() });
  await db.execute(sql`UPDATE xv_tap SET ten = coalesce(${d.ten ?? null}, ten), brief = coalesce(${d.brief ?? null}, brief), kich_ban = coalesce(${d.kich_ban ?? null}, kich_ban),
    tom_tat = coalesce(${d.tom_tat ?? null}, tom_tat), so = coalesce(${d.so ?? null}, so), thoi_luong_s = coalesce(${d.thoi_luong_s ?? null}, thoi_luong_s), noi_khung = coalesce(${d.noi_khung ?? null}, noi_khung), nhac_mo_ta = coalesce(${d.nhac_mo_ta ?? null}, nhac_mo_ta), updated_at = now() WHERE id = ${id}`);
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


/** Claude viết kịch bản từ brief → lưu vào tập (người sửa tiếp trong ô kịch bản). */
export async function vietKichBanTap(tapId: number, brief: string, thoiLuongS: number): Promise<Kq<string>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const thieu = thieuQc(bc.loai, bc.kt);   // quảng cáo chưa khai sản phẩm → Claude bịa tính năng (phim bra 09/10/2026) — chặn ở máy chủ, không chỉ mờ nút
  if (thieu) return loi(thieu);
  if (!brief.trim()) return loi('thiếu brief');
  const kq = await vietKichBan({ loai: bc.loai, kinhThanh: bc.kt, nhanVat: bc.nhanVat, brief, tapSo: bc.loai === 'phim' ? bc.tap.so : undefined, tapTruoc: bc.tapTruoc, thoiLuongS });
  if (!kq.ok) return loi(kq.loi);
  await ghiChu(bc.tap.phim_id, `Viết kịch bản · tập ${bc.tap.so}`, kq);
  await db.execute(sql`UPDATE xv_tap SET brief = ${brief}, kich_ban = ${kq.kichBan}, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: kq.kichBan };
}

/** Tách kịch bản thành cảnh. Thay toàn bộ cảnh đang là NHÁP của tập; cảnh đã có keyframe/video giữ nguyên (không mất tiền đã tốn). */
export async function tachCanhTap(tapId: number, soCanh: number, thoiLuongS?: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const thieu = thieuQc(bc.loai, bc.kt);
  if (thieu) return loi(thieu);
  if (!bc.tap.kich_ban.trim()) return loi('tập chưa có kịch bản');
  // Có QC mẫu → thời lượng = tổng giây mẫu, số shot = số shot mẫu (tachCanh tự ép); không mẫu → theo ô nhập / tập.
  const kt = docKinhThanh(bc.kt);
  const mucTieu = coMau(kt.qc) ? giayMau(kt.qc.mau) : thoiLuongS && thoiLuongS > 0 ? Math.round(thoiLuongS) : bc.tap.thoi_luong_s ?? undefined;
  const kq = await tachCanh({ loai: bc.loai, kinhThanh: bc.kt, nhanVat: bc.nhanVat, kichBan: bc.tap.kich_ban, soCanh, tapTruoc: bc.tapTruoc, thoiLuongS: mucTieu, khuon: bc.loai === 'quang_cao' ? taKhuon(await dsKhuon(db, { toiDa: 60 })) : undefined });
  if (!kq.ok) return loi(kq.loi);
  const so = await luuCanhTach(db, { tapId, tenTap: bc.tap.ten, kq, nhanVat: bc.nhanVat, nguoi: (await admin())!.email, thoiLuongS: mucTieu });
  // Shot vừa tách có hình tả được → vào thư viện khuôn (gỡ tên anchor), không cần ai bấm.
  if (bc.loai === 'quang_cao') await ghiKhuonTuCanh(db, kq.canh, bc.nhanVat, kt.qc?.ten ?? '', `phim #${bc.tap.phim_id} tập ${bc.tap.so}`, bc.tap.phim_id);
  await ghiChu(bc.tap.phim_id, `Tách cảnh · tập ${bc.tap.so} (${so} cảnh${coMau(kt.qc) ? ', bám QC mẫu' : ''})`, kq);
  return { ok: true, data: so };
}

// ── QC mẫu (anh 09/10/2026): bài đăng kèm theo mẫu + phân tích video mẫu thành xương sống shot ─────────────────
/** Claude viết văn bản chính · tiêu đề · mô tả · nút cho bài đăng của tập (bám bài mẫu nếu có) → lưu xv_tap.bai_dang. */
export async function vietBaiDangTap(tapId: number): Promise<Kq<BaiDang>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const thieu = thieuQc(bc.loai, bc.kt);
  if (thieu) return loi(thieu);
  const canh = (await db.execute(sql`SELECT chu_man FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[];
  const kq = await vietBaiDang({ kinhThanh: bc.kt, kichBan: bc.tap.kich_ban || bc.tap.brief, chuMan: canh.map((c) => s(c.chu_man)) });
  if (!kq.ok) return loi(kq.loi);
  await ghiChu(bc.tap.phim_id, `Bài đăng kèm · tập ${bc.tap.so}`, kq);
  const bd: BaiDang = { ...kq.data, luc: new Date().toISOString() };
  await db.execute(sql`UPDATE xv_tap SET bai_dang = ${JSON.stringify(bd)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: bd };
}
/** Ước tiền dịch CẢ PHIM (0đ): số chuỗi tiếng Việt còn lại (anchor, kinh thánh, tập, shot, thoại) × giá model chữ của phim. */
export async function uocDichPhim(phimId: number): Promise<Kq<{ cents: number; chars: number; soChuoi: number; soLo: number; soCoGiong: number; ngonNgu: string }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const nd = await docPhimDich(db, phimId);
  if (!nd) return loi('không thấy phim');
  const kt = docKinhThanh(nd.kt);
  return { ok: true, data: { cents: uocDichCents(kt.mo_hinh_chu, nd.chars, nd.soLo), chars: nd.chars, soChuoi: nd.chuoi.length, soLo: nd.soLo, soCoGiong: nd.soCoGiong, ngonNgu: kt.ngon_ngu } };
}
/** Dịch CẢ PHIM sang ngôn ngữ khác (Claude, TỐN TIỀN): mọi chữ tiếng Việt của phim; giữ keyframe/video; đổi ngon_ngu; hoàn tác được. */
export async function dichPhimSang(phimId: number, sang: string): Promise<Kq<{ soBanGhi: number; boGiong: number; cents: number; conViet: number }>> {
  const db = getDb();
  if (!db) return loi('no db');
  const ad = await admin();
  if (!ad) return loi('không có quyền');
  if (!NGON_NGU.some((x) => x.value === sang)) return loi(`ngôn ngữ lạ: ${sang}`);
  return chayDichPhim(db, phimId, sang, ad.email);
}
/** Thao tác mới nhất có thể hoàn tác của phim (nút ↶ trên đầu drawer phim, #1252). */
export async function docHoanTac(phimId: number): Promise<Kq<MucHoanTac | null>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return { ok: true, data: await ganNhat(db, phimId) };
}
/** ↶ Hoàn tác thao tác mới nhất (cả nhóm) — ghi lại giá trị cũ đã chụp trước khi sửa. */
export async function hoanTac(phimId: number): Promise<Kq<string>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const m = await hoanTacGanNhat(db, phimId);
  return m == null ? loi('không còn gì để hoàn tác') : { ok: true, data: m };
}
/** Sửa tay bài đăng (sau khi Claude viết). */
export async function suaBaiDang(tapId: number, d: Omit<BaiDang, 'luc'>): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['bai_dang'], moTa: 'sửa bài đăng', nguoi: await ai() });
  const bd: BaiDang = { chu_bai: d.chu_bai, tieu_de: d.tieu_de, mo_ta: d.mo_ta, cta: d.cta, luc: new Date().toISOString() };
  await db.execute(sql`UPDATE xv_tap SET bai_dang = ${JSON.stringify(bd)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: undefined };
}
/** Tải video mẫu (qc.mau.video_url) về máy chủ, lấy khung hình mỗi ~2s (tối đa 40 khung), Claude nhìn → shots + ghi chú vào qc.mau. */
export async function phanTichVideoMau(phimId: number): Promise<Kq<MauQc>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy phim');
  const kt = docKinhThanh(r[0].kinh_thanh as KinhThanh);
  const mau: MauQc = { nguon: '', video_url: '', chu_bai: '', tieu_de: '', cta: '', ghi_chu: '', shots: [], ...(kt.qc?.mau ?? {}) };
  if (!/^https?:\/\//.test(mau.video_url.trim())) return loi('dán link video mẫu (mp4) vào ô Video mẫu trước');
  const { khungHinhVideo } = await import('@/lib/xuong-video/xuat-chay');
  const kh = await khungHinhVideo(mau.video_url.trim(), 40);
  if (!kh.ok) return loi(kh.loi);
  const kq = await phanTichMau(kh.khung, kh.giay, kt);
  if (!kq.ok) return loi(kq.loi);
  await ghiChu(phimId, 'Phân tích video mẫu', kq);
  const moi: MauQc = { ...mau, shots: kq.data.shots, ghi_chu: mau.ghi_chu.trim() ? mau.ghi_chu : kq.data.ghi_chu };
  const nvK = (await db.execute(sql`SELECT ten, loai FROM xv_nhan_vat WHERE phim_id = ${phimId}`)) as unknown as Row[];
  await ghiKhuonTuMau(db, moi.shots, nvK.map((v) => ({ ten: s(v.ten), loai: s(v.loai) as NhanVat['loai'] })), kt.qc?.ten ?? '', `QC mẫu${moi.nguon ? ` · ${moi.nguon.slice(0, 60)}` : ''}`, phimId);
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{qc}', coalesce(kinh_thanh->'qc', '{}'::jsonb)), '{qc,mau}', ${JSON.stringify(moi)}::jsonb), updated_at = now() WHERE id = ${phimId}`);
  return { ok: true, data: moi };
}

// ── Bản xuất (review 09/10/2026): MP4 hoàn chỉnh của tập theo nhánh hook — thứ gửi Meta/TikTok ──────────────────
/** Dựng bản xuất ở nền (ffmpeg trên máy chủ). Trả job id; UI hỏi trangThaiXuat tới khi xong rồi tải lại tập. Không tốn tiền model. */
export async function xuatTap(tapId: number, nhanh?: string | null): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const canh = await dsCanh(tapId);
  if (!canh.length) return loi('tập chưa có cảnh');
  const dang = (await db.execute(sql`SELECT 1 FROM xv_job WHERE loai = 'xuat' AND trang_thai = 'cho' AND request->>'tap_id' = ${String(tapId)} AND created_at > now() - interval '20 minutes' LIMIT 1`)) as unknown as Row[];
  if (dang.length) return loi('đang có một bản xuất của tập này chạy dở — chờ xong rồi xuất lại');
  const kt = docKinhThanh(bc.kt);
  const job = await taoJob(db, { phim_id: bc.tap.phim_id, nhan: `Xuất bản · tập ${bc.tap.so}${nhanh ? ` · hook ${nhanh}` : ''}`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: nhanh ?? '' } });
  chayNen(async () => {
    const kq = await chayXuat({ loai: bc.loai, tiLe: kt.ti_le, canh, nhanVat: bc.nhanVat, tap: bc.tap, qc: kt.qc, nhanh });
    if (!kq.ok) { await xongJob(job, { loi: kq.loi }); return; }
    await ghiBanXuat(db, { tapId, job, nhanh: nhanh ?? '', kq });
  });
  return { ok: true, data: job };
}
/** Trạng thái một job xuất: đang chạy / xong (url) / lỗi. */
export async function trangThaiXuat(jobId: number): Promise<{ trang_thai: string; url: string | null; loi: string }> {
  const db = getDb();
  if (!db || !(await admin())) return { trang_thai: 'loi', url: null, loi: 'không có quyền' };
  const r = (await db.execute(sql`SELECT trang_thai, output_url, loi FROM xv_job WHERE id = ${jobId}`)) as unknown as Row[];
  return r[0] ? { trang_thai: s(r[0].trang_thai), url: r[0].output_url == null ? null : s(r[0].output_url), loi: s(r[0].loi) } : { trang_thai: 'loi', url: null, loi: 'không thấy job' };
}

// ── Cảnh ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Sắp lại thứ tự cảnh của một tập theo danh sách id (kéo thả trên timeline). Một câu UPDATE, cảnh ngoài tập không bị đụng. */
export async function xepCanh(tapId: number, ids: number[]): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  { const nhom = await chupTruoc(db, { bang: 'xv_canh', id: ids[0] ?? 0, cot: ['thu_tu'], moTa: `xếp lại thứ tự ${ids.length} shot`, nguoi: await ai() }); for (const id of ids.slice(1)) await chupTruoc(db, { bang: 'xv_canh', id, cot: ['thu_tu'], moTa: 'xếp lại thứ tự', nguoi: '', nhom }); }
  await db.execute(sql`UPDATE xv_canh c SET thu_tu = x.i, updated_at = now()
    FROM unnest(${mangInt(ids)}::int[]) WITH ORDINALITY AS x(id, i) WHERE c.id = x.id AND c.tap_id = ${tapId}`);
  return { ok: true, data: undefined };
}

export async function suaCanh(id: number, d: Partial<Pick<Canh, 'canh' | 'goc_may' | 'hanh_dong' | 'loi_thoai' | 'am_thanh' | 'thoi_luong_s' | 'nhan_vat' | 'bien_the' | 'prompt_anh' | 'prompt_video' | 'thu_tu' | 'phan_doan' | 'cam_xuc' | 'ky_thuat' | 'thoai' | 'trang_phuc' | 'phat_s' | 'chu_man' | 'nhanh' | 'kieu_chu'>>): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id, cot: [...Object.keys(d), ...(d.thoai ? ['loi_thoai', 'thoai_url'] : [])], moTa: `sửa shot: ${Object.keys(d).join(', ')}`, nguoi: await ai() });
  // Thoại theo dòng: lưu dòng + ghép lại loi_thoai; dòng nào đổi lời thì bỏ file giọng cũ của dòng đó (đọc sai lời).
  if (d.thoai) {
    const cu = ((await db.execute(sql`SELECT thoai FROM xv_canh WHERE id = ${id}`)) as unknown as Row[])[0];
    const cuDs = arr<Canh['thoai'][number]>(cu?.thoai);
    const moi = d.thoai.filter((x) => x.loi.trim() || x.nhan_vat.trim()).map((x) => { const c0 = cuDs.find((y) => y.loi === x.loi && y.nhan_vat === x.nhan_vat); return { nhan_vat: x.nhan_vat, dien_xuat: x.dien_xuat, loi: x.loi, url: c0?.url ?? null, ...(typeof x.tre === 'number' ? { tre: x.tre } : {}) }; });
    d = { ...d, loi_thoai: ghepThoai(moi) };
    await db.execute(sql`UPDATE xv_canh SET thoai = ${JSON.stringify(moi)}::jsonb, thoai_url = ${moi[0]?.url ?? null} WHERE id = ${id}`);
  }
  await db.execute(sql`UPDATE xv_canh SET
    canh = coalesce(${d.canh ?? null}, canh), goc_may = coalesce(${d.goc_may ?? null}, goc_may), hanh_dong = coalesce(${d.hanh_dong ?? null}, hanh_dong),
    loi_thoai = coalesce(${d.loi_thoai ?? null}, loi_thoai), am_thanh = coalesce(${d.am_thanh ?? null}, am_thanh), thoi_luong_s = coalesce(${d.thoi_luong_s ?? null}, thoi_luong_s),
    nhan_vat = coalesce(${d.nhan_vat ? JSON.stringify(d.nhan_vat) : null}::jsonb, nhan_vat), bien_the = coalesce(${d.bien_the ? JSON.stringify(d.bien_the) : null}::jsonb, bien_the), prompt_anh = coalesce(${d.prompt_anh ?? null}, prompt_anh),
    prompt_video = coalesce(${d.prompt_video ?? null}, prompt_video), thu_tu = coalesce(${d.thu_tu ?? null}, thu_tu),
    phan_doan = coalesce(${d.phan_doan ?? null}, phan_doan), cam_xuc = coalesce(${d.cam_xuc ?? null}, cam_xuc), trang_phuc = coalesce(${d.trang_phuc ?? null}, trang_phuc),
    phat_s = CASE WHEN ${d.phat_s === undefined} THEN phat_s ELSE ${d.phat_s ?? null} END, chu_man = coalesce(${d.chu_man ?? null}, chu_man), nhanh = coalesce(${d.nhanh ?? null}, nhanh), kieu_chu = coalesce(${d.kieu_chu ? JSON.stringify(d.kieu_chu) : null}::jsonb, kieu_chu),
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




/** Ảnh gốc cho anchor (lõi ở sinh-anh.ts — script dùng chung). */
export async function sinhAnhMau(nhanVatId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhAnhGoc(db, nhanVatId);
}
/** Keyframe cho một shot (lõi ở sinh-anh.ts — script dùng chung). */
export async function sinhKeyframe(canhId: number, so = 1, moHinh?: string): Promise<Kq<number[]>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhKeyframeCanh(db, canhId, so, moHinh);
}

export async function chonKeyframe(canhId: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['keyframe_url', 'keyframe_uv', 'trang_thai'], moTa: 'chọn keyframe', nguoi: await ai() });
  await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${url}, keyframe_uv = CASE WHEN keyframe_uv @> ${JSON.stringify([url])}::jsonb THEN keyframe_uv ELSE keyframe_uv || ${JSON.stringify([url])}::jsonb END,
    trang_thai = CASE WHEN trang_thai IN ('nhap', 'loi') THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: undefined };
}

/** Duyệt keyframe (gate trước khi tốn tiền video). `duyet=false` trả về co_keyframe. */
/** Làm lại shot từ bước keyframe (#1218): bỏ chọn video nháp/bản cuối đang dùng, shot về "có keyframe". Mọi bản video vẫn nằm trong
 *  video_phien_ban — chọn lại được, không mất gì. */
export async function lamLaiTuKeyframe(canhId: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['video_url', 'video_cuoi_url', 'trang_thai', 'loi'], moTa: 'làm lại từ keyframe', nguoi: await ai() });
  await db.execute(sql`UPDATE xv_canh SET video_url = NULL, video_cuoi_url = NULL, trang_thai = CASE WHEN keyframe_url IS NULL THEN 'nhap' ELSE 'co_keyframe' END, loi = '', updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: undefined };
}

export async function duyetCanh(canhId: number, duyet: boolean): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['trang_thai', 'loi'], moTa: duyet ? 'duyệt keyframe' : 'bỏ duyệt keyframe', nguoi: await ai() });
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

/** Sinh video cho một shot (lõi ở sinh-video.ts — script dùng chung). */
export async function sinhVideoCanh(canhId: number, moHinh?: string, ban: 'nhap' | 'cuoi' = 'nhap'): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return batDauVideoCanh(db, canhId, moHinh, ban);
}
/** Nhận kết quả video của tập (lõi ở sinh-video.ts). */
export async function kiemVideo(tapId: number): Promise<{ conChay: number; vuaXong: number }> {
  const db = getDb();
  if (!db || !(await admin())) return { conChay: 0, vuaXong: 0 };
  return kiemVideoTap(db, tapId);
}
/** Sinh giọng đọc thoại cho các shot (lõi ở sinh-giong.ts — script dùng chung). */
export async function sinhGiong(tapId: number, canhIds?: number[], tuy: TuyGiong = {}): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhGiongShots(db, tapId, canhIds, tuy);
}

/** Chọn một phiên bản đã sinh làm nháp hoặc bản cuối đang dùng (không tốn tiền). */
export async function chonPhienBan(canhId: number, url: string, ban: 'nhap' | 'cuoi'): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['video_url', 'video_cuoi_url', 'trang_thai', 'loi'], moTa: ban === 'cuoi' ? 'chọn bản cuối' : 'chọn bản nháp', nguoi: await ai() });
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
  const job = await taoJob(db, { nhan: `Nâng cấp bản cuối · cảnh #${n(c[0].thu_tu)} ${s(c[0].canh)}`, canh_id: canhId, loai: 'video', provider: 'fal', model: NANG_CAP.model, request: { nangCap: true, ban: 'cuoi', giay, tu: s(c[0].video_url) } });
  const kq = await batDauNangCap(NANG_CAP.model, s(c[0].video_url), 2);
  if (!kq.ok) { await xongJob(job, { loi: kq.loi }); await db.execute(sql`UPDATE xv_canh SET loi = ${kq.loi} WHERE id = ${canhId}`); return loi(kq.loi); }
  await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${kq.taskId}, updated_at = now() WHERE id = ${job}`);
  await db.execute(sql`UPDATE xv_canh SET trang_thai = 'dang_sinh', loi = '', updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: job };
}

/** Khớp miệng clip nháp với file giọng đã sinh của shot (fal sync-lipsync): nhiều dòng thoại thì nối giọng thành một file trước.
 *  Kết quả thành bản nháp mới (bản cũ còn trong phiên bản). Giá ${KHOP_MIENG.giaGiayCents}¢/giây clip. */
export async function khopMiengCanh(canhId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return loi('không thấy cảnh');
  const video = bc.canh.video_cuoi_url || bc.canh.video_url;
  if (!video) return loi('cảnh chưa có video để khớp miệng');
  const giong = dongThoai(bc.canh, bc.nhanVat).map((d) => d.url).filter((u): u is string => !!u);
  if (!giong.length) return loi('shot chưa có file giọng — sinh giọng trước (🗣)');
  let audio = giong[0]!;
  if (giong.length > 1) {
    const buf = await gopAm(giong);
    const url = buf ? await uploadToR2(`xuong-video/am/thoai/${canhId}-gop-${randomUUID()}.mp3`, buf, 'audio/mpeg') : null;
    if (!url) return loi('không nối được các dòng giọng thành một file');
    audio = url;
  }
  const giay = bc.canh.thoi_luong_s || 8;
  const job = await taoJob(db, { nhan: `Khớp miệng · cảnh #${bc.canh.thu_tu} ${bc.canh.canh}`, canh_id: canhId, loai: 'video', provider: 'fal', model: KHOP_MIENG.model, request: { khopMieng: true, ban: 'nhap', giay, tu: video, audio } });
  const kq = await guiFal(KHOP_MIENG.model, { video_url: video, audio_url: audio, sync_mode: 'cut_off' });
  if (!kq.ok) { await xongJob(job, { loi: kq.loi }); await db.execute(sql`UPDATE xv_canh SET loi = ${kq.loi} WHERE id = ${canhId}`); return loi(kq.loi); }
  await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${kq.taskId}, updated_at = now() WHERE id = ${job}`);
  await db.execute(sql`UPDATE xv_canh SET trang_thai = 'dang_sinh', loi = '', updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: job };
}

/** Poll mọi job video đang chạy của tập: xong → tải về R2, ghi tiền, cảnh = xong. Gọi từ UI mỗi 10s khi có cảnh dang_sinh. */

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
/** Claude nhìn ảnh gốc của anchor so với mô tả → lưu kết quả (khớp / lệch chỗ nào / mô tả đề xuất) để thẻ anchor hiện cảnh báo. */
export async function doiChieuAnchor(nhanVatId: number): Promise<Kq<NonNullable<NhanVat['doi_chieu']>>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy anchor');
  const nv = mapNhanVat(r[0]);
  const kq = await doiChieuAnchorClaude(nv, docKinhThanh(r[0].kt as KinhThanh));
  await ghiChu(nv.phim_id, `Đối chiếu ảnh ↔ mô tả · ${nv.ten}`, kq);
  if (!kq.ok) return loi(kq.loi);
  const dc = { ...kq.data, luc: new Date().toISOString() };
  await db.execute(sql`UPDATE xv_nhan_vat SET doi_chieu = ${JSON.stringify(dc)}::jsonb, updated_at = now() WHERE id = ${nhanVatId}`);
  return { ok: true, data: dc };
}

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
  const thieu = thieuQc(nc.loai, nc.kinhThanh);
  if (thieu) return loi(thieu);
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

const xongJob = (id: number, d: Parameters<typeof xongJobDb>[2]) => xongJobDb(getDb()!, id, d);
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
  await chupTruoc(db, { bang: 'xv_nhan_vat', id: nhanVatId, cot: ['giong_model', 'giong_id', 'giong_mau_url'], moTa: 'đổi giọng cố định của nhân vật', nguoi: await ai() });
  if (!model) return loi('chọn model giọng');
  const ds = await giongCua(model);
  if (ds.length && !ds.some((g) => g.id === voice)) return loi('giọng không có trong danh sách của model');
  await db.execute(sql`UPDATE xv_nhan_vat SET giong_model = ${model}, giong_id = ${voice}, giong_mau_url = NULL, updated_at = now() WHERE id = ${nhanVatId}`);
  return { ok: true, data: undefined };
}


/** Sinh giọng đọc lời thoại cho các shot (một shot hoặc mọi shot có thoại của tập). */
/** tuy: chọn từ bảng ＋ trên timeline (#1202) — model/giọng cho lượt này (không đổi giọng cố định của nhân vật), cảm xúc, chỉ dòng chưa có giọng. */

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
  const job = await taoJob(db, { nhan: `Nghe thử giọng · ${v.ten} (${v.giong_id})${g == null ? ' · giá chưa rõ' : ''}`, nhan_vat_id: v.id, loai: 'am', provider: v.giong_model.startsWith('elevenlabs:') ? 'elevenlabs' : 'fal', model: v.giong_model.startsWith('elevenlabs:') ? v.giong_model : `fal:${v.giong_model}`, request: { dich: 'giong_mau', gia, text } });
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
    const job = await taoJob(db, { nhan: `Âm thanh · shot #${c.thu_tu} ${clip ? '(từ clip)' : '(từ mô tả)'}`, canh_id: c.id, loai: 'am', provider: 'fal', model: `fal:${model}`, request: { dich: 'sfx', gia, moTa } });
    await dayViecAm({ kieu: 'am', job, model, input, thuMuc: `sfx/${c.id}` });
    so++;
  }
  return so ? { ok: true, data: so } : loi('không shot nào có clip hoặc mô tả âm thanh');
}

/** Sinh nhạc nền (lõi ở sinh-nhac.ts). */
export async function sinhNhac(tapId: number, model = 'cassetteai/music-generator', phanDoan?: string, moTaThem = ''): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhNhacTap(db, tapId, model, phanDoan, moTaThem);
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
      for (const d of dsT) { const v = timNv(bc?.nhanVat ?? [], d.nhan_vat); giong += giaGiong(dm.find((m) => m.key === (v?.giong_model || MODEL_GIONG_MAC_DINH())), d.loi.length) ?? 0; }
      soThoai++;
    }
    const clip = c.video_cuoi_url || c.video_url;
    if (clip || c.am_thanh.trim() || c.ky_thuat.am_thanh?.length) { sfx += giaAm(clip ? 'mirelo-ai/sfx-v1/video-to-audio' : 'sonilo/v1.1/text-to-sound-effects', c.thoi_luong_s || 5); soSfx++; }
  }
  const giay = giayNhac(ds);
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

