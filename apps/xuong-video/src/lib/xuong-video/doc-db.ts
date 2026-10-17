// Đọc DB của studio: ánh xạ dòng → kiểu, bối cảnh một cảnh / một tập, ghi job. Không kiểm quyền — actions.ts kiểm rồi mới gọi;
// script trên box (dung-phim-mau, sinh-anh-phim) dùng thẳng. Trước nằm trong actions.ts ('use server') nên script không import được.
import 'server-only';
import { sql } from 'drizzle-orm';
import { chotTien, LOAI_JOB_TON_TIEN } from './chot-tien';
import type { getDb } from '@mos2/db';
import { docKinhThanh, giaAnhCents, MO_HINH_ANH, giaChuCents, giaVideoCents, type BienThe, type Canh, type Job, type KinhThanh, type LoaiNhanVat, type LoaiPhim, type May3d, type NhanVat, type PhanCanh, type Tap, type TrangThaiCanh } from './kieu';
import { modelFal } from './fal';
import { boSetCuaShot, laDoVatPhim, mayDayDu, PT_THAY } from './bo-set-3d';
import type { NguCanhPhim } from './claude';

export type Db = NonNullable<ReturnType<typeof getDb>>;
export type Row = Record<string, unknown>;
export const n = (v: unknown) => Number(v ?? 0);
export const s = (v: unknown) => (v == null ? '' : String(v));
export const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
/** Mảng int cho ANY(…::int[]) — nhét mảng JS thô vào làm postgres-js đoán sai kiểu (thu-ghi-job.mts). */
export const mangInt = (xs: number[]) => `{${xs.map((x) => Math.trunc(Number(x))).filter(Number.isFinite).join(',')}}`;

export const mapBienThe = (r: Row): BienThe => ({ id: n(r.id), nhan_vat_id: n(r.nhan_vat_id), nhom: s(r.nhom), ten: s(r.ten), mo_ta: s(r.mo_ta), anh_url: r.anh_url == null ? null : s(r.anh_url),
  ...(Array.isArray(r.dan_3d) && r.dan_3d.length ? { dan_3d: r.dan_3d } : {}),   // dấu 3D của biến thể (bo-set-3d.ts › BienTheDan)
  ...(Array.isArray(r.dung_cho) && r.dung_cho.length ? { dung_cho: r.dung_cho } : {}) });   // hoàn cảnh dùng (bang-trang-phuc.ts)

export const mapNhanVat = (r: Row): NhanVat => ({ id: n(r.id), phim_id: n(r.phim_id), loai: s(r.loai) as LoaiNhanVat, ten: s(r.ten), mo_ta: s(r.mo_ta), tieu_su: s(r.tieu_su), am_hieu: arr<{ ten: string; mo_ta: string; url: string }>(r.am_hieu), anh_ref: arr<string>(r.anh_ref), anh_mat: (r.anh_mat && typeof r.anh_mat === 'object' ? r.anh_mat : null) as NhanVat['anh_mat'], giong: s(r.giong), giong_model: s(r.giong_model), giong_id: s(r.giong_id), giong_mau_url: r.giong_mau_url == null ? null : s(r.giong_mau_url), giong_thu: Array.isArray(r.giong_thu) ? (r.giong_thu as NhanVat['giong_thu']) : [], doi_chieu: (r.doi_chieu && typeof r.doi_chieu === 'object' ? r.doi_chieu : null) as NhanVat['doi_chieu'],
  bo_set_id: r.bo_set_id == null ? null : n(r.bo_set_id), vung: (r.vung ?? null) as NhanVat['vung'], khoi_3d: (r.khoi_3d ?? null) as NhanVat['khoi_3d'] });

export const mapTap = (r: Row): Tap => ({ ho_so: (r.ho_so && typeof r.ho_so === 'object' ? r.ho_so : {}) as Tap['ho_so'], id: n(r.id), phim_id: n(r.phim_id), so: n(r.so), ten: s(r.ten), brief: s(r.brief), noi_khung: r.noi_khung === true, thoi_luong_s: r.thoi_luong_s == null ? null : n(r.thoi_luong_s), xuat: arr<Tap['xuat'][number]>(r.xuat), bai_dang: (r.bai_dang && typeof r.bai_dang === 'object' ? r.bai_dang : null) as Tap['bai_dang'], nhac_url: r.nhac_url == null ? null : s(r.nhac_url), nhac_mo_ta: s(r.nhac_mo_ta), nhac_phan_canh: (r.nhac_phan_canh && typeof r.nhac_phan_canh === 'object' ? r.nhac_phan_canh : {}) as Record<string, string>, beats: arr<Tap['beats'][number]>(r.beats), lop: arr<Tap['lop'][number]>(r.lop), thu_nguoi_xem: (r.thu_nguoi_xem && typeof r.thu_nguoi_xem === 'object' ? r.thu_nguoi_xem : null) as Tap['thu_nguoi_xem'], phan_canh: arr<Tap['phan_canh'][number]>(r.phan_canh), kich_ban: s(r.kich_ban), tom_tat: s(r.tom_tat), trang_thai: s(r.trang_thai), video_url: r.video_url == null ? null : s(r.video_url), so_canh: n(r.so_canh) });

export const mapCanh = (r: Row): Canh => ({
  id: n(r.id), tap_id: n(r.tap_id), thu_tu: n(r.thu_tu), canh: s(r.canh), goc_may: s(r.goc_may), hanh_dong: s(r.hanh_dong), hanh_dong_vi: s(r.hanh_dong_vi), loi_thoai: s(r.loi_thoai), am_thanh: s(r.am_thanh), thoai_url: r.thoai_url == null ? null : s(r.thoai_url), am_thanh_url: r.am_thanh_url == null ? null : s(r.am_thanh_url), phan_doan: s(r.phan_doan), cam_xuc: n(r.cam_xuc), thoai: arr<Canh['thoai'][number]>(r.thoai), trang_phuc: s(r.trang_phuc),
  ky_thuat: (r.ky_thuat && typeof r.ky_thuat === 'object' ? r.ky_thuat : {}) as Canh['ky_thuat'], dan_dung: (r.dan_dung && typeof r.dan_dung === 'object' ? r.dan_dung : {}) as Canh['dan_dung'], tham_khao: (Array.isArray(r.tham_khao) ? r.tham_khao : []) as Canh['tham_khao'], kiem_khung: (r.kiem_khung ?? null) as Canh['kiem_khung'], diem_prompt: (r.diem_prompt ?? null) as Canh['diem_prompt'], soi_mat: (r.soi_mat ?? null) as Canh['soi_mat'], soi_clip: (r.soi_clip ?? null) as Canh['soi_clip'], bieu_cam: (Array.isArray(r.bieu_cam) ? r.bieu_cam : []) as Canh['bieu_cam'], noi_lien: r.noi_lien === true, soat: (r.soat ?? null) as Canh['soat'], may_3d: (r.may_3d ?? null) as Canh['may_3d'], khung_xam: (r.khung_xam ?? null) as Canh['khung_xam'],
  phat_s: r.phat_s == null ? null : Number(r.phat_s), chu_man: s(r.chu_man), nhanh: s(r.nhanh), kieu_chu: (r.kieu_chu && typeof r.kieu_chu === 'object' ? r.kieu_chu : {}) as Canh['kieu_chu'], chu_man_dich: (r.chu_man_dich && typeof r.chu_man_dich === 'object' ? r.chu_man_dich : {}) as Canh['chu_man_dich'],
  thoi_luong_s: n(r.thoi_luong_s), nhan_vat: arr<number>(r.nhan_vat).map(Number), bien_the: arr<number>(r.bien_the).map(Number), dang_sinh_anh: r.dang_sinh_anh === true, keyframe_luc: r.keyframe_luc ? new Date(r.keyframe_luc as string).toISOString() : null, video_luc: r.video_luc ? new Date(r.video_luc as string).toISOString() : null, dang_sinh_giong: r.dang_sinh_giong === true, dang_sinh_sfx: r.dang_sinh_sfx === true, dang_sinh_am: r.dang_sinh_giong === true || r.dang_sinh_sfx === true, prompt_anh: s(r.prompt_anh), prompt_video: s(r.prompt_video),
  keyframe_url: r.keyframe_url == null ? null : s(r.keyframe_url), keyframe_uv: arr<string>(r.keyframe_uv), keyframe_ket: r.keyframe_ket == null ? null : s(r.keyframe_ket), video_url: r.video_url == null ? null : s(r.video_url), video_cuoi_url: r.video_cuoi_url == null ? null : s(r.video_cuoi_url), nguon_video: (r.nguon_video && typeof r.nguon_video === 'object' ? r.nguon_video : {}) as Record<string, unknown>, video_phien_ban: arr<Canh['video_phien_ban'][number]>(r.video_phien_ban),
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
  const nv: NhanVat[] = canh.nhan_vat.length
    ? await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE id = ANY(${mangInt(canh.nhan_vat)}::int[])`)) as unknown as Row[]).map(mapNhanVat))
    : [];
  // BỘ SET của shot (nếu có 3D): vật trong set khai anchor = nó là MỘT PHẦN của anchor đó (Card Window → Orange Card, Cable Plug → White Cable).
  const nvPhim = canh.may_3d ? ((await db.execute(sql`SELECT id, ten, loai, bo_set_id FROM xv_nhan_vat WHERE phim_id = ${Number(r[0].p_id)}`)) as unknown as Row[]).map((x) => ({ id: n(x.id), ten: s(x.ten), loai: s(x.loai) as LoaiNhanVat, bo_set_id: x.bo_set_id == null ? null : n(x.bo_set_id) })) : [];
  const sid = canh.may_3d ? boSetCuaShot(canh, nvPhim) : null;
  const vatSet = sid ? ((((await db.execute(sql`SELECT du_lieu->'vat' AS vat FROM xv_bo_set WHERE id = ${sid}`)) as unknown as Row[])[0]?.vat ?? []) as { ten: string; anchor?: string }[]) : [];
  const anchorCua: Record<string, string> = Object.fromEntries(vatSet.filter((v) => v.anchor && v.anchor !== v.ten).map((v) => [v.ten, v.anchor!]));
  // PHẦN TRĂM KHUNG 3D theo ANCHOR (cộng các phần của nó): 15/10/2026 shot #32 tập 19 — cửa sổ thẻ chiếm 34% khung, ví da cam (anchor) 0.7% vì
  // Tango đứng trên → ví không kèm ảnh mẫu, keyframe vẽ mặt xám bất kỳ.
  const ptAnchor = new Map<string, number>();
  for (const t of canh.khung_xam?.thay ?? []) { const a = anchorCua[t.ten] ?? t.ten; ptAnchor.set(a, (ptAnchor.get(a) ?? 0) + t.pt); }
  // ĐẠO CỤ THẤY TRONG KHUNG 3D mà shot không gắn anchor (đồ để lại từ shot trước — kẹo nằm trên thẻ ở 7.4a tập 19): kèm luôn để keyframe có
  // ảnh mẫu + mô tả của nó, không vẽ theo đoán. Chỉ đạo cụ / sản phẩm cùng phim, chiếm ≥ PT_THAY% khung (tính cả các phần của nó).
  const thayThem = [...ptAnchor].filter(([a, pt]) => pt >= PT_THAY && !nv.some((v) => v.ten === a)).map(([a]) => a);
  if (thayThem.length) nv.push(...await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(r[0].p_id)} AND loai IN ('dao_cu', 'san_pham') AND ten IN (${sql.join(thayThem.map((t) => sql`${t}`), sql`, `)})`)) as unknown as Row[]).map(mapNhanVat)));
  // Shot liền trước cùng nhánh — shot đó chọn chuyển cảnh 'lien_may' thì keyframe của nó là tham chiếu nối khung cho shot này (sinh-anh.ts).
  const t = (await db.execute(sql`SELECT keyframe_url, ky_thuat, thu_tu, phan_doan FROM xv_canh WHERE tap_id = ${canh.tap_id} AND thu_tu < ${canh.thu_tu}
    AND coalesce(nhanh, '') IN ('', ${canh.nhanh || 'A'}) ORDER BY thu_tu DESC LIMIT 1`)) as unknown as Row[];
  const truoc = t[0] ? { thu_tu: n(t[0].thu_tu), phan_doan: s(t[0].phan_doan), keyframe_url: t[0].keyframe_url == null ? null : s(t[0].keyframe_url), ky_thuat: (t[0].ky_thuat ?? null) as Canh['ky_thuat'] } : null;
  // Shot MỞ CẢNH (master) của cùng phân cảnh đã có keyframe — tham chiếu bố trí bối cảnh cho các shot sau trong cảnh: đồ vật đứng đâu so với nhau,
  // nhân vật ở phía nào (Tango & Lint tập 1: #9 → #10 Tango nhảy từ trước bàn phím ra sau bàn phím vì mỗi keyframe tự dựng lại bàn).
  const m = canh.phan_doan ? (await db.execute(sql`SELECT keyframe_url, thu_tu FROM xv_canh WHERE tap_id = ${canh.tap_id} AND phan_doan = ${canh.phan_doan} AND thu_tu < ${canh.thu_tu}
    AND keyframe_url IS NOT NULL AND coalesce(nhanh, '') IN ('', ${canh.nhanh || 'A'}) ORDER BY thu_tu LIMIT 1`)) as unknown as Row[] : [];
  const master = m[0] ? { thu_tu: n(m[0].thu_tu), keyframe_url: s(m[0].keyframe_url) } : null;
  // MÁY ĐẦY ĐỦ của shot (khai + đồ để lại từ các shot trước cùng bộ set — bo-set-3d.ts › mayDayDu): MỘT nguồn cho mọi đường dựng prompt keyframe
  // (mở, kết, sơ đồ nguồn) lẫn cổng chặn — trạng thái vật (đã chia mảnh) nằm ở đây kể cả khi món đó ngoài khung.
  let mayDu: May3d | null = canh.may_3d ?? null;
  if (sid) {
    const ds = ((await db.execute(sql`SELECT id, thu_tu, canh, nhan_vat, may_3d FROM xv_canh WHERE tap_id = ${canh.tap_id} AND may_3d IS NOT NULL AND coalesce(nhanh, '') IN ('', ${canh.nhanh || 'A'}) ORDER BY thu_tu, id`)) as unknown as Row[])
      .map((x) => ({ id: n(x.id), thu_tu: n(x.thu_tu), canh: s(x.canh), nhan_vat: (x.nhan_vat as number[]) ?? [], may_3d: x.may_3d as May3d })).filter((c) => boSetCuaShot(c, nvPhim) === sid);
    const pc = ((await db.execute(sql`SELECT phan_canh FROM xv_tap WHERE id = ${canh.tap_id}`)) as unknown as Row[])[0]?.phan_canh;
    mayDu = mayDayDu(ds, laDoVatPhim(nvPhim), (pc ?? []) as PhanCanh[]).get(canh.id) ?? mayDu;
  }
  return { canh, kt, nhanVat: nv, truoc, master, mayDu, anchorCua, ptAnchor: canh.khung_xam?.thay ? ptAnchor : null };
}

export async function taoJob(db: Db, d: { phim_id?: number; nhan?: string; canh_id?: number; nhan_vat_id?: number; bien_the_id?: number; loai: string; provider: string; model: string; request: unknown; xong?: boolean; /** giá ước (¢) — người gọi biết giá (video fal/Veo) thì đưa vào để cổng tiền so ngưỡng thay vì báo "không ước được" */ cents?: number }): Promise<number> {
  // phim_id tính trước bằng truy vấn riêng: nhét cùng một tham số số vào subquery của INSERT làm postgres-js đoán kiểu
  // text cho nó rồi ném ERR_INVALID_ARG_TYPE (sinh keyframe hỏng hẳn 08/10/2026).
  if (LOAI_JOB_TON_TIEN.has(d.loai)) chotTien(`job ${d.loai} · ${d.model}`, { cents: d.cents ?? (d.loai === 'anh' && MO_HINH_ANH.some((m) => m.key === d.model) ? giaAnhCents(d.model) : undefined) });   // script thiếu duyệt → dừng trước khi ghi job (chot-tien.ts)
  let phimId: number | null = d.phim_id ?? null;
  if (phimId == null && d.canh_id != null) {
    const q = (await db.execute(sql`SELECT t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${d.canh_id}`)) as unknown as Row[];
    phimId = q[0] ? n(q[0].phim_id) : null;
  }
  if (phimId == null && d.nhan_vat_id != null) {
    const q = (await db.execute(sql`SELECT phim_id FROM xv_nhan_vat WHERE id = ${d.nhan_vat_id}`)) as unknown as Row[];
    phimId = q[0] ? n(q[0].phim_id) : null;
  }
  // Phim MÁY DỰNG dựng bằng máy (may-dung.ts): không sinh keyframe / clip / giọng / chữ AI cho nó — một chỗ chặn cho mọi nút. Riêng ảnh nền của phim Máy Dựng được.
  if (phimId != null && LOAI_JOB_TON_TIEN.has(d.loai) && (d.request as { dich?: string } | null)?.dich !== 'may_dung_nen') {
    const p = (await db.execute(sql`SELECT loai FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
    if (p[0]?.loai === 'may_dung') throw new Error('phim Máy Dựng dựng bằng máy, không sinh AI — bấm ⬇ Xuất để dựng keyframe / clip / bản xuất (0đ)');
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
  phim_id: r.phim_id == null ? null : n(r.phim_id), nhan: s(r.nhan), tokens_in: n(r.tokens_in), tokens_out: n(r.tokens_out), phim_ten: s(r.phim_ten), nguon: (r.nguon ?? null) as Job['nguon'],
  id: n(r.id), canh_id: r.canh_id == null ? null : n(r.canh_id), nhan_vat_id: r.nhan_vat_id == null ? null : n(r.nhan_vat_id), loai: s(r.loai), provider: s(r.provider), model: s(r.model),
  trang_thai: s(r.trang_thai), task_id: r.task_id == null ? null : s(r.task_id), output_url: r.output_url == null ? null : s(r.output_url), chi_phi_cents: n(r.chi_phi_cents), loi: s(r.loi), created_at: s(r.created_at),
});

/** Giá video thật theo model (fal: danh mục động; Google: bảng kieu.ts). */
export async function giaVideoSv(model: string, dpg: '720p' | '1080p', giay: number, tieng = true): Promise<number> {
  if (model.startsWith('fal:')) {
    const m = await modelFal(model.slice(4));
    const g = (!tieng ? m?.gia.khongTieng?.[dpg] : null) ?? m?.gia.chinh[dpg]; if (g != null) return g * Math.max(giay, m?.gia.giayToiThieu ?? 0);   // tính tối thiểu (Pikaframes 5 s)
    const clip = m?.gia.clip[dpg]; if (clip) return clip[1];
  }
  return giaVideoCents(model, dpg, giay);
}

/** Job "đang chạy" = trang_thai 'cho' và chưa quá PHUT_JOB_CHO phút (quá thì coi như chết, cho bấm lại). MỘT luật cho mọi cờ "đang sinh"
 *  và mọi chặn bấm lại (ảnh, giọng, hiệu ứng, nhạc, poster, giọng-xong-gửi-video) — trước đây chuỗi interval gõ lại ở 10 chỗ. a = bí danh bảng. */
export const PHUT_JOB_CHO = 10;
export const jobDangCho = (a = '') => { const p = a ? `${a}.` : ''; return sql.raw(`${p}trang_thai = 'cho' AND ${p}created_at > now() - interval '${PHUT_JOB_CHO} minutes'`); };

/** Shot đang có việc âm thanh chạy (≤10 phút) theo đích ('thoai' | 'sfx') — MỘT luật chặn bấm lại khi đang sinh, khỏi trả tiền hai lần
 *  (13/10/2026: nút 🗣 Sinh giọng vẫn bấm được lúc "đang sinh"). Cùng điều kiện với cờ dang_sinh_giong / dang_sinh_sfx của dsCanh. */
export async function canhDangSinhAm(db: Db, canhIds: number[], dich: 'thoai' | 'sfx'): Promise<Set<number>> {
  if (!canhIds.length) return new Set();
  const r = (await db.execute(sql`SELECT DISTINCT canh_id FROM xv_job WHERE canh_id = ANY(${mangInt(canhIds)}::int[]) AND loai = 'am' AND request->>'dich' = ${dich}
    AND ${jobDangCho()}`)) as unknown as Row[];
  return new Set(r.map((x) => n(x.canh_id)));
}

/** Ghi sổ một lượt Claude (chữ) theo token thật × giá model — MỘT chỗ cho mọi lượt gọi Claude (gợi ý, dịch, kiểm/sửa theo người xem…). Trả cents. */
export async function ghiTienChu(db: Db, phimId: number | null, nhan: string, model: string, tk: { in: number; out: number }, provider = 'anthropic'): Promise<number> {
  const gia = giaChuCents(model, tk.in, tk.out);
  await db.execute(sql`INSERT INTO xv_job (phim_id, nhan, loai, provider, model, trang_thai, chi_phi_cents, tokens_in, tokens_out)
    VALUES (${phimId}, ${nhan}, 'chu', ${provider}, ${model}, 'xong', ${Math.round(gia * 100) / 100}, ${tk.in}, ${tk.out})`);
  return gia;
}

/** Ngữ cảnh cả phim cho Claude (tiền đề, kinh thánh, mọi anchor kèm biến thể + tiểu sử + âm hiệu, các tập) — MỘT chỗ cho gợi ý AI
 *  (actions.ts) và script (viết mùa phim). */
export async function nguCanhPhimDb(db: Db, phimId: number): Promise<NguCanhPhim | null> {
  const p = (await db.execute(sql`SELECT * FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  if (!p[0]) return null;
  const nv = (await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY loai, id`)) as unknown as Row[];
  const tap = (await db.execute(sql`SELECT so, ten, tom_tat, kich_ban FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so`)) as unknown as Row[];
  return {
    loai: s(p[0].loai) as LoaiPhim, ten: s(p[0].ten), mo_ta: s(p[0].mo_ta), kinhThanh: (p[0].kinh_thanh ?? {}) as KinhThanh, nhanVat: await kemBienThe(db, nv.map(mapNhanVat)),
    tap: tap.map((t) => ({ so: n(t.so), ten: s(t.ten), tom_tat: s(t.tom_tat), kich_ban: s(t.kich_ban) })),
  };
}
