// SOCIAL TRAFFIC › TRỰC TIẾP — ai đang ở trên site aff lúc này (anh 16/10/2026: "như phần trực tiếp của be.adfond /report2").
// Nguồn = sổ phiên khách của ADFOND (phien_khach + phien_su_kien): page-events.js v19 trên mọi site của mình gửi gói tới
// adfond.com/api/phien mỗi 5 giây + nhịp 15 giây (pickjot.com nạp sẵn file đó). Không dựng bộ đếm thứ hai trong mos2.
// Cùng máy Postgres box3, DB 'adfond'; mos2 đọc bằng CHÍNH vai mos2 (GRANT SELECT trên đúng hai bảng đó, 16/10/2026) —
// không mượn mật khẩu adfond. URL: ADFOND_DATABASE_URL, thiếu thì lấy DATABASE_URL đổi tên DB thành adfond.
import 'server-only';
import postgres from 'postgres';
import { BUOC_AFF, type PhienAff, type SuKienAff, type CuaSoAff } from './social-traffic-demo';

declare global { var __adfond_pg: ReturnType<typeof postgres> | undefined }
function db() {
  const url = process.env.ADFOND_DATABASE_URL || process.env.DATABASE_URL?.replace(/\/[A-Za-z0-9_]+(\?|$)/, '/adfond$1');
  if (!url) return null;
  return (globalThis.__adfond_pg ??= postgres(url, { max: 2, prepare: false }));
}

const ONLINE_GIAY = 90;   // cùng mốc adfond (phien-khach-chung ONLINE_GIAY): có gói trong 90 giây qua = đang online
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

/** Phiên của các site aff (host lấy từ đích link của kênh — kenh_sp.dich), bỏ lượt đội nhà (noi_bo). Mới nhất trước, tối đa 300. */
export async function docPhienAff(sites: string[], cuaSo: CuaSoAff): Promise<PhienAff[]> {
  const sql = db(); if (!sql || !sites.length) return [];
  const tu = cuaSo === 'online' ? sql`now() - interval '90 seconds'` : cuaSo === '30p' ? sql`now() - interval '30 minutes'`
    : cuaSo === 'hom_nay' ? sql`date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'` : sql`now() - interval '7 days'`;
  const rows = await sql<{
    id: string; site: string; khach_id: string | null; bat_dau: Date; cuoi: Date; nguon: string | null; trang_vao: string | null; trang_hien: string | null;
    tieu_de: string | null; thiet_bi: string | null; nuoc: string | null; thanh_pho: string | null; so_trang: number; so_bam: number; cuon: number;
    bam_mua: string | null; quay_lai: boolean; online: boolean }[]>`
    SELECT p.id, p.site, p.khach_id, p.bat_dau, p.cuoi, p.nguon, p.trang_vao, p.trang_hien, p.tieu_de, p.thiet_bi, p.nuoc, p.thanh_pho,
      p.so_trang, p.so_bam, p.cuon,
      (SELECT e.chi_tiet FROM phien_su_kien e WHERE e.phien_id = p.id AND e.loai = 'bam_mua' ORDER BY e.luc LIMIT 1) AS bam_mua,
      EXISTS (SELECT 1 FROM phien_khach q WHERE q.khach_id = p.khach_id AND q.site = p.site AND q.bat_dau < p.bat_dau) AS quay_lai,
      p.cuoi > now() - make_interval(secs => ${ONLINE_GIAY}) AS online
    FROM phien_khach p WHERE p.site IN ${sql(sites)} AND NOT p.noi_bo AND p.cuoi > ${tu}
    ORDER BY p.cuoi DESC LIMIT 300`;
  return rows.map((r) => {
    // bước sâu nhất: Vào → Cuộn 25% → Đọc 50% → Bấm sang shop (BUOC_AFF) — cùng mốc "đã đọc" 50% của adfond (DOC_HET)
    const buoc = r.bam_mua != null ? 3 : r.cuon >= 50 ? 2 : r.cuon >= 25 ? 1 : 0;
    return { id: r.id, site: r.site, quayLai: r.quay_lai, batDau: iso(r.bat_dau), cuoi: iso(r.cuoi), online: r.online, nguon: r.nguon,
      trangVao: r.trang_vao, trangHien: r.trang_hien, tieuDe: r.tieu_de, thietBi: r.thiet_bi, nuoc: r.nuoc, thanhPho: r.thanh_pho,
      soTrang: r.so_trang, soBam: r.so_bam, cuon: r.cuon, buoc: Math.min(buoc, BUOC_AFF.length - 1), bamMua: r.bam_mua };
  });
}

/** Số của từng trang đích (site + đường dẫn = trang khách VÀO): 7 / 30 ngày, đọc ≥ 50%, bấm sang shop, nguồn khách, đang online. Bỏ lượt đội nhà. */
export async function docSoLanding(ds: { site: string; path: string }[]): Promise<Map<string, { phien7: number; khach7: number; doc50: number; bamRa: number; phien30: number; online: number; nguonKhach: { ten: string; so: number }[]; cuoi: string | null }>> {
  const sql = db(), ra = new Map(); if (!sql || !ds.length) return ra;
  const sites = [...new Set(ds.map((x) => x.site))], paths = [...new Set(ds.map((x) => x.path))];
  const rows = await sql<{ site: string; trang_vao: string; nguon: string | null; cuon: number; bam: boolean; khach_id: string | null; tuan: boolean; online: boolean; cuoi: Date }[]>`
    SELECT p.site, p.trang_vao, p.nguon, p.cuon, p.khach_id, p.cuoi,
      EXISTS (SELECT 1 FROM phien_su_kien e WHERE e.phien_id = p.id AND e.loai = 'bam_mua') AS bam,
      p.bat_dau > now() - interval '7 days' AS tuan, p.cuoi > now() - make_interval(secs => ${ONLINE_GIAY}) AS online
    FROM phien_khach p WHERE p.site IN ${sql(sites)} AND p.trang_vao IN ${sql(paths)} AND NOT p.noi_bo AND p.bat_dau > now() - interval '30 days'`;
  for (const x of ds) {
    const r = rows.filter((y) => y.site === x.site && y.trang_vao === x.path), t = r.filter((y) => y.tuan);
    const ng = new Map<string, number>(); for (const y of t) ng.set(y.nguon || 'direct', (ng.get(y.nguon || 'direct') ?? 0) + 1);
    ra.set(`${x.site}${x.path}`, { phien7: t.length, khach7: new Set(t.map((y) => y.khach_id)).size, doc50: t.filter((y) => y.cuon >= 50).length, bamRa: t.filter((y) => y.bam).length,
      phien30: r.length, online: r.filter((y) => y.online).length, nguonKhach: [...ng].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([ten, so]) => ({ ten, so })),
      cuoi: r.length ? iso(r.reduce((a, y) => (y.cuoi > a ? y.cuoi : a), r[0]!.cuoi)) : null });
  }
  return ra;
}

/** Dòng thời gian một phiên (xem trang, bấm, bấm sang shop…) — chỉ phiên của site được phép (chặn đọc phiên site khác qua id). */
export async function docSuKienAff(id: string, sites: string[]): Promise<SuKienAff[]> {
  const sql = db(); if (!sql || !sites.length) return [];
  const rows = await sql<{ luc: Date; loai: string; trang: string | null; chi_tiet: string | null }[]>`
    SELECT e.luc, e.loai, e.trang, e.chi_tiet FROM phien_su_kien e JOIN phien_khach p ON p.id = e.phien_id
    WHERE e.phien_id = ${id} AND p.site IN ${sql(sites)} ORDER BY e.luc LIMIT 300`;
  return rows.map((r) => ({ luc: iso(r.luc), loai: r.loai, trang: r.trang, chiTiet: r.chi_tiet }));
}
