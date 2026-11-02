// SOCIAL TRỎ VỀ — đọc DB (server): mọi bài đã đăng của máy đăng studio (xv_may_video.da_dang theo nền) + đích của bài + phiên khách từ bài
// (sổ phiên adfond, docBamBaiDang(ngày)). Trả hàm tra cứu cho từng loại đích; tính ở social-tro-ve-tinh.ts.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { docBamBaiDang } from '@/lib/social-truc-tiep';
import { daLenThat, gopTroVe, khoaDich, khopDuong, khopSite, lichTroVe, linkBai, mienGoc, type BaiDich, type SuKienLich, type TroVe } from './social-tro-ve-tinh';

export type OLich = ReturnType<typeof lichTroVe>;
export type TraTroVe = { site: (domain: string) => TroVe | null; duong: (url: string | null | undefined) => TroVe | null; /** lịch nhỏ menu ⋯ của site */ lich: (domain: string) => OLich };

export async function docSocialTroVe(ky: number, hom: string): Promise<TraTroVe> {
  const d = getDb(); const rong: TraTroVe = { site: () => null, duong: () => null, lich: () => [] }; if (!d) return rong;
  // mỗi (video × nền đã đăng) một bài; tài khoản = tk của máy ở nền đó (xv_may.dang[].tk), nền gốc bỏ đuôi (_anh / :acct)
  const rows = (await d.execute(sql`SELECT coalesce(v.dang->>'link', m.site_dich) AS dich, n.key AS nen, n.value->>'ngay' AS ngay, coalesce(v.dang->>'title', v.chu_de, v.slug) AS ten,
      (v.luot_xem_nen->>n.key)::int AS xem, (n.value->>'hen')::boolean AS hen, n.value->>'luc' AS luc, n.value->>'url' AS url, left(v.dang->>'description', 140) AS mo_ta,
      coalesce((SELECT x->>'tk' FROM jsonb_array_elements(m.dang) x WHERE x->>'nen' = n.key LIMIT 1), m.ma) AS tk
    FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id, jsonb_each(coalesce(v.da_dang, '{}'::jsonb)) n
    WHERE jsonb_typeof(n.value) = 'object'`)) as unknown as { dich: string | null; nen: string; ngay: string | null; ten: string | null; xem: number | null; tk: string; hen: boolean | null; luc: string | null; url: string | null; mo_ta: string | null }[];
  const nay = new Date().toISOString();
  // bài hẹn giờ trên nền chưa tới giờ: không tính là đã đăng (số Bài), lịch ghi hẹn đăng (#1511)
  const ds: BaiDich[] = rows.filter((r) => daLenThat(r, nay)).map((r) => ({ dich: khoaDich(r.dich) ?? '', nen: r.nen.split(':')[0]!.replace(/_(anh|link|poll)$/, ''), tk: r.tk, ngay: r.ngay?.slice(0, 10) ?? null, xem: r.xem }))
    .filter((b) => b.dich);
  const bam = await docBamBaiDang(ky).catch(() => null), khach = bam ? new Map<string, number>() : null;
  if (bam && khach) for (const [k, n] of bam) { const site = k.split('|')[1] ?? ''; const m = mienGoc(khoaDich(site) ?? ''); khach.set(m, (khach.get(m) ?? 0) + n); }
  // LỊCH (menu ⋯ site): đã đăng = mỗi nền một bài theo ngày đăng; làm xong = video đã xuất, chưa đăng nền nào, chưa cất; hẹn đăng = xv_lich_du_kien của máy (đích = site_dich máy)
  const lam = (await d.execute(sql`SELECT coalesce(v.dang->>'link', m.site_dich) AS dich, to_char(v.xuat_luc AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS ngay,
      coalesce(v.dang->>'title', v.chu_de, v.slug) AS ten FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id
    WHERE v.xuat_luc IS NOT NULL AND NOT coalesce(v.luu_tru, false) AND coalesce(v.da_dang, '{}'::jsonb) = '{}'::jsonb`)) as unknown as { dich: string | null; ngay: string; ten: string | null }[];
  const may = new Map(((await d.execute(sql`SELECT ma, site_dich FROM xv_may WHERE site_dich IS NOT NULL`)) as unknown as { ma: string; site_dich: string }[]).map((r) => [r.ma, r.site_dich]));
  const hen = ((await d.execute(sql`SELECT ds FROM xv_lich_du_kien`)) as unknown as { ds: { may: string; ngay: string; gio?: string; nen: string; title?: string }[] }[]).flatMap((r) => r.ds ?? []);
  const sk: SuKienLich[] = [
    ...rows.filter((r) => r.ngay).map((r) => ({ dich: khoaDich(r.dich) ?? '', loai: daLenThat(r, nay) ? 'dang' as const : 'hen' as const, ngay: r.ngay!.slice(0, 10),
      chu: `${r.nen.split(':')[0]}${r.hen && r.luc ? ` ${new Date(r.luc).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}` : ''} · ${r.ten ?? ''}${r.mo_ta ? ` — ${r.mo_ta}` : ''}`,
      url: linkBai(r.url) })),
    ...lam.map((r) => ({ dich: khoaDich(r.dich) ?? '', loai: 'lam' as const, ngay: r.ngay, chu: r.ten ?? '' })),
    ...hen.filter((x) => may.has(x.may) && x.ngay >= hom).map((x) => ({ dich: khoaDich(may.get(x.may)) ?? '', loai: 'hen' as const, ngay: x.ngay, chu: `${x.nen.split(':')[0]}${x.gio ? ` ${x.gio}` : ''} · ${x.title ?? ''}` })),
  ].filter((e) => e.dich);
  return { site: (domain) => gopTroVe(ds, khach, ky, hom, khopSite(domain), true), duong: (url) => gopTroVe(ds, khach, ky, hom, khopDuong(url), false),
    lich: (domain) => lichTroVe(sk, khopSite(domain)) };
}
