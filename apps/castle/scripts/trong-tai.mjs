#!/usr/bin/env node
// TRỌNG TÀI MÁY — cổng trước khi bản sửa castle lên main (anh 16/11/2026: hệ tự phản biện; người sửa không tự chấm bài mình).
// Người sửa (Thắng) chỉ COMMIT trong cây riêng; lệnh này chấm commit chưa lên main rồi mới đẩy:
//   1. kiem-chu-thich (chú thích // nuốt mã) + kiem-nap-phien-ban (mô-đun mới có trong danh sách nạp theo phiên bản) + node --check mọi .js đã đổi + kiem-ke (kiểm kê mặt, chồng lấn) SO VỚI MỐC main: chỉ trả khi lỗi mới / tăng
//   2. hình khối — THƯỚC = SỐ ĐO CHÍNH THỨC (anh 20/11/2026: "đổi trọng tài đi"): sua-theo-dom20.mjs --kiem so đỉnh từng khối trong mặt bằng lâu đài với DOM20
//      của Bayerische Vermessungsverwaltung (mặt trên 20 cm, CC BY 4.0; thiếu tệp thì tự chạy tai-bayern.sh) — khối lệch đều ≥ 1,5 m → TRẢ.
//      Trước 20/11 thước là lưới ảnh 3D Google ở bộ góc chuẩn (cham-goc.mjs); lưới đó bẹp ở cụm cổng Torbau (thấp hơn DOM20 / LoD2 4–8 m, nền sân trước cổng thấp
//      8,7 m) nên chấm theo nó là ép mô hình sai theo. Bước cũ còn chạy được bằng CHAM_GOC=1 (tham khảo, vẫn so MỐC <lâu>-cham-goc.json: lệch ≥ 1,5 m và tệ hơn ≥ 0,9 m → TRẢ)
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
// sổ kiem-ke-kq.json do CHÍNH trọng tài ghi (lần trả trước để lại) — không tính là thay đổi của người sửa (#1842: mọi lần chấm sau đều bị trả "cây còn thay đổi")
if (g('status', '--porcelain', '--untracked-files=no', '--', 'apps/castle', ':!apps/castle/public/du-lieu/*-kiem-ke-kq.json')) tra('cây còn thay đổi apps/castle CHƯA commit — commit rồi chạy lại (trọng tài chấm đúng thứ sẽ lên main)');
// NGƯỜI SỬA KHÔNG ĐƯỢC SỬA THƯỚC (16/11/2026: Thắng tự sửa trong-tai.mjs giữa thẻ #1630 → đụng bản trên main, 6 commit kẹt): commit nào của kỹ sư
// đụng công cụ đo / chấm / mốc thì TRẢ. Commit mốc do chính trọng tài tạo ("castle: bảng chấm góc chuẩn sau …") được miễn.
const THUOC = /^apps\/castle\/(scripts\/(trong-tai|cham-goc|chung|kiem-ke|so-lech|quet-giao)\.mjs|du-lieu-goc\/[^/]*-tia-that\.json|public\/du-lieu\/[^/]*-(cham-goc|goc-chuan)\.json)$/;
for (const c of g('log', '--format=%H%x09%s', 'origin/main..HEAD').split('\n').filter(Boolean)) { const [h, tieu] = c.split('\t'); if (/^castle: bảng chấm góc chuẩn sau /.test(tieu)) continue;
  const dung = g('show', '--name-only', '--format=', h).split('\n').filter((f) => THUOC.test(f)); if (dung.length) tra(`commit ${h.slice(0, 9)} "${tieu}" sửa công cụ chấm (${dung.join(', ')}) — người sửa không được sửa thước; công cụ hỏng thì reply card nêu lỗi, không tự sửa`); }
const NHO = join(os.homedir(), '.cache', 'castle-trong-tai'); mkdirSync(NHO, { recursive: true });
// khoá nhớ = NỘI DUNG phần sửa castle (không phải mã commit: máy đặt lại commit lên main mới mỗi lượt, mã commit đổi mà bài không đổi)
// + mốc + kho tia: mốc / cách đo đổi thì kết luận cũ hết hiệu lực (16/11: mốc đo lại bằng cách quét mới mà trọng tài vẫn trả theo kết luận cũ)
const khoa = createHash('sha1').update(g('diff', 'origin/main...HEAD', '--', 'apps/castle')).update(existsSync(du('cham-goc')) ? readFileSync(du('cham-goc')) : '').update(readFileSync(join(GOC, 'scripts', 'cham-goc.mjs'))).update(readFileSync(join(GOC, 'public', 'ns.js'))).update(readFileSync(new URL(import.meta.url))).digest('hex').slice(0, 16), tepNho = join(NHO, khoa + '.json');
if (existsSync(tepNho)) { const n = JSON.parse(readFileSync(tepNho, 'utf8')); if (!n.dat) { console.log(n.ra); tra(`commit ${sha.slice(0, 9)} đã bị trả lúc ${n.luc} — sửa tiếp bằng commit mới (không sửa lại lịch sử)`); } }
const nho = (dat, ra) => writeFileSync(tepNho, JSON.stringify({ dat, luc: new Date().toISOString(), ra }));
const loi = (e) => String(e.stdout || '') + String(e.stderr || e.message), tom_ok = () => 'đạt: kiểm kê + chiều cao theo DOM20';
// 1. kiểm tĩnh
try { chay('kiem-chu-thich.mjs'); chay('kiem-nap-phien-ban.mjs'); for (const f of doi.filter((f) => /^apps\/castle\/.*\.m?js$/.test(f) && existsSync(join(REPO, f)))) execFileSync(process.execPath, ['--check', join(REPO, f)], { stdio: 'pipe' }); }
catch (e) { const ra = loi(e).split('\n').slice(0, 8).join('\n'); nho(false, ra); console.log(ra); tra('kiểm mã hỏng'); }
// tệp GIAO DIỆN không dựng hình (hòm góp ý, báo lệch, đánh giá, âm thanh) → không chấm hình (25/11/2026 #1842: Thắng chỉ sửa gopy.js mà bị trả "kiểm kê xấu đi")
const GIAO_DIEN = /^apps\/castle\/public\/(gopy|baolech|danhgia|amthanh)\.js$/;
const hinh = doi.filter((f) => /^apps\/castle\/public\/.*\.(js|json)$/.test(f) && !GIAO_DIEN.test(f) && !/cham-goc\.json$|goc-chuan\.json$|kiem-ke-kq\.json$/.test(f));
// MỐC KIỂM KÊ = ĐO LẠI TRÊN CHÍNH origin/main (cây phụ, nhớ theo mã main) khi bản sửa có vẻ xấu đi: sổ kiem-ke-kq.json commit trên main cũ đi mỗi khi
// có commit castle lên thẳng main (08:13 25/11/2026 Hà phải làm mới mốc vì 42 commit; 13:18 lại trả Thắng vì lỗi cửa way/223145713#2 đã có sẵn trên main).
const mocMain = () => {
  const ma = g('rev-parse', 'origin/main'), wt = join(NHO, 'main-' + ma.slice(0, 12)), kq = join(wt, 'apps/castle/public/du-lieu/neuschwanstein-kiem-ke-kq.json'), xong = join(NHO, 'main-' + ma.slice(0, 12) + '.json');
  if (existsSync(xong)) return JSON.parse(readFileSync(xong, 'utf8'));
  for (const d of g('worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ') && l.includes(join(NHO, 'main-'))).map((l) => l.slice(9))) try { g('worktree', 'remove', '--force', d); } catch { /* đã mất */ }
  g('worktree', 'add', '-q', '--detach', wt, ma);
  try { writeFileSync(kq, ''); execFileSync(process.execPath, [join(wt, 'apps/castle/scripts/kiem-ke.mjs'), '--lau', 'neuschwanstein'], { cwd: wt, stdio: 'pipe', timeout: 90 * 60e3, maxBuffer: 64 << 20 }); } catch { /* còn lỗi thì thoát 1 — vẫn ghi kết quả */ }
  let mat = null; try { mat = JSON.parse(readFileSync(kq, 'utf8')).mat || {}; } catch { /* đo hỏng → không có mốc main, dùng sổ */ }
  try { g('worktree', 'remove', '--force', wt); } catch { /* dọn lượt sau */ }
  if (mat) writeFileSync(xong, JSON.stringify(mat)); return mat;
};
if (!hinh.length) { console.log('· không đổi mã / dữ liệu dựng hình — bỏ bước chấm góc'); }
else {
  // KIỂM KÊ SO VỚI MỐC TRÊN MAIN (17/11/2026: bỏ luật đoán → hàng chục mặt báo THIẾU cùng lúc; đòi sạch hết thì sửa xong một mặt vẫn bị chặn vì mặt khác):
  // trả khi có mặt MỚI lỗi hoặc số lỗi một mặt TĂNG so với kiem-ke-kq.json trên origin/main; lỗi cũ chưa sửa không chặn, giảm lỗi là đạt (mốc mới commit cùng bảng chấm)
  let raKK = ''; try { raKK = chay('kiem-ke.mjs', ['--lau', 'neuschwanstein']); } catch (e) { raKK = loi(e); }
  { let goc = {}; try { goc = JSON.parse(g('show', 'origin/main:apps/castle/public/du-lieu/neuschwanstein-kiem-ke-kq.json')).mat || {}; } catch { /* chưa có mốc: so với rỗng */ }
    const moi = existsSync(du('kiem-ke-kq')) ? JSON.parse(readFileSync(du('kiem-ke-kq'), 'utf8')).mat || {} : {};
    const xauSo = (b) => Object.entries(moi).some(([k, v]) => (v.loi?.length || 0) > (b[k]?.loi?.length || 0));
    if (xauSo(goc)) { const m = mocMain(); if (m) { console.log('· sổ kiểm kê trên main cũ → so với kiểm kê đo lại trên origin/main'); goc = m; } }
    const xau = Object.entries(moi).filter(([k, v]) => (v.loi?.length || 0) > (goc[k]?.loi?.length || 0)).map(([k, v]) => `${k}: ${goc[k]?.loi?.length || 0} → ${v.loi.length} lỗi — ${v.loi.filter((l) => !(goc[k]?.loi || []).includes(l)).slice(0, 3).join(' · ')}`);
    const tong = (m) => Object.values(m).reduce((s, v) => s + (v.loi?.length || 0), 0);
    console.log(`· kiểm kê: ${tong(goc)} → ${tong(moi)} lỗi so với mốc main`);
    if (xau.length) { const ra = 'KIỂM KÊ XẤU ĐI:\n' + xau.slice(0, 10).join('\n') + '\n' + raKK.split('\n').filter((l) => /CHỒNG|LƠ LỬNG|ĐÈ CỬA/.test(l)).join('\n'); nho(false, ra); console.log(ra); tra('kiểm kê mặt xấu đi so với main (danh sách trên)'); } }
  // 2. CHIỀU CAO KHỐI THEO DOM20 CHÍNH THỨC
  { const BY = join(GOC, 'du-lieu-goc', 'bayern'); if (!existsSync(join(BY, 'dom20-32631_5268.tif'))) { try { execFileSync('bash', [join(GOC, 'scripts', 'tai-bayern.sh')], { stdio: 'pipe', timeout: 15 * 60e3 }); } catch (e) { tra('không tải được dữ liệu DOM20 (scripts/tai-bayern.sh): ' + loi(e).split('\n')[0]); } }
    let ra = '', dat = true; try { ra = chay('sua-theo-dom20.mjs', ['--kiem']); } catch (e) { ra = loi(e); dat = false; }
    const tom = ra.split('\n').filter((l) => /khối trong mặt bằng|DỜI|mái lệch hình|thiếu |Error/.test(l)).slice(0, 16).join('\n'); console.log(tom);
    if (!dat) { nho(false, tom); tra('chiều cao khối lệch số đo chính thức DOM20 ≥ 1,5 m (danh sách trên) — sửa bằng sua-theo-dom20.mjs --ghi + doi-chi-tiet.mjs --ghi rồi commit mới'); } }
  if (process.env.CHAM_GOC !== '1') { console.log('· bỏ bước chấm góc theo ảnh 3D Google (thước cũ; chạy tham khảo bằng CHAM_GOC=1)');
    if (g('status', '--porcelain', '--', du('kiem-ke-kq'))) { g('add', du('kiem-ke-kq')); g('commit', '-q', '-m', `castle: sổ kiểm kê sau ${sha.slice(0, 9)} (trọng tài máy: kiểm kê không xấu đi, chiều cao khối khớp DOM20 chính thức)`); }
    nho(true, tom_ok()); }
  else {
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
}
console.log(`✓ TRỌNG TÀI ĐẠT: ${sha.slice(0, 9)}`);
if (DAY) { for (let i = 1; ; i++) { try { g('pull', '-q', '--rebase', 'origin', 'main'); g('push', '-q', 'origin', 'HEAD:main'); break; } catch (e) { if (i >= 3) { console.log('✗ đẩy lên lỗi: ' + loi(e).split('\n')[0]); process.exit(2); } } }
  console.log('đã đẩy lên main: ' + g('rev-parse', '--short', 'HEAD')); }
