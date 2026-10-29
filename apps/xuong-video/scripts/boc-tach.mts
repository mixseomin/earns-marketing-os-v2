// 🧩 CHẠY CON BÓC TÁCH khung cho một/nhiều canh (boc-tach-khung.ts). Đọc keyframe → JSON mọi thứ trong khung → in (mặc định) hoặc ghi xv_canh.boc_tach (--ghi).
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/boc-tach.mts --canh=1828 [--ghi]           # bóc tách keyframe của canh
//     ../../node_modules/.bin/tsx scripts/boc-tach.mts --anh=<url>                    # bóc tách một ảnh rời (chỉ in)
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { bocTachKhung } from '../src/lib/xuong-video/boc-tach-khung';
import { duKienKhung, doiChieuKhung } from '../src/lib/xuong-video/doi-chieu-khung';
import { mapCanh, mapNhanVat, kemBienThe, type Row } from '../src/lib/xuong-video/doc-db';
import { kgCua } from '../src/lib/xuong-video/khong-gian';
import { khongGianTap } from './phieu-shot.mts';
import type { BocTachKhung, DongDoiChieu } from '../src/lib/xuong-video/kieu';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const ghi = process.argv.includes('--ghi');
const anhRoi = gia('anh'); const canhId = Number(gia('canh') || 0);
const db = getDb()!;

if (anhRoi) {
  const r = await bocTachKhung(null, null, anhRoi);
  console.log(JSON.stringify(r, null, 2));
  process.exit(r ? 0 : 1);
}
if (!canhId) { console.error('cần --canh=<id> hoặc --anh=<url>'); process.exit(1); }

const row = ((await db.execute(sql`SELECT c.*, t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${canhId}`)) as unknown as Row[])[0];
if (!row) { console.error(`không thấy canh ${canhId}`); process.exit(1); }
const c = mapCanh(row); const phimId = Number(row.phim_id);
const nhanVat = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
const kgt = await khongGianTap(c.tap_id, c.phan_doan ?? '').catch(() => null);
const kg = kgt ? kgCua(kgt, c) : null;
const out: Record<string, unknown> = {}; const dc: { dau?: DongDoiChieu[]; cuoi?: DongDoiChieu[] } = {};
for (const [luc, url] of [['dau', c.keyframe_url], ['cuoi', c.keyframe_ket]] as const) {
  if (!url) { console.log(`#${canhId} ${luc}: chưa có keyframe`); continue; }
  const r = await bocTachKhung(db, phimId, url as string);
  if (!r) { console.log(`#${canhId} ${luc}: bóc tách hỏng`); continue; }
  out[luc] = r;
  // ⚖️ đối chiếu với dự kiến tại khung đó
  const duKien = duKienKhung(c, nhanVat, kg, luc);
  const chieu = await doiChieuKhung(db, phimId, duKien, r as BocTachKhung);
  if (chieu) { dc[luc] = chieu; console.log(`  ⚖️ đối chiếu ${luc}: ${chieu.length} mục · lệch/thiếu/thừa: ${chieu.filter((x) => x.muc !== 'khớp' && x.muc !== 'gần').map((x) => `${x.thanh_phan}(${x.muc})`).join(', ') || 'không'}`); }
  console.log(`\n=== #${canhId} · khung ${luc.toUpperCase()} ===`);
  console.log(`bối cảnh: ${r.boi_canh} | ánh sáng: ${r.anh_sang} | khung: ${r.khung_hinh} · ${r.goc_may}`);
  console.log(`vật cố định: ${r.vat_co_dinh.join(', ')}`);
  for (const n of r.nguoi) console.log(`  👤 ${n.ai} [${n.vi_tri}] áo:${n.ao} · tóc:${n.toc} · trang sức:${n.trang_suc} · biểu cảm:${n.bieu_cam} · nhìn:${n.huong_nhin} · dáng:${n.dang} · cầm:${n.do_cam}`);
  for (const d of r.dao_cu) console.log(`  🧸 ${d.ten}: ${d.trang_thai} @ ${d.vi_tri}`);
  if (r.chu_tren_hinh && r.chu_tren_hinh !== 'không') console.log(`  chữ trên hình: ${r.chu_tren_hinh}`);
}
if (ghi && Object.keys(out).length) {
  await db.execute(sql`UPDATE xv_canh SET boc_tach = ${JSON.stringify({ ...out, doi_chieu: dc, luc_boc: new Date().toISOString(), tren: { dau: c.keyframe_url, cuoi: c.keyframe_ket } })}::jsonb WHERE id = ${canhId}`);
  console.log(`\n✓ đã ghi boc_tach cho canh ${canhId}`);
}
process.exit(0);
