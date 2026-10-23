import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// điểm đất dưới con trỏ / ngón lúc bấm phải nằm đúng dưới con trỏ / ngón lúc thả (kéo trượt neo đất); kéo trái thường vẫn xoay
const [tep] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const datDuoi = (v, W, H, X, Y) => { const [px, py, pz] = v.p, [tx, ty, tz] = v.t; let f = [tx - px, ty - py, tz - pz]; const n = Math.hypot(...f); f = f.map((x) => x / n);
  let rr = [-f[2], 0, f[0]]; const rn = Math.hypot(...rr); rr = rr.map((x) => x / rn); const u = [rr[1] * f[2] - rr[2] * f[1], rr[2] * f[0] - rr[0] * f[2], rr[0] * f[1] - rr[1] * f[0]];
  const th = Math.tan(20 * Math.PI / 180), nx = (X / W) * 2 - 1, ny = -(Y / H) * 2 + 1; const d = [0, 1, 2].map((i) => f[i] + rr[i] * nx * th * W / H + u[i] * ny * th); const t = -py / d[1];
  return [px + d[0] * t, pz + d[2] * t].map(Math.round); };
const huong = (v) => { const d = [0, 1, 2].map((i) => v.p[i] - v.t[i]), n = Math.hypot(...d); return d.map((x) => (x / n).toFixed(3)).join(','); };
{ const W = 1400, H = 850, p = await b.newPage({ viewport: { width: W, height: H } }); p.on('pageerror', (e) => console.log('LOI', e.message)); await p.goto('file://' + tep); await p.waitForTimeout(3500);
  const camv = () => p.evaluate(() => JSON.parse(localStorage.getItem('tp-cam')));
  await p.mouse.move(700, 425); for (let i = 0; i < 4; i++) (await p.keyboard.down('Shift'), await p.mouse.wheel(0, -100), await p.keyboard.up('Shift')); await p.waitForTimeout(1500);
  for (const [ten, nut, phim] of [['chuột phải', 'right', null], ['Shift + kéo trái', 'left', 'Shift']]) { const v0 = await camv(); const G0 = datDuoi(v0, W, H, 500, 300);
    if (phim) await p.keyboard.down(phim); await p.mouse.move(500, 300); await p.mouse.down({ button: nut }); await p.mouse.move(900, 600, { steps: 15 }); await p.mouse.up({ button: nut }); if (phim) await p.keyboard.up(phim);
    await p.waitForTimeout(800); const v1 = await camv(); console.log(`PC ${ten}: đất lúc bấm`, G0, '→ dưới con trỏ lúc thả', datDuoi(v1, W, H, 900, 600), '· hướng nhìn giữ:', huong(v0) === huong(v1)); }
  const v0 = await camv(); await p.mouse.move(500, 300); await p.mouse.down(); await p.mouse.move(800, 300, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(1200); const v1 = await camv();
  console.log('PC kéo trái thường: hướng nhìn đổi (xoay) =', huong(v0) !== huong(v1)); await p.close(); }
{ const W = 393, H = 695, p = await b.newPage({ viewport: { width: W, height: H }, hasTouch: true }); await p.goto('file://' + tep); await p.waitForTimeout(3500);
  const camv = () => p.evaluate(() => JSON.parse(localStorage.getItem('tp-cam'))); const cdp = await p.context().newCDPSession(p);
  const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await t('touchStart', [{ x: 100, y: 300, id: 1 }, { x: 140, y: 300, id: 2 }]); await t('touchMove', [{ x: 99, y: 300, id: 1 }, { x: 141, y: 300, id: 2 }]); await t('touchEnd', []); await p.waitForTimeout(1000);
  const v0 = await camv(), G0 = datDuoi(v0, W, H, 120, 250);
  await t('touchStart', [{ x: 120, y: 250, id: 1 }]); for (let i = 1; i <= 12; i++) { await t('touchMove', [{ x: 120 + 150 * i / 12, y: 250 + 200 * i / 12, id: 1 }]); await p.waitForTimeout(25); } await t('touchEnd', []); await p.waitForTimeout(1000);
  const v1 = await camv(); console.log('ĐT 1 ngón: đất lúc chạm', G0, '→ dưới ngón lúc thả', datDuoi(v1, W, H, 270, 450), '· hướng nhìn giữ:', huong(v0) === huong(v1)); }
await b.close();
