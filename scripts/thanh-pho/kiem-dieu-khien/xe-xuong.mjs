import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
// nhà máy phim: xe đỗ yên khi phim còn chờ; phim xong bước (lượt số sau) thì ĐÚNG xe đó chạy một lần rồi đỗ / giao; xe khác đứng yên
// chạy: node xe-xuong.mjs <tệp thử>.html <số xưởng>.json [thư mục ảnh]
const [tep, sox, raAnh] = process.argv.slice(2);
const A = JSON.parse(readFileSync(sox, 'utf8'));
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
await p.goto('file://' + tep); await p.waitForTimeout(3000); await p.evaluate(() => { document.querySelector('.goi-y')?.remove(); document.querySelector('.ben .wg-x')?.click(); });
const T = (f, ...a) => p.evaluate(([f, a]) => document.querySelector('.tp')[f](...a), [f, a]);
await T('__xuong', A); await p.waitForTimeout(300);
await p.evaluate(() => { const i = document.querySelector('.tim input'); i.value = 'Nhà máy phim'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('.tim-ds button')?.click()); await p.waitForTimeout(2600); await p.evaluate(() => document.querySelector('.ngan .wg-x')?.click());
await p.keyboard.down('Shift'); for (let i = 0; i < 3; i++) { await p.mouse.move(700, 300); await p.mouse.wheel(0, 300); await p.waitForTimeout(150); } await p.keyboard.up('Shift'); await p.mouse.move(5, 845); await p.waitForTimeout(800);
const x0 = await T('__xeXuong'); await p.waitForTimeout(1500); const x1 = await T('__xeXuong');
const dich = (a, b) => a.filter((v) => { const w = b.find((q) => q.id === v.id); return w && (w.x !== v.x || w.z !== v.z); }).length;
console.log('lần đầu:', x0.length, 'xe ·', x0.filter((v) => v.hien).length, 'đang đỗ hiện · xe nhúc nhích sau 1,5 s:', dich(x0, x1), dich(x0, x1) === 0 ? '✓ đỗ yên' : '— SAI, xe chạy vòng');
// cảnh dựng lại (lượt làm mới mỗi phút) không được làm xe biến mất tới lượt số kế (lỗi 24/10/2026: chú thích // nuốt lệnh dựng xe)
await T('__dungLai'); await p.waitForTimeout(500); const xr = await T('__xeXuong');
console.log('ngay sau dựng lại cảnh:', xr.filter((v) => v.hien).length, 'xe hiện', xr.filter((v) => v.hien).length === x0.filter((v) => v.hien).length ? '✓ không mất xe' : '— SAI, xe biến mất');
// lượt số sau: phim đầu tiên của "chờ lên camp" xong → lên camp (#id của camp có trên city)
const B = JSON.parse(JSON.stringify(A)), f = B.tram.len.ds.shift(); B.tram.len.so--; const camp = (A.tram.da_len.ds.find((d) => /#\d+/.test(d.ghi)) ?? {}).ghi?.match(/#\d+/)?.[0] ?? '#0';
B.tram.da_len.ds.push({ id: f.id, ten: f.ten, ghi: camp, luc: 'vừa xong' }); B.tram.da_len.so++;
if (raAnh) await p.screenshot({ path: `${raAnh}/xx-0.png` });
await T('__xuong', B); await p.waitForTimeout(400);
const y0 = await T('__xeXuong'); const xeF = y0.find((v) => v.id === f.id);
console.log(`phim "${f.ten}" xong bước → xe:`, xeF ? (xeF.chay ? '✓ đang chạy' : '— SAI, không chạy') : '— SAI, mất xe', '· xe khác đang chạy:', y0.filter((v) => v.chay && v.id !== f.id).length);
for (let i = 1; i <= 5; i++) { await p.waitForTimeout(1200); if (raAnh) await p.screenshot({ path: `${raAnh}/xx-${i}.png` }); }
let tg = 0; while (tg < 40 && (await T('__xeXuong')).some((v) => v.id === f.id)) { await p.waitForTimeout(1000); tg++; }
const y1 = await T('__xeXuong');
console.log('sau', tg + 7, 'giây: xe phim đó', y1.some((v) => v.id === f.id) ? '— SAI, chưa tới / chưa giao' : '✓ đã giao tới camp ' + camp + ' và biến mất', '· xe khác nhúc nhích:', dich(y0.filter((v) => v.id !== f.id), y1), dich(y0.filter((v) => v.id !== f.id), y1) === 0 ? '✓' : '— SAI');
await b.close();
