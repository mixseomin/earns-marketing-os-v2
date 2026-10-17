// GHÉP ĐÈ đồ nhận dạng (0đ) + SỬA VÙNG (FLUX Fill, tốn tiền) bằng mặt nạ 3D — src/lib/xuong-video/ghep-vung.ts
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ghep-vung.mts --tap=<id> --ghep [--chi=20,14]
//   … --tap=<id> --sua=<thu_tu>:<tên người>[,…] [--mo-ta="…"]   (TỐN TIỀN ~$0,05/lần — cần DUYET_SINH_1_LAN=1)
//   Kết quả là ỨNG VIÊN; thêm --chon để thành ảnh chọn (chỉ sau khi đã soát ảnh)
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { ghepNhanDang, suaVung } from '../src/lib/xuong-video/ghep-vung';
const db = getDb()!; const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3);
const tap = Number(gia('tap')); if (!tap) { console.error('thiếu --tap'); process.exit(1); }
const chi = new Set(gia('chi').split(',').filter(Boolean).map(Number));
const shots = ((await db.execute(sql`SELECT id, thu_tu FROM xv_canh WHERE tap_id = ${tap} AND keyframe_url IS NOT NULL ORDER BY thu_tu`)) as unknown as { id: number; thu_tu: number }[]).filter((c) => !chi.size || chi.has(Number(c.thu_tu)));
if (process.argv.includes('--ghep')) for (const c of shots) {
  const r = await ghepNhanDang(db, Number(c.id), process.argv.includes('--chon')); console.log(`#${c.thu_tu} ${r.ok ? `✓ ghép ${r.data.vat.join(', ')} → ${r.data.url}` : `– ${r.loi}`}`);
}
const sua = gia('sua');
if (sua) {
  if (process.env.DUYET_SINH_1_LAN !== '1') { console.error('sửa vùng TỐN TIỀN — chỉ chạy với DUYET_SINH_1_LAN=1 sau khi anh duyệt'); process.exit(1); }
  for (const x of sua.split(',')) {
    const [so, ten] = x.split(':'); const c = ((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tap} AND thu_tu = ${Number(so)}`)) as unknown as { id: number }[])[0];
    if (!c || !ten) { console.log(`✗ ${x}: không thấy shot / tên`); continue; }
    const r = await suaVung(db, Number(c.id), ten, gia('mo-ta') || undefined, process.argv.includes('--chon')); console.log(`#${so} ${ten}: ${r.ok ? `✓ ${r.data.url}` : `✗ ${r.loi}`}`);
  }
}
process.exit(0);
