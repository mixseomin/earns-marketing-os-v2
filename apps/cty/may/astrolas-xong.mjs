// CỔNG XONG TASK CỦA THÀNH (anh 06/11/2026: "bắt buộc nó phải load đc ảnh", "khi có comment rework thì cũng phải đọc hết", "làm xong thì báo luôn lên tele", "cho phép nó push"). may/astrolas-tasks.mjs chép tệp này về ~/.cache trước mỗi phiên;
// Claude gọi nó sau MỖI task trong lô /tasks. Không qua cổng thì không đẩy, không báo: mã thoát 1 kèm lý do để phiên đó làm cho đủ rồi gọi lại. Đo bằng nhật ký phiên chứ không tin lời báo.
//   node astrolas-xong.mjs <id> "<2–4 dòng báo anh>" [--khong-chup "<lý do>"]   · --tu-kiem
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Các task máy được nhận từ bảng `ai-tasks list`: chưa giao ai hoặc giao iMAC. Thứ tự do /tasks quyết, ở đây chỉ để đếm và báo. */
export const hangTask = (bang) => bang.split('\n').map((d) => d.split('|').map((x) => x.trim())).filter((c) => /^\d+$/.test(c[1] ?? '')).map((c) => ({ id: Number(c[1]), status: c[3], pri: c[4], giao: c[5] })).filter((t) => !t.giao || /^imac$/i.test(t.giao));
export const demHang = (hang) => { const n = (s) => hang.filter((t) => t.status === s).length; return `${n('In progress')} đang làm · ${n('Rework')} làm lại · ${n('Not started')} mới`; };
/** Tin hiện trạng: task chưa từng báo (da = id đã báo) thì báo, không có gì mới thì null — nhịp 2 phút không được thành 2 phút một tin. */
export function tinMoi(hang, da = []) {
  const moi = hang.filter((t) => t.status !== 'In progress' && !da.includes(t.id)); if (!moi.length) return null;
  return `📥 ${moi.length} task mới: ${moi.slice(0, 10).map((t) => `#${t.id}`).join(', ')}${moi.length > 10 ? '…' : ''}\nHàng chờ: ${demHang(hang)}.`;
}
/** Result đọc từ `ai-tasks show`. */
export const docKetQua = (show) => (show.match(/^result: ([\s\S]*?)\n(?:images:|issue_url:|conversation_id:)/m) || [])[1]?.trim() ?? '';
/** Dòng bản do máy ghi, không để mô hình đoán: nó ghi trước khi đẩy nên từng ra "chưa lên máy chủ" trên bản đã lên (#4469). Đặt ngay trước dòng entity. */
export const ghiBan = (kq, sha) => { const r = kq.replace(/\s*↳ bản:[^\n]*/g, '').trim(), ban = `↳ bản: đã lên máy chủ ${sha}`, i = r.indexOf('↳ entity:'); return i < 0 ? `${r}\n${ban}` : `${r.slice(0, i).trimEnd()}\n${ban}\n${r.slice(i)}`; };
/** Lỗi đo được của Result theo luật tasks.md: thiếu dòng entity, phần mô tả lộ tên kỹ thuật (tên tệp, seeder, khoá icon / locale, biến CSS). Lời văn thì không đo được, phần đó vẫn do mô hình. */
export const loiKetQua = (kq) => { const than = kq.replace(/↳[^\n]*/g, '').replace(/\S*astrolas\.com\S*/g, ''), ky = than.match(/[\w/-]+\.(?:blade|php|css|js|json)\b|\bSeed[A-Z]\w*|\b[a-z]+\.[a-z][a-z_-]*\b|\b[a-z]+_[a-z_]+\b|--[a-z][\w-]+|\bfs-[a-z]+\b/g) ?? []; return [...(kq.includes('↳ entity:') ? [] : ['thiếu dòng cuối ↳ entity:']), ...(ky.length ? [`phần mô tả có tên kỹ thuật: ${[...new Set(ky)].join(', ')}`] : [])]; };
/** Số ảnh của task theo `ai-tasks show` (ảnh gốc + ảnh đính trong comment đều nằm ở đây). */
export const soAnh = (show) => (show.split(/^images:\s*$/m)[1]?.split(/^\S/m)[0].match(/^\s+\[\d+\]/gm) ?? []).length;
/** Số ảnh khác nhau của task đã được Read thật trong nhật ký phiên. */
export const anhDaDoc = (nhatKy, id) => new Set(nhatKy.match(new RegExp(`"file_path":"/tmp/task-images/t${id}(?:_\\d+)?\\.[a-z]+"`, 'g')) ?? []).size;
/** Lý do chưa được báo xong, [] = qua cổng. Đã đọc nguyên văn task (show) + đủ ảnh + Result đúng luật + nhìn trang nếu đụng giao diện. */
export const cong = ({ id, show, nhatKy, doiGiaoDien, chupMoi, khongChup }) => [
  ...(new RegExp(`ai-tasks show --id=[\\d,-]*\\b${id}\\b`).test(nhatKy) || khoangCoId(nhatKy, id) ? [] : [`chưa đọc nguyên văn task: php artisan ai-tasks show --id=${id} --pull-images`]),
  ...(anhDaDoc(nhatKy, id) < soAnh(show) ? [`task có ${soAnh(show)} ảnh mà phiên mới Read ${anhDaDoc(nhatKy, id)}: chạy show --pull-images rồi Read TỪNG ảnh trực tiếp; tải không được thì đặt Blocked, không được làm khi chưa thấy ảnh`] : []),
  ...loiKetQua(docKetQua(show)).map((x) => `Result: ${x}; viết lại bằng ai-tasks update rồi gọi lại`),
  ...(doiGiaoDien && !chupMoi && !khongChup ? ['đã sửa giao diện mà chưa chụp màn: br goto, br look rồi Read ảnh để so; thật sự không mở được thì gọi lại với --khong-chup "<lý do>"'] : []),
];
/** `show --id=2653-2660` (tasks.md cho phép gọi theo khoảng) cũng tính là đã đọc. */
const khoangCoId = (nhatKy, id) => [...nhatKy.matchAll(/ai-tasks show --id=[\d,-]*?(\d+)-(\d+)/g)].some((m) => Number(m[1]) <= id && id <= Number(m[2]));

if (process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  const d = (id, s, p, g = '') => `| ${id} | ten | ${s} | ${p} | ${g} |  |`;
  t.deepEqual(hangTask('No tasks found.'), []); t.equal(hangTask(d(3, 'Not started', 'High', 'MacPRO')).length, 0, 'giao máy khác: bỏ'); t.equal(hangTask(d(3, 'Rework', 'High', 'iMAC')).length, 1);
  const h2 = [{ id: 1, status: 'Rework' }, { id: 2, status: 'Not started' }, { id: 3, status: 'In progress' }];
  t.match(tinMoi(h2, []), /2 task mới: #1, #2\nHàng chờ: 1 đang làm · 1 làm lại · 1 mới/); t.equal(tinMoi(h2, [1, 2]), null, 'đã báo: im'); t.equal(tinMoi([], []), null);
  t.equal(docKetQua('status: x\nresult: dòng 1\n↳ entity: —\nimages:\n  [1] a'), 'dòng 1\n↳ entity: —'); t.equal(docKetQua('status: x\nissue_url: y'), '');
  t.equal(ghiBan('Việc.\n↳ bản: chưa lên máy chủ\n↳ entity: a (reuse)', 'abc'), 'Việc.\n↳ bản: đã lên máy chủ abc\n↳ entity: a (reuse)', 'thay dòng sai'); t.equal(ghiBan('Việc. ↳ bản: đã lên máy chủ x.', 'abc'), 'Việc.\n↳ bản: đã lên máy chủ abc', 'dòng dính cuối câu');
  t.deepEqual(loiKetQua('Đã sửa, xem https://astrolas.com/birth?a_b=1.\n↳ bản: x\n↳ entity: x-entity.a_b (reuse)'), [], 'dòng ↳ và link không tính'); t.match(loiKetQua('Thêm planet.sect_balance vào SeedUiIcons, cỡ fs-xl.\n↳ entity: —')[0], /planet\.sect_balance, SeedUiIcons, fs-xl/); t.match(loiKetQua('Việc.')[0], /thiếu dòng/);
  const show2 = 'status: Need Reviews\nresult: Việc.\n↳ entity: —\nimages:\n  [1] /a.jpg\n  [2] /b.jpg\n  ↓ /tmp/task-images/t9_1.jpg\nissue_url: x\n'; t.equal(soAnh(show2), 2); t.equal(soAnh('status: x\nissue_url: y\n'), 0);
  const nk = '"command":"php artisan ai-tasks show --id=8,9 --pull-images" "file_path":"/tmp/task-images/t9_1.jpg" "file_path":"/tmp/task-images/t9_1.jpg" "file_path":"/tmp/task-images/t99.jpg"'; t.equal(anhDaDoc(nk, 9), 1, 'một ảnh đọc hai lần vẫn là một, t99 không phải t9');
  const c0 = { id: 9, show: show2, nhatKy: nk, doiGiaoDien: false, chupMoi: false, khongChup: null };
  t.match(cong(c0)[0], /2 ảnh mà phiên mới Read 1/, 'thiếu ảnh: chặn'); const nk2 = `${nk} "file_path":"/tmp/task-images/t9_2.jpg"`; t.deepEqual(cong({ ...c0, nhatKy: nk2 }), []);
  t.match(cong({ ...c0, nhatKy: nk2, doiGiaoDien: true })[0], /chưa chụp màn/); t.deepEqual(cong({ ...c0, nhatKy: nk2, doiGiaoDien: true, chupMoi: true }), []); t.deepEqual(cong({ ...c0, nhatKy: nk2, doiGiaoDien: true, khongChup: 'x' }), []);
  t.match(cong({ ...c0, nhatKy: '"file_path":"/tmp/task-images/t9_1.jpg" "file_path":"/tmp/task-images/t9_2.jpg"' })[0], /chưa đọc nguyên văn/, 'không show: chặn');
  t.deepEqual(cong({ ...c0, nhatKy: 'ai-tasks show --id=5-12 --pull-images "file_path":"/tmp/task-images/t9_1.jpg" "file_path":"/tmp/task-images/t9_2.jpg"' }), [], 'show theo khoảng: tính'); t.match(cong({ ...c0, id: 99, show: 'status: x\nresult: V.\n↳ entity: —\nissue_url: y\n', nhatKy: 'ai-tasks show --id=9 ' })[0], /chưa đọc nguyên văn/, 'id khác: chặn');
  console.log('astrolas-xong: tự kiểm đạt'); process.exit(0);
}
if (process.argv[1]?.endsWith('astrolas-xong.mjs')) {
  if (!os.hostname().startsWith('Tuans-iMac')) { console.error('chỉ chạy trên iMac'); process.exit(3); }
  const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NHANH = 'ai';
  const REPO = path.join(os.homedir(), 'Me/GitHub/Astrolas.com'), TEP = path.join(os.homedir(), '.cache/astrolas-tasks.json'), PHIEN = path.join(os.homedir(), '.claude/projects/-Users-htuan-Me-GitHub-Astrolas-com');
  const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`, GIT_SSH_COMMAND: 'ssh -o ControlPath=none' };
  const die = (s) => { console.error(`CHƯA QUA CỔNG, chưa đẩy, chưa báo:\n- ${[].concat(s).join('\n- ')}`); process.exit(1); };
  const a = process.argv.slice(2), id = Number(a[0]), chu = a[1]; if (!id || !chu) die('cách gọi: node astrolas-xong.mjs <id> "<báo anh>" [--khong-chup "<lý do>"]');
  const iK = a.indexOf('--khong-chup'), khongChup = iK > 0 ? a[iK + 1] : null;
  const git = (...x) => execFileSync('git', ['-C', REPO, ...x], { encoding: 'utf8', env: ENV, timeout: 300000 }).trim();
  const art = (...x) => execFileSync('php', ['artisan', 'ai-tasks', ...x], { cwd: REPO, encoding: 'utf8', env: ENV, timeout: 120000 });
  const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; } } };
  const st = (() => { try { return JSON.parse(fs.readFileSync(TEP, 'utf8')); } catch { return {}; } })(); const luu = () => fs.writeFileSync(TEP, JSON.stringify(st));
  const show = art('show', `--id=${id}`), tt = (show.match(/^status:\s*(.+)$/m) || [])[1]?.trim();
  const bao = (ket, than) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/astrolas-tasks.mjs --bao ${id} ${ket}${st.tin?.[id] ? ` --tin ${Number(st.tin[id])}` : ''}`, than);
  const cuoi = () => { let con = '?'; try { con = demHang(hangTask(['In progress', 'Rework', 'Not started'].map((s) => art('list', `--status=${s}`)).join('\n'))); } catch { /* không đọc được thì báo dấu hỏi */ } return `\n\nHôm nay: ${st.xong ?? 0} xong · ${st.can_anh ?? 0} cần anh. Hàng chờ: ${con}.`; };
  if (tt === 'Blocked') { st.can_anh = (st.can_anh ?? 0) + 1; luu(); bao('can_anh', chu + cuoi()); console.log('đã báo anh'); process.exit(0); }
  if (tt !== 'Need Reviews') die(`task đang ở "${tt}": đặt Need Reviews hoặc Blocked trước`);
  const moi = fs.readdirSync(PHIEN).filter((f) => f.endsWith('.jsonl')).map((f) => ({ f, t: fs.statSync(path.join(PHIEN, f)).mtimeMs })).sort((x, y) => y.t - x.t)[0]?.f ?? '';
  const ss = moi.replace('.jsonl', ''), con = path.join(PHIEN, ss); let nhatKy = moi ? fs.readFileSync(path.join(PHIEN, moi), 'utf8') : '';   // ảnh có thể do tác tử phụ đọc: gộp cả nhật ký của chúng
  try { for (const f of fs.readdirSync(con, { recursive: true })) if (String(f).endsWith('.jsonl')) nhatKy += fs.readFileSync(path.join(con, f), 'utf8'); } catch { /* phiên không có tác tử phụ */ }
  git('fetch', '-q', 'origin', NHANH);
  const doi = git('diff', '--name-only', `origin/${NHANH}...HEAD`), soChup = (nhatKy.match(/"command":"br look/g) ?? []).length, chupTruoc = st.chup?.ss === ss ? st.chup.n : 0;
  const loi = cong({ id, show, nhatKy, doiGiaoDien: /resources\/views|public\/(css|js)\//.test(doi), chupMoi: soChup > chupTruoc, khongChup }); if (loi.length) die(loi);
  st.chup = { ss, n: soChup };
  let than = chu;
  if (doi) {
    if (git('status', '--porcelain')) die('còn thay đổi chưa commit');
    const truoc = git('rev-parse', `origin/${NHANH}`);
    try { git('merge', '-q', '--no-edit', `origin/${NHANH}`); git('push', '-q', 'origin', `HEAD:refs/heads/${NHANH}`); } catch (e) { try { git('merge', '--abort'); } catch { /* không có merge dở */ } die(`không đẩy được lên nhánh ai: ${e.message.split('\n')[0].slice(0, 300)}`); }
    const sha = git('rev-parse', 'HEAD'); art('update', `--id=${id}`, `--result=${ghiBan(docKetQua(art('show', `--id=${id}`)), sha.slice(0, 9))}`);
    st.deploy_cho = sha; (st.audit ??= []).push({ id, sha: sha.slice(0, 9), truoc: truoc.slice(0, 9) }); than += `\nĐã đẩy lên máy chủ (${sha.slice(0, 8)}).`;
  }
  if (khongChup) than += `\n👁 Chưa nhìn trên trang: ${khongChup}`;
  st.n = (st.n ?? 0) + 1; st.xong = (st.xong ?? 0) + 1; luu();
  bao('da_sua', than + cuoi()); console.log('đã đẩy và báo anh; làm task kế theo /tasks');
}
