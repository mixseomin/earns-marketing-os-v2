import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// thẻ hover: lướt qua vật không bật thẻ; dừng trên vật 900 ms mới hiện (góp ý #1449); đưa chuột vào thẻ thì thẻ ở lại
const [tep] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + tep); await p.waitForTimeout(3500);
const hien = () => p.evaluate(() => !document.querySelector('.meo').hidden);
let o = null; for (let y = 250; y < 650 && !o; y += 20) for (let x = 400; x < 1200 && !o; x += 20) { await p.mouse.move(x, y); if (await p.evaluate(() => document.querySelector('canvas').style.cursor === 'pointer')) o = { x, y }; }
await p.mouse.move(5, 845); await p.waitForTimeout(900);
let bat = false; for (let i = 0; i <= 30; i++) { await p.mouse.move(o.x - 300 + i * 20, o.y); await p.waitForTimeout(16); bat ||= await hien(); }
await p.mouse.move(5, 845); await p.waitForTimeout(900);
console.log('lướt ngang qua vật:', bat ? 'BẬT THẺ — SAI' : 'không bật ✓');
await p.mouse.move(o.x, o.y); await p.waitForTimeout(500); const sau200 = await hien(); await p.waitForTimeout(700); const sau700 = await hien();
console.log('dừng trên vật: 500 ms', sau200 ? 'đã hiện — SAI' : 'chưa ✓', '· 1200 ms', sau700 ? 'hiện ✓' : 'CHƯA — SAI');
const r = await p.evaluate(() => { const m = document.querySelector('.meo').getBoundingClientRect(); return { x: m.x + 30, y: m.y + 20 }; });
await p.mouse.move(r.x, r.y, { steps: 6 }); await p.waitForTimeout(700); console.log('đưa chuột vào thẻ:', (await hien()) ? 'thẻ ở lại ✓' : 'MẤT — SAI');
await b.close();
