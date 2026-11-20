#!/usr/bin/env node
// THỬ THẬT /home BẰNG TRÌNH DUYỆT CỤC BỘ (không chạy trên máy chủ): bật sửa → kéo → đổi cỡ góc + cạnh → F5 còn nguyên → hoàn tác → thêm widget →
// gộp tab → đổi tab → về mặc định → trình chiếu → bảng tìm → mở trang nhúng → màn Agents (ô nhúng mảnh cty.on.tc). 16 bước, bước nào hỏng in ✗ + lý do, mã thoát 1.
// Bài thử SỬA bố cục màn "Hạ tầng phủ" của tài khoản đang dùng rồi tự trả về mặc định ở bước 11 (đầu bài cũng dọn bản thử cũ nếu lượt trước chết giữa chừng).
//
// Cách chạy (máy làm việc, cần Playwright — mượn của courseforge-demo như ~/bin/do-man, đổi bằng DO_MAN_PW):
//   1. đường hầm tới box3:   ssh -f -N -L 13821:127.0.0.1:3821 root@167.233.241.16      (hoặc chạy thẳng tên miền thật: HOME_GOC=https://mos2.on.tc)
//   2. phiên 15 phút (CLAUDE.md › Phiên đo màn): INSERT auth_sessions (session_token, user_id, expires_at) → lấy token
//   3. node scripts/thu-home.mjs <token>          (HOME_GOC=http://127.0.0.1:13821 mặc định)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.DO_MAN_PW ?? `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`);
const GOC = process.env.HOME_GOC ?? 'http://127.0.0.1:13821', tk = process.argv[2];
if (!tk) { console.error('thiếu token phiên: node scripts/thu-home.mjs <token>'); process.exit(2); }

// UA trình duyệt thường: qua tên miền thật Cloudflare chặn UA "HeadlessChrome"
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
await ctx.addCookies([{ name: 'mos2-session', value: tk, url: GOC }]);
const p = await ctx.newPage(); const loi = []; p.on('pageerror', (e) => loi.push(String(e).slice(0, 160)));
let hong = 0;
const o = (ma) => p.evaluate((m) => { const e = document.querySelector(`.hm-o[data-ma="${m}"]`); return e ? ['--x', '--y', '--w', '--h'].map((k) => +e.style.getPropertyValue(k)).join(',') : null; }, ma);
const buoc = async (ten, f) => { try { const r = await f(); if (r === false || (typeof r === 'string' && r.startsWith('!'))) hong++; console.log(r === false || (typeof r === 'string' && r.startsWith('!')) ? '✗' : '✓', ten, typeof r === 'string' ? `→ ${r}` : ''); } catch (e) { hong++; console.log('✗', ten, '→', String(e).slice(0, 200)); } };
const keo = async (chon, dx, dy, lech = [5, 5]) => { const d = await p.locator(chon).boundingBox(); await p.mouse.move(d.x + lech[0], d.y + lech[1]); await p.mouse.down(); await p.mouse.move(d.x + lech[0] + dx, d.y + lech[1] + dy, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(800); };
// bố cục dựng sẵn của màn Hạ tầng phủ (lib/home/so.ts) — đổi bố cục màn đó thì đổi hai hằng này
const MAC_B2 = '0,0,48,40', MAC_B5 = '24,40,24,32';
const veMacDinh = async () => { await p.locator('.hm-the button', { hasText: 'Khung' }).click(); await p.locator('.hm-nut', { hasText: 'Về mặc định' }).click(); await p.waitForTimeout(2500); };

// không đợi networkidle: trang có vòng làm mới nền nên qua tên miền thật mạng không bao giờ "lặng" — đợi ô đầu tiên vẽ xong
await p.goto(`${GOC}/home?man=hatang`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForSelector('.hm-o[data-ma="B2"]', { timeout: 60000 }); await p.waitForTimeout(1500);
if ((await o('B2')) !== MAC_B2) { await p.keyboard.press(']'); await veMacDinh(); await p.keyboard.press(']'); console.log('· dọn bản thử cũ:', await o('B2')); }
const dau = await o('B2');
await buoc(`bố cục dựng sẵn B2 = ${MAC_B2}`, () => dau === MAC_B2 || `!${dau}`);
await buoc('phím E bật sửa: đủ 8 tay nắm + Kho widget mở', async () => { await p.keyboard.press('e'); await p.waitForSelector('.hm-sua .hm-tay', { timeout: 5000 }); return (await p.locator('.hm-o[data-ma="B2"] .hm-tay').count()) === 8 && (await p.locator('.hm-kho').first().isVisible()); });
await buoc('kéo B2 xuống, bắt dính lưới 12×18', async () => { await keo('.hm-o[data-ma="B2"] .hm-od', 0, 95, [300, 10]); const v = await o('B2'); return v !== dau && v.split(',').every((n) => Number(n) % 4 === 0) ? v : `!${v}`; });
const sauKeo = await o('B2');
await buoc('đổi cỡ B2 từ góc dưới phải', async () => { await keo('.hm-o[data-ma="B2"] .hm-tay[data-h="se"]', -125, -65); const v = await o('B2'); return v !== sauKeo ? v : false; });
const sauCo = await o('B2');
await buoc('F5 vẫn giữ bố cục vừa sửa (đã lưu máy chủ)', async () => { await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('.hm-o[data-ma="B2"]', { timeout: 60000 }); await p.waitForTimeout(1200); const v = await o('B2'); return v === sauCo ? v : `!mong ${sauCo}, thấy ${v}`; });
await buoc('đổi cỡ B5 từ cạnh trái', async () => { const t = await o('B5'), d = await p.locator('.hm-o[data-ma="B5"] .hm-tay[data-h="w"]').boundingBox(); await keo('.hm-o[data-ma="B5"] .hm-tay[data-h="w"]', 117, 0, [3, d.height / 2]); const v = await o('B5'); return v !== t ? `${t} → ${v}` : false; });
await buoc('Ctrl+Z hoàn tác bước vừa rồi', async () => { await p.keyboard.press('Control+z'); await p.waitForTimeout(700); const v = await o('B5'); return v === MAC_B5 ? v : `!mong ${MAC_B5}, thấy ${v}`; });
await buoc('Kho widget: thêm A1, ruột do máy chủ vẽ lên', async () => { await p.locator('.hm-kho', { hasText: 'Dải số chính' }).click(); await p.waitForSelector('.hm-o[data-ma="A1"]', { timeout: 8000 }); await p.waitForFunction(() => !document.querySelector('.hm-o[data-ma="A1"] .hm-cho'), null, { timeout: 30000 }); return (await p.locator('.hm-o[data-ma="A1"] [data-comp="ui.StatsStrip"]').count()) === 1; });
await buoc('thả A1 lên tiêu đề B4 → gộp thành tab', async () => { const a = await p.locator('.hm-o[data-ma="A1"] .hm-od').boundingBox(), d = await p.locator('.hm-o[data-ma="B4"] .hm-od').boundingBox(); await keo('.hm-o[data-ma="A1"] .hm-od', d.x + 80 - (a.x + 40), d.y + 10 - (a.y + 8), [40, 8]); const n = await p.locator('.hm-o[data-ma="A1"] .hm-tb').count(); return n === 2 || `!số tab trong ô = ${n}`; });
await buoc('bấm tab còn lại → ruột tab đó lên', async () => { await p.locator('.hm-o[data-ma="A1"] .hm-tb[aria-pressed="false"]').click(); await p.waitForFunction(() => !document.querySelector('.hm-o .hm-cho'), null, { timeout: 30000 }); return true; });
await buoc('Về mặc định: bỏ bản riêng, trả bố cục dựng sẵn', async () => { await veMacDinh(); const v = await o('B2'); return v === MAC_B2 && !(await p.locator('.hm-o[data-ma="A1"]').count()) ? v : `!B2=${v}`; });
await buoc('phím F trình chiếu ẩn khung, Esc hiện lại', async () => { await p.keyboard.press('e'); await p.keyboard.press('f'); await p.waitForTimeout(300); const an = !(await p.locator('.hm-hd').count()); await p.keyboard.press('Escape'); await p.waitForTimeout(300); return an && (await p.locator('.hm-hd').count()) === 1; });
await buoc('Ctrl+K: gõ "tien" + Enter → sang màn Tiền', async () => { await p.keyboard.press('Control+k'); await p.locator('.hm-palh input').fill('tien'); await p.keyboard.press('Enter'); await p.waitForURL(/man=tien/, { timeout: 15000 }); return (await p.locator('.hm-ten').textContent()) === 'Tiền'; });
await buoc('link trong widget mở trang nhúng, không rời /home', async () => { await p.locator('a', { hasText: 'Lịch chi tiết' }).click(); await p.waitForSelector('iframe.hm-nhung', { timeout: 8000 }); const u = new URL(p.url()); return u.pathname === '/home' && u.searchParams.get('tr') === '/revenue' ? u.pathname + u.search : `!${p.url()}`; });
await buoc('trang nhúng bỏ khung ngoài (topbar ẩn)', async () => { await p.waitForTimeout(3000); const f = p.frames().find((x) => x.url().includes('/revenue')); if (!f) return '!không thấy khung trang nhúng'; return await f.evaluate(() => { const t = document.querySelector('.topbar'); return document.documentElement.hasAttribute('data-nhung') && (!t || getComputedStyle(t).display === 'none'); }); });
// màn Agents: ô nhóm M do MOS2 tự vẽ từ dữ liệu cty (components/agents/*) — KHÔNG có khung nhúng nào; mỗi ô có đúng một hàng lọc mỏng (ThanhO)
await buoc('màn Agents: widget tự vẽ, không khung nhúng, mỗi ô một hàng lọc', async () => { await p.goto(`${GOC}/home?man=agents`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForSelector('.hm-o[data-ma="M2"] .ag-o', { timeout: 60000 });
  const d = await p.evaluate(() => ({ iframe: document.querySelectorAll('.hm-ob iframe').length, thanh: [...document.querySelectorAll('.hm-o[data-ma="M2"] .hm-thanh')].length, dong: document.querySelectorAll('.hm-o[data-ma="M2"] tbody tr').length }));
  return !d.iframe && d.thanh === 1 && d.dong > 5 ? `${d.dong} dòng bảng agents · 0 khung nhúng` : `!${JSON.stringify(d)}`; });
if (loi.length) { hong++; console.log('LỖI TRANG:', [...new Set(loi)].join(' | ')); }
await b.close();
console.log(hong ? `✗ thu-home: ${hong} bước hỏng` : '✓ thu-home: 16 bước đạt');
process.exit(hong ? 1 : 0);
