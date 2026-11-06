// THÀNH — kỹ sư task Astrolas (anh 06/11/2026: "tạo 1 con CLI cho phòng Astrolas để chuyên nhận và xử lý các tasks … Dùng opus low"). Bộ điều phối iMac gọi mỗi 2 phút (tệp đọc từ box3 mỗi lượt); từ 23:00 đến 07:00 giờ VN thì nghỉ (anh 06/11/2026).
// Một lượt = MỘT task (luật /tasks: chống trôi đặc tả, ngữ cảnh sạch mỗi task): câu anh trả lời dưới tin báo → Rework → Not started, ưu tiên cao trước. Không đụng In progress của máy khác.
// Claude KHÔNG có quyền git push: script tự đẩy, nên chỗ chốt lên máy chủ nằm ở đúng một hằng LEN_MAY_CHU.
//   node astrolas-tasks.mjs        một lượt  · node astrolas-tasks.mjs --thu   in lời giao cho task sẽ nhận, không gọi Claude, không nhận task  · --tu-kiem
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Task máy được nhận từ các bảng `ai-tasks list`: chưa giao ai hoặc giao iMAC; Rework trước, rồi ưu tiên cao, rồi id cũ. */
export function chonTask(bang) {
  const hang = bang.split('\n').map((d) => d.split('|').map((x) => x.trim())).filter((c) => /^\d+$/.test(c[1] ?? ''))
    .map((c) => ({ id: Number(c[1]), status: c[3], pri: c[4], giao: c[5] })).filter((t) => ['Rework', 'Not started'].includes(t.status) && (!t.giao || /^imac$/i.test(t.giao)));
  const hang2 = (t) => [t.status === 'Rework' ? 0 : 1, { High: 0, Medium: 1, Low: 2 }[t.pri] ?? 1, t.id];
  return hang.sort((a, b) => { const x = hang2(a), y = hang2(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; })[0] ?? null;
}
/** Giờ nghỉ: 23:00 → 07:00 giờ VN, không phụ thuộc múi giờ máy. */
export const nghiDem = (ms = Date.now()) => { const h = new Date(ms + 7 * 36e5).getUTCHours(); return h >= 23 || h < 7; };
if (process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  t.equal(chonTask(''), null); t.equal(chonTask('No tasks found.'), null);
  const d = (id, s, p, g = '') => `| ${id} | ten | ${s} | ${p} | ${g} |  |`;
  t.equal(chonTask([d(1, 'Not started', 'Low'), d(2, 'Not started', 'High')].join('\n')).id, 2, 'ưu tiên cao trước');
  t.equal(chonTask([d(2, 'Not started', 'High'), d(9, 'Rework', 'Low')].join('\n')).id, 9, 'Rework trước');
  t.equal(chonTask(d(3, 'Not started', 'High', 'MacPRO')), null, 'giao máy khác: bỏ'); t.equal(chonTask(d(3, 'Not started', 'High', 'iMAC')).id, 3);
  t.equal(chonTask(d(4, 'In progress', 'High')), null, 'In progress của máy khác: bỏ'); t.equal(chonTask(d(4, 'Rejected', 'High')), null);
  const gio = (h, p = 0) => Date.UTC(2026, 10, 6, h - 7, p);
  t.ok(!nghiDem(gio(7)) && !nghiDem(gio(22, 59)), 'ban ngày làm'); t.ok(nghiDem(gio(23)) && nghiDem(gio(6, 59)) && nghiDem(gio(2)), 'đêm nghỉ');
  console.log('astrolas-tasks (máy): tự kiểm đạt'); process.exit(0);
}

// CHỈ iMAC (luật anh 23/10/2026) — cùng một dòng ở mọi script gọi Claude không giao diện
if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`Thành chỉ chạy trên iMac (máy này: ${os.hostname()})`); process.exit(3); }

if (!process.argv.includes('--thu') && nghiDem()) { console.log('Thành nghỉ đêm (23:00 → 07:00 giờ VN)'); process.exit(0); }

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'thanh';
const REPO = path.join(os.homedir(), 'Me/GitHub/Astrolas.com'), CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 30, TRAN_NGAY = 15, MA = 'thanh-imac';
const LEN_MAY_CHU = false, NHANH = 'ai-thanh';   // false: đẩy lên nhánh riêng, chưa lên astrolas.com · true: đẩy vào nhánh ai (deploy thật) — chờ anh chốt
const TEP = path.join(os.homedir(), '.cache/astrolas-tasks.json');
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` };
const thu = process.argv.includes('--thu');
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);
const box = (cmd, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input });
const bao = (id, ket, than, tin) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/astrolas-tasks.mjs --bao ${id} ${ket}${tin ? ` --tin ${Number(tin)}` : ''}`, than);
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', env: ENV, timeout: 300000 }).trim();
const art = (...a) => execFileSync('php', ['artisan', 'ai-tasks', ...a], { cwd: REPO, encoding: 'utf8', env: ENV, timeout: 120000 });
const st = (() => { try { return JSON.parse(fs.readFileSync(TEP, 'utf8')); } catch { return {}; } })();
const luu = () => fs.writeFileSync(TEP, JSON.stringify(st));
const trangThai = (id) => (art('show', `--id=${id}`).match(/^status:\s*(.+)$/m) || [])[1]?.trim();

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -m1 '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Thành đang tắt'); process.exit(0); }
const model = (soul.match(/claude-code:([\w.-]+)/) || [])[1] || 'opus', effort = (soul.match(/effort:(low|medium|high|max)\b/) || [])[1] || 'low';
const homNay = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
if (st.ngay !== homNay) { st.ngay = homNay; st.n = 0; }
if (st.n >= TRAN_NGAY) { log(`đã đủ ${TRAN_NGAY} lượt hôm nay`); process.exit(0); }

// cây bẩn = lượt trước để sót hoặc có người đang sửa tay: không nhận việc, báo một lần
if (git('status', '--porcelain')) { log('cây làm việc có thay đổi dở: không nhận task'); if (!thu && !st.bao_ban) { bao(st.task_cuoi ?? 0, 'treo', `Bản Astrolas trên iMac còn thay đổi chưa commit nên con dừng nhận task.\nCách duy nhất là xem lại ở iMac vì máy không biết các thay đổi đó của ai: ${REPO}.`); st.bao_ban = true; luu(); } process.exit(0); }
st.bao_ban = false;

const ph = thu ? {} : JSON.parse(box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/astrolas-tasks.mjs --phan-hoi`));
const chon = ph.task ? { id: ph.task } : chonTask(['Rework', 'Not started'].map((s) => art('list', `--status=${s}`)).join('\n'));
if (!chon) { log('hết task'); luu(); process.exit(0); }
const id = chon.id;

const giao = `Bạn là Thành, kỹ sư của Phòng Astrolas. Bạn chạy không giao diện, anh không ngồi máy, không hỏi được ai trong lúc làm. Làm ĐÚNG MỘT task #${id} của astrolas.com rồi dừng; không nhận task khác, không tạo task mới.
${ph.anh ? `\nANH VỪA TRẢ LỜI VỀ TASK NÀY (thắng mọi nội dung cũ, đây là đề bài của lượt này): ${ph.anh}\n` : ''}
CÁCH LÀM:
1. Đọc .claude/commands/tasks.md: làm theo Hành động A từ mục "Nạp ngữ cảnh" tới "Sau khi hoàn thành", giọng văn Result, và khối TUYỆT ĐỐI THEO ĐÚNG HƯỚNG DẪN. Bỏ qua phần về batch, suất, multi-agent, Workflow.
2. php artisan ai-tasks show --id=${id} --pull-images rồi Read trực tiếp mọi ảnh. Task Rework thì tập trung vào feedback.
3. Sửa tận gốc, dùng lại component có sẵn, kiểm được thì kiểm (php -l, lint của repo, grep).
4. git add đúng các tệp đã sửa rồi git commit -m "fix: #${id} <mô tả tiếng Việt>". Không được để sót thay đổi chưa commit. Không git push: script tự đẩy.
5. php artisan ai-tasks update --id=${id} --status="Need Reviews" --result="..." đúng giọng văn tasks.md, dòng bản ghi: ↳ bản: ${LEN_MAY_CHU ? 'sẽ lên máy chủ khi deploy xong' : `chưa lên máy chủ (nhánh ${NHANH})`}.
Mỗi lệnh một dòng phẳng: không cd, không &&, không ;, không vòng lặp (lớp quyền chặn).

CẤM (gặp là dừng, đặt Blocked, --result ghi rõ cần anh quyết gì): tinker · migrate · seed · đẩy dữ liệu lên máy chủ (interp2 push, db-sync) · gọi mô hình AI tốn tiền · đổi giá, gói, thanh toán · xoá dữ liệu · git revert / reset / checkout / stash · đặt Done · in khoá, mật khẩu.
Thiếu thông tin không đoán được, hoặc task quá lớn cho 30 phút → php artisan ai-tasks update --id=${id} --status="Blocked" --result="<lý do + cần gì>".

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 2–4 dòng tiếng Việt lời thường cho anh đọc trên điện thoại, không tên tệp, không lệnh: yêu cầu gì · vì sao bị · đã sửa thế nào (hoặc câu hỏi cần anh trả lời). Xưng "con", gọi "anh".`;
if (thu) { console.log(giao); process.exit(0); }

// chỗ duy nhất đổi nhánh: bám origin/ai để không làm trên mã cũ; xung đột thì dừng, không tự gỡ
try {
  git('fetch', '-q', 'origin', 'ai');
  if (git('branch', '--list', NHANH)) git('checkout', '-q', NHANH); else git('checkout', '-q', '-b', NHANH, 'origin/ai');
  const lock = git('rev-parse', 'HEAD:composer.lock'); git('merge', '-q', '--no-edit', 'origin/ai');
  if (git('rev-parse', 'HEAD:composer.lock') !== lock) execFileSync('composer', ['install', '-q', '--no-interaction'], { cwd: REPO, env: ENV, timeout: 300000 });
  if (git('status', '--porcelain')) throw new Error('nhập mã mới xong cây làm việc bị đổi (móc sau khi nhập)');
} catch (e) {
  try { git('merge', '--abort'); } catch { /* không có merge dở */ }
  log(`không nhập được mã mới: ${e.message.split('\n')[0]}`); if (!st.bao_ban) { bao(id, 'treo', `Con chưa nhận được task #${id}: bản trên iMac không nhập được mã mới từ nhánh ai.\n${e.message.split('\n')[0].slice(0, 300)}`, ph.tin); st.bao_ban = true; } luu(); process.exit(1);
}

art('update', `--id=${id}`, `--status=${ph.task ? 'Rework' : 'In progress'}`, `--conversation-id=${MA}`); if (ph.task) art('update', `--id=${id}`, '--status=In progress', `--conversation-id=${MA}`);
st.n++; st.task_cuoi = id; luu();
log(`nhận task #${id} · model ${model} · effort ${effort}`);
const QUYEN = ['Read', 'Glob', 'Grep', `Edit(/${REPO}/**)`, `Write(/${REPO}/**)`, 'Bash(php artisan ai-tasks:*)', 'Bash(php artisan view:clear)', 'Bash(php artisan lint:*)', 'Bash(php artisan lang:sync:*)', 'Bash(php artisan route:list:*)', 'Bash(php -l:*)', 'Bash(node --check:*)',
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(grep:*)', 'Bash(ls:*)'];
const CAM = ['AskUserQuestion', 'Skill', 'RemoteTrigger', 'Agent', 'Task', 'Workflow', 'WebFetch', 'WebSearch', 'CronCreate', 'Bash(git push:*)', 'Bash(git reset:*)', 'Bash(git revert:*)', 'Bash(git checkout:*)', 'Bash(git stash:*)', 'Bash(git clean:*)', 'Bash(php artisan tinker:*)', 'Bash(php artisan migrate:*)', 'Bash(php artisan db:*)', 'Bash(composer:*)', 'Bash(npm:*)'];
const truoc = git('rev-parse', 'HEAD');
const r = spawnSync(CLAUDE, ['-p', giao, '--model', model, '--effort', effort, '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM], { cwd: REPO, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
const ra = String(kq.result || '').trim(), sau = git('rev-parse', 'HEAD');
const than0 = ra.replace(/^\s*\**KET:.*$/gim, '').trim().split(/^\s*[*#\s]*BÁO ANH:?\**\s*$/im).pop().trim();
let ket = /KET:\**\s*DA_SUA/i.test(ra) ? 'da_sua' : /KET:\**\s*CAN_ANH/i.test(ra) ? 'can_anh' : 'treo', than = than0 || `Claude thoát ${r.status ?? r.signal} không kèm báo cáo (${String(r.stderr || r.error?.message || '').slice(0, 200)})`;
// đọc lại trên bảng, không tin lời báo: còn In progress = task kẹt lại, chat khác sẽ tưởng đang có người làm
if (trangThai(id) === 'In progress') { ket = 'treo'; art('update', `--id=${id}`, '--status=Blocked', `--result=Máy dừng giữa chừng: ${than.slice(0, 500)}`); than += '\nTask đã chuyển Blocked để không kẹt.'; }
if (sau !== truoc) { try { git('push', '-q', 'origin', `HEAD:refs/heads/${LEN_MAY_CHU ? 'ai' : NHANH}`); than += `\n${LEN_MAY_CHU ? 'Đã đẩy lên máy chủ' : `Chưa lên astrolas.com, mã ở nhánh ${NHANH}`} (${sau.slice(0, 8)}).`; } catch (e) { ket = 'treo'; than += `\nChưa đẩy được mã: ${e.message.split('\n')[0].slice(0, 200)}`; } }
log(`xong #${id}: ${ket} · commit ${sau === truoc ? 'không' : sau.slice(0, 8)} · ${kq.num_turns ?? '?'} lượt · ${Math.round((kq.duration_ms || 0) / 6e4)} phút`);
bao(id, ket, than, ph.tin);
