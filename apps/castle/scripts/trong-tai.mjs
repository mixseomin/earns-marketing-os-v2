#!/usr/bin/env node
// TRỌNG TÀI MÁY — cổng trước khi bản sửa castle lên main (anh 16/11/2026: hệ tự phản biện; người sửa không tự chấm bài mình).
// Người sửa (Thắng) chỉ COMMIT trong cây riêng; lệnh này chấm commit chưa lên main rồi mới đẩy:
//   1. kiem-chu-thich (chú thích // nuốt mã) + node --check mọi .js đã đổi + kiem-ke (kiểm kê mặt, chồng lấn)
//   2. hình khối: cham-goc.mjs ở các góc chuẩn THẤY khối đã đổi (đổi mã dựng hình → đủ mọi góc), so với MỐC public/du-lieu/<lâu>-cham-goc.json:
//      khối nào sau sửa lệch ≥ 1,5 m và tệ hơn trước ≥ 0,9 m → TRẢ (thoát 1), không đẩy
//   3. đạt: gộp số đo mới vào mốc (commit kèm), --day thì git push origin HEAD:main (kéo main mới, thử 3 lần)
// Kết quả nhớ theo nội dung phần sửa (~/.cache/castle-trong-tai/<khoá>.json): bài đã bị trả không đo lại mỗi 5 phút.
//   node apps/castle/scripts/trong-tai.mjs            chấm, in kết luận      · --day   đạt thì đẩy lên main
// tra-repo-ok: keo nội bộ (git + công cụ đo của cảnh).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { GOC, du } from './chung.mjs';
const REPO = join(GOC, '..', '..'), DAY = process.argv.includes('--day');
const g = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const chay = (tep, a = []) => execFileSync(process.execPath, [join(GOC, 'scripts', tep), ...a], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90 * 60e3, maxBuffer: 64 << 20 });
const tra = (ly) => { console.log('✗ TRỌNG TÀI TRẢ: ' + ly); process.exit(1); };
g('fetch', '-q', 'origin', 'main');
const sha = g('rev-parse', 'HEAD'), doi = g('diff', '--name-only', 'origin/main...HEAD').split('\n').filter(Boolean);
if (!doi.length) { console.log('✓ không có commit nào chưa lên main'); process.exit(0); }
if (g('status', '--porcelain', '--untracked-files=no', '--', 'apps/castle')) tra('cây còn thay đổi apps/castle CHƯA commit — commit rồi chạy lại (trọng tài chấm đúng thứ sẽ lên main)');
const NHO = join(os.homedir(), '.cache', 'castle-trong-tai'); mkdirSync(NHO, { recursive: true });
// khoá nhớ = NỘI DUNG phần sửa castle (không phải mã commit: máy đặt lại commit lên main mới mỗi lượt, mã commit đổi mà bài không đổi)
// + mốc + kho tia: mốc / cách đo đổi thì kết luận cũ hết hiệu lực (16/11: mốc đo lại bằng cách quét mới mà trọng tài vẫn trả theo kết luận cũ)
const khoa = createHash('sha1').update(g('diff', 'origin/main...HEAD', '--', 'apps/castle')).update(existsSync(du('cham-goc')) ? readFileSync(du('cham-goc')) : '').update(readFileSync(join(GOC, 'scripts', 'cham-goc.mjs'))).update(readFileSync(join(GOC, 'public', 'ns.js'))).digest('hex').slice(0, 16), tepNho = join(NHO, khoa + '.json');
if (existsSync(tepNho)) { const n = JSON.parse(readFileSync(tepNho, 'utf8')); if (!n.dat) { console.log(n.ra); tra(`commit ${sha.slice(0, 9)} đã bị trả lúc ${n.luc} — sửa tiếp bằng commit mới (không sửa lại lịch sử)`); } }
const nho = (dat, ra) => writeFileSync(tepNho, JSON.stringify({ dat, luc: new Date().toISOString(), ra }));
const loi = (e) => String(e.stdout || '') + String(e.stderr || e.message);
// 1. kiểm tĩnh
try { chay('kiem-chu-thich.mjs'); for (const f of doi.filter((f) => /^apps\/castle\/.*\.m?js$/.test(f) && existsSync(join(REPO, f)))) execFileSync(process.execPath, ['--check', join(REPO, f)], { stdio: 'pipe' }); }
catch (e) { const ra = loi(e).split('\n').slice(0, 8).join('\n'); nho(false, ra); console.log(ra); tra('kiểm mã hỏng'); }
const hinh = doi.filter((f) => /^apps\/castle\/public\/.*\.(js|json)$/.test(f) && !/cham-goc\.json$|goc-chuan\.json$|kiem-ke-kq\.json$/.test(f));
if (!hinh.length) { console.log('· không đổi mã / dữ liệu dựng hình — bỏ bước chấm góc'); }
else {
  try { chay('kiem-ke.mjs', ['--lau', 'neuschwanstein']); } catch (e) { const ra = loi(e).split('\n').filter((l) => /THIẾU|SAI|CHỒNG|✗/.test(l)).slice(0, 8).join('\n'); nho(false, ra); console.log(ra); tra('kiểm kê mặt hỏng'); }
  const MOC = du('cham-goc'); if (!existsSync(MOC)) tra(`chưa có mốc ${MOC} — chạy cham-goc.mjs đủ góc trên main rồi commit làm mốc`);
  const moc = JSON.parse(readFileSync(MOC, 'utf8'));
  // góc cần chấm: chỉ sua.json đổi → các góc mốc từng đo được khối đã đổi; đổi tệp khác (mã dựng, dữ liệu khác) → mọi góc
  let gocs = moc.goc, chiKhoi = null;
  if (hinh.every((f) => f.endsWith('-sua.json'))) { const cu = JSON.parse(g('show', 'origin/main:apps/castle/public/du-lieu/neuschwanstein-sua.json')), mo = JSON.parse(readFileSync(du('sua'), 'utf8'));
    const ids = [...new Set([...Object.keys(cu), ...Object.keys(mo)])].filter((id) => JSON.stringify(cu[id]) !== JSON.stringify(mo[id]));
    const co = new Set(moc.khoi.filter((k) => ids.includes(k.id)).flatMap((k) => k.chi_tiet.map((d) => d.goc)));
    console.log(`· khối đổi: ${ids.join(', ')} → góc thấy: ${[...co].join(', ') || '(mốc chưa đo được khối nào — chấm mọi góc)'}`); if (co.size) gocs = moc.goc.filter((x) => co.has(x)); chiKhoi = ids; }
  const tam = join(NHO, khoa + '-do.json'); let ra = '', dat = true;
  try { ra = chay('cham-goc.mjs', ['--goc', gocs.join(','), '--so', MOC, '--ghi', tam, '--nho', join(NHO, khoa + '-goc' + (chiKhoi ? '-khoi' : '')), ...(chiKhoi ? ['--khoi', chiKhoi.join(',')] : [])]); } catch (e) { ra = loi(e); dat = false; }
  const tom = ra.slice(ra.indexOf('\nSO VỚI')).trim() || ra.split('\n').slice(-8).join('\n'); console.log(tom);
  if (!dat) { nho(false, tom); tra('hình khối xấu đi ở bộ góc chuẩn (danh sách trên) — sửa tiếp rồi commit mới'); }
  // gộp số đo mới vào mốc: thay phần của các góc vừa chấm, trung vị tính lại
  const moi = JSON.parse(readFileSync(tam, 'utf8')), tv = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const doLai = new Set(moi.khoi.map((k) => k.id)), M = new Map(moc.khoi.map((k) => [k.id, { ...k, chi_tiet: k.chi_tiet.filter((d) => !moi.goc.includes(d.goc) || (chiKhoi && !doLai.has(k.id))) }]));
  for (const k of moi.khoi) { const c = M.get(k.id) || { id: k.id, ten: k.ten, chi_tiet: [] }; c.y_tren = k.y_tren; c.chi_tiet.push(...k.chi_tiet); M.set(k.id, c); }
  const kh = [...M.values()].filter((k) => k.chi_tiet.length).map((k) => ({ ...k, lech: +tv(k.chi_tiet.map((d) => d.lech)).toFixed(2), goc: k.chi_tiet.length })).sort((a, b) => Math.abs(b.lech) - Math.abs(a.lech));
  writeFileSync(MOC, JSON.stringify({ ...moc, luc: moi.luc, ban: sha.slice(0, 9), so_khoi: kh.length, lech_nang: kh.filter((k) => Math.abs(k.lech) >= 1.5).length, lech_tb: +(kh.reduce((t, k) => t + Math.abs(k.lech), 0) / (kh.length || 1)).toFixed(2), khoi: kh }, null, 1) + '\n');
  g('add', MOC, du('kiem-ke-kq')); g('commit', '-q', '-m', `castle: bảng chấm góc chuẩn sau ${sha.slice(0, 9)} (trọng tài máy: ${moi.goc.length} góc, không khối nào xấu đi)`);
  nho(true, tom);
}
console.log(`✓ TRỌNG TÀI ĐẠT: ${sha.slice(0, 9)}`);
if (DAY) { for (let i = 1; ; i++) { try { g('pull', '-q', '--rebase', 'origin', 'main'); g('push', '-q', 'origin', 'HEAD:main'); break; } catch (e) { if (i >= 3) { console.log('✗ đẩy lên lỗi: ' + loi(e).split('\n')[0]); process.exit(2); } } }
  console.log('đã đẩy lên main: ' + g('rev-parse', '--short', 'HEAD')); }
