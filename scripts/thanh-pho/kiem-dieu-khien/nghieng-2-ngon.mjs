import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// điện thoại: hai ngón cùng cuộn lên = hạ camera (nhìn ngang hơn), cuộn xuống = nâng camera; khoảng cách tới tâm nhìn giữ nguyên
const [tep] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 393, height: 695 }, hasTouch: true }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + tep); await p.waitForTimeout(3500); const cdp = await p.context().newCDPSession(p);
const cam = () => p.evaluate(() => document.querySelector('.tp').__cam());
const nghieng = (v) => { const d = [0, 1, 2].map((i) => v.p[i] - v.t[i]), n = Math.hypot(...d); return { goc: Math.round(Math.acos(d[1] / n) * 180 / Math.PI), kc: Math.round(n) }; };
const cuon = async (tu, den) => { const pt = (y) => [{ x: 150, y, id: 1 }, { x: 250, y, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(tu) });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(tu + (den - tu) * i / 10) }); await p.waitForTimeout(30); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(800); };
const a = nghieng(await cam()); await cuon(450, 300); const b2 = nghieng(await cam()); await cuon(300, 550); const c = nghieng(await cam());
console.log(`góc nghiêng (0° = nhìn thẳng xuống): ${a.goc}° → cuộn lên ${b2.goc}° (${b2.goc > a.goc ? 'hạ camera ✓' : 'SAI'}) → cuộn xuống ${c.goc}° (${c.goc < b2.goc ? 'nâng camera ✓' : 'SAI'}) · khoảng cách ${a.kc} ${b2.kc} ${c.kc}`);
await b.close();
