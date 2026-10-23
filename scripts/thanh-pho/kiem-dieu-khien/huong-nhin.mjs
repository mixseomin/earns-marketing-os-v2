import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// phóng không được đổi hướng nhìn: đo góc lệch hướng camera sau mỗi chuỗi lăn ở các góc màn (PC) và chụm ở mép (điện thoại)
const [tep] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const huong = (v) => { const d = [0, 1, 2].map((i) => v.p[i] - v.t[i]), n = Math.hypot(...d); return d.map((x) => x / n); };
const goc = (a, c) => Math.round(Math.acos(Math.min(1, a.reduce((s, x, i) => s + x * c[i], 0))) * 180 / Math.PI * 10) / 10;
{ const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
  await p.goto('file://' + tep); await p.waitForTimeout(3500); const camv = () => p.evaluate(() => JSON.parse(localStorage.getItem('tp-cam')));
  await p.mouse.move(700, 425); await p.mouse.wheel(0, -100); await p.waitForTimeout(1500); let v = await camv(); const kq = [];
  for (const [x, y, dy, n] of [[1350, 120, -100, 8], [60, 800, -100, 6], [1350, 800, 100, 10], [80, 150, -100, 10], [700, 425, 100, 12]]) {
    await p.mouse.move(x, y); for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy); await p.waitForTimeout(50); } await p.waitForTimeout(1500); const v2 = await camv(); kq.push(`(${x},${y}) ${dy < 0 ? 'vào' : 'ra'}×${n}: lệch ${goc(huong(v), huong(v2))}°`); v = v2; }
  console.log('PC', kq.join(' · ')); await p.close(); }
{ const p = await b.newPage({ viewport: { width: 393, height: 695 }, hasTouch: true }); await p.goto('file://' + tep); await p.waitForTimeout(3500);
  const camv = () => p.evaluate(() => JSON.parse(localStorage.getItem('tp-cam'))); const cdp = await p.context().newCDPSession(p);
  const chum = async (mx, my, tu, den) => { const pt = (d) => [{ x: mx - d, y: my, id: 1 }, { x: mx + d, y: my, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(tu) });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(tu + (den - tu) * i / 10) }); await p.waitForTimeout(30); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(1000); };
  await chum(196, 350, 40, 41); let v = await camv(); const kq = [];
  for (const [x, y, tu, den] of [[60, 120, 40, 150], [330, 600, 150, 40], [330, 600, 150, 40], [60, 100, 30, 160], [196, 350, 40, 160]]) { await chum(x, y, tu, den); const v2 = await camv(); kq.push(`(${x},${y}) ${den > tu ? 'mở' : 'chụm'}: lệch ${goc(huong(v), huong(v2))}°`); v = v2; }
  console.log('DT', kq.join(' · ')); }
await b.close();
