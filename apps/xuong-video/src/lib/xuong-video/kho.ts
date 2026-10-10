// Kho tài sản dùng lại (10/10/2026, anh: "nhạc nền chất lượng cao đã sinh có thể lưu lại vào thư viện và dùng cho nhiều creative").
// Creative sau lấy clip/keyframe đạt, nhạc nền, preset giọng, khuôn QC từ kho thay vì sinh lại — tiết kiệm tiền và giữ đúng sản phẩm.
// MỘT cửa ghi/đọc/dùng cho nút trên studio (actions) và script trên box. Bỏ khỏi kho = xoa_luc (không xoá thật).
import 'server-only';
import { sql } from 'drizzle-orm';
import { chupTruoc } from './hoan-tac';
import { mapCanh, s, n, type Db, type Row } from './doc-db';
import { thuongHieu, type KinhThanh, type LoaiTaiSan, type TaiSan } from './kieu';

type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });

const mapTaiSan = (r: Row): TaiSan => ({
  id: n(r.id), loai: s(r.loai) as LoaiTaiSan, ten: s(r.ten), url: r.url == null ? null : s(r.url), thuong_hieu: s(r.thuong_hieu), san_pham: s(r.san_pham),
  the: (r.the as string[]) ?? [], mo_ta: s(r.mo_ta), so_do: (r.so_do ?? {}) as TaiSan['so_do'], du_lieu: (r.du_lieu ?? {}) as Record<string, unknown>,
  nguon: (r.nguon ?? {}) as TaiSan['nguon'], chi_phi_cents: n(r.chi_phi_cents), so_lan_dung: n(r.so_lan_dung), created_at: s(r.created_at),
});

/** Tiền đã bỏ ra để sinh tệp (job có output_url đúng tệp) — kho hiện "giá trị" của tài sản, so được với giá sinh lại. */
async function giaTep(db: Db, url: string | null): Promise<{ cents: number; job: number | null }> {
  if (!url) return { cents: 0, job: null };
  const r = (await db.execute(sql`SELECT id, chi_phi_cents FROM xv_job WHERE output_url = ${url} AND trang_thai = 'xong' ORDER BY id DESC LIMIT 1`)) as unknown as Row[];
  return r[0] ? { cents: n(r[0].chi_phi_cents), job: n(r[0].id) } : { cents: 0, job: null };
}

/** Ghi (hoặc cập nhật nhãn) một tài sản có tệp — trùng (loai, url) thì cập nhật, không tạo bản thứ hai; đã bỏ thì đưa lại vào kho. */
export async function luuVaoKho(db: Db, t: { loai: LoaiTaiSan; url: string; ten: string; thuong_hieu: string; san_pham?: string; the?: string[]; mo_ta?: string; so_do?: Record<string, unknown>; nguon?: Record<string, unknown> }): Promise<number> {
  const g = await giaTep(db, t.url);
  const r = (await db.execute(sql`INSERT INTO xv_tai_san (loai, ten, url, thuong_hieu, san_pham, the, mo_ta, so_do, nguon, chi_phi_cents)
    VALUES (${t.loai}, ${t.ten}, ${t.url}, ${t.thuong_hieu}, ${t.san_pham ?? ''}, ${`{${(t.the ?? []).map((x) => `"${x.replace(/["\\]/g, '')}"`).join(',')}}`}::text[], ${t.mo_ta ?? ''},
      ${JSON.stringify(t.so_do ?? {})}::jsonb, ${JSON.stringify({ ...(t.nguon ?? {}), ...(g.job ? { job_id: g.job } : {}) })}::jsonb, ${g.cents})
    ON CONFLICT (loai, url) WHERE url IS NOT NULL DO UPDATE SET ten = EXCLUDED.ten, san_pham = EXCLUDED.san_pham, the = EXCLUDED.the, mo_ta = EXCLUDED.mo_ta,
      so_do = xv_tai_san.so_do || EXCLUDED.so_do, xoa_luc = NULL, updated_at = now()
    RETURNING id`)) as unknown as Row[];
  return n(r[0]!.id);
}

/** Lưu shot ĐẠT vào kho: keyframe đang chọn (ảnh) + clip đang dùng (bản cuối, không thì nháp). Nhãn = sản phẩm/anchor trong shot,
 *  loại shot, góc máy; mô tả = cảnh + hành động — creative sau tìm theo sản phẩm + động tác. */
export async function luuShotVaoKho(db: Db, canhId: number): Promise<Kq<number>> {
  const r = (await db.execute(sql`SELECT c.*, t.phim_id, p.project, p.kinh_thanh, p.ten AS phim_ten, p.kinh_thanh->>'ti_le' AS ti_le FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id JOIN xv_phim p ON p.id = t.phim_id WHERE c.id = ${canhId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy shot');
  const c = mapCanh(r[0]);
  const nv = c.nhan_vat.length ? ((await db.execute(sql`SELECT ten, loai FROM xv_nhan_vat WHERE id = ANY(${`{${c.nhan_vat.join(',')}}`}::int[])`)) as unknown as Row[]) : [];
  const sp = nv.filter((x) => s(x.loai) === 'san_pham').map((x) => s(x.ten)).join(', ');
  const the = [...nv.filter((x) => s(x.loai) !== 'san_pham').map((x) => s(x.ten)), c.goc_may].filter(Boolean).slice(0, 6);
  const moTa = [c.canh, c.hanh_dong].filter(Boolean).join(' — ');
  const nguon = { phim_id: n(r[0].phim_id), tap_id: c.tap_id, canh_id: c.id };
  const chung = { thuong_hieu: thuongHieu(s(r[0].project), r[0].kinh_thanh as KinhThanh), san_pham: sp, the, mo_ta: moTa, nguon };
  const tenGoc = `${s(r[0].phim_ten)} · shot ${c.thu_tu}`;
  let so = 0;
  if (c.keyframe_url) { await luuVaoKho(db, { ...chung, loai: 'anh', url: c.keyframe_url, ten: `${tenGoc} · keyframe`, so_do: { ti_le: s(r[0].ti_le), prompt: c.prompt_anh } }); so++; }
  const clip = c.video_cuoi_url || c.video_url;
  if (clip) { await luuVaoKho(db, { ...chung, loai: 'clip', url: clip, ten: `${tenGoc} · clip`, so_do: { ti_le: s(r[0].ti_le), keyframe_url: c.keyframe_url, thoi_luong_s: c.thoi_luong_s, prompt: c.prompt_video, ban: c.video_cuoi_url ? 'cuoi' : 'nhap' } }); so++; }
  return so ? { ok: true, data: so } : loi('shot chưa có keyframe hay clip để lưu');
}

/** Danh sách kho (chưa bỏ), mới trước; lọc loại / thương hiệu / chữ (tên, sản phẩm, mô tả, nhãn). */
export async function dsKho(db: Db, o: { loai?: LoaiTaiSan[]; thuongHieu?: string; q?: string } = {}): Promise<TaiSan[]> {
  const q = (o.q ?? '').trim().toLowerCase();
  const r = (await db.execute(sql`SELECT * FROM xv_tai_san WHERE xoa_luc IS NULL
    ${o.loai?.length ? sql`AND loai = ANY(${`{${o.loai.join(',')}}`}::text[])` : sql``}
    ${o.thuongHieu ? sql`AND thuong_hieu = ${o.thuongHieu}` : sql``}
    ${q ? sql`AND lower(ten || ' ' || san_pham || ' ' || mo_ta || ' ' || array_to_string(the, ' ')) LIKE ${`%${q}%`}` : sql``}
    ORDER BY id DESC LIMIT 300`)) as unknown as Row[];
  return r.map(mapTaiSan);
}

/** Dùng tài sản cho một đích: clip/ảnh → shot (clip kèm keyframe gốc của nó để thẻ shot + video khớp), nhạc → tập. Chụp trước để ↶ Hoàn tác. */
export async function dungTaiSan(db: Db, id: number, dich: { canhId?: number; tapId?: number }, nguoi: string): Promise<Kq> {
  const r = (await db.execute(sql`SELECT * FROM xv_tai_san WHERE id = ${id} AND xoa_luc IS NULL`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy tài sản trong kho');
  const t = mapTaiSan(r[0]);
  if (!t.url) return loi('tài sản này không có tệp');
  if ((t.loai === 'clip' || t.loai === 'anh') && dich.canhId) {
    if (t.loai === 'clip') {
      await chupTruoc(db, { bang: 'xv_canh', id: dich.canhId, cot: ['video_url', 'video_cuoi_url', 'keyframe_url', 'trang_thai'], moTa: `lấy clip từ kho (#${id})`, nguoi });
      const kf = typeof t.so_do.keyframe_url === 'string' ? t.so_do.keyframe_url : null;
      await db.execute(sql`UPDATE xv_canh SET video_url = ${t.url}, video_cuoi_url = NULL, keyframe_url = coalesce(${kf}, keyframe_url), trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${dich.canhId}`);
    } else {
      await chupTruoc(db, { bang: 'xv_canh', id: dich.canhId, cot: ['keyframe_url', 'trang_thai'], moTa: `lấy keyframe từ kho (#${id})`, nguoi });
      await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${t.url}, trang_thai = CASE WHEN trang_thai IN ('nhap', 'co_keyframe') THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${dich.canhId}`);
    }
  } else if (t.loai === 'nhac' && dich.tapId) {
    await chupTruoc(db, { bang: 'xv_tap', id: dich.tapId, cot: ['nhac_url'], moTa: `lấy nhạc từ kho (#${id})`, nguoi });
    await db.execute(sql`UPDATE xv_tap SET nhac_url = ${t.url}, updated_at = now() WHERE id = ${dich.tapId}`);
  } else return loi(`không dùng được ${t.loai} cho đích này`);
  await db.execute(sql`UPDATE xv_tai_san SET so_lan_dung = so_lan_dung + 1, updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

/** Bỏ khỏi kho (không xoá thật, tệp vẫn nguyên). */
export async function boKhoiKho(db: Db, id: number): Promise<void> {
  await db.execute(sql`UPDATE xv_tai_san SET xoa_luc = now(), updated_at = now() WHERE id = ${id}`);
}

// ── Khuôn QC + kiểu chữ thương hiệu (đợt C) ─────────────────────────────────────────────────────────────────────

/** Cột của shot chép vào khuôn — phần CẤU TRÚC (giây, chữ màn nguyên văn, lời + độ trễ, máy, prompt), không chép tệp (hình/clip/giọng). */
type ShotKhuon = { thu_tu: number; canh: string; goc_may: string; hanh_dong: string; loi_thoai: string; am_thanh: string; thoi_luong_s: number; phat_s: number | null;
  prompt_anh: string; prompt_video: string; phan_doan: string; cam_xuc: number; ky_thuat: unknown; trang_phuc: string; chu_man: string; nhanh: string; kieu_chu: unknown;
  thoai: { nhan_vat: string; dien_xuat: string; loi: string; tre?: number }[]; nhan_vat_ten: string[] };

/** Lưu cả một tập làm KHUÔN QC: cấu trúc từng shot + kiểu chữ + QC mẫu + bài đăng — tạo tập mới từ khuôn là có ngay bộ khung đã thắng. */
export async function luuKhuonQc(db: Db, tapId: number, ten?: string): Promise<Kq<number>> {
  const t = (await db.execute(sql`SELECT t.*, p.project, p.kinh_thanh, p.ten AS phim_ten FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return loi('không thấy tập');
  const kt = (t[0].kinh_thanh ?? {}) as KinhThanh;
  const nv = (await db.execute(sql`SELECT id, ten FROM xv_nhan_vat WHERE phim_id = ${n(t[0].phim_id)}`)) as unknown as Row[];
  const tenNv = new Map(nv.map((x) => [n(x.id), s(x.ten)]));
  const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  if (!ds.length) return loi('tập chưa có shot');
  const shots: ShotKhuon[] = ds.map((c) => ({ thu_tu: c.thu_tu, canh: c.canh, goc_may: c.goc_may, hanh_dong: c.hanh_dong, loi_thoai: c.loi_thoai, am_thanh: c.am_thanh,
    thoi_luong_s: c.thoi_luong_s, phat_s: c.phat_s ?? null, prompt_anh: c.prompt_anh, prompt_video: c.prompt_video, phan_doan: c.phan_doan, cam_xuc: c.cam_xuc, ky_thuat: c.ky_thuat,
    trang_phuc: c.trang_phuc ?? '', chu_man: c.chu_man, nhanh: c.nhanh ?? '', kieu_chu: c.kieu_chu,
    thoai: c.thoai.map((d) => ({ nhan_vat: d.nhan_vat, dien_xuat: d.dien_xuat, loi: d.loi, ...(typeof d.tre === 'number' ? { tre: d.tre } : {}) })),
    nhan_vat_ten: c.nhan_vat.map((id) => tenNv.get(id) ?? '').filter(Boolean) }));
  const giay = ds.reduce((a, c) => a + (c.phat_s || c.thoi_luong_s || 0), 0);
  const tenK = ten?.trim() || `Khuôn · ${s(t[0].phim_ten)} · ${s(t[0].ten)}`;
  const duLieu = { shots, kieu_chu: kt.qc?.kieu_chu ?? null, vi_tri_chu: kt.qc?.vi_tri_chu ?? null, mau: kt.qc?.mau ?? null, bai_dang: t[0].bai_dang ?? null, brief: s(t[0].brief), giong_dan: kt.giong_dan ?? null };
  const r = (await db.execute(sql`INSERT INTO xv_tai_san (loai, ten, thuong_hieu, san_pham, mo_ta, so_do, du_lieu, nguon)
    VALUES ('khuon_qc', ${tenK}, ${thuongHieu(s(t[0].project), kt)}, ${kt.qc?.ten ?? ''}, ${`${ds.length} shot · ${Math.round(giay)}s`}, ${JSON.stringify({ so_shot: ds.length, dai: giay })}::jsonb,
      ${JSON.stringify(duLieu)}::jsonb, ${JSON.stringify({ phim_id: n(t[0].phim_id), tap_id: tapId })}::jsonb) RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]!.id) };
}

/** Tạo TẬP MỚI trong một phim từ khuôn QC: chép nguyên cấu trúc shot (chữ màn + lời nguyên văn, mốc giây, máy, prompt), anchor khớp theo TÊN
 *  trong phim đích (không khớp thì bỏ), chưa có hình/clip/giọng — sinh lại theo từng bước như thường. */
export async function taoTapTuKhuon(db: Db, khuonId: number, phimId: number, nguoi: string): Promise<Kq<number>> {
  const k = (await db.execute(sql`SELECT * FROM xv_tai_san WHERE id = ${khuonId} AND loai = 'khuon_qc' AND xoa_luc IS NULL`)) as unknown as Row[];
  if (!k[0]) return loi('không thấy khuôn QC');
  const du = (k[0].du_lieu ?? {}) as { shots?: ShotKhuon[]; brief?: string; bai_dang?: unknown };
  if (!du.shots?.length) return loi('khuôn rỗng');
  const nv = (await db.execute(sql`SELECT id, ten FROM xv_nhan_vat WHERE phim_id = ${phimId}`)) as unknown as Row[];
  const idTheoTen = new Map(nv.map((x) => [s(x.ten).trim().toLowerCase(), n(x.id)]));
  const so = n(((await db.execute(sql`SELECT coalesce(max(so), 0) + 1 AS so FROM xv_tap WHERE phim_id = ${phimId}`)) as unknown as Row[])[0]?.so);
  const giay = du.shots.reduce((a, x) => a + (x.phat_s || x.thoi_luong_s || 0), 0);
  const t = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, brief, thoi_luong_s, bai_dang) VALUES (${phimId}, ${so}, ${`Từ khuôn: ${s(k[0].ten)}`}, ${du.brief ?? ''}, ${Math.round(giay)}, ${du.bai_dang ? JSON.stringify(du.bai_dang) : null}::jsonb) RETURNING id`)) as unknown as Row[];
  const tapId = n(t[0]!.id);
  for (const x of du.shots) {
    const ids = x.nhan_vat_ten.map((tn) => idTheoTen.get(tn.trim().toLowerCase())).filter((v): v is number => v != null);
    await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, goc_may, hanh_dong, loi_thoai, am_thanh, thoi_luong_s, nhan_vat, prompt_anh, prompt_video, phan_doan, cam_xuc, ky_thuat, trang_phuc, chu_man, nhanh, kieu_chu, thoai, phat_s, trang_thai)
      VALUES (${tapId}, ${x.thu_tu}, ${x.canh}, ${x.goc_may}, ${x.hanh_dong}, ${x.loi_thoai}, ${x.am_thanh}, ${x.thoi_luong_s}, ${JSON.stringify(ids)}::jsonb, ${x.prompt_anh}, ${x.prompt_video},
        ${x.phan_doan}, ${x.cam_xuc}, ${JSON.stringify(x.ky_thuat ?? {})}::jsonb, ${x.trang_phuc}, ${x.chu_man}, ${x.nhanh || null}, ${JSON.stringify(x.kieu_chu ?? {})}::jsonb, ${JSON.stringify(x.thoai)}::jsonb, ${x.phat_s}, 'nhap')`);
  }
  await db.execute(sql`UPDATE xv_tai_san SET so_lan_dung = so_lan_dung + 1, updated_at = now() WHERE id = ${khuonId}`);
  console.log(`[kho] ${nguoi}: tập #${tapId} từ khuôn #${khuonId} (${du.shots.length} shot)`);
  return { ok: true, data: tapId };
}

/** Kiểu chữ màn của phim → preset của thương hiệu (một dòng mỗi thương hiệu, cập nhật tại chỗ). Gọi khi xuất bản: kiểu đang dùng thật. */
export async function luuKieuChuThuongHieu(db: Db, phimId: number): Promise<void> {
  const p = (await db.execute(sql`SELECT project, kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  const kt = (p[0]?.kinh_thanh ?? {}) as KinhThanh;
  const kc = kt.qc?.kieu_chu;
  if (!p[0] || !kc || !Object.keys(kc).length) return;
  const th = thuongHieu(s(p[0].project), kt);
  const du = JSON.stringify({ kieu_chu: kc, vi_tri_chu: kt.qc?.vi_tri_chu ?? null });
  const r = (await db.execute(sql`UPDATE xv_tai_san SET du_lieu = ${du}::jsonb, nguon = ${JSON.stringify({ phim_id: phimId })}::jsonb, xoa_luc = NULL, updated_at = now()
    WHERE loai = 'kieu_chu' AND thuong_hieu = ${th} RETURNING id`)) as unknown as Row[];
  if (!r.length) await db.execute(sql`INSERT INTO xv_tai_san (loai, ten, thuong_hieu, du_lieu, nguon) VALUES ('kieu_chu', ${`Kiểu chữ · ${th}`}, ${th}, ${du}::jsonb, ${JSON.stringify({ phim_id: phimId })}::jsonb)`);
}

/** Phim của thương hiệu có preset kiểu chữ mà chưa đặt kiểu chữ → điền từ preset (gọi sau khi lưu kinh thánh). */
export async function apKieuChuThuongHieu(db: Db, phimId: number): Promise<boolean> {
  const p = (await db.execute(sql`SELECT project, kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  const kt = (p[0]?.kinh_thanh ?? {}) as KinhThanh;
  if (!p[0] || !kt.qc || (kt.qc.kieu_chu && Object.keys(kt.qc.kieu_chu).length)) return false;
  const th = thuongHieu(s(p[0].project), kt);
  const r = (await db.execute(sql`SELECT du_lieu FROM xv_tai_san WHERE loai = 'kieu_chu' AND thuong_hieu = ${th} AND xoa_luc IS NULL ORDER BY updated_at DESC LIMIT 1`)) as unknown as Row[];
  const du = r[0]?.du_lieu as { kieu_chu?: object; vi_tri_chu?: string | null } | undefined;
  if (!du?.kieu_chu) return false;
  const qc = { ...kt.qc, kieu_chu: du.kieu_chu, ...(du.vi_tri_chu && !kt.qc.vi_tri_chu ? { vi_tri_chu: du.vi_tri_chu } : {}) };
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{qc}', ${JSON.stringify(qc)}::jsonb), updated_at = now() WHERE id = ${phimId}`);
  return true;
}
