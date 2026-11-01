// NỀN SẠCH cho shot code cắt giấy (01/11/2026): xoá NGƯỜI khỏi keyframe để nhân vật tách lớp (tach-lop.swift) đi lại không để lại vết.
// Vá cục bộ bằng màu xung quanh để lại vệt mờ lớn; ở đây nhờ model ảnh vẽ phần phố phía sau. Cổng rẻ nhất (ckey Nano Banana 2 ~110₫/ảnh).
// Chạy trên box3 (khoá cổng ở .env.production), ghi ảnh ra thư mục tạm rồi worker iMac kéo về:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/shot-code/xoa-nguoi.mts [--them '<vật xoá thêm, en>'] <thư-mục-ra> <tên>=<url> [<tên>=<url> …]
// --them: xoá thêm con vật / đạo cụ sẽ cử động riêng (mèo, quả bóng…) — tách nó bằng tach-lop.swift --vung trên ảnh GỐC.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sinhAnhMotCong, chuoiAnh, taNguonNgan } from '../../src/lib/xuong-video/cong-ai';

const argv = process.argv.slice(2), iThem = argv.indexOf('--them'), them = iThem >= 0 ? argv.splice(iThem, 2)[1] : '';
const PROMPT = 'Edit Image 1: remove every HUMAN figure completely (adults and children, including their hats, clothes and shadows)'
  + (them ? `, and also remove ${them}` : '') + '. '
  + 'Keep everything else exactly as it is — same framing, camera, perspective, lighting, colors and hand-drawn illustration style; keep ' + (them ? 'everything else' : 'animals') + ', bamboo poles, '
  + 'baskets, flowers, stools, tables, lanterns, trains and buildings exactly where they are. Paint in the street, rails, sleepers, gravel, doorsteps and walls '
  + 'that were hidden behind the people, continuing the surrounding lines naturally. No people anywhere. No text, letters, watermarks or logos.';

const [ra, ...ds] = argv;
if (!ra || !ds.length) { console.error('tsx xoa-nguoi.mts <thư-mục-ra> <tên>=<url> …'); process.exit(2); }
mkdirSync(ra, { recursive: true });
const cong = chuoiAnh('nano-banana-2')[0];
if (!cong) { console.error('không có cổng ảnh nào có khoá'); process.exit(1); }
let tong = 0, hong = 0;
await Promise.all(ds.map(async (x) => {
  const [ten, url] = [x.slice(0, x.indexOf('=')), x.slice(x.indexOf('=') + 1)];
  const kq = await sinhAnhMotCong(cong.cong, cong.model, { prompt: PROMPT, thamChieuUrl: [url], tiLe: '16:9' });
  if (!kq.anh) { hong++; console.log(`✗ ${ten}: ${kq.loi}`); return; }
  writeFileSync(join(ra, `${ten}.${kq.anh.mimeType.includes('png') ? 'png' : 'jpg'}`), kq.anh.data);
  tong += kq.nguon.vnd || 0;
  console.log(`✓ ${ten} · ${taNguonNgan(kq.nguon)}`);
}));
console.log(`tiền thật ~${Math.round(tong)}₫ · ${ds.length - hong}/${ds.length}`);
if (hong) process.exit(1);
