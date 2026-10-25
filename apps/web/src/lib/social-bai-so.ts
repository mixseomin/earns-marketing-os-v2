// SỐ ĐO TỪNG BÀI FACEBOOK (anh 25/10/2026: "có lấy được views vào bài viết không? kể cả bài post, ảnh"): Graph API post insights cho MỌI Page
// trong sổ token box3 (/root/.secrets/fb-pages.json) — một lệnh mỗi Page (/posts + insights lồng), 42 ngày gần nhất. Không có lịch chạy riêng:
// trang Lịch đọc bảng bai_so, số cũ hơn 3 giờ thì khởi một lượt làm mới chạy kèm (không chặn trang), một lượt một lúc.
import 'server-only';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';

const SO = process.env.FB_PAGES_FILE || '/root/.secrets/fb-pages.json', G = 'https://graph.facebook.com/v23.0', CU_MS = 3 * 3600e3;
let dangChay: Promise<number> | null = null;
/** khoá bài để khớp sổ đăng ↔ số đo: mã reel/video, còn lại link không đuôi '/' */
export const khoaBai = (u: string | null | undefined) => (u ? (u.match(/(?:reel|shorts|video|videos)\/([\w-]+)/)?.[1] ?? u.replace(/\/+$/, '')) : '');

type Bai = { id?: string; permalink_url?: string; created_time?: string; insights?: { data?: { name: string; values?: { value?: number }[] }[] } };
async function docTrang(pageId: string, token: string, tu: number): Promise<{ id: string | null; url: string; xem: number | null; bam: number | null; luc: string | null }[]> {
  const ra: { id: string | null; url: string; xem: number | null; bam: number | null; luc: string | null }[] = [];
  let u: string | null = `${G}/${pageId}/posts?${new URLSearchParams({ fields: 'id,permalink_url,created_time,insights.metric(post_media_view,post_clicks)', since: String(tu), limit: '100', access_token: token })}`;
  for (let trang = 0; u && trang < 5; trang++) {
    const r = await fetch(u, { signal: AbortSignal.timeout(20_000) }), j = (await r.json()) as { data?: Bai[]; paging?: { next?: string }; error?: { message: string } };
    if (j.error) throw new Error(j.error.message);
    for (const b of j.data ?? []) {
      if (!b.permalink_url) continue;
      const so = (m: string) => { const v = b.insights?.data?.find((x) => x.name === m)?.values?.[0]?.value; return typeof v === 'number' ? v : null; };
      ra.push({ id: b.id ?? null, url: b.permalink_url, xem: so('post_media_view'), bam: so('post_clicks'), luc: b.created_time ?? null });
    }
    u = j.paging?.next ?? null;
  }
  return ra;
}
/** làm mới bai_so cho mọi Page có token; trả số bài đã ghi. Page lỗi (token hết hạn…) bỏ qua, Page khác vẫn chạy. */
export async function lamMoiSoBaiFb(): Promise<number> {
  const d = getDb(); if (!d) return 0;
  let so: Record<string, { ten?: string; token?: string }>; try { so = JSON.parse(readFileSync(SO, 'utf8')); } catch { return 0; }
  const tu = Math.floor((Date.now() - 42 * 86400e3) / 1000), ds = Object.entries(so).filter(([, t]) => t.token);
  let n = 0, loi = 0;
  for (let i = 0; i < ds.length; i += 6) {
    await Promise.all(ds.slice(i, i + 6).map(async ([id, t]) => {
      try {
        const bs = await docTrang(id, t.token!, tu);
        for (const b of bs) {
          await d.execute(sql`INSERT INTO bai_so (url, nen, page_id, post_id, xem, bam, dang_luc, cap_nhat) VALUES (${b.url}, 'facebook', ${id}, ${b.id}, ${b.xem}, ${b.bam}, ${b.luc}, now())
            ON CONFLICT (url) DO UPDATE SET xem = excluded.xem, bam = excluded.bam, post_id = excluded.post_id, cap_nhat = now()`);
          n++;
        }
      } catch { loi++; }
    }));
  }
  if (loi) console.warn(`[bai_so] ${loi}/${ds.length} Page đọc lỗi`);
  return n;
}
export type SoBai = { xem: number | null; bam: number | null; url: string };
/** số đo bài Facebook, khoá theo khoaBai(link) VÀ theo mã bài <page_id>_<id> (bài hẹn giờ chỉ biết mã); số cũ quá 3 giờ (hoặc chưa có) thì khởi làm mới chạy kèm */
export async function docSoBaiFb(): Promise<Map<string, SoBai>> {
  const d = getDb(); if (!d) return new Map();
  const rows = (await d.execute(sql`SELECT url, post_id, xem, bam, extract(epoch FROM cap_nhat) * 1000 AS luc FROM bai_so WHERE nen = 'facebook'`)) as unknown as { url: string; post_id: string | null; xem: number | null; bam: number | null; luc: number }[];
  const moi = rows.reduce((m, r) => Math.max(m, Number(r.luc)), 0);
  if (Date.now() - moi > CU_MS && !dangChay) dangChay = lamMoiSoBaiFb().catch(() => 0).finally(() => { dangChay = null; });
  return new Map(rows.flatMap((r) => { const v = { xem: r.xem, bam: r.bam, url: r.url }; return r.post_id ? [[khoaBai(r.url), v], [r.post_id, v]] as const : [[khoaBai(r.url), v]] as const; }));
}
