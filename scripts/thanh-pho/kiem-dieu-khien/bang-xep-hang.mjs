import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// bảng xếp hạng phim mỗi khu Ethopex: mặc định gọn một dòng; rê lên biển → mở đủ bảng; rời ra → gọn lại; không bật thêm thẻ hover chồng lên
const [tep, S] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + tep); await p.waitForTimeout(3500);
if (!(await p.evaluate(() => document.querySelector('.ben').classList.contains('gon')))) await p.click('.ben .wg-x');
const hub = await p.evaluate(() => document.querySelector('.tp').__hubNut()); const bx = () => p.evaluate((h) => document.querySelector('.tp').__bangXh(h), hub);
let v = await bx(); await p.mouse.move(v.x, v.y); await p.keyboard.down('Shift'); for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, -100); await p.waitForTimeout(50); } await p.keyboard.up('Shift'); await p.waitForTimeout(1500);
await p.mouse.move(5, 300); await p.waitForTimeout(300); v = await bx(); console.log('mặc định:', v.mo ? 'MỞ — SAI' : 'gọn ✓'); if (S) await p.screenshot({ path: S + '/bxh-gon.png' });
await p.mouse.move(v.x, v.y); await p.waitForTimeout(300); console.log('rê lên biển 300 ms:', (await bx()).mo ? 'MỞ NGAY — SAI' : 'chưa mở ✓ (đang chờ)'); await p.waitForTimeout(1000); const v2 = await bx(); const the = await p.evaluate(() => !document.querySelector('.meo').hidden);
console.log('rê lên biển:', v2.mo ? 'mở đủ ✓' : 'VẪN GỌN — SAI', '· thẻ hover chồng:', the ? 'CÓ — SAI' : 'không ✓'); if (S) await p.screenshot({ path: S + '/bxh-mo.png' });
const toaNen = (await p.evaluate((h) => document.querySelector('.tp').__toaDoDich('nen', h), hub))[0]; if (!toaNen) console.log('rê vào toà nền tảng: SAI — không thấy toà trong màn'); else { await p.mouse.move(5, 300); await p.waitForTimeout(400); await p.mouse.move(toaNen.x, toaNen.y); await p.waitForTimeout(1300); console.log('rê vào toà nền tảng:', (await bx()).mo ? 'BẢNG MỞ — SAI' : 'bảng vẫn gọn ✓ (chỉ thẻ toà)'); }
await p.mouse.move(5, 300); await p.waitForTimeout(300); console.log('rời ra:', (await bx()).mo ? 'VẪN MỞ — SAI' : 'gọn lại ✓');
await b.close();
