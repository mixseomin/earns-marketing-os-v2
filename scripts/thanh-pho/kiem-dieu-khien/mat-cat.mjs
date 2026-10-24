// toà mặt cắt (Công ty AI, Ethopex mỗi bộ): ở xa chỉ vỏ, tới gần thì vỏ ẩn + ruột / hầm hiện; rê vào một phòng ra thẻ phòng · node mat-cat.mjs <tệp thử>.html [thư mục ảnh]
import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
const [tep, raAnh] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
for (const [ten, vp] of [['may', { width: 1400, height: 850 }], ['dt', { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
  const { isMobile, hasTouch, ...kho } = vp;
  const p = await b.newPage({ viewport: kho, isMobile, hasTouch }); p.on('pageerror', (e) => console.log('LOI', e.message));
  await p.goto('file://' + tep); await p.waitForTimeout(3000); await p.evaluate(() => { document.querySelector('.goi-y')?.remove(); document.querySelector('.ben .wg-x')?.click(); });
  const mc = () => p.evaluate(() => document.querySelector('.tp').__matCat(null));
  console.log(`[${ten}] toàn cảnh:`, (await mc()).map((o) => (o.gan ? 'MỞ — SAI' : 'đóng ✓')).join(' · '));
  await p.evaluate(() => { document.querySelector('.thu')?.click(); const i = document.querySelector('.tim input'); i.value = 'Công ty AI'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('.tim-ds button')?.click(); }); await p.waitForTimeout(2800); await p.evaluate(() => { document.querySelector('.ngan .wg-x')?.click(); document.querySelector('.ben .wg-x')?.click(); }); await p.mouse.move(2, 2); await p.waitForTimeout(800);
  const m = await mc(); console.log(`[${ten}] tới Công ty AI:`, m[0]?.gan ? `✓ mở (${m[0].trong} vật ruột)` : '— SAI, chưa mở', JSON.stringify(m[0]));
  if (raAnh) await p.screenshot({ path: `${raAnh}/mc-${ten}.png` });
  if (ten === 'may') { let the = null; for (let y = 200; y < 700 && !the; y += 18) for (let x = 400; x < 1000 && !the; x += 18) { await p.mouse.move(x, y); await p.waitForTimeout(20); const d = await p.evaluate(() => document.querySelector('.tp').__dangSang()); if (d?.loai === 'phong') the = { x, y }; }
    if (the) await p.waitForTimeout(1300); console.log('rê vào phòng:', the ? '✓ ' + (await p.evaluate(() => document.querySelector('.meo').innerText.split('\n')[0])) : '— SAI, không trúng phòng nào'); }
  await p.close();
}
await b.close();
