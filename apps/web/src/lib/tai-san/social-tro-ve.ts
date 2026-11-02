// SOCIAL TRỎ VỀ — đọc DB (server): mọi bài đã đăng của máy đăng studio (xv_may_video.da_dang theo nền) + đích của bài + phiên khách từ bài
// (sổ phiên adfond, docBamBaiDang(ngày)). Trả hàm tra cứu cho từng loại đích; tính ở social-tro-ve-tinh.ts.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { docBamBaiDang } from '@/lib/social-truc-tiep';
import { gopTroVe, khoaDich, khopDuong, khopSite, mienGoc, type BaiDich, type TroVe } from './social-tro-ve-tinh';

export type TraTroVe = { site: (domain: string) => TroVe | null; duong: (url: string | null | undefined) => TroVe | null };

export async function docSocialTroVe(ky: number, hom: string): Promise<TraTroVe> {
  const d = getDb(); const rong: TraTroVe = { site: () => null, duong: () => null }; if (!d) return rong;
  // mỗi (video × nền đã đăng) một bài; tài khoản = tk của máy ở nền đó (xv_may.dang[].tk), nền gốc bỏ đuôi (_anh / :acct)
  const rows = (await d.execute(sql`SELECT coalesce(v.dang->>'link', m.site_dich) AS dich, n.key AS nen, n.value->>'ngay' AS ngay,
      (v.luot_xem_nen->>n.key)::int AS xem,
      coalesce((SELECT x->>'tk' FROM jsonb_array_elements(m.dang) x WHERE x->>'nen' = n.key LIMIT 1), m.ma) AS tk
    FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id, jsonb_each(coalesce(v.da_dang, '{}'::jsonb)) n
    WHERE jsonb_typeof(n.value) = 'object'`)) as unknown as { dich: string | null; nen: string; ngay: string | null; xem: number | null; tk: string }[];
  const ds: BaiDich[] = rows.map((r) => ({ dich: khoaDich(r.dich) ?? '', nen: r.nen.split(':')[0]!.replace(/_(anh|link|poll)$/, ''), tk: r.tk, ngay: r.ngay?.slice(0, 10) ?? null, xem: r.xem }))
    .filter((b) => b.dich);
  const bam = await docBamBaiDang(ky).catch(() => null), khach = bam ? new Map<string, number>() : null;
  if (bam && khach) for (const [k, n] of bam) { const site = k.split('|')[1] ?? ''; const m = mienGoc(khoaDich(site) ?? ''); khach.set(m, (khach.get(m) ?? 0) + n); }
  return { site: (domain) => gopTroVe(ds, khach, ky, hom, khopSite(domain), true), duong: (url) => gopTroVe(ds, khach, ky, hom, khopDuong(url), false) };
}
