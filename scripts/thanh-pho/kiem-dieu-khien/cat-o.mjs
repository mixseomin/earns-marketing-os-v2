import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// chỉ vẽ phần trong khung nhìn: phóng vào một khu thì tam giác phải giảm mạnh, và ảnh có cắt ô phải y hệt ảnh vẽ đủ (không mất vật nào trong màn)
const [tep, raAnh] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + tep); await p.waitForTimeout(3500);
const T = (f, ...a) => p.evaluate(([f, a]) => document.querySelector('.tp')[f](...a), [f, a]);
const xa = await T('__thongKe'); console.log('toàn cảnh:', xa.tamGiac, 'tam giác ·', xa.lenh, 'lệnh vẽ');
const nha = { x: 900, y: 430 };   // giữa dải khu, xa bảng bên trái
await p.keyboard.down('Shift'); for (let i = 0; i < 6; i++) { await p.mouse.move(nha.x, nha.y); await p.mouse.wheel(0, -300); await p.waitForTimeout(120); } await p.keyboard.up('Shift');
await p.mouse.move(5, 845); await p.waitForTimeout(1500);
const gan = await T('__thongKe'); console.log('phóng vào khu:', gan.tamGiac, 'tam giác ·', gan.lenh, 'lệnh vẽ', gan.tamGiac < xa.tamGiac * .5 ? '✓ bỏ phần ngoài màn' : '— SAI, vẫn vẽ gần đủ');
// chụp liền hai lần cùng góc nhìn: lần đầu có cắt ô, lần hai vẽ đủ (xe / người có nhích vài điểm ảnh, nhìn bằng mắt)
const a1 = await p.locator('.tp canvas').first().screenshot(); await T('__khongCat', true); await p.waitForTimeout(400); const a2 = await p.locator('.tp canvas').first().screenshot();
const du = await T('__thongKe'); console.log('vẽ đủ cùng góc nhìn:', du.tamGiac, 'tam giác');
if (raAnh) { const fs = await import('node:fs'); fs.writeFileSync(raAnh + '-cat.png', a1); fs.writeFileSync(raAnh + '-du.png', a2); console.log('ảnh:', raAnh + '-cat.png', raAnh + '-du.png'); }
await b.close();
