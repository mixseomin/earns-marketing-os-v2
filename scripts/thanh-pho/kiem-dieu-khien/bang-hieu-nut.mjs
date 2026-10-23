import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// mỗi khu Ethopex (một bộ tài khoản QC) có trạm bảng hiệu riêng — đếm biển đúng khu của trạm vừa bấm.
// trạm bảng hiệu trong khu Ethopex: bấm tắt mọi bảng hiệu phim; đang tắt thì rê lên sân phim lộ đúng biển đó, rời ra ẩn lại; bấm lần nữa bật lại
const [tep, S] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + tep); await p.waitForTimeout(3500);
const H = (f, a) => p.evaluate(([f, a]) => document.querySelector('.tp')[f](a), [f, a]);
if (await p.evaluate(() => document.querySelector('.ben')?.classList.contains('gon'))) await p.click('.thu');
await p.fill('.tim input', 'Ethopex'); await p.waitForTimeout(300); await p.click('.tim-ds button'); await p.waitForTimeout(2500);
await p.click('.ngan .wg-x').catch(() => {}); await p.click('.ben .wg-x'); await p.waitForTimeout(300);
const hub = await H('__hubNut'); const D = () => H('__demBien', hub); const n0 = await D(); const nut = await H('__toaDoVat', 'nut-bien'); console.log('biển đang hiện', n0, '· nút ở', nut && [Math.round(nut.x), Math.round(nut.y)]);
await p.mouse.click(nut.x, nut.y); await p.waitForTimeout(800); await p.mouse.move(5, 845); await p.waitForTimeout(400);
const n1 = await D(); console.log('bấm nút → biển hiện', n1, n1 === 0 ? '✓ tắt hết' : 'SAI'); if (S) await p.screenshot({ path: S + '/nb-tat.png' });
const san = await p.evaluate((hub) => document.querySelector(".tp").__toaDoVat("cum-phim", hub), hub); await p.mouse.move(san.x, san.y); await p.waitForTimeout(300);
const n2 = await D(); console.log('rê lên sân phim → biển hiện', n2, n2 === 1 ? '✓ lộ đúng 1' : 'SAI'); if (S) await p.screenshot({ path: S + '/nb-hover.png' });
await p.mouse.move(5, 845); await p.waitForTimeout(300); const n3 = await D(); console.log('rời ra → biển hiện', n3, n3 === 0 ? '✓ ẩn lại' : 'SAI');
const nut2 = await H('__toaDoVat', 'nut-bien'); await p.mouse.click(nut2.x, nut2.y); await p.waitForTimeout(800); const n4 = await D(); console.log('bấm lần nữa → biển hiện', n4, n4 === n0 ? '✓ bật lại hết' : 'SAI');
await b.close();
