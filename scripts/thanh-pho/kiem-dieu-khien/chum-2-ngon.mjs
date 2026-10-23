import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// chụm 2 ngón lệch tâm: điểm mặt đất dưới giữa hai ngón phải đứng yên
const tep = process.argv[2], W = 393, H = 695, MX = 110, MY = 330;
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: W, height: H }, hasTouch: true }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + tep); await p.waitForTimeout(3500);
const cdp = await p.context().newCDPSession(p);
const chum = async (tu, den, quay = 0) => { const pt = (d, g) => [{ x: MX - d * Math.cos(g), y: MY - d * Math.sin(g), id: 1 }, { x: MX + d * Math.cos(g), y: MY + d * Math.sin(g), id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(tu, 0) });
  for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(tu + (den - tu) * i / 12, quay * i / 12) }); await p.waitForTimeout(30); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(1200); };
const camv = () => p.evaluate(() => JSON.parse(localStorage.getItem('tp-cam') ?? 'null'));
// điểm mặt đất dưới (MX,MY) từ camera đã lưu (fov 40)
const duoi = (v) => { const [px, py, pz] = v.p, [tx, ty, tz] = v.t; let f = [tx - px, ty - py, tz - pz]; const n = Math.hypot(...f); f = f.map((x) => x / n);
  let rr = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; const rn = Math.hypot(...rr); rr = rr.map((x) => x / rn); const u = [rr[1] * f[2] - rr[2] * f[1], rr[2] * f[0] - rr[0] * f[2], rr[0] * f[1] - rr[1] * f[0]];
  const th = Math.tan(20 * Math.PI / 180), nx = (MX / W) * 2 - 1, ny = -(MY / H) * 2 + 1; const d = [0, 1, 2].map((i) => f[i] + rr[i] * nx * th * W / H + u[i] * ny * th); const t = -py / d[1];
  return [px + d[0] * t, pz + d[2] * t].map(Math.round); };
await chum(40, 41); const v0 = await camv();
await chum(30, 120); const v1 = await camv();
await chum(120, 50, .6); const v2 = await camv();
const kc = (v) => Math.round(Math.hypot(v.p[0] - v.t[0], v.p[1] - v.t[1], v.p[2] - v.t[2]));
console.log('đất dưới giữa 2 ngón:', duoi(v0), '→ mở', duoi(v1), '→ chụm+xoay', duoi(v2), '| khoảng cách', kc(v0), kc(v1), kc(v2));
await b.close();
