// tài nguyên: dải cảnh báo (việc gấp nhất + danh sách bấm bay tới, tự đóng), thẻ bồn khi rê, vòng hạn máy chủ · node tai-nguyen.mjs <tệp thử>.html [thư mục ảnh]
import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + process.argv[2]); await p.waitForTimeout(3000); await p.evaluate(() => { document.querySelector('.goi-y')?.remove(); document.querySelector('.ben .wg-x')?.click(); });
console.log('dải:', await p.evaluate(() => { const o = document.querySelector('.tn-canh'); return o.hidden ? 'ẩn' : o.innerText; }));
await p.click('.tn-canh > button'); await p.waitForTimeout(200); console.log('danh sách:', await p.evaluate(() => [...document.querySelectorAll('.tn-canh .ds button')].map((x) => x.innerText.replace(/\n/g, ' ')).join(' | ')));

await p.click('.tn-canh .ds button[data-i="0"]'); await p.waitForTimeout(2600); await p.evaluate(() => document.querySelector('.ngan .wg-x')?.click());
await p.keyboard.down('Shift'); await p.mouse.move(700, 425); await p.mouse.wheel(0, 300); await p.keyboard.up('Shift'); await p.mouse.move(5, 845); await p.waitForTimeout(1500);

let v = null; for (let y = 150; y < 700 && !v; y += 15) for (let x = 500; x < 1000 && !v; x += 15) { await p.mouse.move(x, y); await p.waitForTimeout(25); const d = await p.evaluate(() => document.querySelector('.tp').__dangSang()); if (d?.loai === 'binh') v = { x, y }; }
console.log('dải sau khi bay:', await p.evaluate(() => document.querySelector('.tn-canh .ds') ? 'VẪN MỞ — SAI' : 'đã đóng ✓')); if (v) await p.waitForTimeout(1300);
 console.log('thẻ bồn:', await p.evaluate(() => document.querySelector('.meo').hidden ? 'ẩn' : document.querySelector('.meo').innerText.replace(/\n/g, ' | ')));
// vòng hạn: bấm dòng "máy … còn N ngày" trong dải → bay tới toà máy, toà phải có vòng vàng / đỏ quanh chân
await p.mouse.move(5, 845); await p.click('.tn-canh > button'); await p.waitForTimeout(200);
const iMay = await p.evaluate(() => [...document.querySelectorAll('.tn-canh .ds button[data-i]')].findIndex((x) => /máy/.test(x.textContent)));
if (iMay >= 0) { await p.click(`.tn-canh .ds button[data-i="${iMay}"]`); await p.waitForTimeout(2600); console.log('vòng hạn máy chủ:', await p.evaluate(() => document.querySelector('.tp').__vongHan()) > 0 ? '✓ có vòng quanh toà máy' : '— SAI, không có vòng'); }
else console.log('vòng hạn máy chủ: bỏ qua (không có máy sắp hết hạn trong số hiện tại)');
console.log('thẻ bồn có đủ mức + còn ngày:', /Mức/.test(await p.evaluate(() => document.querySelector('.meo').innerText)) ? '✓' : '— SAI');
await b.close();
