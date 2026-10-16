// LÕI KHO CONCEPT dùng chung cho server action (actions-concept.ts) và script trên box (scripts/viet-phuong-an.mts) — nhận db, không đòi phiên.
import 'server-only';
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { type Row, n, s, ghiTienChu } from './doc-db';
import { docOTemplate } from './template-db';
import { sanPhamPhim } from './nhom-phim';
import { giaChuCents, type KinhThanh } from './kieu';
import { vietPhuongAnCap } from './claude';
import { oChuTuKhung, mucNb, PA_DU_KIEN, type SubAvatar } from './concept';

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
export async function uocVietPhuongAnDb(db: Db, capId: number): Promise<Kq<{ cents: number; model: string; so_o: number }>> {
  const x = await nguCanhCap(db, capId);
  if (!x) return { ok: false, loi: 'không thấy cặp' };
  const model = x.kt.mo_hinh_chu || 'claude-opus-5-5';
  const soPa = x.oChu.reduce((a, _o, i) => a + PA_DU_KIEN(x.oChu, i), 0);
  return { ok: true, data: { cents: Math.round(giaChuCents(model, Math.ceil(x.user.length / 3.2) + 1600, soPa * 70 + 300) * 100) / 100, model, so_o: x.oChu.length } };
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

