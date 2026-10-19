// THU HỒI clip Kie đã sinh xong mà bị đánh dấu hỏng "không có link video" (lỗi đọc 1080p trước 2ad1a9fe): đưa job về 'chay' rồi để
// kiemVideoTap (đúng đường studio: tải clip, ghi cảnh, tính tiền) đọc lại. 0đ thêm — clip đã nằm trên Kie, không sinh lại.
//   … NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/thu-hoi-kie.mts <tap_id…>
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { kiemVideoTap } from '../../src/lib/xuong-video/sinh-video';
const db = getDb()!;
const taps = process.argv.slice(2).map(Number);
const r = (await db.execute(sql`UPDATE xv_job j SET trang_thai = 'chay', loi = '' FROM xv_canh c WHERE c.id = j.canh_id AND c.tap_id = ANY(${`{${taps.join(',')}}`}::int[])
  AND j.provider = 'kie' AND j.loai = 'video' AND j.trang_thai = 'loi' AND j.loi LIKE '%không có link%' AND j.task_id IS NOT NULL RETURNING j.id`)) as unknown as { id: number }[];
console.log(`đưa ${r.length} job về 'chay'`);
for (let lan = 0; lan < 30; lan++) {
  for (const t of taps) await kiemVideoTap(db, t);
  const con = (await db.execute(sql`SELECT count(*)::int AS n FROM xv_job WHERE id = ANY(${`{${r.map((x) => x.id).join(',') || 0}}`}::int[]) AND trang_thai = 'chay'`)) as unknown as { n: number }[];
  if (!con[0]?.n) break;
  await new Promise((o) => setTimeout(o, 10_000));
}
const kq = (await db.execute(sql`SELECT trang_thai, count(*)::int AS n FROM xv_job WHERE id = ANY(${`{${r.map((x) => x.id).join(',') || 0}}`}::int[]) GROUP BY 1`)) as unknown as { trang_thai: string; n: number }[];
console.log(kq.map((x) => `${x.trang_thai}: ${x.n}`).join(' · '));
process.exit(0);
