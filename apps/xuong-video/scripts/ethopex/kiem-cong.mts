// KIỂM KHÔ cổng keyframe (0đ): gọi đúng lyChanKeyframe của studio cho mọi cảnh của các tập → in mọi lý do chặn, gom theo lỗi.
//   … NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/kiem-cong.mts <tap_id…>
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { lyChanKeyframe } from '../../src/lib/xuong-video/sinh-anh';
const db = getDb()!;
const dem = new Map<string, string[]>();
for (const tap of process.argv.slice(2).map(Number)) {
  const ds = (await db.execute(sql`SELECT id, thu_tu, keyframe_url FROM xv_canh WHERE tap_id = ${tap} ORDER BY thu_tu`)) as unknown as { id: number; thu_tu: number; keyframe_url: string | null }[];
  for (const c of ds) {
    if (c.keyframe_url) continue;
    const g = await lyChanKeyframe(db, c.id);
    for (const l of (g?.chan ?? ['không thấy cảnh']).flatMap((x) => x.replace(/^Shot #\d+ chưa qua quy trình: /, '').split('; '))) {
      const k = l.replace(/#\d+/g, '#N').slice(0, 220); dem.set(k, [...(dem.get(k) ?? []), `${tap}#${c.thu_tu}`]);
    }
  }
}
for (const [k, v] of [...dem].sort((a, b) => b[1].length - a[1].length)) console.log(`${String(v.length).padStart(3)} × ${k}  [${v.slice(0, 4).join(' ')}${v.length > 4 ? ' …' : ''}]`);
if (!dem.size) console.log('✓ mọi cảnh qua cổng keyframe');
process.exit(0);
