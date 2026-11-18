// CHUẨN CHUNG nút Góp ý (packages/gop-y/CHUAN.md) sống ở BA bản chép vì ba nền khác nhau: gốc packages/gop-y/src/client.tsx (React, mọi app monorepo),
// spy-on-tc web/gop-y.js + web/app.css (JS thuần, Hiếu), Astrolas _report_button.blade.php (Laravel, Thành). Bài này so ba bản để chúng không trôi:
//  · "AI đang làm" (12/11/2026): keyframes `gy-rung` y nhau (bỏ khoảng trắng + dấu ;), class `gy-dang-lam`, nhịp nạp 60 s cạnh visibilitychange, chữ "AI đang làm"
//  · số đỏ chờ ý kiến (17/11/2026, Astrolas #4756): đọc `can_y_kien` + hiện số trên nút (data-can-y-kien / gy-so-do)
// Tệp không có trên máy này (GHA, máy không clone spy / Astrolas) → bỏ qua. Gốc thiếu chuẩn / bản chép lệch keyframes / nhịp → ĐỎ (loi).
// Bản ngoài monorepo THIẾU hẳn một mục chuẩn → `thieu`: chạy lẻ thì ĐỎ (exit 1, danh sách giao Hiếu / Thành); tu-kiem cty chỉ in cảnh báo vì
// kỹ sư cty không sửa được repo spy / Astrolas. Gọi từ tu-kiem.mjs; chạy lẻ: node apps/cty/scripts/kiem-chuan-gop-y.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { goiTep } from '../worker/goc.mjs';

const H = os.homedir(), R = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const GOC = goiTep('gop-y', 'src/client.tsx');   // bản ghim goi/gop-y khi cty là repo riêng (worker/goc.mjs)
const GOC_SERVER = goiTep('gop-y', 'src/server.ts');
const BAN = [
  { ten: 'spy web/app.css + gop-y.js', css: `${H}/Me/GitHub/spy-on-tc/web/app.css`, js: `${H}/Me/GitHub/spy-on-tc/web/gop-y.js` },
  ...[`${H}/Me/GitHub/Astrolas.com`, `${H}/Documents/GitHub/Astrolas.com`].map((a) => ({ ten: `Astrolas ${a}`, css: `${a}/resources/views/v2/layouts/partials/_report_button.blade.php`, js: `${a}/resources/views/v2/layouts/partials/_report_button.blade.php` })),
];
const doc = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
/** Phần keyframes gy-rung, chuẩn hoá: bỏ khoảng trắng + dấu ; để CSS viết dài (Astrolas) so được với viết nén (gói, spy). */
export const rung = (s) => { const t = s.replace(/[\s;]/g, ''), i = t.indexOf('@keyframesgy-rung'); if (i < 0) return null; const j = t.indexOf('}}', i); return j < 0 ? null : t.slice(i, j + 2); };
export const nhip = (s) => /visibilitychange/.test(s) && /60_?000/.test(s);
/** Số đỏ chờ ý kiến: đọc can_y_kien + có chỗ hiện số (thuộc tính data-can-y-kien / dataset.canYKien hoặc huy hiệu gy-so-do). */
export const soDo = (s) => /can_y_kien/.test(s) && /data-can-y-kien|canYKien|gy-so-do/.test(s);
export function kiem(gocSrc, ds) {
  const loi = [], thieu = [], ghi = [], g = rung(gocSrc);
  if (!g || !/gy-dang-lam/.test(gocSrc) || !nhip(gocSrc) || !/AI đang làm/.test(gocSrc)) loi.push('gốc packages/gop-y/src/client.tsx chưa mang chuẩn gy-rung (keyframes + gy-dang-lam + nhịp 60 s + "AI đang làm")');
  if (!soDo(gocSrc)) loi.push('gốc packages/gop-y chưa mang số đỏ can_y_kien (counts.can_y_kien + huy hiệu trên nút)');
  if (loi.length) return { loi, thieu, ghi };
  for (const b of ds) {
    if (b.css == null || b.js == null) { ghi.push(`${b.ten}: không có trên máy này — bỏ qua`); continue; }
    const tat = b.css + '\n' + b.js;
    if (!/gy-dang-lam/.test(tat)) thieu.push(`${b.ten}: chưa có rung "AI đang làm" (class gy-dang-lam + keyframes gy-rung)`);
    else {
      if (rung(b.css) !== g) loi.push(`${b.ten}: keyframes gy-rung khác gốc`);
      if (!nhip(b.js)) loi.push(`${b.ten}: thiếu nhịp nạp 60 s cạnh visibilitychange`);
      if (!/AI đang làm/.test(b.js)) loi.push(`${b.ten}: thiếu chữ "AI đang làm"`);
    }
    if (!soDo(tat)) thieu.push(`${b.ten}: chưa có số đỏ chờ ý kiến (đọc counts.can_y_kien, hiện số trên nút)`);
  }
  return { loi, thieu, ghi };
}
export const kiemMay = () => kiem((doc(GOC) ?? '') + '\n' + (doc(GOC_SERVER) ?? '') + '\n' + (doc(goiTep('gop-y', 'src/dem.ts')) ?? ''), BAN.map((b) => ({ ten: b.ten, css: doc(b.css), js: doc(b.js) })));

if (process.argv[1]?.endsWith('kiem-chuan-gop-y.mjs')) {
  if (process.argv.includes('--tu-kiem')) {
    const t = (await import('node:assert/strict')).default;
    const goc = `.gy-dang-lam{animation:gy-rung 3s}@keyframes gy-rung{0%,78%,100%{transform:none}82%{transform:rotate(-9deg)}}\nsetInterval(nhip, 60_000); document.addEventListener('visibilitychange', nhip); 'AI đang làm' can_y_kien gy-so-do`;
    const dai = `@keyframes gy-rung { 0%, 78%, 100% { transform: none; } 82% { transform: rotate(-9deg); } }`;
    const duJs = `setInterval(n, 60000); addEventListener('visibilitychange', n); title='AI đang làm 2'; c = d.counts.can_y_kien; fab.dataset.canYKien = c`;
    t.equal(rung(dai), rung(goc), 'CSS viết dài = viết nén');
    t.deepEqual(kiem(goc, [{ ten: 'a', css: `.x.gy-dang-lam{} ${dai}`, js: duJs }]), { loi: [], thieu: [], ghi: [] }, 'bản chép đúng chuẩn: không lỗi');
    t.match(kiem(goc, [{ ten: 'a', css: `.gy-dang-lam{} ${dai.replace('-9deg', '-5deg')}`, js: duJs }]).loi[0], /keyframes/, 'đổi góc lắc một bản → đỏ');
    t.match(kiem(goc, [{ ten: 'a', css: `.gy-dang-lam{} ${dai}`, js: duJs.replace('60000', '30000') }]).loi[0], /nhịp/, 'đổi nhịp → đỏ');
    t.match(kiem(goc, [{ ten: 'a', css: `.gy-dang-lam{} ${dai}`, js: `setInterval(n, 60000); visibilitychange AI đang làm` }]).thieu[0], /số đỏ/, 'bản ngoài thiếu số đỏ → thiếu (đỏ khi chạy lẻ)');
    t.match(kiem(goc, [{ ten: 'b', css: '.cu{}', js: 'cu' }]).thieu[0], /chưa có rung/, 'bản ngoài chưa có rung → thiếu');
    const r = kiem(goc, [{ ten: 'a', css: null, js: null }]); t.deepEqual([r.loi, r.thieu, r.ghi.length], [[], [], 1], 'không có tệp trên máy: bỏ qua');
    t.match(kiem('const x = 1;', []).loi[0], /gốc .* chưa mang chuẩn gy-rung/, 'gốc chưa có chuẩn → đỏ');
    t.match(kiem(goc.replace(/can_y_kien|gy-so-do/g, ''), []).loi[0], /số đỏ/, 'gốc thiếu số đỏ → đỏ');
    console.log('kiem-chuan-gop-y: tự kiểm đạt');
  } else {
    const { loi, thieu, ghi } = kiemMay(); for (const g of ghi) console.log(`· ${g}`);
    if (loi.length || thieu.length) { console.error('✗ chuẩn nút Góp ý (packages/gop-y/CHUAN.md) lệch / thiếu:\n  ' + [...loi, ...thieu].join('\n  ')); process.exit(1); }
    console.log('✓ chuẩn nút Góp ý: các bản chép khớp gốc');
  }
}
