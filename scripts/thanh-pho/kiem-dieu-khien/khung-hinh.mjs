import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
// nóng máy: ngồi nhìn lâu (> 12 s không chạm) thì thưa khung (~4/s); chạm là tỉnh lại đủ khung · khổ điện thoại có cảm ứng
const [tep] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }); p.on('pageerror', (e) => console.log('LOI', e.message));
// tệp thử không có thẻ viewport (artifact tự bọc lúc đăng, Next tự thêm trên city.on.tc) → gắn vào để khổ giống điện thoại thật
await p.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width,initial-scale=1">')));
await p.goto('file://' + tep); await p.waitForTimeout(2000);
const dem = () => p.evaluate(() => document.querySelector('.tp').__soKhung());
const do2s = async () => { const a = await dem(); await p.waitForTimeout(2000); return (await dem() - a) / 2; };
console.log('cảm ứng:', await p.evaluate(() => matchMedia('(pointer: coarse)').matches), '· tập trung:', await p.evaluate(() => document.hasFocus()), '· mật độ điểm vẽ:', await p.evaluate(() => document.querySelector('.tp canvas').width / innerWidth));
const vua = await do2s(); console.log('vừa mở (< 12 s):', vua, 'khung/s');
await p.waitForTimeout(10500); const ngoi = await do2s(); console.log('ngồi nhìn > 12 s:', ngoi, 'khung/s', ngoi <= 6 ? '✓' : '— SAI, còn vẽ dày');
const ch = await p.evaluate(() => { const c = document.querySelector('.tp canvas'); for (let y = 780; y > 100; y -= 20) for (let x = 20; x < 390; x += 20) if (document.elementFromPoint(x, y) === c) return { x, y }; return null; });
await p.touchscreen.tap(ch.x, ch.y); const tinh = await do2s(); console.log('chạm xong:', tinh, 'khung/s', tinh > ngoi * 2 ? '✓ tỉnh lại' : '— SAI, không tỉnh');
await b.close();
