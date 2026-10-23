import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// luật anh chốt 23/10/2026: Shift + lăn = phóng (lên = vào), lăn thường = trượt; nhấp đúp = phóng, KHÔNG chọn vật; nhấp đơn vẫn chọn
const [tep] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + tep); await p.waitForTimeout(3500);
const camv = () => p.evaluate(() => JSON.parse(localStorage.getItem('tp-cam')));
const kc = (v) => Math.round(Math.hypot(v.p[0] - v.t[0], v.p[1] - v.t[1], v.p[2] - v.t[2])), tam = (v) => v.t.map(Math.round).join(',');
await p.mouse.move(800, 400); await p.mouse.wheel(0, 30); await p.waitForTimeout(900); const v0 = await camv();
await p.keyboard.down('Shift'); for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -100); await p.waitForTimeout(50); } await p.keyboard.up('Shift'); await p.waitForTimeout(1500); const v1 = await camv();
console.log(`Shift + lăn lên ×4: khoảng cách ${kc(v0)} → ${kc(v1)} (${kc(v1) < kc(v0) ? 'VÀO ✓' : 'SAI'})`);
for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -100); await p.waitForTimeout(50); } await p.waitForTimeout(1200); const v2 = await camv();
console.log(`lăn thường ×4: khoảng cách ${kc(v1)} → ${kc(v2)} (${kc(v1) === kc(v2) ? 'giữ ✓' : 'SAI'}) · tâm ${tam(v1)} → ${tam(v2)} (${tam(v1) !== tam(v2) ? 'trượt ✓' : 'SAI'})`);
// tìm một vật bấm được
let o = null; for (let y = 250; y < 650 && !o; y += 20) for (let x = 400; x < 1200 && !o; x += 20) { await p.mouse.move(x, y); if (await p.evaluate(() => document.querySelector('canvas').style.cursor === 'pointer')) o = { x, y }; }
await p.mouse.move(5, 845); await p.waitForTimeout(500);
const v3 = await camv(); await p.mouse.dblclick(o.x, o.y); await p.waitForTimeout(1500); const v4 = await camv();
console.log(`nhấp đúp lên vật ${o.x},${o.y}: ngăn chọn ${await p.evaluate(() => (document.querySelector('.ngan').hidden ? 'đóng ✓' : 'MỞ — SAI'))} · khoảng cách ${kc(v3)} → ${kc(v4)} (${kc(v4) < kc(v3) ? 'phóng ✓' : 'SAI'})`);
let o2 = null; for (let y = 250; y < 650 && !o2; y += 20) for (let x = 400; x < 1200 && !o2; x += 20) { await p.mouse.move(x, y); if (await p.evaluate(() => document.querySelector('canvas').style.cursor === 'pointer')) o2 = { x, y }; }
await p.mouse.click(o2.x, o2.y); await p.waitForTimeout(600);
console.log('nhấp đơn lên vật: ngăn chọn', await p.evaluate(() => (document.querySelector('.ngan').hidden ? 'đóng — SAI' : 'mở ✓')));
await b.close();
