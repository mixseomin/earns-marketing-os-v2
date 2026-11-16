// HOÀN CÔNG CẢ TẬP — độc lập, chạy lúc nào cũng được (hoan-cong.ts / hoan-cong-lien.ts). Mỗi shot có clip: khung đầu + cuối của đoạn đang dùng → so với thẻ shot
// hiện tại; rồi NỐI TIẾP: trạng thái thật cuối shot trước ↔ đầu shot sau → shot nào cần chỉnh (sinh lại, hoặc sửa thẻ shot sau cho khớp thật). Tốn ~1,2¢ / shot
// (bóc + đối chiếu Gemini rẻ), clip đã hoàn công thì dùng lại (0đ). Chạy trên box3 (có khoá cổng AI):
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/hoan-cong.mts --tap=3074 [--so=15,16] [--ep]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { hoanCongShot } from '../src/lib/xuong-video/hoan-cong';
import { dongLech, lechNoiTiep, type HoanCong } from '../src/lib/xuong-video/hoan-cong-lien';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tap = Number(arg('tap')); if (!tap) { console.error('cần --tap'); process.exit(1); }
const chi = new Set((arg('so') ?? '').split(',').map(Number).filter(Boolean));
const db = getDb()!;
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
const hc = new Map<number, HoanCong | null>();
for (const c of ds) {
  if (!c.video_url) { console.log(`#${+c.thu_tu}: chưa có clip`); continue; }
  const r = chi.size && !chi.has(+c.thu_tu) ? ((c.nguon_video as { hoan_cong?: HoanCong } | null)?.hoan_cong ?? null) : await hoanCongShot(db, c.id, { ep: process.argv.includes('--ep') });
  hc.set(c.id, r && r.url === c.video_url ? r : null);
  if (chi.size && !chi.has(+c.thu_tu)) continue;
  if (!r) { console.log(`#${+c.thu_tu}: bóc hỏng`); continue; }
  const l = [...dongLech(r.dau).map((x) => ({ ...x, luc: 'đầu' })), ...dongLech(r.cuoi).map((x) => ({ ...x, luc: 'cuối' }))];
  console.log(`#${+c.thu_tu} · đoạn ${r.doan[0]}–${r.doan[1]} s · ${l.length ? `${l.length} điểm lệch thẻ shot` : 'khớp thẻ shot'}`);
  for (const x of l) console.log(`   [${x.luc}] ${x.muc} · ${x.thanh_phan}: cần «${x.du_kien.slice(0, 110)}» — thật «${x.thuc_te.slice(0, 110)}»`);
}
const nt = lechNoiTiep(ds.map((c) => ({ so: +c.thu_tu, phan_doan: c.phan_doan, hc: hc.get(c.id) ?? null })));
console.log(`\nNỐI TIẾP (trạng thái thật qua cú cắt): ${nt.length ? '' : 'không thấy lệch (trong các shot đã hoàn công)'}`); for (const x of nt) console.log(`   #${x.so}: ${x.chu}`);
process.exit(0);
