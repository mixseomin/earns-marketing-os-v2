// ĐỌC CAMP ETHOPEX cho tab Ethopex trang chủ (anh 21/10/2026: "thêm 1 tab mới là Ethopex để quản lý các camp đang lên … kèm rules đang set cho từng camp
// giống bên adfond"). Kéo sống từ API Ethopex khi mở tab (khoá ở xv_khoa_ngoai, gói chung @mos2/db/ethopex) + nối studio (phim / creative).
// Nhớ 60 giây trong tiến trình để bấm qua lại tab không gọi lại 70+ lượt API. Chỉ đọc.
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiEthopex } from '@mos2/db/ethopex';
import type { CampEtp, SoLieu } from './ethopex-luat';

type CtCamp = { campaign: { id: number; name: string; state: string; budget_daily: number; last_synced_at: string | null; created_at: string; error?: string };
  ad_groups?: { ads?: { content_id?: number; creative_id?: number; delivery_status?: string; error?: string }[] }[] };
type DongBc = { campaign_id: number; cost: number; revenue: number };
export type DuLieuEthopex = { luc: string; camps: CampEtp[]; phimThang: number[]; loi: string | null };

let nho: { luc: number; data: DuLieuEthopex } | null = null;

const ngay = (d: Date) => d.toISOString().slice(0, 10);
async function baoCao(tu: string, den: string): Promise<Map<number, SoLieu>> {
  const r = await goiEthopex<{ rows: DongBc[] }>(getDb()!, '/api/v1/report', { method: 'POST', body: { columns: ['campaign_name', 'cost', 'revenue'], filters: {}, metric_conditions: [], limit: 1000, page: 1, page_size: 1000, date_from: tu, date_to: den } });
  const m = new Map<number, SoLieu>();
  if (!r.ok) return m;
  for (const x of r.data.rows) { const a = m.get(x.campaign_id) ?? { chi: 0, thu: 0 }; a.chi += +x.cost || 0; a.thu += +x.revenue || 0; m.set(x.campaign_id, a); }   // report tách dòng theo content → cộng theo camp
  return m;
}

export async function docEthopex(lamMoi = false): Promise<DuLieuEthopex> {
  if (!lamMoi && nho && Date.now() - nho.luc < 60_000) return nho.data;
  const db = getDb();
  if (!db) return { luc: new Date().toISOString(), camps: [], phimThang: [], loi: 'chưa nối DB' };
  const vn = new Date(Date.now() + 7 * 3600_000), nay = ngay(vn), lui = (n: number) => ngay(new Date(vn.getTime() - n * 86_400_000));
  const ds = await goiEthopex<{ data: { id: number }[] }>(db, '/api/v1/campaigns?page_size=500');
  if (!ds.ok) return { luc: new Date().toISOString(), camps: [], phimThang: [], loi: ds.loi };
  const ids = ds.data.data.map((c) => c.id);
  const ct: CtCamp[] = [];
  for (let i = 0; i < ids.length; i += 12) {   // 12 lượt song song mỗi đợt — đủ nhanh, không dồn API
    const lo = await Promise.all(ids.slice(i, i + 12).map((id) => goiEthopex<CtCamp>(db, `/api/v1/campaigns/${id}`)));
    for (const x of lo) if (x.ok) ct.push(x.data);
  }
  const [thang, hom, gan, truoc] = await Promise.all([baoCao(`${nay.slice(0, 8)}01`, nay), baoCao(nay, nay), baoCao(lui(2), nay), baoCao(lui(6), lui(3))]);
  const sx = (await db.execute(sql`SELECT id, ten, (kinh_thanh->'ethopex'->>'creative_id')::int AS cr, kinh_thanh->>'ngon_ngu' AS nn FROM xv_phim
    WHERE project = 'ethopex' AND kinh_thanh->'ethopex' ? 'creative_id'`)) as unknown as { id: number; ten: string; cr: number; nn: string | null }[];
  const theoCr = new Map(sx.map((r) => [r.cr, r]));
  const thangRow = (await db.execute(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_phim_thang'`)) as unknown as { gia_tri: { content?: number[] } }[];
  const rong: SoLieu = { chi: 0, thu: 0 };
  const camps: CampEtp[] = ct.map((d) => {
    const a = d.ad_groups?.[0]?.ads?.[0] ?? {}, p = a.creative_id ? theoCr.get(a.creative_id) : undefined, c = d.campaign;
    const ten = c.name.replace(/^\d+:\s*/, '');
    return { id: c.id, ten, trang_thai: c.state, giao: a.delivery_status ?? '', ngan_sach: +c.budget_daily || 0, dong_bo: c.last_synced_at, tao: c.created_at,
      content_id: a.content_id ?? null, creative_id: a.creative_id ?? null, phim: p?.ten.split(' · ')[1] ?? null,
      ngon_ngu: p?.nn ?? (/\bES\b/.test(ten) ? 'es' : /\bEN\b/.test(ten) ? 'en' : null), studio_phim_id: p?.id ?? null,
      loi: a.error || c.error || null, thang: thang.get(c.id) ?? rong, hom_nay: hom.get(c.id) ?? rong, gan: gan.get(c.id) ?? rong, truoc: truoc.get(c.id) ?? rong };
  }).sort((x, y) => y.id - x.id);
  const data = { luc: new Date().toISOString(), camps, phimThang: thangRow[0]?.gia_tri?.content ?? [], loi: null };
  nho = { luc: Date.now(), data };
  return data;
}
