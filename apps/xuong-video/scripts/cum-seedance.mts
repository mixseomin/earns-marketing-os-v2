// KẾ HOẠCH CỤM SEEDANCE của một tập (0đ, chỉ đọc) — anh 14/11/2026 "tổ chức lại cụm video để sinh". Chia cụm cân trong từng phân cảnh (cum-shot.ts › chiaCumCan,
// trần 15 s của Seedance 2.0), đặt tên A, B, C…, ước giá Kie (có video vào: $0,034/s 480p · $0,075/s 720p × (giây vào + giây ra)).
// Dòng cuối là JSON cho scripts/bo-set/cum-seedance-tap.sh (iMac: dựng clip 3D nối của một cụm rồi gửi thu-seedance-cum.mts).
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cum-seedance.mts --tap=3074 [--dpg=480p]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { chiaCumCan } from '../src/lib/xuong-video/cum-shot';
import { giayPhat } from '../src/lib/xuong-video/kieu';

const arg = (k: string, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const tap = Number(arg('tap')); const dpg = arg('dpg', '480p'); if (!tap) { console.error('cần --tap'); process.exit(1); }
const db = getDb()!;
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
const gia = dpg === '720p' ? 7.5 : 3.4;
const cum = chiaCumCan(ds, 15).map((c, i) => {
  const tong = c.reduce((a, x) => a + giayPhat(x), 0); const ra = Math.max(4, Math.ceil(tong));
  const thieu = c.filter((x) => !(x.khung_xam?.clip && x.khung_xam.clip.ma === x.khung_xam.ma) || !x.keyframe_url).map((x) => x.thu_tu);
  return { ten: String.fromCharCode(65 + i), phan_doan: c[0]!.phan_doan, shot: c.map((x) => ({ id: x.id, so: x.thu_tu, phat: giayPhat(x), clip: x.khung_xam?.clip?.url ?? null, vao: x.khung_xam?.clip?.vao ?? 0 })),
    tong: +tong.toFixed(2), ra, cents: +(gia * (tong + ra)).toFixed(1), thieu };
});
for (const c of cum) console.log(`cụm ${c.ten} · ${c.phan_doan} · #${c.shot.map((x) => x.so).join(' #')} · ${c.tong} s → clip ${c.ra} s · ~${c.cents}¢${c.thieu.length ? ` · THIẾU clip 3D / keyframe: #${c.thieu.join(' #')}` : ''}`);
console.log(`tổng ~${cum.reduce((a, c) => a + c.cents, 0).toFixed(1)}¢ (${dpg})`);
console.log(JSON.stringify(cum));
process.exit(0);
