// TỰ HOÀN THÀNH một tập (anh 17/10/2026): vòng tự sửa clip lỗi (tu-sua-clip.ts — viết lại prompt theo lỗi + luật, sinh lại qua cổng studio,
// máy soi tự chạy) → còn shot nào lỗi thì DỪNG, không xuất bản lỗi → sạch hết thì xuất MP4 (xuat-chay.ts) → in tổng chi phí cả phim.
// TỐN TIỀN (video ~$0.17/lần/shot) — chạy khi anh đã bảo hoàn thành phim đó.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/tu-lam-phim.mts <tap_id> [--toi-da=3]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { tuSuaClipTap } from '../src/lib/xuong-video/tu-sua-clip';
import { boiCanhTap, mapCanh, taoJob, type Row } from '../src/lib/xuong-video/doc-db';
import { chayXuat, ghiBanXuat } from '../src/lib/xuong-video/xuat-chay';
import { lookPhim } from '../src/lib/xuong-video/look';
import { docKinhThanh, loiSoiClip, locNhanh, tien } from '../src/lib/xuong-video/kieu';

if (process.env.DUYET_SINH_1_LAN !== '1') { console.error('TỐN TIỀN — cần DUYET_SINH_1_LAN=1 sau khi anh bảo'); process.exit(1); }
const db = getDb()!; const tapId = Number(process.argv[2]);
const toiDa = Number((process.argv.find((a) => a.startsWith('--toi-da=')) ?? '').split('=')[1] || 3);
const bc = await boiCanhTap(db, tapId); if (!bc) { console.error('không thấy tập'); process.exit(1); }
const phimId = bc.tap.phim_id; const kt = docKinhThanh(bc.kt);
const truoc = Number(((await db.execute(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS c FROM xv_job WHERE phim_id = ${phimId} AND tinh_chi`)) as unknown as Row[])[0]!.c);
const kq = await tuSuaClipTap(db, tapId, { toiDa, log: (s) => console.log(s) });
for (const k of kq) console.log(`#${k.thu_tu}: ${k.ket} sau ${k.lan} lần${k.loi.length ? ` — ${k.loi.join(' | ')}` : ''}`);
const canh = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh), 'A');
const conLoi = canh.filter((c) => loiSoiClip(c).length || !(c.video_cuoi_url || c.video_url));
if (conLoi.length) console.log(`✗ còn ${conLoi.length} shot lỗi (#${conLoi.map((c) => c.thu_tu).join(', #')}) — KHÔNG xuất`);
else {
  const job = await taoJob(db, { phim_id: phimId, nhan: `Xuất bản · tập ${bc.tap.so} (tự hoàn thành)`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: 'A' } });
  const x = await chayXuat({ loai: bc.loai, tiLe: kt.ti_le, nhipStopMotion: kt.nhip_stop_motion, look: lookPhim(kt), canh: ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh), nhanVat: bc.nhanVat, tap: bc.tap, qc: kt.qc, nhanh: 'A' });
  if (!x.ok) { await db.execute(sql`UPDATE xv_job SET trang_thai = 'loi', loi = ${x.loi} WHERE id = ${job}`); console.log(`✗ xuất: ${x.loi}`); }
  else { await ghiBanXuat(db, { tapId, job, nhanh: 'A', kq: x }); console.log(`✓ MP4 ${x.giay}s → ${x.url}`); for (const c of x.canhBao) console.log(`  ⚠ ${c}`); }
}
const sau = Number(((await db.execute(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS c FROM xv_job WHERE phim_id = ${phimId} AND tinh_chi`)) as unknown as Row[])[0]!.c);
console.log(`chi lượt này ${tien(sau - truoc)} · tổng cả phim #${phimId}: ${tien(sau)}`);
process.exit(conLoi.length ? 1 : 0);
