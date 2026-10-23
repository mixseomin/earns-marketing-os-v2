import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// chỉ vẽ phần trong khung nhìn + bỏ chi tiết < 2 điểm ảnh khi nhìn xa: toàn cảnh và phóng vào khu đều phải giảm tam giác so với vẽ đủ, ảnh có cắt ≈ ảnh vẽ đủ
const [tep, raAnh] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + tep); await p.waitForTimeout(3500);
const T = (f, ...a) => p.evaluate(([f, a]) => document.querySelector('.tp')[f](...a), [f, a]);
const xa = await T('__thongKe'); await T('__khongCat', true); await p.waitForTimeout(400); const xaDu = await T('__thongKe'); const xaA2 = await p.locator('.tp canvas').first().screenshot(); await T('__khongCat', false); await p.waitForTimeout(400); const xaA1 = await p.locator('.tp canvas').first().screenshot();
console.log('toàn cảnh: vẽ đủ', xaDu.tamGiac, 'tam giác ·', xaDu.lenh, 'lệnh → có cắt', xa.tamGiac, '·', xa.lenh, xa.lenh < xaDu.lenh * .8 ? '✓ bớt chi tiết nhỏ' : '— SAI, không bớt');
const nha = { x: 900, y: 430 };   // giữa dải khu, xa bảng bên trái
await p.keyboard.down('Shift'); for (let i = 0; i < 6; i++) { await p.mouse.move(nha.x, nha.y); await p.mouse.wheel(0, -300); await p.waitForTimeout(120); } await p.keyboard.up('Shift');
await p.mouse.move(5, 845); await p.waitForTimeout(1500);
const gan = await T('__thongKe');
// chụp liền hai lần cùng góc nhìn: lần đầu có cắt ô, lần hai vẽ đủ (xe / người có nhích vài điểm ảnh, nhìn bằng mắt)
const a1 = await p.locator('.tp canvas').first().screenshot(); const gan2 = await T('__thongKe'); await T('__khongCat', true); await p.waitForTimeout(400); const a2 = await p.locator('.tp canvas').first().screenshot();
const du = await T('__thongKe'); console.log('phóng vào khu: vẽ đủ', du.tamGiac, 'tam giác → có cắt', gan.tamGiac, '·', gan.lenh, 'lệnh', gan.tamGiac < du.tamGiac * .5 ? '✓ bỏ phần ngoài màn' : '— SAI, vẫn vẽ gần đủ');
if (raAnh) { const fs = await import('node:fs'); fs.writeFileSync(raAnh + '-cat.png', a1); fs.writeFileSync(raAnh + '-du.png', a2); fs.writeFileSync(raAnh + '-xa-cat.png', xaA1); fs.writeFileSync(raAnh + '-xa-du.png', xaA2); console.log('ảnh:', raAnh + '-cat.png', raAnh + '-du.png'); }
await b.close();
