// Ghi lượt xem các nền vào xv_may_video (luot_xem_nen theo nền, luot_xem = tổng) — một chỗ cho --luot-xem, --sinh-game, --sinh-kho. Đọc lại video cũ hơn 12 giờ.
import { sql } from 'drizzle-orm';
import { luotXemCacNen, tokenFacebook } from './luot-xem';

/** Ngày đăng sớm nhất của video (nền nào đăng trước) — để xét "sau ≥ 7 ngày". */
export const NGAY_DANG_SQL = `least((da_dang->'youtube'->>'ngay')::date, (da_dang->'facebook'->>'ngay')::date, (da_dang->'instagram'->>'ngay')::date)`;

export async function docLaiLuotXem(db: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }, mayId: number | null): Promise<{ doc: number; tong: number }> {
  const ds = (await db.execute(sql`SELECT id, da_dang FROM xv_may_video WHERE (da_dang ? 'youtube' OR da_dang ? 'facebook') AND (${mayId}::int IS NULL OR may_id = ${mayId}::int)
    AND (luot_xem_luc IS NULL OR luot_xem_luc < now() - interval '12 hours')`)) as unknown as { id: number; da_dang: Record<string, { url?: string | null }> }[];
  const tk = await tokenFacebook(); let doc = 0;
  for (const v of ds) {
    const nen = await luotXemCacNen(v.da_dang, tk); if (!Object.keys(nen).length) continue;
    const tong = Object.values(nen).reduce((a, b) => a + b, 0);
    await db.execute(sql`UPDATE xv_may_video SET luot_xem = ${tong}, luot_xem_nen = ${JSON.stringify(nen)}::jsonb, luot_xem_luc = now() WHERE id = ${v.id}`); doc++;
  }
  return { doc, tong: ds.length };
}
