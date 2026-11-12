// XUẤT KHUNG KEYFRAME TỪ three.js — thay 🧊 Dựng khung xám Blender (anh 13/11/2026). Mỗi shot: <so>-mau.jpg (khung mở), <so>-mau-giua.jpg, <so>-mau-ket.jpg,
// <so>-sau.png (độ sâu, xám) đúng khổ phim. Sau đó máy chủ nạp vào khung_xam: scripts/bo-set/nap-khung-three.mts. 0đ.
//   XV_PLAYWRIGHT=… XV_CHROMIUM=… node scripts/bo-set/xem-web/xuat-khung.cjs <trang.html> <thư mục ra> [rộng=1365] [tỉ lệ=16:9]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require(process.env.XV_PLAYWRIGHT || 'playwright');
const [trang, ra, rongS, tlS] = process.argv.slice(2);
const [tw, th] = (tlS || '16:9').split(':').map(Number); const rong = Number(rongS || (tw >= th ? 1365 : 768)); const cao = Math.round((rong * th) / tw / 2) * 2;
(async () => {
  fs.mkdirSync(ra, { recursive: true });
  const b = await chromium.launch({ ...(process.env.XV_CHROMIUM ? { executablePath: process.env.XV_CHROMIUM } : {}), args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } }); const loi = []; p.on('pageerror', (e) => loi.push(String(e)));
  await p.goto('file://' + path.resolve(trang)); await p.waitForFunction(() => typeof xuatKhung === 'function' && typeof DU === 'object');
  await p.evaluate(([w, h]) => { ve.setPixelRatio(1); ve.setSize(w, h, false); may.aspect = w / h; may.updateProjectionMatrix(); }, [rong, cao]);
  const ds = await p.evaluate(() => DU.shot.map((s) => s.so));
  for (let i = 0; i < ds.length; i++) {
    for (const [duoi, u, loai] of [['mau', 0, 'mau'], ['mau-giua', 0.5, 'mau'], ['mau-ket', 1, 'mau'], ['sau', 0, 'sau']]) {
      const url = await p.evaluate(([i, u, l]) => xuatKhung(i, u, l), [i, u, loai]);
      const f = path.join(ra, `${ds[i]}-${duoi}.${loai === 'sau' ? 'png' : 'jpg'}`); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
      if (loai === 'sau') execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-pix_fmt', 'gray', f + '.g.png']), fs.renameSync(f + '.g.png', f);
    }
  }
  await b.close(); console.log(JSON.stringify({ loi, rong, cao, so: ds.length }));
})();
