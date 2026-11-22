// Lấy mặt ảnh thật 3D Google trên lưới 1 m quanh lâu đài (camera nhìn thẳng xuống cho ô chi tiết nạp đủ) rồi gọi khop-google-dom20.py so với DOM20.
//   node apps/castle/scripts/khop-google-dom20.mjs [--ghi]      (chạy trên iMac; --ghi: ghi lech vào public/du-lieu/google3d.json)
import { moTrang } from './chung.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const { pg, dong } = await moTrang({ anh3d: true, khung: { width: 1280, height: 1280 } });
let r; try {
  for (let i = 0; i < 3; i++) await pg.evaluate((c) => window.__ns.chupHaiBan(c), { p: [10, 150, -10.01], d: [0, -1, 0.0001], fov: 55, zoom: 120 });
  r = await pg.evaluate(() => { const g = window.__ns.anh3d().goc.position, ds = [];
    for (let x = -70; x <= 70; x++) for (let z = -70; z <= 70; z++) { const h = window.__ns.cao3d(x, z); if (h != null) ds.push([x, z, +h.toFixed(2)]); }
    return { goc: [g.x, g.y, g.z], ds }; });
} finally { await dong(); }
if (r.ds.length < 2000) { console.error(`✗ chỉ lấy được ${r.ds.length} điểm Google (ô chưa nạp?) — không đo`); process.exit(1); }
const f = path.join(os.tmpdir(), 'khop-google-dom20.json'); fs.writeFileSync(f, JSON.stringify(r));
console.log(`Google: ${r.ds.length} điểm · lech đang dùng (${r.goc.join(', ')})`);
execFileSync(path.join(os.homedir(), '.venvs/castle-khop/bin/python'), [new URL('./khop-google-dom20.py', import.meta.url).pathname, f, ...process.argv.slice(2)], { stdio: 'inherit' });
