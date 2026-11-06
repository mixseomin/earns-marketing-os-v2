// VẼ TÀI SẢN CẢNH GHÉP GIẤY (mẫu video dài, 06/11/2026). Chạy trên box3 (khoá cổng ảnh ở .env.production), ckey Nano Banana 2 ~110₫/ảnh, song song 6, thử lại 3 lần:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/giay/ve-giay.mts <yeu-cau.json> <thư-mục-ra>
//   yeu-cau.json = [{ ten, prompt, ti_le: '16:9'|'3:2'|'2:3' }] → <ra>/<ten>.jpg; in tiền thật dòng cuối
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sinhAnhMotCong, chuoiAnh } from '../../../src/lib/xuong-video/cong-ai';

const [tep, ra] = process.argv.slice(2);
if (!tep || !ra) { console.error('tsx ve-giay.mts <yeu-cau.json> <ra>'); process.exit(2); }
mkdirSync(ra, { recursive: true });
const ds = JSON.parse(readFileSync(tep, 'utf8')) as { ten: string; prompt: string; ti_le: string }[], c = chuoiAnh('nano-banana-2')[0]!;
let tong = 0, hong = 0, i = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (i < ds.length) { const v = ds[i++];
  let r = await sinhAnhMotCong(c.cong, c.model, { prompt: v.prompt, thamChieuUrl: [], tiLe: v.ti_le });
  for (let lan = 2; !r.anh && lan <= 3; lan++) { await new Promise((o) => setTimeout(o, 4000 * lan)); r = await sinhAnhMotCong(c.cong, c.model, { prompt: v.prompt, thamChieuUrl: [], tiLe: v.ti_le }); }
  if (!r.anh) { hong++; console.log(`✗ ${v.ten}: ${r.loi}`); continue; }
  writeFileSync(join(ra, `${v.ten}.jpg`), r.anh.data); tong += r.nguon.vnd || 0; console.log(`✓ ${v.ten}`); } }));
console.log(`${ds.length - hong}/${ds.length} ảnh ~${Math.round(tong)}₫`);
if (hong) process.exit(1);
