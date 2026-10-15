// Áp THƯ VIỆN CTA (cta.ts) lên phim QC trên DB: ghi kt.qc.cta + kiểu chữ của mọi shot ưu đãi / CTA / end card. 0đ.
import 'server-only';
import { sql } from 'drizzle-orm';
import { type Db, type Row, n, s } from './doc-db';
import { chupTruoc } from './hoan-tac';
import { chonCta, ctaTheoKey, kieuShotSauCta, laShotCta, type KieuCta } from './cta';
import type { KieuChu } from './kieu';

export async function apCtaPhim(db: Db, phimId: number, key: string, nguoi = ''): Promise<{ cta: KieuCta; shot: number } | null> {
  const cta = ctaTheoKey(key);
  if (!cta) return null;
  const nhom = await chupTruoc(db, { bang: 'xv_phim', id: phimId, cot: ['kinh_thanh'], moTa: `🎯 kiểu CTA: ${cta.ten}`, nguoi });
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{qc,cta}', to_jsonb(${cta.key}::text), true), updated_at = now() WHERE id = ${phimId}`);
  const ds = (await db.execute(sql`SELECT c.id, c.phan_doan, c.kieu_chu FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${phimId}`)) as unknown as Row[];
  let shot = 0;
  for (const c of ds.filter((x) => laShotCta(s(x.phan_doan)))) {
    await chupTruoc(db, { bang: 'xv_canh', id: n(c.id), cot: ['kieu_chu'], moTa: `🎯 kiểu CTA: ${cta.ten}`, nguoi: '', nhom });
    await db.execute(sql`UPDATE xv_canh SET kieu_chu = ${JSON.stringify(kieuShotSauCta(s(c.phan_doan), c.kieu_chu as KieuChu, cta))}::jsonb, updated_at = now() WHERE id = ${n(c.id)}`);
    shot++;
  }
  return { cta, shot };
}

/** Phim QC mới: chọn kiểu ít dùng nhất trong các phim (không phải template, chưa lưu trữ) cùng sản phẩm → các video không trùng CTA. */
export async function ganCtaTuDong(db: Db, phimId: number): Promise<KieuCta | null> {
  const p = ((await db.execute(sql`SELECT loai, kinh_thanh->'qc'->>'ten' AS ten FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[])[0];
  if (!p || s(p.loai) !== 'quang_cao') return null;
  const dem: Record<string, number> = {};
  for (const r of (await db.execute(sql`SELECT kinh_thanh->'qc'->>'cta' AS cta FROM xv_phim WHERE id <> ${phimId} AND loai = 'quang_cao'
      AND kinh_thanh->'qc'->>'ten' = ${s(p.ten)} AND jsonb_typeof(kinh_thanh->'template') IS DISTINCT FROM 'object' AND coalesce((kinh_thanh->>'luu_tru')::boolean, false) = false`)) as unknown as Row[]) {
    if (r.cta) dem[s(r.cta)] = (dem[s(r.cta)] ?? 0) + 1;
  }
  const cta = chonCta(dem);
  await apCtaPhim(db, phimId, cta.key);
  return cta;
}
