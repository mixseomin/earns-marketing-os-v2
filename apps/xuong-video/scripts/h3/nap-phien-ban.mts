// NẠP CLIP H3 LÀM PHIÊN BẢN CỦA SHOT (anh 17/11/2026: "trong studio có nhìn được phiên bản của seedance và h3 khác nhau không"). Chạy trên box3:
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/h3/nap-phien-ban.mts <ke-hoach.json>
// ke-hoach.json = [{ canh_id, tep_h3 (đường dẫn mp4 trên box3), k (độ dài clip H3 ÷ độ dài clip Seedance của cùng cụm) }]
// Mỗi shot: (1) clip ĐANG dùng chưa có trong phiên bản → thêm làm phiên bản 'Seedance' với mốc đoạn hiện tại (vao_s, toc_khop);
// (2) thêm phiên bản 'H3' (clip cụm H3 trên R2) với mốc quy theo k: vao_s × k, toc_khop × k — cùng số giây phát trên timeline, đúng đoạn của shot trong clip H3.
// KHÔNG đổi clip đang dùng; chọn qua nút phiên bản trên thẻ shot (chonPhienBan chép mốc vào ky_thuat). Chạy lại an toàn (url đã có thì bỏ qua). Một clip cụm tải lên R2 một lần.
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../../src/lib/r2';

type Muc = { canh_id: number; tep_h3: string; k: number };
const ke = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Muc[];
const db = getDb()!; const daLen = new Map<string, string>();
for (const m of ke) {
  const c = ((await db.execute(sql`SELECT thu_tu, video_url, ky_thuat, video_phien_ban FROM xv_canh WHERE id = ${m.canh_id}`)) as unknown as Record<string, unknown>[])[0];
  if (!c?.video_url) { console.log(`#${m.canh_id}: shot chưa có clip — bỏ`); continue; }
  const kt = (c.ky_thuat ?? {}) as { vao_s?: number; toc_khop?: number };
  const pb = (c.video_phien_ban ?? []) as { url: string }[];
  const vao = Number(kt.vao_s ?? 0), toc = Number(kt.toc_khop ?? 1), luc = new Date().toISOString();
  const them: Record<string, unknown>[] = [];
  if (!pb.some((x) => x.url === c.video_url)) them.push({ url: c.video_url, ban: 'nhap', nhan: 'Seedance', model: 'kie:seedance', vao_s: vao, toc_khop: toc, luc });
  let url = daLen.get(m.tep_h3);
  if (!url) { url = (await uploadToR2(`xuong-video/clip/h3-${m.tep_h3.split('/').pop()!.replace('.mp4', '')}-${Date.now()}.mp4`, readFileSync(m.tep_h3), 'video/mp4')) ?? undefined; if (url) daLen.set(m.tep_h3, url); }
  if (!url) { console.log(`#${m.canh_id}: không tải được clip H3 lên R2`); continue; }
  if (!pb.some((x) => x.url === url)) them.push({ url, ban: 'nhap', nhan: 'H3', model: 'h3:ref2va-int8-turbo', vao_s: +(vao * m.k).toFixed(3), toc_khop: +(toc * m.k).toFixed(4), luc });
  if (them.length) await db.execute(sql`UPDATE xv_canh SET video_phien_ban = coalesce(video_phien_ban, '[]'::jsonb) || ${JSON.stringify(them)}::jsonb WHERE id = ${m.canh_id}`);
  console.log(`shot #${Number(c.thu_tu)}: +${them.length} phiên bản (${them.map((x) => x.nhan).join(', ') || 'đã có'})`);
}
process.exit(0);
