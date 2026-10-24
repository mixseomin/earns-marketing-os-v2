import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// widget chuẩn (bảng trái + ngăn chi tiết): đầu cố định khi cuộn thân · nút × đóng · kéo đầu để dời · đổi cỡ từ đủ 4 cạnh + 4 góc · nhớ qua F5 · ↺ đặt lại
const [tep, S] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + tep); await p.waitForTimeout(3500);
if (await p.evaluate(() => document.querySelector('.ben').classList.contains('gon'))) await p.click('.thu');
const rect = (sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); }, sel);
const keo = async (sel, dx, dy) => { const r = await p.evaluate((s) => { const e = document.querySelector(s).getBoundingClientRect(); return [e.x + e.width / 2, e.y + e.height / 2]; }, sel);
  await p.mouse.move(r[0], r[1]); await p.mouse.down(); await p.mouse.move(r[0] + dx, r[1] + dy, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150); };
let ok = 0, tong = 0; const kt = (ten, dk) => { tong++; if (dk) ok++; console.log(dk ? '✓' : '✗ SAI', ten); };
await keo('.ben .wg-dau', 300, 80); let r = await rect('.ben'); kt(`kéo đầu dời bảng → ${r}`, r[0] > 250 && r[1] > 60);
await keo('.ben .wg-k[data-h=se]', -0, -360); // thu thấp bảng để còn chỗ thử kéo xuống
for (const [h, dx, dy, dk] of [['e', 60, 0, (a, c) => c[2] > a[2] && c[0] === a[0]], ['w', -50, 0, (a, c) => c[2] > a[2] && c[0] < a[0]], ['s', 0, 60, (a, c) => c[3] > a[3] && c[1] === a[1]], ['n', 0, -40, (a, c) => c[3] > a[3] && c[1] < a[1]],
  ['se', 30, 30, (a, c) => c[2] > a[2] && c[3] > a[3]], ['nw', -30, -30, (a, c) => c[2] > a[2] && c[3] > a[3] && c[0] < a[0] && c[1] < a[1]], ['ne', 30, -30, (a, c) => c[2] > a[2] && c[1] < a[1]], ['sw', -30, 30, (a, c) => c[2] > a[2] && c[0] < a[0] && c[3] > a[3]]]) {
  const a = await rect('.ben'); await keo(`.ben .wg-k[data-h=${h}]`, dx, dy); const c = await rect('.ben'); kt(`đổi cỡ ${h}: ${a} → ${c}`, dk(a, c)); }
await keo(".ben .wg-k[data-h=s]", 0, -380); // bảng thấp để thân phải cuộn
const d0 = await rect('.ben .wg-dau'); await p.evaluate(() => { document.querySelector('.ben .wg-than').scrollTop = 400; }); await p.waitForTimeout(100); const d1 = await rect('.ben .wg-dau');
kt(`đầu đứng yên khi cuộn thân (${d0[1]} → ${d1[1]}, thân cuộn ${await p.evaluate(() => document.querySelector('.ben .wg-than').scrollTop)})`, d0[1] === d1[1] && await p.evaluate(() => document.querySelector('.ben .wg-than').scrollTop) > 0);
const truoc = await rect('.ben'); await p.reload(); await p.waitForTimeout(3500); const sau = await rect('.ben'); kt(`nhớ qua F5 ${truoc} = ${sau}`, Math.abs(truoc[0] - sau[0]) < 3 && Math.abs(truoc[2] - sau[2]) < 3 && Math.abs(truoc[3] - sau[3]) < 3);
await p.click('.ben .wg-x'); kt('× đóng bảng, hiện ☰', await p.evaluate(() => document.querySelector('.ben').classList.contains('gon') && getComputedStyle(document.querySelector('.thu')).display !== 'none'));
await p.click('.thu'); kt('☰ mở lại bảng', await p.evaluate(() => !document.querySelector('.ben').classList.contains('gon')));
// ngăn chi tiết
let o = null; for (let y = 250; y < 650 && !o; y += 20) for (let x = 500; x < 1200 && !o; x += 20) { await p.mouse.move(x, y); if (await p.evaluate(() => document.querySelector('canvas').style.cursor === 'pointer')) o = { x, y }; }
await p.mouse.click(o.x, o.y); await p.waitForTimeout(600);
kt('ngăn có đầu + tên + ×', await p.evaluate(() => { const n = document.querySelector('.ngan'); return !n.hidden && !!n.querySelector('.wg-dau .wg-ten')?.textContent && !!n.querySelector('.wg-x') && n.querySelectorAll('.wg-k').length === 8; }));
const n0 = await rect('.ngan'); await keo('.ngan .wg-k[data-h=sw]', -60, 50); const n1 = await rect('.ngan'); kt(`ngăn đổi cỡ góc sw ${n0} → ${n1}`, n1[2] > n0[2] && n1[3] > n0[3]);
if (S) await p.screenshot({ path: S + '/widget.png' });
await p.click('.ngan .wg-x'); kt('× đóng ngăn', await p.evaluate(() => document.querySelector('.ngan').hidden));
await p.click('.dieu-mo'); await p.click('[data-d="datLai"]'); await p.waitForTimeout(400); kt(`↺ đặt lại bảng về chỗ cũ ${await rect('.ben')}`, (await rect('.ben'))[0] === 12);
console.log(`${ok}/${tong} đạt`); await b.close();
