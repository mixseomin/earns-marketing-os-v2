// LÕI KHO CONCEPT dùng chung cho server action (actions-concept.ts) và script trên box (scripts/viet-phuong-an.mts) — nhận db, không đòi phiên.
import 'server-only';
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { type Row, n, s, ghiTienChu } from './doc-db';
import { docOTemplate, dienLaiChu, chepPhim, type KetQuaChep } from './template-db';
import { nhomCuaO, oThieu } from './template';
import { docGocSpy, type GocSpy } from './goc-spy';
import { docSpy } from './spy-api';
import { cauThieuNguon, type ThamKhaoCau } from './tham-khao';
import { sanPhamPhim } from './nhom-phim';
import { giaChuUoc, type KinhThanh } from './kieu';
import { vietPhuongAnCap } from './claude';
import { oChuTuKhung, mucNb, PA_DU_KIEN, nguonCreative, gtBienThe, type SubAvatar } from './concept';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Kq<T> = { ok: true; data: T } | { ok: false; loi: string };
/** Phim QC của sản phẩm (không template, không lưu trữ) — mới sửa trước. */
export async function phimSanPham(db: Db, spKey: string): Promise<Row[]> {
  return ((await db.execute(sql`SELECT id, kinh_thanh, goc_spy FROM xv_phim WHERE loai = 'quang_cao' ORDER BY updated_at DESC`)) as unknown as Row[])
    .filter((r) => { const kt = (r.kinh_thanh ?? {}) as KinhThanh; return !kt.luu_tru && !kt.template && sanPhamPhim({ loai: 'quang_cao', kinh_thanh: kt })?.key === spKey; });
}
/** Ngữ cảnh viết phương án của một cặp: concept + template (shot, ô) + phim sản phẩm (sản phẩm, ngôn ngữ, model chữ). */
export async function nguCanhCap(db: Db, capId: number) {
  const c = ((await db.execute(sql`SELECT k.*, c.template_id FROM xv_cap c JOIN xv_concept k ON k.id = c.concept_id WHERE c.id = ${capId}`)) as unknown as Row[])[0];
  if (!c) return null;
  const o = await docOTemplate(db, n(c.template_id));
  if (!o) return null;
  const oChu = oChuTuKhung(o.o.filter((x) => x.dung), o.khung);
  const phim = (await phimSanPham(db, s(c.sp_key)))[0];
  const kt = ((phim?.kinh_thanh ?? {}) as KinhThanh);
  const av = (c.du_lieu ?? {}) as SubAvatar;
  const daCo = ((await db.execute(sql`SELECT o, chu FROM xv_phuong_an WHERE cap_id = ${capId} AND NOT an ORDER BY o, so`)) as unknown as Row[]).filter((x) => oChu.some((o) => o.k === s(x.o)));   // chỉ ô chữ — ô hình (nap-o-hinh) không phải câu để AI né lặp
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
export async function uocVietPhuongAnDb(db: Db, capId: number): Promise<Kq<{ cents: number; model: string; so_o: number }>> {
  const x = await nguCanhCap(db, capId);
  if (!x) return { ok: false, loi: 'không thấy cặp' };
  const model = x.kt.mo_hinh_chu || 'claude-opus-5-5';
  const soPa = x.oChu.reduce((a, _o, i) => a + PA_DU_KIEN(x.oChu, i), 0);
  return { ok: true, data: { cents: Math.round(giaChuUoc(model, Math.ceil(x.user.length / 3.2) + 1600, soPa * 70 + 300) * 100) / 100, model, so_o: x.oChu.length } };
}
/** AI viết phương án cho mọi ô của một cặp (TỐN TIỀN — một lượt Claude, anh bấm). Phương án mới nối sau phương án đã có. */
export async function vietPhuongAnDb(db: Db, capId: number): Promise<Kq<number>> {
  const x = await nguCanhCap(db, capId);
  if (!x) return { ok: false, loi: 'không thấy cặp' };
  if (!x.oChu.length) return { ok: false, loi: 'template này không có ô chữ nào để viết phương án' };
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


/** Cặp ĐANG BẬT của sản phẩm còn ô chữ chưa có phương án nào (cần AI viết). */
export async function capThieuPhuongAn(db: Db, spKey: string): Promise<number[]> {
  const caps = (await db.execute(sql`SELECT c.id FROM xv_cap c JOIN xv_concept k ON k.id = c.concept_id WHERE k.sp_key = ${spKey} AND NOT k.an AND c.bat ORDER BY k.path, k.ma, c.template_id`)) as unknown as Row[];
  const ra: number[] = [];
  for (const r of caps) {
    const x = await nguCanhCap(db, n(r.id)); if (!x || !x.oChu.length) continue;
    const co = new Set(((await db.execute(sql`SELECT DISTINCT o FROM xv_phuong_an WHERE cap_id = ${n(r.id)} AND NOT an`)) as unknown as Row[]).map((y) => s(y.o)));
    if (x.oChu.some((o) => !co.has(o.k))) ra.push(n(r.id));
  }
  return ra;
}
/** Lượt VIẾT HẾT đang chạy theo sản phẩm (bộ nhớ tiến trình studio) — màn hỏi lại để hiện tiến độ. */
export const VIET_HET = new Map<string, { tong: number; xong: number; loi: number; cents: number; chay: boolean; luc: number }>();
/** Viết phương án cho mọi cặp còn thiếu — LẦN LƯỢT (một cặp một lượt Claude), ghi tiến độ vào VIET_HET. Gọi không chờ (nền) từ action, chờ từ script. */
export async function vietHetDb(db: Db, spKey: string, caps: number[]): Promise<{ xong: number; loi: number }> {
  const st = { tong: caps.length, xong: 0, loi: 0, cents: 0, chay: true, luc: Date.now() };
  VIET_HET.set(spKey, st);
  for (const id of caps) {
    try {
      const truoc = Date.now();
      const r = await vietPhuongAnDb(db, id);
      if (!r.ok) { st.loi++; console.error(`viet het · cặp #${id}: ${r.loi}`); }
      const t = (await db.execute(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS c FROM xv_job WHERE loai = 'chu' AND nhan LIKE 'Phương án chữ%' AND created_at >= to_timestamp(${truoc / 1000})`)) as unknown as Row[];
      st.cents += Number(t[0]?.c) || 0;
    } catch (e) { st.loi++; console.error(`viet het · cặp #${id}:`, e instanceof Error ? e.message : e); }
    st.xong++;
  }
  st.chay = false;
  return { xong: st.xong, loi: st.loi };
}

/** Gắn nguồn tham khảo của creative vào phim của nó (0đ): đọc phương án đã chọn + sub-avatar + thông tin trang bán đã điền trong phim → dienLaiChu
 *  (chữ / lời giữ nguyên vì gt không đổi, chỉ thêm nguồn). Một đường cho nút Tạo phim gốc (taoPhimTuCreative) và script gắn lại cho phim đã tạo. */
export async function ganNguonCreativeDb(db: Db, phimId: number): Promise<{ shot: number; thieu: string[] } | null> {
  const r = ((await db.execute(sql`SELECT cr.chon, cr.cap_id, k.du_lieu, p.kinh_thanh FROM xv_creative cr JOIN xv_cap c ON c.id = cr.cap_id
    JOIN xv_concept k ON k.id = c.concept_id JOIN xv_phim p ON p.id = cr.phim_id WHERE cr.phim_id = ${phimId}`)) as unknown as Row[])[0];
  if (!r) return null;
  const gt = (((r.kinh_thanh ?? {}) as KinhThanh).tu_template?.gia_tri ?? {}) as Record<string, string>;
  const pa = ((await db.execute(sql`SELECT o, so, nguon FROM xv_phuong_an WHERE cap_id = ${n(r.cap_id)} AND NOT an`)) as unknown as Row[]).map((x) => ({ o: s(x.o), so: n(x.so), nguon: s(x.nguon) }));
  const tk = nguonCreative((r.chon ?? {}) as Record<string, number>, pa, (r.du_lieu ?? {}) as SubAvatar,
    { link: gt.link, diem: gt.diem_noi_bat, uu_dai: gt.uu_dai, ten: gt.san_pham });
  const kq = await dienLaiChu(db, phimId, { gt: {}, tk });
  if (!kq) return null;
  const canh = (await db.execute(sql`SELECT c.chu_man, c.thoai, c.tham_khao FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${phimId}`)) as unknown as Row[];
  return { shot: kq.shot, thieu: canh.flatMap((c) => cauThieuNguon({ chu_man: s(c.chu_man), thoai: (c.thoai ?? []) as { loi?: string }[], tham_khao: (c.tham_khao ?? []) as ThamKhaoCau[] })) };
}

/** Giá trị ô SẢN PHẨM lấy từ các phim QC cũ cùng sản phẩm (ô nhóm san_pham). Một chỗ cho nút (actions.ts › giaTriSanPham) và đường tự làm phim. */
export async function giaTriSanPhamDb(db: Db, spKey: string): Promise<Record<string, string>> {
  const ds = ((await db.execute(sql`SELECT loai, kinh_thanh FROM xv_phim WHERE loai = 'quang_cao' AND kinh_thanh->'tu_template' IS NOT NULL ORDER BY updated_at`)) as unknown as Row[])
    .filter((r) => sanPhamPhim({ loai: 'quang_cao', kinh_thanh: (r.kinh_thanh ?? {}) as KinhThanh })?.key === spKey);
  const gt: Record<string, string> = {};
  for (const r of ds) for (const [k, v] of Object.entries(((r.kinh_thanh ?? {}) as KinhThanh).tu_template?.gia_tri ?? {})) if (nhomCuaO(k) === 'san_pham' && String(v ?? '').trim()) gt[k] = String(v);
  return gt;
}
/** Giá trị ô để tạo phim từ một creative: sản phẩm → ô hình của cặp (nap-o-hinh.mts) → diễn viên / bối cảnh của biến thể → phương án đã chọn. */
export async function gtCreativeDb(db: Db, creativeId: number): Promise<{ template_id: number; template_ten: string; ten: string; gt: Record<string, string> } | string> {
  const r = ((await db.execute(sql`SELECT cr.*, c.template_id, k.ma AS k_ma, k.ten AS k_ten, k.du_lieu, p.ten AS t_ten, b.nguoi_chinh, b.nguoi_phu, b.boi_canh, b.o AS b_o
    FROM xv_creative cr JOIN xv_cap c ON c.id = cr.cap_id JOIN xv_concept k ON k.id = c.concept_id JOIN xv_phim p ON p.id = c.template_id
    LEFT JOIN xv_bien_the_hinh b ON b.id = cr.bien_the_id WHERE cr.id = ${creativeId}`)) as unknown as Row[])[0];
  if (!r) return 'không thấy creative';
  const o = await docOTemplate(db, n(r.template_id));
  if (!o) return 'không thấy template';
  const gt: Record<string, string> = { ...(await giaTriSanPhamDb(db, s(r.sp_key))) };
  const keys = o.o.filter((x) => x.dung).map((x) => x.k);
  const av = (r.du_lieu ?? {}) as SubAvatar;
  if (keys.includes('doi_tuong') && av.nguoi) gt.doi_tuong = av.nguoi;
  const chon = (r.chon ?? {}) as Record<string, number>;
  const pa = (await db.execute(sql`SELECT o, so, chu FROM xv_phuong_an WHERE cap_id = ${n(r.cap_id)} AND NOT an`)) as unknown as Row[];
  // ô HÌNH của cặp (scripts/nap-o-hinh.mts — hình tả đúng sản phẩm thay cho mẫu template lẫn sản phẩm khác): một phương án, không vào tổ hợp
  for (const p of pa) if (n(p.so) === 1 && !(s(p.o) in chon) && keys.includes(s(p.o)) && s(p.chu).trim()) gt[s(p.o)] = s(p.chu);
  Object.assign(gt, gtBienThe({ nguoi_chinh: s(r.nguoi_chinh), nguoi_phu: s(r.nguoi_phu), boi_canh: s(r.boi_canh), o: (r.b_o ?? {}) as Record<string, string> }, keys));
  for (const [k, so] of Object.entries(chon)) { const p = pa.find((x) => s(x.o) === k && n(x.so) === so); if (p) gt[k] = s(p.chu); }
  const tTen = s(r.t_ten).replace(/^Template\s*·\s*/, '').replace(/\s*\(.*\)\s*$/, '');
  return { template_id: n(r.template_id), template_ten: s(r.t_ten), ten: `#${n(r.so)} ${s(r.k_ten)} · ${tTen}`, gt };
}
/** Tạo PHIM GỐC từ creative đã duyệt (0đ): chép template + điền ô, gắn góc spy của concept, nguồn tham khảo của phương án, nối creative ↔ phim,
 *  phim đầu tiên của bộ hình làm phim gốc. Một chỗ cho nút 🎬 Tạo phim gốc (actions-concept.ts) và scripts/tao-phim-goc.mts. */
export async function taoPhimGocDb(db: Db, creativeId: number, o: { ten?: string; gt?: Record<string, string> } = {}): Promise<{ ok: true; data: KetQuaChep } | { ok: false; loi: string }> {
  const r = ((await db.execute(sql`SELECT cr.*, c.template_id, k.du_lieu, k.spy_sp, k.ma AS k_ma FROM xv_creative cr JOIN xv_cap c ON c.id = cr.cap_id JOIN xv_concept k ON k.id = c.concept_id WHERE cr.id = ${creativeId}`)) as unknown as Row[])[0];
  if (!r) return { ok: false, loi: 'không thấy creative' };
  if (s(r.trang_thai) !== 'duyet' || r.phim_id != null) return { ok: false, loi: 'creative này không còn chờ tạo phim' };
  const g = o.gt && o.ten ? { ten: o.ten, gt: o.gt } : await gtCreativeDb(db, creativeId);
  if (typeof g === 'string') return { ok: false, loi: g };
  const t = await docOTemplate(db, n(r.template_id));
  if (!t) return { ok: false, loi: 'không thấy template' };
  const thieu = oThieu(t.o, g.gt);
  if (thieu.length) return { ok: false, loi: `chưa điền: ${thieu.map((x) => x.ten).join(', ')}` };
  let kq: KetQuaChep | null;
  try { kq = await chepPhim(db, n(r.template_id), { ten: g.ten.trim(), gt: g.gt, laTemplate: false }); } catch (e) { return { ok: false, loi: e instanceof Error ? e.message : String(e) }; }
  if (!kq) return { ok: false, loi: 'không thấy template' };
  // góc spy của concept (góc làm bằng chứng) → chip góc trên phim, giữ đường quy về spy
  const ids = new Set(((r.du_lieu ?? {}) as SubAvatar).goc ?? []);
  let goc: GocSpy[] = [];
  if (ids.size) { const gs = await docSpy<{ id: number; loai: string; ten: string; mo_ta?: string }[]>(`/api/goc?sp=${n(r.spy_sp)}`);
    if (gs.ok) goc = docGocSpy(gs.data.filter((x) => ids.has(Number(x.id))).map((x) => ({ id: Number(x.id), sp: n(r.spy_sp), loai: x.loai, ten: x.ten, ...(x.mo_ta ? { mo_ta: x.mo_ta } : {}) }))); }
  await db.execute(sql`UPDATE xv_phim SET goc_spy = ${JSON.stringify(goc)}::jsonb,
    kinh_thanh = jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{creative}', ${JSON.stringify({ so: n(r.so), ma: s(r.ma), concept: s(r.k_ma) })}::jsonb), updated_at = now() WHERE id = ${kq.phimId}`);
  await db.execute(sql`UPDATE xv_creative SET phim_id = ${kq.phimId}, trang_thai = 'da_tao' WHERE id = ${creativeId}`);
  // nguồn tham khảo của phương án đi theo câu chữ vào phim — thiếu thì cổng quy trình chặn sinh keyframe cả phim
  await ganNguonCreativeDb(db, kq.phimId);
  // phim ĐẦU TIÊN của bộ hình = PHIM GỐC — các creative khác cùng bộ hình xuất từ clip của nó (xuatCreative), không tạo phim riêng
  if (r.bien_the_id != null) await db.execute(sql`UPDATE xv_bien_the_hinh SET phim_id = ${kq.phimId} WHERE id = ${n(r.bien_the_id)} AND phim_id IS NULL`);
  return { ok: true, data: kq };
}
