'use server';
// Server action của KHO CREATIVE THEO CONCEPT (concept.ts, migration 0269) — tách khỏi actions.ts. Bốn tab ngăn sản phẩm:
// Concept (nhập sub-avatar spy) · Template (cặp concept × template + biến thể diễn viên / bối cảnh) · Phương án (chữ cho từng ô) · Creative (duyệt tổ hợp → tạo phim).
// Cùng luật quyền (admin) như actions.ts. Lượt tốn tiền duy nhất: vietPhuongAn (Claude, giá ghi trước trên nút); mọi thứ khác 0đ. Không xoá dòng — bỏ = an / 'bo'.
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { type Row, n, s, mangInt, ghiTienChu } from '@/lib/xuong-video/doc-db';
import { docOTemplate } from '@/lib/xuong-video/template-db';
import { sanPhamPhim } from '@/lib/xuong-video/nhom-phim';
import { docGocSpy, type GocSpy } from '@/lib/xuong-video/goc-spy';
import { giaChuCents, type KinhThanh } from '@/lib/xuong-video/kieu';
import { vietPhuongAnCap } from '@/lib/xuong-video/claude';
import { giaTriSanPham, taoPhimTuTemplate } from '@/lib/actions';
import type { KetQuaChep } from '@/lib/xuong-video/template-db';
import { oChuTuKhung, oHinhCua, hopKhuon, gtBienThe, mucNb, PA_DU_KIEN, type Concept, type TplConcept, type Cap, type BienTheHinh, type PhuongAn, type CreativeDuyet, type GiaConcept, type SubAvatar } from '@/lib/xuong-video/concept';

type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });
async function admin() { const me = await getCurrentUser(); return me && me.role === 'admin' ? me : null; }
const SPY_API = process.env.SPY_API_URL || 'http://127.0.0.1:3850';
async function docSpy<T>(duong: string): Promise<Kq<T>> {
  try {
    const r = await fetch(`${SPY_API}${duong}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    return r.ok ? { ok: true, data: (await r.json()) as T } : loi(`spy trả ${r.status}`);
  } catch (e) { return loi(`không gọi được spy (${e instanceof Error ? e.message.slice(0, 60) : 'lỗi'})`); }
}

type Db = NonNullable<ReturnType<typeof getDb>>;
/** Phim QC của sản phẩm (không template, không lưu trữ) — mới sửa trước. */
async function phimSanPham(db: Db, spKey: string): Promise<Row[]> {
  return ((await db.execute(sql`SELECT id, kinh_thanh, goc_spy FROM xv_phim WHERE loai = 'quang_cao' ORDER BY updated_at DESC`)) as unknown as Row[])
    .filter((r) => { const kt = (r.kinh_thanh ?? {}) as KinhThanh; return !kt.luu_tru && !kt.template && sanPhamPhim({ loai: 'quang_cao', kinh_thanh: kt })?.key === spKey; });
}
/** Nhóm spy của sản phẩm: góc spy đã gắn ở creative của sản phẩm, hoặc concept đã nhập. */
async function spySp(db: Db, spKey: string): Promise<number | null> {
  for (const r of await phimSanPham(db, spKey)) { const g = docGocSpy(r.goc_spy)[0]; if (g) return g.sp; }
  const c = ((await db.execute(sql`SELECT spy_sp FROM xv_concept WHERE sp_key = ${spKey} ORDER BY id DESC LIMIT 1`)) as unknown as Row[])[0];
  return c ? n(c.spy_sp) : null;
}

export type KhoConcept = { spy_sp: number | null; concept: Concept[]; tpl: TplConcept[]; cap: Cap[]; bien_the: BienTheHinh[]; phuong_an: PhuongAn[]; creative: CreativeDuyet[]; gia: GiaConcept };
/** Đọc trọn kho concept của một sản phẩm + 14 template + đơn giá thật (sổ xv_job 30 ngày). */
export async function docKhoConcept(spKey: string): Promise<Kq<KhoConcept>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const [cRows, tRows, gRows] = await Promise.all([
    db.execute(sql`SELECT * FROM xv_concept WHERE sp_key = ${spKey} AND NOT an ORDER BY path, array_position(ARRAY['UA','PA','SA','PrA','MA'], nb), ma`),
    db.execute(sql`SELECT id, ten, kinh_thanh->'template'->>'dong' AS dong, kinh_thanh->'template'->>'khuon' AS khuon FROM xv_phim
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
  const tpl: TplConcept[] = [];
  for (const r of tRows as unknown as Row[]) {
    const o = await docOTemplate(db, n(r.id)); if (!o) continue;
    const d = dem.find((x) => n(x.phim_id) === n(r.id));
    const oChu = oChuTuKhung(o.o.filter((x) => x.dung), o.khung);
    tpl.push({ id: n(r.id), ten: s(r.ten).replace(/^Template\s*·\s*/, ''), dong: s(r.dong), khuon: s(r.khuon), so_shot: o.khung.length, giay: Math.round(o.khung.reduce((a, k) => a + k.giay, 0)),
      shot_nguoi: n(d?.nguoi), shot_boi: n(d?.boi), shot_ca: n(d?.ca), o_chu: oChu, o_hinh: oHinhCua(o.o.filter((x) => x.dung), oChu) });
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
  const anh = Number(g.anh) || 3.4, video = Number(g.video) || 16, chu = Number(g.chu) || 16;
  return { ok: true, data: {
    spy_sp: await spySp(db, spKey), concept, tpl, cap,
    bien_the: (bt as unknown as Row[]).map((r) => ({ id: n(r.id), cap_id: n(r.cap_id), so: n(r.so), nguoi_chinh: s(r.nguoi_chinh), nguoi_phu: s(r.nguoi_phu), boi_canh: s(r.boi_canh), goc: r.goc === true })),
    phuong_an: (pa as unknown as Row[]).map((r) => ({ id: n(r.id), cap_id: n(r.cap_id), o: s(r.o), so: n(r.so), chu: s(r.chu), nguon: s(r.nguon) })),
    creative: (cr as unknown as Row[]).map((r) => ({ id: n(r.id), so: n(r.so), cap_id: n(r.cap_id), bien_the_id: r.bien_the_id == null ? null : n(r.bien_the_id),
      chon: (r.chon ?? {}) as Record<string, number>, ma: s(r.ma), trang_thai: (s(r.trang_thai) || 'duyet') as CreativeDuyet['trang_thai'], phim_id: r.phim_id == null ? null : n(r.phim_id) })),
    gia: { shot_cents: Math.round((2 * anh + 1.3 * video) * 100) / 100, kb_cents: Math.round(2.3 * chu * 100) / 100, chu_cents: Math.round(chu * 100) / 100 },
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

/** Ngữ cảnh viết phương án của một cặp: concept + template (shot, ô) + phim sản phẩm (sản phẩm, ngôn ngữ, model chữ). */
async function nguCanhCap(db: Db, capId: number) {
  const c = ((await db.execute(sql`SELECT k.*, c.template_id FROM xv_cap c JOIN xv_concept k ON k.id = c.concept_id WHERE c.id = ${capId}`)) as unknown as Row[])[0];
  if (!c) return null;
  const o = await docOTemplate(db, n(c.template_id));
  if (!o) return null;
  const oChu = oChuTuKhung(o.o.filter((x) => x.dung), o.khung);
  const phim = (await phimSanPham(db, s(c.sp_key)))[0];
  const kt = ((phim?.kinh_thanh ?? {}) as KinhThanh);
  const av = (c.du_lieu ?? {}) as SubAvatar;
  const daCo = (await db.execute(sql`SELECT o, chu FROM xv_phuong_an WHERE cap_id = ${capId} AND NOT an ORDER BY o, so`)) as unknown as Row[];
  const user = `NGƯỜI MUA (concept ${s(c.ma)} · mức nhận biết ${s(c.nb)} — ${mucNb(s(c.nb)).ten}: ${mucNb(s(c.nb)).dung}):
- Ai: ${av.nguoi}
- Đang trải qua: ${av.trai_nghiem} · Cảm thấy: ${av.cam_xuc} · Kéo dài: ${av.keo_dai}
${av.so_sanh ? `- Đang so với: ${av.so_sanh}\n` : ''}${av.phan_doi ? `- Còn ngại: ${av.phan_doi}\n` : ''}- Câu NGUYÊN VĂN của khách: ${(av.ngon_ngu ?? []).map((x) => `"${x}"`).join(' · ')}
- Hook gợi ý: ${av.hook}
- Dàn ý gợi ý: ${av.creative}

TEMPLATE (thứ tự shot · loại · giây · chữ màn, {{ô}} là chỗ cần viết):
${o.khung.map((k, i) => `${i + 1}. ${k.loai} · ${k.giay}s · ${k.chu}`).join('\n')}

Ô CẦN VIẾT (k · tên · shot · giây · gợi ý của template) — số phương án mỗi ô ghi trong ngoặc:
${oChu.map((x, i) => `- ${x.k} · ${x.ten} · ${x.loai} · ${x.giay}s${x.goi_y ? ` · gợi ý: ${x.goi_y}` : ''} (${PA_DU_KIEN(oChu, i)} phương án)`).join('\n')}
${daCo.length ? `\nĐÃ CÓ (đừng lặp lại): ${daCo.map((x) => `${s(x.o)}: "${s(x.chu)}"`).join(' · ')}` : ''}`;
  return { c, oChu, kt, user, phimId: phim ? n(phim.id) : null };
}
/** Giá ước một lượt viết phương án (cents) — ghi trên nút trước khi bấm. */
export async function uocVietPhuongAn(capId: number): Promise<Kq<{ cents: number; model: string; so_o: number }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const x = await nguCanhCap(db, capId);
  if (!x) return loi('không thấy cặp');
  const model = x.kt.mo_hinh_chu || 'claude-opus-5-5';
  const soPa = x.oChu.reduce((a, _o, i) => a + PA_DU_KIEN(x.oChu, i), 0);
  return { ok: true, data: { cents: Math.round(giaChuCents(model, Math.ceil(x.user.length / 3.2) + 1600, soPa * 70 + 300) * 100) / 100, model, so_o: x.oChu.length } };
}
/** AI viết phương án cho mọi ô của một cặp (TỐN TIỀN — một lượt Claude, anh bấm). Phương án mới nối sau phương án đã có. */
export async function vietPhuongAn(capId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const x = await nguCanhCap(db, capId);
  if (!x) return loi('không thấy cặp');
  if (!x.oChu.length) return loi('template này không có ô chữ nào để viết phương án');
  const r = await vietPhuongAnCap(x.kt, x.user);
  if (r.ok) await ghiTienChu(db, x.phimId, `Phương án chữ · concept ${s(x.c.ma)} × template #${n(x.c.template_id)}`, r.model, r.tokens);
  if (!r.ok) return r;
  const hop = new Set(x.oChu.map((o) => o.k));
  let so = 0;
  for (const o of r.data.o) {
    if (!hop.has(o.k)) continue;
    for (const p of o.phuong_an) {
      if (!p.chu.trim()) continue;
      await db.execute(sql`INSERT INTO xv_phuong_an (cap_id, o, so, chu, nguon)
        VALUES (${capId}, ${o.k}, (SELECT coalesce(max(so), 0) + 1 FROM xv_phuong_an WHERE cap_id = ${capId} AND o = ${o.k}), ${p.chu.trim().slice(0, 600)}, ${p.nguon.trim().slice(0, 80)})`);
      so++;
    }
  }
  return { ok: true, data: so };
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
      ON CONFLICT (sp_key, ma) DO UPDATE SET trang_thai = CASE WHEN xv_creative.trang_thai = 'bo' THEN 'duyet' ELSE xv_creative.trang_thai END`);
    so++;
  }
  return { ok: true, data: so };
}
/** Bỏ duyệt (đổi trạng thái, không xoá — số giữ nguyên). */
export async function boCreative(spKey: string, ma: string[]): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_creative SET trang_thai = 'bo' WHERE sp_key = ${spKey} AND ma = ANY(${`{${ma.map((m) => `"${m.replace(/"/g, '')}"`).join(',')}}`}::text[]) AND trang_thai = 'duyet'`);
  return { ok: true, data: undefined };
}

/** Giá trị ô để tạo phim từ một creative đã duyệt: ô sản phẩm (creative cũ cùng sản phẩm) + đối tượng (concept) + diễn viên / bối cảnh + phương án đã chọn. */
export async function gtCreative(creativeId: number): Promise<Kq<{ template_id: number; template_ten: string; ten: string; gt: Record<string, string> }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = ((await db.execute(sql`SELECT cr.*, c.template_id, k.ma AS k_ma, k.ten AS k_ten, k.du_lieu, p.ten AS t_ten, b.nguoi_chinh, b.nguoi_phu, b.boi_canh
    FROM xv_creative cr JOIN xv_cap c ON c.id = cr.cap_id JOIN xv_concept k ON k.id = c.concept_id JOIN xv_phim p ON p.id = c.template_id
    LEFT JOIN xv_bien_the_hinh b ON b.id = cr.bien_the_id WHERE cr.id = ${creativeId}`)) as unknown as Row[])[0];
  if (!r) return loi('không thấy creative');
  const o = await docOTemplate(db, n(r.template_id));
  if (!o) return loi('không thấy template');
  const sp = await giaTriSanPham(s(r.sp_key));
  const gt: Record<string, string> = { ...(sp.ok ? sp.data : {}) };
  const keys = o.o.filter((x) => x.dung).map((x) => x.k);
  const av = (r.du_lieu ?? {}) as SubAvatar;
  if (keys.includes('doi_tuong') && av.nguoi) gt.doi_tuong = av.nguoi;
  Object.assign(gt, gtBienThe({ nguoi_chinh: s(r.nguoi_chinh), nguoi_phu: s(r.nguoi_phu), boi_canh: s(r.boi_canh) }, keys));
  const chon = (r.chon ?? {}) as Record<string, number>;
  const pa = (await db.execute(sql`SELECT o, so, chu FROM xv_phuong_an WHERE cap_id = ${n(r.cap_id)}`)) as unknown as Row[];
  for (const [k, so] of Object.entries(chon)) { const p = pa.find((x) => s(x.o) === k && n(x.so) === so); if (p) gt[k] = s(p.chu); }
  const tTen = s(r.t_ten).replace(/^Template\s*·\s*/, '').replace(/\s*\(.*\)\s*$/, '');
  return { ok: true, data: { template_id: n(r.template_id), template_ten: s(r.t_ten), ten: `#${n(r.so)} ${s(r.k_ten)} · ${tTen}`, gt } };
}
/** Tạo phim từ creative đã duyệt (0đ): chép template + điền ô như nút 🧩, gắn góc spy của concept, nối creative ↔ phim, ghi mã QC vào phim. */
export async function taoPhimTuCreative(creativeId: number, ten: string, gt: Record<string, string>): Promise<Kq<KetQuaChep>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = ((await db.execute(sql`SELECT cr.*, c.template_id, k.du_lieu, k.spy_sp, k.ma AS k_ma FROM xv_creative cr JOIN xv_cap c ON c.id = cr.cap_id JOIN xv_concept k ON k.id = c.concept_id WHERE cr.id = ${creativeId}`)) as unknown as Row[])[0];
  if (!r) return loi('không thấy creative');
  if (s(r.trang_thai) !== 'duyet' || r.phim_id != null) return loi('creative này không còn chờ tạo phim');
  const kq = await taoPhimTuTemplate(n(r.template_id), ten, gt);
  if (!kq.ok) return kq;
  // góc spy của concept (góc làm bằng chứng) → chip góc trên phim, giữ đường quy về spy
  const ids = new Set(((r.du_lieu ?? {}) as SubAvatar).goc ?? []);
  let goc: GocSpy[] = [];
  if (ids.size) { const g = await docSpy<{ id: number; loai: string; ten: string; mo_ta?: string }[]>(`/api/goc?sp=${n(r.spy_sp)}`);
    if (g.ok) goc = docGocSpy(g.data.filter((x) => ids.has(Number(x.id))).map((x) => ({ id: Number(x.id), sp: n(r.spy_sp), loai: x.loai, ten: x.ten, ...(x.mo_ta ? { mo_ta: x.mo_ta } : {}) }))); }
  await db.execute(sql`UPDATE xv_phim SET goc_spy = ${JSON.stringify(goc)}::jsonb,
    kinh_thanh = jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{creative}', ${JSON.stringify({ so: n(r.so), ma: s(r.ma), concept: s(r.k_ma) })}::jsonb), updated_at = now() WHERE id = ${kq.data.phimId}`);
  await db.execute(sql`UPDATE xv_creative SET phim_id = ${kq.data.phimId}, trang_thai = 'da_tao' WHERE id = ${creativeId}`);
  return kq;
}
