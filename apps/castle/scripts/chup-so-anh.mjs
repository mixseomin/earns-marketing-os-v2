#!/usr/bin/env node
// CHỤP MÔ HÌNH ĐÚNG CAMERA CÁC ẢNH SO (du-lieu/<lâu>-anh.json có camera) — đầu vào cho scripts/kiem-vien.py (so đường viền trời).
// Chạy trên iMac: node apps/castle/scripts/chup-so-anh.mjs <thư mục ra>. Tự mở máy chủ tĩnh cổng 18777, ảnh 3D tắt, rừng ẩn.
// tra-repo-ok: công cụ nội bộ của cảnh, gọi hàm có sẵn trong trang (__ns.moSo).
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { GOC, PUB, LAU, du, doiSo, moTrang } from './chung.mjs';
import { join } from 'node:path';
const RA = doiSo[0] || '/tmp/chup-so-anh';
mkdirSync(RA, { recursive: true });
const { pg, dong } = await moTrang({ anh3d: false, khung: { width: 1920, height: 1440 } });
await pg.waitForTimeout(6000); // lớp nền chạy sau (ảnh dán tường, ảnh chiếu lên mái) — chờ xong mới chụp
const ds = await pg.evaluate(() => window.__ns.ANH.map((a, i) => ({ i, tep: a.tep, coCam: !!a.camera })));
const ra = [];
for (const a of ds.filter((a) => a.coCam)) {
  const k = await pg.evaluate((i) => { const n = window.__ns; n.moSo(i); 
    for (const id of ['so', 'dau', 'nguon', 'bd', 'nut']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } document.getElementById('so-anh').style.opacity = 0;
    const r = n.renderer.domElement.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }, a.i);
  await pg.waitForTimeout(2500);
  const tep = join(RA, `mo-hinh-${a.i}.png`); await pg.screenshot({ path: tep, clip: k }); ra.push({ i: a.i, anh: join(PUB, 'du-lieu', a.tep), moHinh: tep });
}
writeFileSync(join(RA, 'ds.json'), JSON.stringify(ra)); console.log(JSON.stringify(ra));
await dong();
