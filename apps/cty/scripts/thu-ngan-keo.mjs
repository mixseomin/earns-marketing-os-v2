// KIỂM CHỒNG NGĂN KÉO theo skill ngan-keo (6 bước + mở từ màn + bấm mép + Esc), trên trình duyệt thật, bản production.
//   node scripts/thu-ngan-keo.mjs <base> <phiên mos2-session> [thư mục ảnh]
// Exit 1 khi bước nào sai. Không bấm nút tốn tiền / gửi góp ý.
const { chromium } = await import(process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs');
const [base, tok, anh] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
await ctx.addCookies([{ name: 'mos2-session', value: tok, url: base }]);
const p = await ctx.newPage(); const loiJs = []; p.on('pageerror', (e) => loiJs.push(e.message));
const tieu = async () => (await p.$$eval('.nk[data-khoa]', (ns) => ns.map((n) => n.getAttribute('data-khoa')))).join(' > ');
const urlChong = () => new URL(p.url()).searchParams.getAll('ngan').join(' > ');
const doi = async () => { await p.waitForLoadState('networkidle'); await p.waitForTimeout(300); };
// Đợi tới khi chồng ngăn = mong muốn (máy chủ dựng ngăn mất một nhịp sau cú bấm), tối đa 8s; trả về chồng cuối cùng thấy.
const choChong = async (mong) => { const t0 = Date.now(); let c = ''; while (Date.now() - t0 < 8000) { c = await tieu(); if (c === mong) return c; await p.waitForTimeout(150); } return c; };
let sai = 0; const kq = (ten, ok, chi) => { console.log(`${ok ? '✓' : '✗'} ${ten}: ${chi}`); if (!ok) sai++; };
const LUOT = 'nhat-ky:luot=2026-10-10T15-23-33-941Z';

await p.goto(`${base}/phong/thu-nghiem`); await doi();
await p.locator('.cty-row a.cty-nguoi').first().click();
kq('0 mở từ màn (bấm thẻ người)', (await choChong('nhan-su:tam')) === 'nhan-su:tam' && new URL(p.url()).pathname === '/phong/thu-nghiem', await tieu());

await p.goto(`${base}/?ngan=phong:thu-nghiem&ngan=nhan-su:tam&ngan=${encodeURIComponent(LUOT)}`); await doi();
kq('1 URL 3 khoá → 3 ngăn đúng thứ tự', (await tieu()) === `phong:thu-nghiem > nhan-su:tam > ${LUOT}`, await tieu());
const w = await p.$$eval('.nk[data-khoa]', (ns) => ns.map((n) => Math.round(n.getBoundingClientRect().width)));
kq('1b mỗi tầng hẹp hơn 64px', w[0] - w[1] === 64 && w[1] - w[2] === 64, w.join(' / '));
if (anh) await p.screenshot({ path: `${anh}/nk-3tang.png` });

await p.locator('.nk[data-tang="2"] .nk-dong').click();
kq('2 ✕ tầng trên → còn 2, URL bớt 1', (await choChong('phong:thu-nghiem > nhan-su:tam')) === 'phong:thu-nghiem > nhan-su:tam' && urlChong() === 'phong:thu-nghiem > nhan-su:tam', `${await tieu()} | url ${urlChong()}`);

await p.reload(); await doi();
kq('3 F5 → vẫn 2 ngăn', (await tieu()) === 'phong:thu-nghiem > nhan-su:tam', await tieu());

const truoc = new URL(p.url()).pathname;
await p.locator('.nk[data-tang="1"] .nk-luoi a.cty-nguoi-link').first().click();
kq('4 link trong ngăn → chồng thêm, màn không đổi', (await choChong('phong:thu-nghiem > nhan-su:tam > nhan-su:minh')) === 'phong:thu-nghiem > nhan-su:tam > nhan-su:minh' && new URL(p.url()).pathname === truoc, await tieu());
if (anh) await p.screenshot({ path: `${anh}/nk-link.png` });

await p.locator('.nk[data-tang="2"] .nk-luoi a[href="/phong/vp-giam-doc"]').click();
await choChong('phong:thu-nghiem > nhan-su:tam > nhan-su:minh > phong:vp-giam-doc');
await p.locator('.nk[data-tang="3"] a[href="/nhan-su/hung"]').first().click();
await choChong('phong:thu-nghiem > nhan-su:tam > nhan-su:minh > phong:vp-giam-doc > nhan-su:hung');
await p.locator('.nk[data-tang="4"] .nk-luoi a.cty-nguoi-link').first().click();   // Hùng báo cáo cho Minh — Minh đã có ở tầng 2
const sau = await choChong('phong:thu-nghiem > nhan-su:tam > phong:vp-giam-doc > nhan-su:hung > nhan-su:minh');
kq('5 mở lại khoá đã có → không tăng, lên trên cùng', sau === 'phong:thu-nghiem > nhan-su:tam > phong:vp-giam-doc > nhan-su:hung > nhan-su:minh', sau);

await p.locator('.nk[data-tang="0"]').click({ position: { x: 20, y: 300 } });
kq('mép: bấm ngăn dưới cùng → đóng các tầng trên', (await choChong('phong:thu-nghiem')) === 'phong:thu-nghiem', await tieu());

await p.keyboard.press('Escape');
kq('Esc → đóng tầng trên cùng', (await choChong('')) === '', `"${await tieu()}"`);

await p.goto(`${base}/?ngan=nhan-su:khong-co-ai`); await doi();
const thongBao = await p.locator('.nk [data-loi]').innerText().catch(() => '');
kq('6 bản ghi không có → báo trong ngăn, không treo', /Không có hồ sơ/.test(thongBao), thongBao.slice(0, 70));

await p.goto(`${base}/?ngan=phong:thu-nghiem`); await doi();
const cuon = await p.$eval('.nk[data-tang="0"] .nk-than', (e) => e.scrollHeight - e.clientHeight);
kq('8 một màn: thân ngăn không cuộn (cột tự cuộn)', cuon <= 1, `${cuon}px`);
if (anh) await p.screenshot({ path: `${anh}/nk-phong.png` });

kq('không lỗi JS', !loiJs.length, loiJs.join(' | ').slice(0, 200) || '0');
await b.close();
console.log(sai ? `✗ ${sai} bước sai` : '✓ chồng ngăn đạt chuẩn ngan-keo');
process.exit(sai ? 1 : 0);
