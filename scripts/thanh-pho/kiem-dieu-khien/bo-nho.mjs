// bộ nhớ khi dựng lại cảnh (mỗi phút làm mới): số texture / hình khối GPU KHÔNG được tăng dần — cảnh cũ phải được giải phóng (góp ý 24/10/2026: iPhone cạn canvas,
// biểu đồ Ethopex thành sọc rác) · node bo-nho.mjs <tệp thử>.html
import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + process.argv[2]); await p.waitForTimeout(3000);
const do_ = () => p.evaluate(() => document.querySelector('.tp').__boNho());
const dau = await do_(); const ds = [];
for (let i = 0; i < 4; i++) { await p.evaluate(() => document.querySelector('.tp').__dungLai()); await p.waitForTimeout(700); ds.push(await do_()); }
const cuoi = ds[ds.length - 1];
console.log('ban đầu:', JSON.stringify(dau), '\nsau 4 lần dựng lại:', ds.map((x) => `${x.textures} tex · ${x.geometries} hình`).join(' → '));
console.log(cuoi.textures <= dau.textures * 1.15 && cuoi.geometries <= dau.geometries * 1.15 ? '✓ không phình — cảnh cũ đã giải phóng' : '— SAI: bộ nhớ phình theo mỗi lần dựng lại');
await b.close();
