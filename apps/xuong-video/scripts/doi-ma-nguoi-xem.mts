// Chuyển mã phiên bản của kết quả "kiểm người xem" sang mã KHÔNG tính giây (nguoi-xem.ts › maKichBan, 13/10/2026). Chỉ đổi tập mà nội dung
// vẫn y như lúc kiểm (mã cũ có giây còn khớp) — tập đã sửa sau lần kiểm thì giữ nguyên để cổng vẫn bắt kiểm lại. 0đ, chạy một lần sau deploy.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/doi-ma-nguoi-xem.mts
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { banNguoiXem, maBan, maKichBan } from '../src/lib/xuong-video/nguoi-xem';
import { locNhanh } from '../src/lib/xuong-video/kieu';
const db = getDb()!;
const taps = (await db.execute(sql`SELECT id, thu_nguoi_xem->>'ma' AS ma FROM xv_tap WHERE thu_nguoi_xem IS NOT NULL`)) as unknown as Row[];
for (const t of taps) {
  const canh = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${t.id} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  const cu = maBan(banNguoiXem(canh)); const moi = maKichBan(canh);
  if (t.ma === moi) { console.log(`tập ${t.id}: đã là mã mới`); continue; }
  if (t.ma !== cu) { console.log(`tập ${t.id}: kịch bản đã đổi sau lần kiểm — giữ nguyên (cổng vẫn bắt kiểm lại)`); continue; }
  await db.execute(sql`UPDATE xv_tap SET thu_nguoi_xem = jsonb_set(thu_nguoi_xem, '{ma}', to_jsonb(${moi}::text)) WHERE id = ${t.id}`);
  console.log(`tập ${t.id}: đổi mã ${cu} → ${moi}`);
}
process.exit(0);
