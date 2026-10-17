'use server';
// Server action của KHO CREATIVE THEO CONCEPT (concept.ts, migration 0269) — tách khỏi actions.ts. Bốn tab ngăn sản phẩm:
// Concept (nhập sub-avatar spy) · Template (cặp concept × template + biến thể diễn viên / bối cảnh) · Phương án (chữ cho từng ô) · Creative (duyệt tổ hợp → tạo phim).
// Cùng luật quyền (admin) như actions.ts. Lượt tốn tiền duy nhất: vietPhuongAn (Claude, giá ghi trước trên nút); mọi thứ khác 0đ. Không xoá dòng — bỏ = an / 'bo'.
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { type Row, n, s, mangInt } from '@/lib/xuong-video/doc-db';
import { docOTemplate } from '@/lib/xuong-video/template-db';
import { giaTriMau } from '@/lib/xuong-video/template';
import { docGocSpy, type GocSpy } from '@/lib/xuong-video/goc-spy';
import { docSpy } from '@/lib/xuong-video/spy-api';
import { nguCanhXuat, xuatCreativeDb } from '@/lib/xuong-video/xuat-creative';
import { taoJob, xongJob } from '@/lib/xuong-video/doc-db';
import { chayNen } from '@/lib/xuong-video/hoan-tat';
import { phimSanPham, uocVietPhuongAnDb, vietPhuongAnDb, capThieuPhuongAn, vietHetDb, VIET_HET, giaTriSanPhamDb, gtCreativeDb, taoPhimGocDb } from '@/lib/xuong-video/concept-db';
import type { KetQuaChep } from '@/lib/xuong-video/template-db';
import { oChuTuKhung, oHinhCua, hopKhuon, gtBienThe, laDuyet, type Concept, type TplConcept, type Cap, type BienTheHinh, type PhuongAn, type CreativeDuyet, type GiaConcept, type SubAvatar } from '@/lib/xuong-video/concept';

type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });
async function admin() { const me = await getCurrentUser(); return me && me.role === 'admin' ? me : null; }
/** Đơn giá DỰ PHÒNG (cents) khi sổ xv_job 30 ngày chưa có lượt nào — số đo sổ 15/10/2026: ảnh Nano Banana 3,4¢ · clip Veo Lite ~16¢ · lượt Opus ~16¢. */
const GIA_DU_PHONG = { anh: 3.4, video: 16, chu: 16 };
/** Một shot = ~2 lần thử keyframe + ~1,3 lần thử video; một bộ kịch bản = kịch bản + tách cảnh + ~0,3 lượt kiểm người xem (đo trên sổ 14–15/10/2026). */
const LAN_THU = { anh: 2, video: 1.3, chu_kb: 2.3 };

type Db = NonNullable<ReturnType<typeof getDb>>;
/** Nhóm spy của sản phẩm: góc spy đã gắn ở creative của sản phẩm, hoặc concept đã nhập. */
async function spySp(db: Db, spKey: string): Promise<number | null> {
  for (const r of await phimSanPham(db, spKey)) { const g = docGocSpy(r.goc_spy)[0]; if (g) return g.sp; }
  const c = ((await db.execute(sql`SELECT spy_sp FROM xv_concept WHERE sp_key = ${spKey} ORDER BY id DESC LIMIT 1`)) as unknown as Row[])[0];
  return c ? n(c.spy_sp) : null;
}

export type KhoConcept = { spy_sp: number | null; /** giá trị ô SẢN PHẨM (creative cũ cùng sản phẩm) — điền phần xem trước */ gt_sp: Record<string, string>; concept: Concept[]; tpl: TplConcept[]; cap: Cap[]; bien_the: BienTheHinh[]; phuong_an: PhuongAn[]; creative: CreativeDuyet[]; gia: GiaConcept };
/** Đọc trọn kho concept của một sản phẩm + 14 template + đơn giá thật (sổ xv_job 30 ngày). */
export async function docKhoConcept(spKey: string): Promise<Kq<KhoConcept>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const [cRows, tRows, gRows] = await Promise.all([
    db.execute(sql`SELECT * FROM xv_concept WHERE sp_key = ${spKey} AND NOT an ORDER BY path, array_position(ARRAY['UA','PA','SA','PrA','MA'], nb), ma`),
    db.execute(sql`SELECT id, ten, kinh_thanh->'template'->>'dong' AS dong, kinh_thanh->'template'->>'khuon' AS khuon, kinh_thanh->'template'->'mau_qc' AS mau FROM xv_phim
      WHERE kinh_thanh->'template' ? 'dong' AND coalesce((kinh_thanh->>'luu_tru')::boolean, false) = false ORDER BY id`),
    // ĐƠN GIÁ THẬT: ảnh keyframe + video (Veo Lite) + một lượt Claude kịch bản — trung bình 30 ngày, thiếu số thì lùi về số đo 15/10/2026
    db.execute(sql`SELECT
        (SELECT avg(chi_phi_cents) FROM xv_job WHERE loai = 'anh' AND chi_phi_cents > 0 AND model ILIKE '%nano-banana%' AND created_at > now() - interval '30 days') AS anh,
        (SELECT avg(chi_phi_cents) FROM xv_job WHERE loai = 'video' AND chi_phi_cents > 0 AND model ILIKE '%veo%lite%' AND created_at > now() - interval '30 days') AS video,
        (SELECT avg(chi_phi_cents) FROM xv_job WHERE loai = 'chu' AND chi_phi_cents > 0 AND model ILIKE 'claude-opus%' AND created_at > now() - interval '30 days') AS chu`),
  ]);
  const concept: Concept[] = (cRows as unknown as Row[]).map((r) => ({ id: n(r.id), ma: s(r.ma), path: s(r.path), path_ten: s(r.path_ten), nb: s(r.nb), ten: s(r.ten), du_lieu: (r.du_lieu ?? {}) as SubAvatar }));
  const tIds = (tRows as unknown as Row[]).map((r) => n(r.id));
  const dem = tIds.length ? ((await db.execute(sql`SELECT t.phim_id, count(DISTINCT c.id) AS tong,
      count(DISTINCT c.id) FILTER (WHERE v.loai = 'nhan_vat') AS nguoi, count(DISTINCT c.id) FILTER (WHERE v.loai = 'boi_canh') AS boi,
      count(DISTINCT c.id) FILTER (WHERE v.loai IN ('nhan_vat', 'boi_canh')) AS ca
    FROM xv_tap t JOIN xv_canh c ON c.tap_id = t.id AND coalesce(c.nhanh, '') IN ('', 'A')
    LEFT JOIN LATERAL jsonb_array_elements_text(coalesce(c.nhan_vat, '[]'::jsonb)) e(x) ON true LEFT JOIN xv_nhan_vat v ON v.id = e.x::int
    WHERE t.phim_id = ANY(${mangInt(tIds)}::int[]) AND t.so = (SELECT min(so) FROM xv_tap t2 WHERE t2.phim_id = t.phim_id) GROUP BY t.phim_id`)) as unknown as Row[]) : [];
  // HÌNH của từng shot template (hành động) — xem trước phim gốc; tập đầu, nhánh A, theo thứ tự
  const hinh = tIds.length ? ((await db.execute(sql`SELECT t.phim_id, c.thu_tu, coalesce(nullif(c.hanh_dong, ''), c.canh, '') AS hinh FROM xv_tap t JOIN xv_canh c ON c.tap_id = t.id AND coalesce(c.nhanh, '') IN ('', 'A')
    WHERE t.phim_id = ANY(${mangInt(tIds)}::int[]) AND t.so = (SELECT min(so) FROM xv_tap t2 WHERE t2.phim_id = t.phim_id) ORDER BY t.phim_id, c.thu_tu, c.id`)) as unknown as Row[]) : [];
  const tpl: TplConcept[] = [];
  for (const r of tRows as unknown as Row[]) {
    const o = await docOTemplate(db, n(r.id)); if (!o) continue;
    const d = dem.find((x) => n(x.phim_id) === n(r.id));
    const oChu = oChuTuKhung(o.o.filter((x) => x.dung), o.khung);
    tpl.push({ id: n(r.id), ten: s(r.ten).replace(/^Template\s*·\s*/, ''), dong: s(r.dong), khuon: s(r.khuon), so_shot: o.khung.length, giay: Math.round(o.khung.reduce((a, k) => a + k.giay, 0)),
      shot_nguoi: n(d?.nguoi), shot_boi: n(d?.boi), shot_ca: n(d?.ca), o_chu: oChu, o_hinh: oHinhCua(o.o.filter((x) => x.dung), oChu),
      gt_mau: giaTriMau(o.o.filter((x) => x.dung)),
      shot: o.khung.map((k, i) => ({ loai: k.loai, giay: k.giay, chu: k.chu, hinh: s(hinh.filter((h) => n(h.phim_id) === n(r.id))[i]?.hinh).slice(0, 220) })),
      mau: (Array.isArray(r.mau) ? (r.mau as { video?: string | null; anh?: string | null; mo_ta?: string; link?: string }[]) : []).slice(0, 2).map((m) => ({ video: m.video ?? null, anh: m.anh ?? null, mo_ta: s(m.mo_ta).slice(0, 300), link: s(m.link) })) });
  }
  const cIds = concept.map((c) => c.id);
  const cap: Cap[] = cIds.length ? ((await db.execute(sql`SELECT * FROM xv_cap WHERE concept_id = ANY(${mangInt(cIds)}::int[]) ORDER BY id`)) as unknown as Row[])
    .map((r) => ({ id: n(r.id), concept_id: n(r.concept_id), template_id: n(r.template_id), bat: r.bat === true })) : [];
  const capIds = cap.map((c) => c.id);
  const [bt, pa, cr] = capIds.length ? await Promise.all([
    db.execute(sql`SELECT * FROM xv_bien_the_hinh WHERE cap_id = ANY(${mangInt(capIds)}::int[]) AND NOT an ORDER BY cap_id, so`),
    db.execute(sql`SELECT * FROM xv_phuong_an WHERE cap_id = ANY(${mangInt(capIds)}::int[]) AND NOT an ORDER BY cap_id, o, so`),
    db.execute(sql`SELECT * FROM xv_creative WHERE sp_key = ${spKey} ORDER BY so`),
  ]) : [[], [], []];
  const g = (gRows as unknown as Row[])[0] ?? {};
  const anh = Number(g.anh) || GIA_DU_PHONG.anh, video = Number(g.video) || GIA_DU_PHONG.video, chu = Number(g.chu) || GIA_DU_PHONG.chu;
  return { ok: true, data: {
    spy_sp: await spySp(db, spKey), gt_sp: await giaTriSanPhamDb(db, spKey), concept, tpl, cap,
    bien_the: (bt as unknown as Row[]).map((r) => ({ id: n(r.id), cap_id: n(r.cap_id), so: n(r.so), nguoi_chinh: s(r.nguoi_chinh), nguoi_phu: s(r.nguoi_phu), boi_canh: s(r.boi_canh), goc: r.goc === true, phim_id: r.phim_id == null ? null : n(r.phim_id) })),
    phuong_an: (pa as unknown as Row[]).map((r) => ({ id: n(r.id), cap_id: n(r.cap_id), o: s(r.o), so: n(r.so), chu: s(r.chu), nguon: s(r.nguon) })),
    creative: (cr as unknown as Row[]).map((r) => ({ id: n(r.id), so: n(r.so), cap_id: n(r.cap_id), bien_the_id: r.bien_the_id == null ? null : n(r.bien_the_id),
      chon: (r.chon ?? {}) as Record<string, number>, ma: s(r.ma), trang_thai: (s(r.trang_thai) || 'duyet') as CreativeDuyet['trang_thai'], phim_id: r.phim_id == null ? null : n(r.phim_id), xuat: (r.xuat ?? null) as CreativeDuyet['xuat'] })),
    gia: { shot_cents: Math.round((LAN_THU.anh * anh + LAN_THU.video * video) * 100) / 100, kb_cents: Math.round(LAN_THU.chu_kb * chu * 100) / 100, chu_cents: Math.round(chu * 100) / 100 },
  } };
}

/** Tạo cặp (bật sẵn) + biến thể V1 nếu chưa có. */
async function damBaoCap(db: Db, conceptId: number, templateId: number, bat: boolean, nguoi: string): Promise<number> {
  const r = (await db.execute(sql`INSERT INTO xv_cap (concept_id, template_id, bat) VALUES (${conceptId}, ${templateId}, ${bat})
    ON CONFLICT (concept_id, template_id) DO UPDATE SET bat = ${bat} RETURNING id`)) as unknown as Row[];
  const id = n(r[0]!.id);
  await db.execute(sql`INSERT INTO xv_bien_the_hinh (cap_id, so, nguoi_chinh, goc) VALUES (${id}, 1, ${nguoi}, true) ON CONFLICT (cap_id, so) DO NOTHING`);
  return id;
}

/** NHẬP CONCEPT từ sub-avatar spy (0đ — sub-avatar đã lập trên spy). Concept mới → bật sẵn các template hợp mức nhận biết; concept đã có → chỉ cập nhật dữ liệu,
 *  không bật lại template anh đã tắt. */
export async function nhapConcept(spKey: string): Promise<Kq<{ moi: number; cap_nhat: number }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const sp = await spySp(db, spKey);
  if (!sp) return loi('sản phẩm chưa gắn nhóm spy — gắn góc spy cho một creative của sản phẩm trước');
  const r = await docSpy<{ avatar: { path: { ma: string; ten: string }[]; avatar: SubAvatar[] } | null }>(`/api/goc/avatar?sp=${sp}`);
  if (!r.ok) return r;
  const a = r.data.avatar;
  if (!a?.avatar?.length) return loi(`nhóm spy #${sp} chưa lập sub-avatar — mở tab Sub-avatar trên spy, bấm Lập`);
  const tpl = (await db.execute(sql`SELECT id, kinh_thanh->'template'->>'khuon' AS khuon FROM xv_phim WHERE kinh_thanh->'template' ? 'dong' AND coalesce((kinh_thanh->>'luu_tru')::boolean, false) = false`)) as unknown as Row[];
  let moi = 0, cap_nhat = 0;
  for (const x of a.avatar) {
    const pathTen = a.path.find((p) => p.ma === x.path)?.ten ?? (x.path.includes('+') || x.path === 'chung' ? 'Chung mọi path' : '');
    const kq = (await db.execute(sql`INSERT INTO xv_concept (sp_key, spy_sp, ma, path, path_ten, nb, ten, du_lieu)
      VALUES (${spKey}, ${sp}, ${x.ma}, ${x.path}, ${pathTen}, ${x.nb}, ${x.ten}, ${JSON.stringify(x)}::jsonb)
      ON CONFLICT (sp_key, spy_sp, ma) DO UPDATE SET path = excluded.path, path_ten = excluded.path_ten, nb = excluded.nb, ten = excluded.ten, du_lieu = excluded.du_lieu, an = false, updated_at = now()
      RETURNING id, (xmax = 0) AS moi`)) as unknown as Row[];
    if (kq[0]!.moi === true) { moi++; for (const t of tpl) if (hopKhuon(s(t.khuon), x.nb)) await damBaoCap(db, n(kq[0]!.id), n(t.id), true, x.nguoi); }
    else cap_nhat++;
  }
  return { ok: true, data: { moi, cap_nhat } };
}

/** Bật / tắt một cặp concept × template (tắt = giữ dữ liệu, chỉ thôi tính creative). */
export async function batCap(conceptId: number, templateId: number, bat: boolean): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const c = ((await db.execute(sql`SELECT du_lieu FROM xv_concept WHERE id = ${conceptId}`)) as unknown as Row[])[0];
  if (!c) return loi('không thấy concept');
  return { ok: true, data: await damBaoCap(db, conceptId, templateId, bat, s(((c.du_lieu ?? {}) as SubAvatar).nguoi)) };
}
type VBt = { nguoi_chinh: string; nguoi_phu: string; boi_canh: string };
const sach = (v: Partial<VBt>) => ({ nguoi_chinh: String(v.nguoi_chinh ?? '').slice(0, 300), nguoi_phu: String(v.nguoi_phu ?? '').slice(0, 300), boi_canh: String(v.boi_canh ?? '').slice(0, 300) });
/** Thêm biến thể diễn viên / bối cảnh (V2, V3…) cho một cặp. */
export async function themBienThe(capId: number, v: VBt): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const x = sach(v);
  const r = (await db.execute(sql`INSERT INTO xv_bien_the_hinh (cap_id, so, nguoi_chinh, nguoi_phu, boi_canh)
    VALUES (${capId}, (SELECT coalesce(max(so), 0) + 1 FROM xv_bien_the_hinh WHERE cap_id = ${capId}), ${x.nguoi_chinh}, ${x.nguoi_phu}, ${x.boi_canh}) RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]!.id) };
}
export async function suaBienThe(id: number, v: VBt): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const x = sach(v);
  await db.execute(sql`UPDATE xv_bien_the_hinh SET nguoi_chinh = ${x.nguoi_chinh}, nguoi_phu = ${x.nguoi_phu}, boi_canh = ${x.boi_canh} WHERE id = ${id}`);
  return { ok: true, data: undefined };
}
/** Bỏ biến thể (ẩn, không xoá; V1 gốc không bỏ được). */
export async function boBienThe(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_bien_the_hinh SET an = true WHERE id = ${id} AND NOT goc`);
  return { ok: true, data: undefined };
}

// ── PHƯƠNG ÁN CHỮ ────────────────────────────────────────────────────────────────────────────────────────────────
export async function themPhuongAn(capId: number, o: string, chu: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!chu.trim()) return loi('chữ trống');
  const r = (await db.execute(sql`INSERT INTO xv_phuong_an (cap_id, o, so, chu, nguon)
    VALUES (${capId}, ${o}, (SELECT coalesce(max(so), 0) + 1 FROM xv_phuong_an WHERE cap_id = ${capId} AND o = ${o}), ${chu.trim().slice(0, 600)}, 'viết tay') RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]!.id) };
}
export async function suaPhuongAn(id: number, chu: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!chu.trim()) return loi('chữ trống');
  await db.execute(sql`UPDATE xv_phuong_an SET chu = ${chu.trim().slice(0, 600)} WHERE id = ${id}`);
  return { ok: true, data: undefined };
}
export async function boPhuongAn(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_phuong_an SET an = true WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

export async function uocVietPhuongAn(capId: number): Promise<Kq<{ cents: number; model: string; so_o: number }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return uocVietPhuongAnDb(db, capId);
}
/** AI viết phương án cho mọi ô của một cặp (TỐN TIỀN — một lượt Claude, anh bấm). Lõi: concept-db.ts › vietPhuongAnDb. */
export async function vietPhuongAn(capId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return vietPhuongAnDb(db, capId);
}

/** Cặp còn thiếu phương án + giá ước viết hết (cents) + lượt viết hết đang chạy (nếu có). */
export async function uocVietHet(spKey: string): Promise<Kq<{ caps: number[]; cents: number; dang: { tong: number; xong: number; loi: number; cents: number; chay: boolean } | null }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const caps = await capThieuPhuongAn(db, spKey);
  let cents = 0; for (const id of caps) { const u = await uocVietPhuongAnDb(db, id); if (u.ok) cents += u.data.cents; }
  return { ok: true, data: { caps, cents: Math.round(cents * 100) / 100, dang: VIET_HET.get(spKey) ?? null } };
}
/** AI viết phương án cho MỌI cặp còn thiếu (TỐN TIỀN — giá tổng ghi trên nút, anh bấm là duyệt đúng lượt đó). Chạy nền, lần lượt từng cặp. */
export async function vietHet(spKey: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (VIET_HET.get(spKey)?.chay) return loi('đang viết — đợi lượt trước xong');
  const caps = await capThieuPhuongAn(db, spKey);
  if (!caps.length) return loi('mọi cặp đã có phương án');
  void vietHetDb(db, spKey, caps);
  return { ok: true, data: caps.length };
}

// ── CREATIVE ĐÃ DUYỆT ────────────────────────────────────────────────────────────────────────────────────────────
/** Duyệt tổ hợp → lưu creative với SỐ CỐ ĐỊNH trong sản phẩm (#1, #2…). Tổ hợp đã duyệt thì giữ số cũ; đã bỏ thì duyệt lại. */
export async function duyetToHop(spKey: string, ds: { cap_id: number; bien_the_id: number; chon: Record<string, number>; ma: string }[]): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  let so = 0;
  for (const x of ds.slice(0, 3000)) {
    await db.execute(sql`INSERT INTO xv_creative (sp_key, so, cap_id, bien_the_id, chon, ma)
      VALUES (${spKey}, (SELECT coalesce(max(so), 0) + 1 FROM xv_creative WHERE sp_key = ${spKey}), ${x.cap_id}, ${x.bien_the_id}, ${JSON.stringify(x.chon)}::jsonb, ${x.ma.slice(0, 120)})
      ON CONFLICT (sp_key, ma) DO UPDATE SET trang_thai = CASE WHEN xv_creative.trang_thai IN ('bo', 'de_xuat') THEN 'duyet' ELSE xv_creative.trang_thai END`);
    so++;
  }
  return { ok: true, data: so };
}
/** CẤP SỐ CỐ ĐỊNH cho tổ hợp chưa có số (anh 17/10/2026: "creative không thấy ID rõ ràng") — mọi creative có #N ngay khi xuất hiện, trạng thái
 *  'de_xuat'; duyệt chỉ đổi trạng thái, giữ số. Một câu SQL cho cả lô, đánh số theo thứ tự gửi lên (thứ tự bộ hình trên màn). */
export async function capSo(spKey: string, ds: { cap_id: number; bien_the_id: number; chon: Record<string, number>; ma: string }[]): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!ds.length) return { ok: true, data: 0 };
  const r = (await db.execute(sql`INSERT INTO xv_creative (sp_key, so, cap_id, bien_the_id, chon, ma, trang_thai)
    SELECT ${spKey}, (SELECT coalesce(max(so), 0) FROM xv_creative WHERE sp_key = ${spKey}) + row_number() OVER (ORDER BY x.i), x.cap_id, x.bien_the_id, x.chon, x.ma, 'de_xuat'
    FROM jsonb_to_recordset(${JSON.stringify(ds.slice(0, 5000).map((x, i) => ({ ...x, ma: x.ma.slice(0, 120), i })))}::jsonb) AS x(i int, cap_id int, bien_the_id int, chon jsonb, ma text)
    WHERE NOT EXISTS (SELECT 1 FROM xv_creative c WHERE c.sp_key = ${spKey} AND c.ma = x.ma)
    ON CONFLICT DO NOTHING RETURNING id`)) as unknown as Row[];
  return { ok: true, data: r.length };
}
/** Bỏ duyệt → về 'de_xuat' (không xoá — số giữ nguyên). */
export async function boCreative(spKey: string, ma: string[]): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_creative SET trang_thai = 'de_xuat' WHERE sp_key = ${spKey} AND ma = ANY(${`{${ma.map((m) => `"${m.replace(/"/g, '')}"`).join(',')}}`}::text[]) AND trang_thai = 'duyet'`);
  return { ok: true, data: undefined };
}

/** Giá trị ô để tạo phim từ một creative đã duyệt: ô sản phẩm (creative cũ cùng sản phẩm) + đối tượng (concept) + diễn viên / bối cảnh + phương án đã chọn. */
export async function gtCreative(creativeId: number): Promise<Kq<{ template_id: number; template_ten: string; ten: string; gt: Record<string, string> }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const g = await gtCreativeDb(db, creativeId);
  return typeof g === 'string' ? loi(g) : { ok: true, data: g };
}
/** Tạo phim từ creative đã duyệt (0đ): chép template + điền ô như nút 🧩, gắn góc spy của concept, nối creative ↔ phim, ghi mã QC vào phim. */
export async function taoPhimTuCreative(creativeId: number, ten: string, gt: Record<string, string>): Promise<Kq<KetQuaChep>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!ten.trim()) return loi('thiếu tên phim');
  return taoPhimGocDb(db, creativeId, { ten, gt });
}

/** ⬇ XUẤT CREATIVE TỪ PHIM GỐC (dùng lại clip — xuat-creative.ts): chạy nền như lồng tiếng, trả job. Tiền: chỉ giọng của câu đổi (ElevenLabs,
 *  câu đã đọc thì dùng lại); hình / clip 0đ. Creative phải đã duyệt và bộ hình có phim gốc đủ clip. */
export async function xuatCreative(creativeId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const nc = await nguCanhXuat(db, creativeId);
  if (!nc.ok) return nc;
  if (!laDuyet(s(nc.data.cr.trang_thai))) return loi('creative chưa duyệt — duyệt trước rồi xuất');
  const job = await taoJob(db, { phim_id: nc.data.phimGoc, nhan: `Xuất creative #${n(nc.data.cr.so)} từ phim gốc`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { creative_id: creativeId } });
  chayNen(async () => {
    const r = await xuatCreativeDb(db, creativeId, job).catch((e: unknown) => ({ ok: false as const, loi: e instanceof Error ? e.message : String(e) }));
    if (!r.ok) await xongJob(db, job, { loi: r.loi });
  });
  return { ok: true, data: job };
}
