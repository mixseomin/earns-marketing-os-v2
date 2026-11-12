// XUẤT CLIP THAM CHIẾU TỪ TRANG three.js (anh 12/11/2026 "Có dùng three xuất thành video ref được không"): mở trang xem blocking (dung-trang.py) bằng
// Chromium chạy ngầm, dựng TỪNG KHUNG theo thời điểm trong shot (không quay màn → không rớt khung, không phụ thuộc tốc độ máy), chụp canvas, ffmpeg ghép MP4.
// Mỗi shot một clip, dài max(4 s, thời lượng cắt) — video tham chiếu của Seedance cần 2–15 s, đầu ra tối thiểu 4 s. 0đ.
//   node scripts/bo-set/xem-web/xuat-clip.cjs <trang.html> <thư mục ra> [rộng=1280] [fps=24] [shot,...]
// Playwright: XV_PLAYWRIGHT=<đường dẫn gói playwright> (repo này không cài sẵn); Chromium: XV_CHROMIUM=<tệp chạy> nếu bản tải của Playwright lệch phiên bản.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require(process.env.XV_PLAYWRIGHT || 'playwright');
const [trang, ra, rongS, fpsS, chiS] = process.argv.slice(2);
const rong = Number(rongS || 1280), cao = Math.round((rong * 9) / 16 / 2) * 2, fps = Number(fpsS || 24), chi = (chiS || '').split(',').filter(Boolean).map(Number);
(async () => {
  fs.mkdirSync(ra, { recursive: true });
  const b = await chromium.launch({ ...(process.env.XV_CHROMIUM ? { executablePath: process.env.XV_CHROMIUM } : {}), args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  const loi = []; p.on('pageerror', (e) => loi.push(String(e)));
  await p.goto('file://' + path.resolve(trang)); await p.waitForFunction(() => typeof dungShot === 'function' && typeof DU === 'object');
  await p.evaluate(([w, h]) => { ve.setSize(w, h, false); may.aspect = w / h; }, [rong, cao]);
  const ds = await p.evaluate(() => DU.shot.map((s) => ({ so: s.so, giay: s.giay })));
  const kq = [];
  for (let i = 0; i < ds.length; i++) {
    if (chi.length && !chi.includes(ds[i].so)) continue;
    const giay = Math.max(4, ds[i].giay), n = Math.round(giay * fps), tm = path.join(ra, `khung-${ds[i].so}`); fs.mkdirSync(tm, { recursive: true });
    const t0 = Date.now();
    for (let f = 0; f < n; f++) {
      const url = await p.evaluate(([i, u]) => { dungShot(i, u); ve.render(canh, may); return ve.domElement.toDataURL('image/png'); }, [i, n > 1 ? f / (n - 1) : 0]);
      fs.writeFileSync(path.join(tm, `f${String(f + 1).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
    const mp4 = path.join(ra, `shot-${String(ds[i].so).padStart(2, '0')}.mp4`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-i', path.join(tm, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4]);
    fs.rmSync(tm, { recursive: true, force: true });
    kq.push({ so: ds[i].so, giay, khung: n, s: (Date.now() - t0) / 1000, mp4 });
  }
  await b.close();
  console.log(JSON.stringify({ loi, rong, cao, fps, kq }));
})();
