// ĐO MÁY SOI trên bộ mẫu chuẩn (scripts/du-lieu/soi-mau/mau.json): tỉ lệ BẮT clip lỗi (phải 100%) + báo nhầm trên clip tốt. Chạy sau MỌI lần đổi máy soi.
// Tốn ~1¢/clip (Gemini) — dưới ngưỡng tự chạy cả bộ ~$0.2.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kiem-may-soi.mts
import { readFileSync } from 'node:fs';
import { getDb } from '@mos2/db';
import { soiBienDang } from '../src/lib/xuong-video/soi-bien-dang';

const m = JSON.parse(readFileSync('scripts/du-lieu/soi-mau/mau.json', 'utf8')) as { sp: string; loi: { url: string; dai: number; loai: string; ghi: string }[]; tot: { url: string; dai: number; ghi: string }[] };
const db = getDb()!;
let bat = 0, nham = 0, tien = 0;
const ket = await Promise.all([...m.loi.map((x) => ({ ...x, laLoi: true })), ...m.tot.map((x) => ({ ...x, laLoi: false, loai: '' }))].map(async (x) => ({ x, k: await soiBienDang(db, { url: x.url, dai: x.dai, sp: m.sp }) })));
for (const { x, k } of ket) {
  if (!k) { console.log(`?  ${x.ghi} — không soi được`); continue; }
  tien += k.cents;
  if (x.laLoi) { const ok = k.loi.length > 0; if (ok) bat++; console.log(`${ok ? '✓ bắt' : '✗ SÓT'}  ${x.ghi}${k.loi.length ? `\n      ${k.loi.join(' | ').slice(0, 220)}` : ''}`); }
  else { if (k.loi.length) nham++; console.log(`${k.loi.length ? '✗ NHẦM' : '✓ sạch'}  ${x.ghi}${k.loi.length ? `\n      ${k.loi.join(' | ').slice(0, 220)}` : ''}`); }
}
console.log(`\nBẮT ${bat}/${m.loi.length} clip lỗi · báo nhầm ${nham}/${m.tot.length} clip tốt · ${tien.toFixed(2)}¢`);
process.exit(bat === m.loi.length ? 0 : 1);
