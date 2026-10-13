// Tự kiểm trên box (chỉ đọc, 0đ): mỗi shot của một tập — bấm Sinh keyframe / Sinh nháp video sẽ qua hay bị chặn, vì sao — gọi ĐÚNG hàm cổng
// của nút (sinh-anh.ts › lyChanKeyframe, quy-trinh.ts › chanVideo), không tự lắp lại; kèm máy kiểm tiếng cả tập.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kiem-cong-shot.mts <tap_id…>
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';
import { chanVideo } from '../src/lib/xuong-video/quy-trinh';
import { lyChanKeyframe } from '../src/lib/xuong-video/sinh-anh';
import { locNhanh } from '../src/lib/xuong-video/kieu';
import { dongThoai } from '../src/lib/xuong-video/am-thanh';
import { kiemTieng } from '../src/lib/xuong-video/khop-giong';
const db = getDb()!;
for (const tapId of process.argv.slice(2).map(Number)) {
  const canh = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  const nv = ((await db.execute(sql`SELECT v.* FROM xv_nhan_vat v JOIN xv_tap t ON t.phim_id = v.phim_id WHERE t.id = ${tapId} ORDER BY v.id`)) as unknown as Row[]).map(mapNhanVat);
  console.log(`\n== tập ${tapId} · ${canh.length} shot · kiểm tiếng: ${kiemTieng(locNhanh(canh, 'A'), nv).join(' | ') || 'sạch'}`);
  for (const c of canh) {
    const g = await lyChanKeyframe(db, c.id);
    if (!g) { console.log(`#${c.thu_tu} không đọc được bối cảnh`); continue; }
    const vid = chanVideo(g.bc.canh, g.bc.nhanVat);
    const gi = dongThoai(c, nv).filter((d) => d.loi.trim());
    console.log(`#${c.thu_tu} [${c.trang_thai}] kf:${c.keyframe_url ? 'có' : '—'} giọng:${gi.filter((d) => d.url).length}/${gi.length} | keyframe: ${g.chan.length ? 'CHẶN ' + g.chan.join(' ; ') : 'qua'} | video: ${vid.length ? 'CHẶN ' + vid.join(' ; ') : 'qua'}`);
  }
}
process.exit(0);
