// Tự kiểm trên box (chỉ đọc, 0đ): mỗi shot của một tập — bấm Sinh keyframe / Sinh nháp video / Sinh giọng sẽ qua hay bị chặn, vì sao.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kiem-cong-shot.mts <tap_id…>
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boiCanhCanh, mapTap, mapCanh, mapNhanVat, kemBienThe, type Row } from '../src/lib/xuong-video/doc-db';
import { chanTienKy, chanShot, chanVideo } from '../src/lib/xuong-video/quy-trinh';
import { chanChuModel, thanhPhanCanh, locNhanh } from '../src/lib/xuong-video/kieu';
import { dongThoai } from '../src/lib/xuong-video/am-thanh';
import { kiemTieng } from '../src/lib/xuong-video/khop-giong';
const db = getDb()!;
for (const tapId of process.argv.slice(2).map(Number)) {
  const tap = mapTap(((await db.execute(sql`SELECT * FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0]!);
  const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${tap.phim_id} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const canh = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  console.log(`\n== tập ${tapId} · kiểm tiếng: ${kiemTieng(locNhanh(canh, 'A'), nv).join(' | ') || 'sạch'}`);
  console.log(`== tập ${tapId} (phim ${tap.phim_id}) · ${canh.length} shot`);
  for (const c of canh) {
    const bc = await boiCanhCanh(db, c.id);
    if (!bc) { console.log(`#${c.thu_tu} không đọc được bối cảnh`); continue; }
    const ds = locNhanh(canh, c.nhanh || 'A');
    const kf = [...chanTienKy(tap, { phong_cach: bc.kt.phong_cach, laQc: false, logline: bc.kt.logline, series: bc.kt.series }, ds), ...chanShot(bc.canh, tap, nv), chanChuModel(bc.kt.ngon_ngu, { phongCach: bc.kt.phong_cach, shot: bc.canh, anchor: bc.nhanVat }) ?? '', ...thanhPhanCanh(bc.canh, bc.nhanVat).thieu].filter(Boolean);
    const vid = chanVideo(bc.canh, bc.nhanVat);
    const g = dongThoai(c, nv).filter((d) => d.loi.trim());
    console.log(`#${c.thu_tu} [${c.trang_thai}] kf:${c.keyframe_url ? 'có' : '—'} giọng:${g.filter((d) => d.url).length}/${g.length} | keyframe: ${kf.length ? 'CHẶN ' + kf.join(' ; ') : 'qua'} | video: ${vid.length ? 'CHẶN ' + vid.join(' ; ') : 'qua'}`);
  }
}
process.exit(0);
