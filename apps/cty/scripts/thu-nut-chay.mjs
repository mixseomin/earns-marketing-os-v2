// Kiểm nút "Chạy một lượt" trên trình duyệt thật (bản production) — KHÔNG tốn tiền: máy chủ thử phải chạy với
// CTY_PROXY_URL trỏ cổng đóng (vd http://127.0.0.1:9) → worker vào lượt, gọi proxy hỏng, kết thúc "lỗi", 0 lượt gọi mô hình.
//   node scripts/thu-nut-chay.mjs <base> <phiên> [ảnh-dir] [đường-dẫn-màn]
// Kiểm: chữ anh gõ GIỮ sau bấm và qua F5 · có dòng báo dưới nút · lượt mới hiện trên màn không cần F5 · lỗi lượt hiện đỏ.
const { chromium } = await import(process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs');
const [base, tok, anh, man = '/phong/thu-nghiem'] = process.argv.slice(2);
// CHẶN TIỀN (11/10/2026: con trỏ bài này vào production qua đường hầm → 4 lượt thật, ~$0,011, bẩn nhật ký/chỉ số Phòng thử): bài này
// BẤM Chạy thật. Chỉ chạy khi tiến trình ĐANG NGHE cổng của base là (con của) đúng tiến trình `kiem.sh may-len` đã dựng với proxy cổng
// đóng — may-len ghi mã tiến trình vào <CTY_KIEM_TAM>/may-len.pid. Không đoán theo số cổng (đường hầm tới production cũng có thể nằm ở
// cổng đó); macOS không cho đọc biến môi trường của tiến trình khác nên không đọc thẳng CTY_PROXY_URL được. Không chứng minh được → từ chối.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const proxyDong = () => {
  const u = new URL(base); if (!['localhost', '127.0.0.1'].includes(u.hostname)) return 'không phải máy này';
  let goc; try { goc = fs.readFileSync(`${process.env.CTY_KIEM_TAM || '/tmp/cty-kiem'}/may-len.pid`, 'utf8').trim(); } catch { return 'chưa có bản kiem.sh may-len (thiếu may-len.pid)'; }
  let pid; try { pid = execFileSync('lsof', ['-ti', `tcp:${u.port}`, '-sTCP:LISTEN']).toString().trim().split('\n')[0]; } catch { return `không có tiến trình nghe cổng ${u.port}`; }
  for (let p = pid, i = 0; p && p !== '1' && i < 6; i++, p = execFileSync('ps', ['-o', 'ppid=', '-p', p]).toString().trim()) if (p === goc) return null;
  return `tiến trình ${pid} nghe cổng ${u.port} không do kiem.sh may-len (${goc}) dựng`;
};
const vi = proxyDong();
if (vi) { console.log(`⤼ bỏ qua: ${base} — ${vi}; bấm Chạy ở đây có thể giao lượt thật, tốn tiền`); process.exit(2); }
if (process.argv.includes('--chi-xet')) { console.log(`✓ ${base}: proxy cổng đóng`); process.exit(0); }
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
const cacNut = () => p.evaluate(() => [...document.querySelectorAll('.cty-thu-form .cty-thu-nut > *')].map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)}`; }).join(' '));
const viTriTruoc = await cacNut();
await p.click('.cty-thu-form button:has-text("Chạy một lượt")');
kq('mở xác nhận: các nút cạnh đứng yên (YDNI 6)', (await cacNut()) === viTriTruoc, `${viTriTruoc} → ${await cacNut()}`);
// #1271: bấm lần đầu chỉ mở xác nhận tại chỗ — chưa được gửi gì. Huỷ thì thôi; Xác nhận mới chạy.
await p.waitForTimeout(800);
kq('bấm lần đầu chỉ hỏi xác nhận, chưa giao lượt', (await p.locator('.cty-thu-form .cty-xac-nhan').count()) === 1 && (await p.locator('.cty-thu-form .cty-bao-ok, .cty-thu-form .cty-bao-loi').count()) === 0, '');
await p.click('.cty-thu-form .cty-xac-nhan button:has-text("Huỷ")');
kq('Huỷ thì nút Chạy trở lại', (await p.locator('.cty-thu-form button:has-text("Chạy một lượt")').count()) === 1, '');
await p.click('.cty-thu-form button:has-text("Chạy một lượt")');
await p.click('.cty-thu-form .cty-xac-nhan button:has-text("Xác nhận")');
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
