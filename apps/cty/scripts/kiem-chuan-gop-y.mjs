// CHUẨN CHUNG "AI ĐANG LÀM" của nút Góp ý (anh 12/11/2026) sống ở BA bản chép vì ba nền khác nhau: gốc packages/gop-y/src/client.tsx (React, 5 app),
// spy-on-tc web/gop-y.js + web/app.css (JS thuần, Hiếu), Astrolas _report_button.blade.php (Laravel, Thành). Bài này so ba bản để chúng không trôi:
// keyframes `gy-rung` phải y nhau (bỏ khoảng trắng + dấu ;), class `gy-dang-lam`, nhịp nạp 60 s cạnh visibilitychange, chữ "AI đang làm".
// Tệp không có trên máy này → bỏ qua (spy / Astrolas chỉ có ở iMac + MacBook). Tệp có nhưng CHƯA mang chuẩn → ghi chú, không đỏ (clone cũ chưa kéo);
// tệp mang chuẩn mà keyframes / nhịp khác gốc → ĐỎ (ai đó sửa một bản). Gọi từ tu-kiem.mjs; chạy lẻ: node apps/cty/scripts/kiem-chuan-gop-y.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const H = os.homedir(), R = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const GOC = path.join(R, 'packages/gop-y/src/client.tsx');
const BAN = [
  { ten: 'spy web/app.css + gop-y.js', css: `${H}/Me/GitHub/spy-on-tc/web/app.css`, js: `${H}/Me/GitHub/spy-on-tc/web/gop-y.js` },
  ...[`${H}/Me/GitHub/Astrolas.com`, `${H}/Documents/GitHub/Astrolas.com`].map((a) => ({ ten: `Astrolas ${a}`, css: `${a}/resources/views/v2/layouts/partials/_report_button.blade.php`, js: `${a}/resources/views/v2/layouts/partials/_report_button.blade.php` })),
];
const doc = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
/** Phần keyframes gy-rung, chuẩn hoá: bỏ khoảng trắng + dấu ; để CSS viết dài (Astrolas) so được với viết nén (gói, spy). */
export const rung = (s) => { const t = s.replace(/[\s;]/g, ''), i = t.indexOf('@keyframesgy-rung'); if (i < 0) return null; const j = t.indexOf('}}', i); return j < 0 ? null : t.slice(i, j + 2); };
export const nhip = (s) => /visibilitychange/.test(s) && /60_?000/.test(s);
export function kiem(gocSrc, ds) {
  const loi = [], ghi = [], g = rung(gocSrc);
  // gốc chưa mang chuẩn (bản vá gói chung chưa lên) → chưa có gì để so: ghi chú, không đỏ — bài này bắt TRÔI giữa các bản, không bắt "chưa làm"
  if (!g || !/gy-dang-lam/.test(gocSrc) || !nhip(gocSrc)) return { loi, ghi: [...ghi, 'gốc packages/gop-y/src/client.tsx chưa mang chuẩn gy-rung — chưa so được'] };
  for (const b of ds) {
    if (b.css == null || b.js == null) { ghi.push(`${b.ten}: không có trên máy này — bỏ qua`); continue; }
    if (!/gy-dang-lam/.test(b.css + b.js)) { ghi.push(`${b.ten}: chưa mang chuẩn (clone cũ chưa kéo?)`); continue; }
    if (rung(b.css) !== g) loi.push(`${b.ten}: keyframes gy-rung khác gốc`);
    if (!nhip(b.js)) loi.push(`${b.ten}: thiếu nhịp nạp 60 s cạnh visibilitychange`);
    if (!/AI đang làm/.test(b.js)) loi.push(`${b.ten}: thiếu chữ "AI đang làm"`);
  }
  return { loi, ghi };
}
export const kiemMay = () => kiem(doc(GOC) ?? '', BAN.map((b) => ({ ten: b.ten, css: doc(b.css), js: doc(b.js) })));

if (process.argv[1]?.endsWith('kiem-chuan-gop-y.mjs')) {
  if (process.argv.includes('--tu-kiem')) {
    const t = (await import('node:assert/strict')).default;
    const goc = `.gy-dang-lam{animation:gy-rung 3s}@keyframes gy-rung{0%,78%,100%{transform:none}82%{transform:rotate(-9deg)}}\nsetInterval(nhip, 60_000); document.addEventListener('visibilitychange', nhip); 'AI đang làm'`;
    const dai = `@keyframes gy-rung { 0%, 78%, 100% { transform: none; } 82% { transform: rotate(-9deg); } }`;
    t.equal(rung(dai), rung(goc), 'CSS viết dài = viết nén');
    t.deepEqual(kiem(goc, [{ ten: 'a', css: `.x.gy-dang-lam{} ${dai}`, js: `setInterval(n, 60000); addEventListener('visibilitychange', n); title='AI đang làm 2'` }]).loi, [], 'bản chép đúng chuẩn: không lỗi');
    t.match(kiem(goc, [{ ten: 'a', css: `.gy-dang-lam{} ${dai.replace('-9deg', '-5deg')}`, js: `60000 visibilitychange AI đang làm` }]).loi[0], /keyframes/, 'đổi góc lắc một bản → đỏ');
    t.match(kiem(goc, [{ ten: 'a', css: `.gy-dang-lam{} ${dai}`, js: `setInterval(n, 30000); visibilitychange AI đang làm` }]).loi[0], /nhịp/, 'đổi nhịp → đỏ');
    const r = kiem(goc, [{ ten: 'a', css: null, js: null }, { ten: 'b', css: '.cu{}', js: 'cu' }]); t.deepEqual(r.loi, []); t.equal(r.ghi.length, 2, 'thiếu tệp / clone cũ: ghi chú, không đỏ');
    const r2 = kiem('const x = 1;', [{ ten: 'a', css: dai, js: '60000' }]); t.deepEqual(r2.loi, []); t.match(r2.ghi[0], /gốc .* chưa mang chuẩn/, 'gốc chưa có chuẩn: ghi chú, không đỏ');
    console.log('kiem-chuan-gop-y: tự kiểm đạt');
  } else {
    const { loi, ghi } = kiemMay(); for (const g of ghi) console.log(`· ${g}`);
    if (loi.length) { console.error('✗ chuẩn nút Góp ý lệch:\n  ' + loi.join('\n  ')); process.exit(1); }
    console.log('✓ chuẩn nút Góp ý: các bản chép khớp gốc');
  }
}
