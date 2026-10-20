'use server';
// SỐ LIỆU QC ETHOPEX SỐNG cho trang 📦 Sản phẩm (anh 20/10/2026: realtime "cách 1" + "cần show thời gian update cuối cùng bao lâu rồi").
// Kéo khi mở trang / bấm Làm mới: Report từ đầu tháng (giờ VN) + danh sách camp (mốc Ethopex đồng bộ Facebook). Camp → creative: đọc từ studio
// (kinh_thanh.ethopex.camp_id / camp_nhan_ban); camp chưa có trong studio thì hỏi chi tiết camp trên Ethopex rồi GHI LUÔN camp_id vào phim studio.
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { goiEthopex } from '@/lib/xuong-video/ethopex-api';

export type SoLieuSong = {
  luc: string; khoang: string; ethopex_dong_bo: string | null;
  /** creative_id → số liệu cộng các camp của nó */
  theo_creative: Record<number, { chi: number; thu: number; lai: number; camp: { id: number; budget: number; spending: number | null; roi: number | null; lai: number; chi: number; thu: number }[] }>;
};
type Dong = { campaign_id: number; daily_budget: number; spending: number | null; roi: number | null; profit: number; cost: number; revenue: number };

export async function soLieuQcSong(): Promise<{ ok: true; data: SoLieuSong } | { ok: false; loi: string }> {
  const db = getDb(); if (!db) return { ok: false, loi: 'no db' };
  const me = await getCurrentUser(); if (!me || me.role !== 'admin') return { ok: false, loi: 'không có quyền' };
  const nay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); const tu = `${nay.slice(0, 8)}01`;
  const [bc, ds] = await Promise.all([
    goiEthopex<{ rows: Dong[] }>(db, '/api/v1/report', { method: 'POST', body: { columns: ['campaign_name', 'daily_budget', 'spending', 'roi', 'profit', 'cost', 'revenue'], filters: {}, metric_conditions: [], limit: 1000, page: 1, page_size: 1000, date_from: tu, date_to: nay } }),
    goiEthopex<{ data: { id: number; last_synced_at: string | null }[] }>(db, '/api/v1/campaigns?page_size=500'),
  ]);
  if (!bc.ok) return bc; if (!ds.ok) return ds;
  // camp → creative từ studio
  const rows = (await db.execute(sql`SELECT id, (kinh_thanh->'ethopex'->>'creative_id')::int AS cr, kinh_thanh->'ethopex'->'camp_id' AS camp, kinh_thanh->'ethopex'->'camp_nhan_ban' AS nb
    FROM xv_phim WHERE project = 'ethopex' AND kinh_thanh->'ethopex' ? 'creative_id'`)) as unknown as { id: number; cr: number; camp: number | null; nb: number[] | null }[];
  const campCr = new Map<number, number>();
  for (const r of rows) for (const c of [r.camp, ...(r.nb ?? [])]) if (typeof c === 'number') campCr.set(c, r.cr);
  // camp chưa biết creative → hỏi Ethopex, ghi vào studio (lần sau khỏi hỏi)
  const thieu = bc.data.rows.map((r) => r.campaign_id).filter((id) => !campCr.has(id));
  for (const id of thieu) {
    const ct = await goiEthopex<{ ad_groups?: { ads?: { creative_id?: number }[] }[] }>(db, `/api/v1/campaigns/${id}`);
    const cr = ct.ok ? ct.data.ad_groups?.[0]?.ads?.[0]?.creative_id : undefined;
    if (!cr) continue;
    campCr.set(id, cr);
    const p = rows.find((r) => r.cr === cr);
    if (p && !p.camp) await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{ethopex,camp_id}', ${JSON.stringify(id)}::jsonb) WHERE id = ${p.id}`);
    else if (p) await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{ethopex,camp_nhan_ban}', coalesce(kinh_thanh->'ethopex'->'camp_nhan_ban', '[]'::jsonb) || ${JSON.stringify([id])}::jsonb) WHERE id = ${p.id}`);
  }
  const theo: SoLieuSong['theo_creative'] = {};
  for (const r of bc.data.rows) {
    const cr = campCr.get(r.campaign_id); if (!cr) continue;
    const g = (theo[cr] ??= { chi: 0, thu: 0, lai: 0, camp: [] });
    g.camp.push({ id: r.campaign_id, budget: +r.daily_budget || 0, spending: r.spending == null ? null : Math.round(r.spending * 10) / 10, roi: r.roi == null ? null : Math.round(r.roi * 10) / 10,
      lai: +r.profit || 0, chi: +r.cost || 0, thu: +r.revenue || 0 });
    g.chi += +r.cost || 0; g.thu += +r.revenue || 0; g.lai += +r.profit || 0;
  }
  const dongBo = ds.data.data.map((c) => c.last_synced_at).filter((x): x is string => !!x).sort().pop() ?? null;
  return { ok: true, data: { luc: new Date().toISOString(), khoang: `${tu} → ${nay}`, ethopex_dong_bo: dongBo, theo_creative: theo } };
}
