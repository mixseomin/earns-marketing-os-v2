// SHOP — tải ảnh quảng cáo đối thủ (link fbcdn ký, hết hạn sau vài ngày) về media_assets để xem lâu dài trong /shop › Đối thủ.
// Dùng lại kho ảnh chung (media_assets + /api/media/<id>/raw có thu nhỏ) — không dựng kho thứ hai. Gọi từ cron /api/cron/shop.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

const MAX = 4 * 1024 * 1024;

export async function luuMediaDoiThu(gioiHan = 30) {
  const d = getDb();
  if (!d) return { luu: 0, loi: 0 };
  const ds = (await d.execute(sql`
    SELECT q.id, q.media, dt.ten,
           (SELECT c.project_id FROM shop_doi_thu_sp s JOIN shop_san_pham p ON p.id = s.san_pham_id JOIN shop_cua_hang c ON c.id = p.cua_hang_id
             WHERE s.doi_thu_id = q.doi_thu_id AND s.san_pham_id IS NOT NULL ORDER BY (s.id = q.doi_thu_sp_id) DESC LIMIT 1) AS project_id
      FROM shop_doi_thu_qc q JOIN shop_doi_thu dt ON dt.id = q.doi_thu_id
     WHERE q.media ~ '^https?://' AND q.media_id IS NULL AND q.media_loi IS NULL ORDER BY q.id LIMIT ${gioiHan}`)) as unknown as { id: number; media: string; ten: string; project_id: string | null }[];
  let luu = 0, loi = 0;
  for (const x of ds) {
    try {
      const r = await fetch(x.media, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'Mozilla/5.0' } });
      const mime = (r.headers.get('content-type') ?? '').split(';')[0]!.trim();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (!mime.startsWith('image/')) throw new Error(`không phải ảnh (${mime || 'không rõ'})`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX) throw new Error(`ảnh quá lớn ${Math.round(buf.length / 1024)} KB`);
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'img';
      const [m] = (await d.execute(sql`
        INSERT INTO media_assets (project_id, kind, filename, url, mime_type, size_bytes, tags, notes, source, category)
        VALUES (${x.project_id}, 'image', ${`doi-thu-qc-${x.id}.${ext}`}, ${`data:${mime};base64,${buf.toString('base64')}`}, ${mime}, ${buf.length},
                ${JSON.stringify(['doi_thu', x.ten])}::jsonb, ${`QC đối thủ ${x.ten} — shop_doi_thu_qc #${x.id}`}, 'doi_thu', 'doi_thu')
        RETURNING id`)) as unknown as { id: number }[];
      await d.execute(sql`UPDATE shop_doi_thu_qc SET media_id = ${m!.id} WHERE id = ${x.id}`);
      luu++;
    } catch (e) {
      await d.execute(sql`UPDATE shop_doi_thu_qc SET media_loi = ${(e as Error).message.slice(0, 200)} WHERE id = ${x.id}`);
      loi++;
    }
  }
  return { luu, loi };
}
