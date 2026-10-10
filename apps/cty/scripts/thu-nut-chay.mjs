// Kiểm nút "Chạy một lượt" trên trình duyệt thật (bản production) — KHÔNG tốn tiền: máy chủ thử phải chạy với
// CTY_PROXY_URL trỏ cổng đóng (vd http://127.0.0.1:9) → worker vào lượt, gọi proxy hỏng, kết thúc "lỗi", 0 lượt gọi mô hình.
//   node scripts/thu-nut-chay.mjs <base> <phiên> [ảnh-dir] [đường-dẫn-màn]
// Kiểm: chữ anh gõ GIỮ sau bấm và qua F5 · có dòng báo dưới nút · lượt mới hiện trên màn không cần F5 · lỗi lượt hiện đỏ.
const { chromium } = await import(process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs');
const [base, tok, anh, man = '/phong/thu-nghiem'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
await ctx.addCookies([{ name: 'mos2-session', value: tok, url: base }]);
const p = await ctx.newPage(); const loiJs = []; p.on('pageerror', (e) => loiJs.push(e.message));
let sai = 0; const kq = (t, ok, c) => { console.log(`${ok ? '✓' : '✗'} ${t}: ${c}`); if (!ok) sai++; };
await p.goto(base + man, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.removeItem('cty.tab.thu-nghiem'));
await p.reload({ waitUntil: 'networkidle' });
const VIEC = `Thử nút ${Date.now()}: viết 1 câu chào tiếng Anh`;
const truoc = await p.locator('.cty-ds-luot details').count();
await p.fill('.cty-thu-form textarea', VIEC);
await p.click('.cty-thu-form button:has-text("Chạy một lượt")');
const bao = await p.locator('.cty-thu-form .cty-bao-ok, .cty-thu-form .cty-bao-loi').first().innerText({ timeout: 8000 }).catch(() => '');
kq('có dòng báo dưới nút', !!bao, bao);
kq('chữ đã gõ còn nguyên sau bấm', (await p.inputValue('.cty-thu-form textarea')) === VIEC, await p.inputValue('.cty-thu-form textarea'));
let thay = ''; for (let i = 0; i < 40 && !thay.includes('Thử nút'); i++) { await p.waitForTimeout(500); thay = await p.locator('.cty-thu-tieu').innerText().catch(() => ''); }
kq('lượt mới hiện trên màn không cần F5', thay.includes('Thử nút'), thay.slice(0, 80));
let tt = ''; for (let i = 0; i < 40; i++) { tt = await p.locator('.cty-thu-tieu .cty-pill').first().innerText().catch(() => ''); if (tt && tt !== 'đang chạy') break; await p.waitForTimeout(500); }
kq('lượt kết thúc tự cập nhật (không F5)', tt === 'lỗi' || tt === 'xong', tt);
kq('lỗi lượt hiện thành ô báo', (await p.locator('.cty-thu .cty-bao-loi[data-loi]').count()) > 0, await p.locator('.cty-thu .cty-bao-loi[data-loi]').first().innerText().catch(() => '—'));
if (anh) await p.screenshot({ path: `${anh}/nut-chay.png` });
await p.reload({ waitUntil: 'networkidle' });
kq('chữ đã gõ còn sau F5', (await p.inputValue('.cty-thu-form textarea')) === VIEC, '');
kq('tab Các lượt tăng 1', (await p.locator('.cty-ds-luot details').count()) === truoc + 1, `${truoc} → ${await p.locator('.cty-ds-luot details').count()}`);
kq('không lỗi JS', !loiJs.length, loiJs.join(' | ') || '0');
await b.close(); console.log(sai ? `✗ ${sai} sai` : '✓ nút chạy đạt'); process.exit(sai ? 1 : 0);
