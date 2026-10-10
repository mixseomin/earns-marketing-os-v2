// Đọc DB của studio: ánh xạ dòng → kiểu, bối cảnh một cảnh / một tập, ghi job. Không kiểm quyền — actions.ts kiểm rồi mới gọi;
// script trên box (dung-phim-mau, sinh-anh-phim) dùng thẳng. Trước nằm trong actions.ts ('use server') nên script không import được.
import 'server-only';
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { docKinhThanh, giaVideoCents, type BienThe, type Canh, type Job, type KinhThanh, type LoaiNhanVat, type LoaiPhim, type NhanVat, type Tap, type TrangThaiCanh } from './kieu';
import { danhMucFal } from './fal';

export type Db = NonNullable<ReturnType<typeof getDb>>;
export type Row = Record<string, unknown>;
export const n = (v: unknown) => Number(v ?? 0);
export const s = (v: unknown) => (v == null ? '' : String(v));
export const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
/** Mảng int cho ANY(…::int[]) — nhét mảng JS thô vào làm postgres-js đoán sai kiểu (thu-ghi-job.mts). */
export const mangInt = (xs: number[]) => `{${xs.map((x) => Math.trunc(Number(x))).filter(Number.isFinite).join(',')}}`;

export const mapBienThe = (r: Row): BienThe => ({ id: n(r.id), nhan_vat_id: n(r.nhan_vat_id), nhom: s(r.nhom), ten: s(r.ten), mo_ta: s(r.mo_ta), anh_url: r.anh_url == null ? null : s(r.anh_url) });

export const mapNhanVat = (r: Row): NhanVat => ({ id: n(r.id), phim_id: n(r.phim_id), loai: s(r.loai) as LoaiNhanVat, ten: s(r.ten), mo_ta: s(r.mo_ta), anh_ref: arr<string>(r.anh_ref), giong: s(r.giong), giong_model: s(r.giong_model), giong_id: s(r.giong_id), giong_mau_url: r.giong_mau_url == null ? null : s(r.giong_mau_url), doi_chieu: (r.doi_chieu && typeof r.doi_chieu === 'object' ? r.doi_chieu : null) as NhanVat['doi_chieu'] });

export const mapTap = (r: Row): Tap => ({ id: n(r.id), phim_id: n(r.phim_id), so: n(r.so), ten: s(r.ten), brief: s(r.brief), noi_khung: r.noi_khung === true, thoi_luong_s: r.thoi_luong_s == null ? null : n(r.thoi_luong_s), xuat: arr<Tap['xuat'][number]>(r.xuat), bai_dang: (r.bai_dang && typeof r.bai_dang === 'object' ? r.bai_dang : null) as Tap['bai_dang'], nhac_url: r.nhac_url == null ? null : s(r.nhac_url), nhac_mo_ta: s(r.nhac_mo_ta), nhac_phan_canh: (r.nhac_phan_canh && typeof r.nhac_phan_canh === 'object' ? r.nhac_phan_canh : {}) as Record<string, string>, beats: arr<Tap['beats'][number]>(r.beats), phan_canh: arr<Tap['phan_canh'][number]>(r.phan_canh), kich_ban: s(r.kich_ban), tom_tat: s(r.tom_tat), trang_thai: s(r.trang_thai), video_url: r.video_url == null ? null : s(r.video_url), so_canh: n(r.so_canh) });

export const mapCanh = (r: Row): Canh => ({
  id: n(r.id), tap_id: n(r.tap_id), thu_tu: n(r.thu_tu), canh: s(r.canh), goc_may: s(r.goc_may), hanh_dong: s(r.hanh_dong), loi_thoai: s(r.loi_thoai), am_thanh: s(r.am_thanh), thoai_url: r.thoai_url == null ? null : s(r.thoai_url), am_thanh_url: r.am_thanh_url == null ? null : s(r.am_thanh_url), phan_doan: s(r.phan_doan), cam_xuc: n(r.cam_xuc), thoai: arr<Canh['thoai'][number]>(r.thoai), trang_phuc: s(r.trang_phuc),
  ky_thuat: (r.ky_thuat && typeof r.ky_thuat === 'object' ? r.ky_thuat : {}) as Canh['ky_thuat'],
  phat_s: r.phat_s == null ? null : Number(r.phat_s), chu_man: s(r.chu_man), nhanh: s(r.nhanh), kieu_chu: (r.kieu_chu && typeof r.kieu_chu === 'object' ? r.kieu_chu : {}) as Canh['kieu_chu'],
  thoi_luong_s: n(r.thoi_luong_s), nhan_vat: arr<number>(r.nhan_vat).map(Number), bien_the: arr<number>(r.bien_the).map(Number), dang_sinh_anh: r.dang_sinh_anh === true, dang_sinh_giong: r.dang_sinh_giong === true, dang_sinh_sfx: r.dang_sinh_sfx === true, dang_sinh_am: r.dang_sinh_giong === true || r.dang_sinh_sfx === true, prompt_anh: s(r.prompt_anh), prompt_video: s(r.prompt_video),
  keyframe_url: r.keyframe_url == null ? null : s(r.keyframe_url), keyframe_uv: arr<string>(r.keyframe_uv), video_url: r.video_url == null ? null : s(r.video_url), video_cuoi_url: r.video_cuoi_url == null ? null : s(r.video_cuoi_url), nguon_video: (r.nguon_video && typeof r.nguon_video === 'object' ? r.nguon_video : {}) as Record<string, unknown>, video_phien_ban: arr<Canh['video_phien_ban'][number]>(r.video_phien_ban),
  trang_thai: s(r.trang_thai) as TrangThaiCanh, loi: s(r.loi), chi_phi_cents: n(r.chi_phi_cents),
});

export async function kemBienThe(db: Db, nvs: NhanVat[]): Promise<NhanVat[]> {
  if (!nvs.length) return nvs;
  const bt = ((await db.execute(sql`SELECT * FROM xv_bien_the WHERE nhan_vat_id = ANY(${mangInt(nvs.map((v) => v.id))}::int[]) ORDER BY nhom, id`)) as unknown as Row[]).map(mapBienThe);
  for (const v of nvs) v.bien_the = bt.filter((b) => b.nhan_vat_id === v.id);
  return nvs;
}

export async function boiCanhTap(db: Db, tapId: number) {
  const r = (await db.execute(sql`SELECT t.*, p.loai AS p_loai, p.kinh_thanh AS kt, p.id AS p_id FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[];
  if (!r[0]) return null;
  const tap = mapTap(r[0]);
  const nv = (await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${tap.phim_id} ORDER BY loai, id`)) as unknown as Row[];
  const nvKem = await kemBienThe(db, nv.map(mapNhanVat));
  const truoc = (await db.execute(sql`SELECT tom_tat FROM xv_tap WHERE phim_id = ${tap.phim_id} AND so < ${tap.so} AND tom_tat <> '' ORDER BY so`)) as unknown as Row[];
  return { tap, loai: s(r[0].p_loai) as LoaiPhim, kt: (r[0].kt ?? {}) as KinhThanh, nhanVat: nvKem, tapTruoc: truoc.map((x) => s(x.tom_tat)) };
}

export async function boiCanhCanh(db: Db, canhId: number) {
  const r = (await db.execute(sql`SELECT c.*, p.kinh_thanh AS kt, p.id AS p_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id JOIN xv_phim p ON p.id = t.phim_id WHERE c.id = ${canhId}`)) as unknown as Row[];
  if (!r[0]) return null;
  const canh = mapCanh(r[0]);
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const nv = canh.nhan_vat.length
    ? await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE id = ANY(${mangInt(canh.nhan_vat)}::int[])`)) as unknown as Row[]).map(mapNhanVat))
    : [];
  return { canh, kt, nhanVat: nv };
}

export async function taoJob(db: Db, d: { phim_id?: number; nhan?: string; canh_id?: number; nhan_vat_id?: number; bien_the_id?: number; loai: string; provider: string; model: string; request: unknown; xong?: boolean }): Promise<number> {
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

/** Khép một job: xong (kèm file/tiền) hoặc lỗi. Dùng chung actions + lib sinh video/giọng + script trên box. */
export async function xongJob(db: Db, id: number, d: { output_url?: string; model?: string; chi_phi_cents?: number; loi?: string }) {
  if (d.model?.startsWith('gpt-')) await db.execute(sql`UPDATE xv_job SET provider = 'openai' WHERE id = ${id}`);
  await db.execute(sql`UPDATE xv_job SET trang_thai = ${d.loi ? 'loi' : 'xong'}, output_url = coalesce(${d.output_url ?? null}, output_url), model = coalesce(${d.model ?? null}, model),
    chi_phi_cents = ${Math.round((d.chi_phi_cents ?? 0) * 1000) / 1000}, loi = ${d.loi ?? ''}, updated_at = now() WHERE id = ${id}`);
}
export const mapJob = (r: Row): Job => ({
  phim_id: r.phim_id == null ? null : n(r.phim_id), nhan: s(r.nhan), tokens_in: n(r.tokens_in), tokens_out: n(r.tokens_out), phim_ten: s(r.phim_ten),
  id: n(r.id), canh_id: r.canh_id == null ? null : n(r.canh_id), nhan_vat_id: r.nhan_vat_id == null ? null : n(r.nhan_vat_id), loai: s(r.loai), provider: s(r.provider), model: s(r.model),
  trang_thai: s(r.trang_thai), task_id: r.task_id == null ? null : s(r.task_id), output_url: r.output_url == null ? null : s(r.output_url), chi_phi_cents: n(r.chi_phi_cents), loi: s(r.loi), created_at: s(r.created_at),
});

/** Giá video thật theo model (fal: danh mục động; Google: bảng kieu.ts). */
export async function giaVideoSv(model: string, dpg: '720p' | '1080p', giay: number, tieng = true): Promise<number> {
  if (model.startsWith('fal:')) {
    const m = (await danhMucFal()).find((x) => x.id === model.slice(4));
    const g = (!tieng ? m?.gia.khongTieng?.[dpg] : null) ?? m?.gia.chinh[dpg]; if (g != null) return g * giay;
    const clip = m?.gia.clip[dpg]; if (clip) return clip[1];
  }
  return giaVideoCents(model, dpg, giay);
}
