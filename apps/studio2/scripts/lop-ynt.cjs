// Xuất TỪNG LỚP của mỗi cảnh YNT bằng chính bộ dựng ban-do.html: khung nền (chỉ bản đồ) + mỗi thành phần vẽ riêng rồi lấy phần khác nền làm lớp trong suốt. 0₫.
// Chạy trên iMac: node apps/studio2/scripts/lop-ynt.cjs <thư mục ra>  → l<cảnh>-<lớp>.png + lop.json (chép ảnh vào public/v/ynt/, lop.json vào scripts/du-lieu-goc/lop/).
// Playwright lấy từ PLAYWRIGHT_DIR (mặc định bản cài sẵn của courseforge-demo trên iMac).
const path = require('path'), { chromium } = require(process.env.PLAYWRIGHT_DIR || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright'), fs = require('fs'), os = require('os');
const TRANG = path.resolve(__dirname, '../../xuong-video/scripts/lich-su/ban-do.html'), ID = 'yesterdays-news-tonight-demo-weather-desk';
const cau = JSON.parse(fs.readFileSync(`${os.homedir()}/.cache/lich-su/${ID}/cau.json`, 'utf8')), RA = process.argv[2];
const KHOA = ['to', 'vong', 'nhay', 'ten', 'duong', 'nhan', 'xe', 'nguoi', 'tranh', 'dau', 'chu_to', 'ket', 'so', '_so'];
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] }), p = await (await b.newContext({ viewport: { width: 1080, height: 1920 } })).newPage(); p.on('pageerror', (e) => console.log('LỖI TRANG', e.message));
  await p.goto('file://' + TRANG); await p.evaluate(async (c) => { window.CAU = c; await window.__dung(); }, cau);
  await p.evaluate(() => { window.__nho = (t) => { window.__seek(t); const k = document.createElement('canvas'); k.width = 360; k.height = 640; const g = k.getContext('2d'); g.drawImage(document.getElementById('c'), 0, 0, 360, 640); return [k, g.getImageData(0, 0, 360, 640)]; };
    window.__nen = (t) => { const [k, d] = window.__nho(t); window.__goc = d; return k.toDataURL('image/jpeg', 0.86).split(',')[1]; };
    window.__lop = (t) => { const [k, d] = window.__nho(t), a = window.__goc.data, o = d.data; let n = 0, x0 = 360, y0 = 640, x1 = 0, y1 = 0;
      for (let i = 0; i < o.length; i += 4) { const df = Math.max(Math.abs(o[i] - a[i]), Math.abs(o[i + 1] - a[i + 1]), Math.abs(o[i + 2] - a[i + 2])); if (df > 9) { o[i + 3] = Math.min(255, 80 + df * 9); n++; const q = i / 4, x = q % 360, y = (q - x) / 360; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } else o[i + 3] = 0; }
      k.getContext('2d').putImageData(d, 0, 0); return { n, hop: [x0, y0, x1, y1], png: k.toDataURL('image/png').split(',')[1] }; }; });
  const tuGoc = cau.tu, ndGoc = cau.nhan_dien, ra = [];
  const dat = (i, c, tu, nd) => p.evaluate(([i, c, tu, nd]) => { window.CAU.canh[i].c = c; window.CAU.tu = tu; window.CAU.nhan_dien = nd; }, [i, c, tu, nd]);
  for (let i = 0; i < cau.canh.length; i++) { const s = cau.canh[i], goc = s.c, tran = Object.fromEntries(Object.entries(goc).filter(([k]) => !KHOA.includes(k) && k !== 'nam')), nd0 = { mau: ndGoc.mau }, lop = [];
    for (const u of [0.8, 0.55, 0.95]) { const t = +s.bd + u * (s.kt - s.bd);
      if (u === 0.8) { await dat(i, tran, [], nd0); fs.writeFileSync(`${RA}/l${i + 1}-nen.jpg`, Buffer.from(await p.evaluate((t) => window.__nen(t), t), 'base64')); } else { await dat(i, tran, [], nd0); await p.evaluate((t) => window.__nen(t), t); }
      const thu = async (k, c, tu, nd) => { if (lop.some((l) => l.k === k)) return; await dat(i, c, tu, nd); const r = await p.evaluate((t) => window.__lop(t), t); if (r.n < 60) return; fs.writeFileSync(`${RA}/l${i + 1}-${k}.png`, Buffer.from(r.png, 'base64')); lop.push({ k, n: r.n, hop: r.hop, u }); };
      for (const k of KHOA) { if (goc[k] == null || k === '_so' || (Array.isArray(goc[k]) && !goc[k].length)) continue;
        if (k === 'nguoi') for (let j = 0; j < goc.nguoi.length; j++) await thu(`nguoi${j}`, { ...tran, nguoi: [goc.nguoi[j]] }, [], nd0); else await thu(k, { ...tran, [k]: goc[k] }, [], nd0); }
      if (goc.nam != null) await thu('nam', { ...tran, nam: goc.nam }, [], nd0);
      await thu('tu', tran, tuGoc, nd0); await thu('tem', tran, [], ndGoc); }
    await dat(i, goc, tuGoc, ndGoc); ra.push({ i: i + 1, lop }); console.log(i + 1, lop.map((l) => `${l.k}:${l.n}${l.u !== 0.8 ? '@' + l.u : ''}`).join(' ')); }
  fs.writeFileSync(`${RA}/lop.json`, JSON.stringify(ra)); await b.close();
})();
