// THÀNH — kỹ sư task Astrolas (anh 06/11/2026: "tạo 1 con CLI cho phòng Astrolas để chuyên nhận và xử lý các tasks … Dùng opus low"). Bộ điều phối iMac gọi mỗi 2 phút (tệp đọc từ box3 mỗi lượt); từ 23:00 đến 07:00 giờ VN thì nghỉ.
// Mỗi phiên chạy NGUYÊN lệnh /tasks của repo (anh: "thứ tự ưu tiên… mọi thứ của command tasks bên dự án astrolas nó phải tuân thủ, ko được lược bỏ bất cứ điều gì"): thứ tự nhận, lô 5 suất, claim, multi-agent, giọng văn, báo cáo đều do .claude/commands/tasks.md quyết,
// script không chọn task thay. Script chỉ lo phần lệnh đó không có: khi nào mở phiên, nạp bản mới, và cổng may/astrolas-xong.mjs sau mỗi task (đủ tài liệu, đủ ảnh, đủ comment, chụp màn, Result đúng luật → đẩy nhánh ai, báo Telegram). Claude KHÔNG có quyền git push.
//   node astrolas-tasks.mjs        một lượt  · node astrolas-tasks.mjs --thu   in lời giao, không gọi Claude  · --tu-kiem
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Task có bản thiết kế (anh 06/11/2026: "với task có thiết kế thì cho nâng lên medium"): đọc đúng lời người báo, không đọc result cũ hay đường dẫn trang. */
export const coThietKe = (show) => /thiết\s*kế|bản\s*mẫu|mockup|\bdesign\b/i.test((show.match(/^human_query:([\s\S]*?)(?:^result:|^images:|^issue_url:)/m) || [])[1] ?? '');
/** Giờ nghỉ: 23:00 → 07:00 giờ VN, không phụ thuộc múi giờ máy. */
export const nghiDem = (ms = Date.now()) => { const h = new Date(ms + 7 * 36e5).getUTCHours(); return h >= 23 || h < 7; };
/** In progress bị gián đoạn: của chính máy này, hoặc của máy khác mà im quá 60 phút (đang có người giữ thì khối CLAIM của /tasks bảo bỏ qua). */
export const gianDoan = (show, ms = Date.now(), ma = 'thanh-imac') => { const conv = (show.match(/^conversation_id:\s*(.+)$/m) || [])[1]?.trim(), u = (show.match(/^updated_at:\s*(.+)$/m) || [])[1]?.trim(); return conv === ma || (!!u && ms - Date.parse(`${u.replace(' ', 'T')}Z`) > 3600000); };
// bài thử --xem-cach: Bash chỉ được đọc (danh sách cho phép của repo rất rộng nên phải chặn bằng móc); ai-tasks cũng chặn để không thấy đáp án trong result
const GAC_CHI_DOC = `c=$(jq -r .tool_input.command); case "$c" in "br goto "*|"br look"*|"br read"*|"br wait"*|"br click "*|"br eval "*) exit 0;; *'&&'*|*';'*|*'|'*|*'>'*|*'$('*) ;; "grep "*|"ls "*|"git log"*|"git show"*|"git diff"*|"git status"*|"php -l "*|"php artisan route:list"*) exit 0;; esac; echo "CHI DOC: bai thu khong sua gi, lenh nay bi chan: $c" >&2; exit 2`;
if (process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  t.ok(coThietKe('human_query: Hãy format lại, giống như bản thiết kế\nĐây là lần 3\nresult: x')); t.ok(!coThietKe('human_query: Xoá chữ này\nresult: theo Design System, thiết kế\nissue_url: /design')); t.ok(!coThietKe('status: x'));
  const gio = (h, p = 0) => Date.UTC(2026, 10, 6, h - 7, p); t.ok(!nghiDem(gio(7)) && !nghiDem(gio(22, 59)), 'ban ngày làm'); t.ok(nghiDem(gio(23)) && nghiDem(gio(6, 59)) && nghiDem(gio(2)), 'đêm nghỉ');
  const bay = Date.UTC(2026, 10, 6, 7, 0); t.ok(gianDoan('conversation_id: thanh-imac\nupdated_at: 2026-11-06 06:59:00', bay), 'của máy này'); t.ok(!gianDoan('conversation_id: abc\nupdated_at: 2026-11-06 06:30:00', bay), 'máy khác đang giữ'); t.ok(gianDoan('conversation_id: abc\nupdated_at: 2026-11-06 05:30:00', bay), 'máy khác im quá lâu');
  const chan = (c) => spawnSync('sh', ['-c', GAC_CHI_DOC], { input: JSON.stringify({ tool_input: { command: c } }) }).status === 2;
  for (const c of ['php artisan ai-tasks show --id=1', 'git fetch origin', 'git commit -m x', 'grep x y > z', 'ls ; rm a', 'git log | sh', 'python3 -c 1', 'git push']) t.ok(chan(c), `phải chặn: ${c}`);
  for (const c of ['grep -n x y', 'git log -5 -- a', 'git show abc', 'br goto "http://a/?x=1&y=2"', 'br eval "a && b > 1"', 'br look']) t.ok(!chan(c), `phải cho: ${c}`);
  console.log('astrolas-tasks (máy): tự kiểm đạt'); process.exit(0);
}

// CHỈ iMAC (luật anh 23/10/2026) — cùng một dòng ở mọi script gọi Claude không giao diện
if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`Thành chỉ chạy trên iMac (máy này: ${os.hostname()})`); process.exit(3); }
if (!process.argv.includes('--thu') && nghiDem()) { console.log('Thành nghỉ đêm (23:00 → 07:00 giờ VN)'); process.exit(0); }

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'thanh';
const REPO = path.join(os.homedir(), 'Me/GitHub/Astrolas.com'), CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 150, TRAN_NGAY = 30, AUDIT_SAU = 15, EFFORT_THIET_KE = 'medium', MA = 'thanh-imac', NHANH = 'ai';
// ghi nhớ dự án nằm trên MacBook; bản trong ~/.claude của iMac đứng từ 06/09/2026 và thiếu tệp → mỗi lượt có việc chép về đây (MacBook tắt thì dùng bản lần trước)
const NHO = path.join(os.homedir(), '.cache/astrolas-memory'), NHO_NGUON = 'nguyens-macbook-pro:.claude/projects/-Users-htuan-Documents-GitHub-Astrolas-com/memory/';
const TEP = path.join(os.homedir(), '.cache/astrolas-tasks.json'), CONG = path.join(os.homedir(), '.cache/astrolas-xong.mjs');
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${os.homedir()}/bin:${process.env.PATH}`, GIT_SSH_COMMAND: 'ssh -o ControlPath=none', BR_SESSION: 'thanh', BR_PROFILE: path.join(os.homedir(), '.cache/astrolas-br'), BR_URL_NGUON: 'site-astrolas-cuc-bo' };   // br: hồ sơ riêng, chỉ mở site cục bộ (anh 06/11/2026: "bật lại cho Thành vào qua br")
const thu = process.argv.includes('--thu');
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input, maxBuffer: 1 << 24 }); } catch (e) { if (i >= 3) throw e; } } };
const baoHang = (than) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/astrolas-tasks.mjs --hang`, than);
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', env: ENV, timeout: 300000 }).trim();
const art = (...a) => execFileSync('php', ['artisan', 'ai-tasks', ...a], { cwd: REPO, encoding: 'utf8', env: ENV, timeout: 120000 });
const docSt = () => { try { return JSON.parse(fs.readFileSync(TEP, 'utf8')); } catch { return {}; } };
let st = docSt(); const luu = () => fs.writeFileSync(TEP, JSON.stringify(st));

fs.writeFileSync(CONG, box(`cat ${APP}/may/astrolas-xong.mjs`));   // Claude gọi cổng này; cũng lấy hàm đếm hàng từ đây vì tệp chính đến qua import dữ liệu
const { hangTask, demHang, tinMoi } = await import(`${pathToFileURL(CONG).href}?v=${Date.now()}`);   // tệp này chạy từ URL data: nên đường dẫn trần là "Invalid URL"

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -m1 '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false && !process.argv.includes('--kiem-nap') && !process.argv.includes('--xem-cach')) { log('Thành đang tắt'); process.exit(0); }
const model = (soul.match(/claude-code:([\w.-]+)/) || [])[1] || 'opus', effort = (soul.match(/effort:(low|medium|high|max)\b/) || [])[1] || 'low';
const QUYEN = ['Read', 'Glob', 'Grep', 'Agent', 'Task', 'Skill', `Edit(/${REPO}/**)`, `Write(/${REPO}/**)`, 'Bash(php artisan ai-tasks:*)', 'Bash(php artisan ship:check:*)', 'Bash(php artisan lint:*)', 'Bash(php artisan view:clear)', 'Bash(php artisan cache:clear)', 'Bash(php artisan optimize:clear)', 'Bash(php artisan lang:sync:*)', 'Bash(php artisan db:seed --class=:*)', 'Bash(br goto:*)', 'Bash(br look)', 'Bash(br read)', 'Bash(br wait:*)', 'Bash(br click:*)', 'Bash(br eval:*)', 'Bash(php artisan migrate)', 'Bash(php artisan deps:export:*)', 'Bash(php artisan design:export:*)', 'Bash(php artisan chart-config:export:*)', 'Bash(php artisan chat-eval:export:*)', 'Bash(php artisan route:list:*)', 'Bash(php -l:*)', 'Bash(node --check:*)',
  `Bash(node ${CONG}:*)`, 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(grep:*)', 'Bash(ls:*)', 'Bash(shell-smells:*)'];
const CAM = ['AskUserQuestion', 'RemoteTrigger', 'WebFetch', 'WebSearch', 'CronCreate', 'Bash(git push:*)', 'Bash(git reset:*)', 'Bash(git revert:*)', 'Bash(git checkout:*)', 'Bash(git stash:*)', 'Bash(git clean:*)', 'Bash(php artisan tinker:*)', 'Bash(php artisan db:wipe:*)', 'Bash(composer:*)', 'Bash(npm:*)'];
// nạp đủ thông tin như một chat Astrolas thật (anh 06/11/2026: "phải đọc đủ các thông tin mà chat ở Astrolas đang thực hiện"): CLAUDE.md chung + mục lục ghi nhớ bản MacBook đưa thẳng vào lời hệ thống. KHÔNG dùng --setting-sources user: thử 06/11/2026, hook Stop của anh lỗi trên iMac kéo phiên chệch sang tự tạo tệp trong ~/.claude/hooks
const ghiNhoMoi = () => { const chung = (() => { try { return fs.readFileSync(path.join(os.homedir(), '.claude/CLAUDE.md'), 'utf8'); } catch { return ''; } })(); try { return `${chung}\n\nMục lục ghi nhớ dự án Astrolas, bản mới nhất từ máy anh đang làm việc. Tệp chi tiết ở ${NHO}/, Read mục nào đụng tới việc đang làm:\n${fs.readFileSync(path.join(NHO, 'MEMORY.md'), 'utf8')}`; } catch { return chung; } };
// tường thật: danh sách cho phép của repo rất rộng (Write trơn, python3…) nên --allowedTools không phải ranh giới; sổ chặn này mới là. Chỉ ghi trong repo, lệnh không đụng ~/.claude
const GAC_REPO = `p=$(jq -r .tool_input.file_path); case "$p" in ${REPO}/*) ;; *) echo "CHỈ ĐƯỢC SỬA TRONG REPO ASTROLAS, không đụng $p" >&2; exit 2;; esac`;
const GAC_LENH = `c=$(jq -r .tool_input.command); case "$c" in *"${REPO}/.claude/"*) ;; *"/.claude/"*|*"~/.claude"*) echo 'CẤM đụng ~/.claude: cấu hình cá nhân của anh. Cần đọc kỹ năng chung thì dùng Read.' >&2; exit 2;; esac`;
// phiên trước chỉ đọc MEMORY và tasks.md rồi sửa, lời dặn không đủ (3/3 phiên 06/11/2026): chặn ở máy, đọc nhật ký phiên chứ không tin lời báo
const GAC = `f=$(jq -r .transcript_path); grep -q '"file_path":"[^"]*/\\.agents/contexts/' "$f" || { echo 'CHƯA ĐỌC TÀI LIỆU PHẦN ĐANG SỬA: Read đúng tệp .agents/contexts/ theo bảng Auto-load trong CLAUDE.md rồi mới được sửa.' >&2; exit 2; }`;
const claude = (ef, loi, chiDoc) => { const r = spawnSync(CLAUDE, ['-p', loi, '--model', model, '--effort', ef, '--output-format', 'json', '--setting-sources', 'project,local', '--append-system-prompt', ghiNhoMoi(), '--settings', JSON.stringify({ hooks: { PreToolUse: chiDoc ? [{ matcher: 'Edit|Write|NotebookEdit', hooks: [{ type: 'command', command: 'echo "CHI DOC: bai thu khong sua tep" >&2; exit 2' }] }, { matcher: 'Bash', hooks: [{ type: 'command', command: GAC_CHI_DOC }] }] : [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: GAC_REPO }, { type: 'command', command: GAC }] }, { matcher: 'Bash', hooks: [{ type: 'command', command: GAC_LENH }] }] } }), '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM], { cwd: REPO, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }); let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ } return { r, kq }; };

// kiểm một phiên đã nạp đủ chưa, không nhận task, không đụng hàng, không báo: node dieu-phoi.mjs goi <nhãn> --kiem-nap, đọc kết quả trong nhật ký
if (process.argv.includes('--kiem-nap')) {
  try { execFileSync('rsync', ['-a', '--delete', '-e', 'ssh -o BatchMode=yes -o ConnectTimeout=5', NHO_NGUON, `${NHO}/`], { env: ENV, timeout: 120000 }); } catch (e) { log(`chưa chép được ghi nhớ: ${e.message.split('\n')[0]}`); }
  const { r, kq } = claude(effort, 'KIỂM TRA, không làm task, không sửa tệp, không gọi ai-tasks. Trả lời ngắn, đánh số: 1) Có đang thấy nội dung ~/.claude/CLAUDE.md không, nêu luật xưng hô trong đó. 2) Có CLAUDE.md của dự án không, nêu tiêu đề đầu. 3) Mục lục ghi nhớ: có mấy nguồn, nêu một dòng của bản "mới nhất từ máy anh". 4) Liệt kê tên các kỹ năng thấy được, có birth-chart, ship-check hay không. 5) Có công cụ Skill và Agent không. 6) Read ~/.claude/skills/design/ydni/SKILL.md rồi nêu dòng đầu sau phần YAML. 7) Thử Write tệp /tmp/thanh-thu-gac.txt nội dung x, nêu nguyên văn kết quả. 8) Chạy đúng từng lệnh sau, mỗi lệnh một lần, ghi được chạy hay bị từ chối và dòng đầu kết quả: php artisan ai-tasks show --id=4476 --pull-images · node '+CONG+' · br goto "http://127.0.0.1:8000/dev-login/1?to=%2Fbirth%3Fyear%3D1986%26month%3D12%26day%3D14%26hour%3D16%26minute%3D30%26name%3DDHOE%26location%3DHa%2BNoi%26lat%3D21.0283334%26lng%3D105.854041%26timezone%3D7%26tab%3Dplanet_status" · br look · php artisan view:clear · php artisan ship:check · git log -3 --oneline -- CLAUDE.md. Chỉ trả lời, thấy báo lỗi gì cũng KHÔNG tự sửa, không đổi trạng thái task.');
  log(`kiểm nạp: ${kq.num_turns ?? '?'} lượt · thoát ${r.status}\n${kq.result ?? String(r.stderr).slice(0, 500)}`); process.exit(0);
}
// bài thử (anh 06/11/2026: "cho nó đọc các comment mới nhất, xem cách nó sẽ triển khai, ko đc làm vì đó là tasks đã làm rồi"): mỗi tệp lo-*.md trong ~/.cache/astrolas-xem-cach là một lô đề đã giấu kết quả; Thành chỉ đọc và viết cách làm vào .ket.md
if (process.argv.includes('--xem-cach')) {
  const THU = path.join(os.homedir(), '.cache/astrolas-xem-cach');
  try { execFileSync('rsync', ['-a', '--delete', '-e', 'ssh -o BatchMode=yes -o ConnectTimeout=5', NHO_NGUON, `${NHO}/`], { env: ENV, timeout: 120000 }); } catch (e) { log(`chưa chép được ghi nhớ: ${e.message.split('\n')[0]}`); }
  try { execFileSync(path.join(os.homedir(), 'bin/br'), ['open', ENV.BR_PROFILE], { encoding: 'utf8', env: ENV, timeout: 90000 }); } catch (e) { log(`chưa mở được br: ${e.message.split('\n')[0]}`); }
  for (const f of fs.readdirSync(THU).filter((x) => /^lo-.*\.md$/.test(x) && !x.endsWith('.ket.md')).sort()) {
    const de = fs.readFileSync(path.join(THU, f), 'utf8'), ef = /thiết\s*kế|bản\s*mẫu|mockup/i.test(de) ? EFFORT_THIET_KE : effort;
    const { r, kq } = claude(ef, `Bạn là Thành, kỹ sư của Phòng Astrolas. ĐÂY LÀ BÀI THỬ CHỈ ĐỌC: các task dưới đây đã có chat khác làm rồi, TUYỆT ĐỐI không làm lại, không sửa tệp, không commit, không đổi trạng thái task (móc máy chặn mọi lệnh ghi và cả ai-tasks; bị chặn thì đọc cách khác, đừng tìm đường vòng). Đề đã được chép sẵn bên dưới, ảnh đã tải sẵn. Mã trên máy là bản TRƯỚC khi họ sửa, nên nhìn trang cục bộ sẽ thấy đúng hiện trạng người báo thấy.
Làm đúng phần chuẩn bị như một phiên thật: Read TOÀN BỘ .claude/commands/tasks.md; với mỗi phần sắp đụng, đọc MỌI tệp context và MỌI kỹ năng dòng đó nêu trong mục "Auto-load Module Context" của CLAUDE.md, cộng astrolas-patterns, cộng .agents/rules.md (sửa giao diện thêm ~/.claude/skills/design/ydni/SKILL.md); mở mục ghi nhớ đụng tới việc; git log -15 -- <tệp sắp sửa>. Read trực tiếp TỪNG ảnh. Comment mới nhất thắng; người báo nói "chưa thấy", "chưa được" thì trước hết coi là đã sửa NHẦM CHỖ, cấm đổ cho bộ nhớ đệm. Ảnh có mũi tên hoặc khoanh đỏ: ghi rõ đầu mũi tên chạm phần tử nào. Có bản thiết kế: liệt kê TỪNG khác biệt nhìn thấy. Task giao diện thì nhìn trang cục bộ: br goto "http://127.0.0.1:8000/dev-login/1?to=<đường dẫn trong Page, đã mã hoá URL>", br wait, br eval để cuộn hoặc đo CSS thật, br look rồi Read ảnh nó in ra. Mỗi lệnh một dòng phẳng.
KẾT QUẢ, mỗi task một mục, tiếng Việt: (1) Người báo muốn gì, ảnh chỉ vào phần tử nào. (2) Vì sao hiện tại đang như vậy, gốc ở đâu (tệp:dòng, selector, giá trị đo được trên trang). (3) Sẽ sửa gì, chính xác ở đâu, từ giá trị nào sang giá trị nào, tái dùng thành phần nào. (4) Ảnh hưởng chỗ nào khác, cần tránh gì. (5) Sẽ kiểm thế nào trước khi báo xong. (6) Chỗ còn chưa chắc. Cuối cùng liệt kê các tệp context, kỹ năng, ghi nhớ đã đọc.

${de}`, true);
    fs.writeFileSync(path.join(THU, f.replace(/\.md$/, '.ket.md')), `phiên ${kq.session_id ?? '?'} · effort ${ef} · ${kq.num_turns ?? '?'} lượt · ${Math.round((kq.duration_ms || 0) / 6e4)} phút · thoát ${r.status}\n\n${kq.result ?? String(r.stderr).slice(0, 2000)}`);
    log(`xem cách ${f}: ${kq.num_turns ?? '?'} lượt · thoát ${r.status}`);
  }
  process.exit(0);
}
const homNay = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
if (st.ngay !== homNay) { st.ngay = homNay; st.n = 0; st.xong = 0; st.can_anh = 0; }
if (st.n >= TRAN_NGAY) { log(`đã đủ ${TRAN_NGAY} task hôm nay`); luu(); process.exit(0); }

// cây bẩn = lượt trước để sót hoặc có người đang sửa tay: không nhận việc, báo một lần
if (git('status', '--porcelain')) { log('cây làm việc có thay đổi dở: không nhận task'); if (!thu && !st.bao_ban) { baoHang(`Bản Astrolas trên iMac còn thay đổi chưa commit nên con dừng nhận task.\nCách duy nhất là xem lại ở iMac vì máy không biết các thay đổi đó của ai: ${REPO}.`); st.bao_ban = true; luu(); } process.exit(0); }
st.bao_ban = false;

// deploy lượt trước hỏng thì câu "đã lên máy chủ" trong tin báo là sai: báo to, một lần
if (!thu && st.deploy_cho) { try { const r = JSON.parse(execFileSync('gh', ['run', 'list', '--branch', NHANH, '--limit', '20', '--json', 'headSha,conclusion,status,name'], { cwd: REPO, encoding: 'utf8', env: ENV, timeout: 60000 })).find((x) => x.headSha === st.deploy_cho && /deploy/i.test(x.name)); if (r?.status === 'completed') { if (r.conclusion === 'failure') baoHang(`❌ Deploy mã ${st.deploy_cho.slice(0, 8)} lên astrolas.com bị lỗi: bản sửa của các task vừa báo CHƯA lên máy chủ.`); st.deploy_cho = null; } } catch (e) { log(`đọc trạng thái deploy lỗi: ${e.message.split('\n')[0]}`); } }

const docHang = () => hangTask(['In progress', 'Rework', 'Not started'].map((s) => art('list', `--status=${s}`)).join('\n'));
const hang = docHang();
// anh 06/11/2026: "Khi Thành check tasks thì sẽ báo về hiện trạng số lượng tasks mới, làm xong cũng báo cáo số lượng"
if (!thu) { const tin = tinMoi(hang, st.da_bao ?? []); if (tin) baoHang(tin); st.da_bao = [...new Set([...(st.da_bao ?? []), ...hang.filter((t) => t.status !== 'In progress').map((t) => t.id)])].slice(-500); }
const ph = thu ? {} : JSON.parse(box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/astrolas-tasks.mjs --phan-hoi`));
if (ph.task) { art('update', `--id=${ph.task}`, '--status=Rework', `--conversation-id=${MA}`); (st.tin ??= {})[ph.task] = ph.tin; }
const coViec = ph.task || hang.some((t) => t.status !== 'In progress' || gianDoan(art('show', `--id=${t.id}`)));
const REVIEW = path.join(os.homedir(), '.cache/astrolas-review-cho'), dsReview = !thu && !coViec && fs.existsSync(REVIEW) ? fs.readFileSync(REVIEW, 'utf8').trim() : '';   // anh 06/11/2026: "xong thì bảo nó review lại các việc đã làm gần đây": tệp chứa danh sách id, hết hàng chờ thì chạy một lần
if (!coViec && !dsReview) { log('hết task'); luu(); process.exit(0); }

// bám origin/ai để không làm trên mã cũ; xung đột thì dừng, không tự gỡ
try {
  git('fetch', '-q', 'origin', NHANH); if (git('branch', '--show-current') !== NHANH) git('checkout', '-q', NHANH);
  const lock = git('rev-parse', 'HEAD:composer.lock'); git('merge', '-q', '--no-edit', `origin/${NHANH}`);
  if (git('rev-parse', 'HEAD:composer.lock') !== lock) execFileSync('composer', ['install', '-q', '--no-interaction'], { cwd: REPO, env: ENV, timeout: 300000 });
  if (git('status', '--porcelain')) throw new Error('nhập mã mới xong cây làm việc bị đổi (móc sau khi nhập)');
} catch (e) { try { git('merge', '--abort'); } catch { /* không có merge dở */ } log(`không nhập được mã mới: ${e.message.split('\n')[0]}`); if (!st.bao_ban && !thu) { baoHang(`Con chưa nhận được task: bản trên iMac không nhập được mã mới từ nhánh ai.\n${e.message.split('\n')[0].slice(0, 300)}`); st.bao_ban = true; } luu(); process.exit(1); }
luu();

const giao = `Bạn là Thành, kỹ sư của Phòng Astrolas. Đọc TOÀN BỘ .claude/commands/tasks.md rồi thực hiện Hành động A ĐÚNG VÀ ĐỦ, như anh vừa gõ /tasks. Không lược bỏ, không rút gọn bất cứ điều gì trong tệp đó: thứ tự nhận task (In progress → Rework → Not started, rồi High → Medium → Low, bỏ qua Rejected), 5 suất, claim cả lô ngay, multi-agent khi hàng chờ từ 3 task, đọc lại nguyên văn trước mỗi task, giọng văn Result, dòng entity, bảng so sánh khi sao chép, khối TUYỆT ĐỐI THEO ĐÚNG HƯỚNG DẪN, Bước 9. conversation-id của bạn: ${MA}.
${ph.task ? `\nANH VỪA TRẢ LỜI VỀ TASK #${ph.task} (đã đặt Rework, thắng mọi nội dung cũ của task đó): ${ph.anh}\n` : ''}
PHẦN RIÊNG VÌ BẠN CHẠY KHÔNG GIAO DIỆN (bổ sung, không thay thế tasks.md):
- Anh không ngồi máy, không hỏi được ai. Chỗ nào tasks.md bảo hỏi user thì đặt Blocked, --result ghi rõ cần anh quyết gì, rồi làm task kế.
- In progress của conversation-id khác mà updated_at trong vòng 60 phút là chat khác đang giữ: bỏ qua theo khối CLAIM. Im quá 60 phút hoặc conversation-id ${MA} là bị gián đoạn: resume.
- ĐỌC ĐỦ NHƯ MỘT CHAT ASTROLAS, không chọn lọc cho nhanh. Phiên này đã nạp CLAUDE.md chung, CLAUDE.md dự án và mục lục ghi nhớ. Kỹ năng dự án dùng công cụ Skill; kỹ năng chung Read ở ~/.claude/skills/<nhóm>/<tên>/SKILL.md (sửa giao diện: design/ydni). Chỉ sửa tệp trong repo Astrolas. Làm theo TOÀN BỘ mục "Auto-load Module Context": với mỗi phần sắp đụng, đọc MỌI tệp context và MỌI kỹ năng dòng đó nêu, cộng astrolas-patterns, cộng .agents/rules.md, cộng thuộc tính contexts của task. Mở mọi mục ghi nhớ đụng tới việc đang làm ở cả hai nguồn: mục lục "mới nhất" trong lời hệ thống và ghi nhớ phiên tự nạp; trái nhau thì bản mới nhất thắng. Chat khác đang sửa cùng chỗ: chạy git log -15 -- <tệp sắp sửa> và đọc các commit gần đây trước khi đụng vào, đừng đè việc của họ. Cổng cuối đối chiếu tệp đã sửa với bảng: thiếu tệp nào là không cho qua.
- ĐỌC HẾT: task Rework phải đọc toàn bộ luồng trong show (mọi Feedback, mọi AI reply, discord_comments, result cũ), comment mới nhất thắng. Mọi ảnh, kể cả ảnh đính trong comment, tải bằng show --pull-images rồi Read trực tiếp TỪNG tệp; thiếu ảnh nào thì cổng cuối không cho qua. Tải không được ảnh thì Blocked, không làm mò.
- Ảnh có mũi tên / khung đỏ: xác định đúng phần tử đầu mũi tên chạm vào (khung nào, chứa chữ gì, lớp ngoài hay lớp trong), ghi ra trước khi sửa, rồi đối chiếu trên trang. #4476 từng sửa nhầm khối bên trong hai lần trong khi mũi tên chỉ khung ngoài cùng. Người báo nói "không thấy", "chưa đổi", "làm lại": trước hết coi là bạn SỬA NHẦM CHỖ, đọc lại ảnh gốc; CẤM đổ cho bộ nhớ đệm nếu chưa chứng minh bằng ảnh chụp.
- Có ảnh bản thiết kế hoặc khoanh vùng: liệt kê TỪNG khác biệt nhìn thấy (icon, viền, nền, kẻ dòng, căn lề, cỡ chữ, dạng pill, thứ tự, chữ thừa) rồi sửa đủ. Result cũ có danh sách mục thì đi lại TỪNG mục trước khi báo; mục chưa làm ghi "Chưa làm: …", không gộp mục mới cho đủ số.
- NHÌN TRANG THẬT trước khi commit, mọi task đụng giao diện: site cục bộ chạy sẵn ở http://127.0.0.1:8000 cùng mã bạn vừa sửa, dữ liệu riêng máy này. Sau view:clear và cache:clear: br goto "http://127.0.0.1:8000/dev-login/1?to=<đường dẫn trong issue_url, đã mã hoá URL>" (admin), br wait, br eval "document.querySelector('<selector>').scrollIntoView()", br click để mở khối, br look rồi Read tệp ảnh nó in ra NGAY. Lệch thì sửa rồi chụp lại. Chỉ được viết "khớp bản thiết kế" khi đã chụp và so. Thiếu dữ liệu giống ảnh thì so bố cục.
- Commit xong đặt Need Reviews như tasks.md, không ghi dòng ↳ bản: (máy ghi), KHÔNG git push. Rồi NGAY SAU MỖI task (cả task Blocked) chạy một lệnh: node ${CONG} <id> "<2–4 dòng lời thường cho anh đọc trên điện thoại, không tên tệp, không lệnh: yêu cầu gì · vì sao bị · đã sửa thế nào hoặc câu hỏi cần anh trả lời. Xưng con, gọi anh>"
  Lệnh đó kiểm đủ tài liệu, đủ ảnh, đủ show, chụp màn, Result đúng luật, rồi đẩy lên máy chủ và báo Telegram. Nó báo CHƯA QUA CỔNG thì làm đủ điều nó nêu rồi gọi lại; chưa qua cổng thì task coi như chưa xong. Không mở được trang: thêm --khong-chup "<lý do>".
- Mỗi lệnh một dòng phẳng: không cd, không &&, không ;, không vòng lặp (lớp quyền chặn).
- CẤM (gặp là Blocked): tinker · migration xoá hoặc đổi dữ liệu có sẵn · đẩy dữ liệu lên máy chủ (interp2 push, db-sync) · gọi mô hình AI tốn tiền · đổi giá, gói, thanh toán · xoá dữ liệu · git revert / reset / checkout / stash · đặt Done · in khoá, mật khẩu. Seed chỉ đụng dữ liệu cục bộ, chạy được để nhìn thử; seeder mới vẫn phải thêm vào deploy như CLAUDE.md.
Kết thúc bằng báo cáo Bước 9 của tasks.md, gồm dòng **Hàng chờ:**.`;
const giaoReview = `Bạn là Thành, kỹ sư của Phòng Astrolas, chạy không giao diện. Đọc TOÀN BỘ .claude/commands/tasks.md rồi thực hiện Hành động D (re-review) ĐÚNG VÀ ĐỦ cho đúng các task: ${dsReview}. Không lược bỏ gì, TUYỆT ĐỐI không đặt Done. Đọc nguyên văn từng task bằng php artisan ai-tasks show --id=<id> --pull-images (toàn bộ luồng, mọi comment), Read trực tiếp TỪNG ảnh, đọc đủ tệp .agents/contexts/ và .claude/skills/ theo bảng Auto-load trong CLAUDE.md, đối chiếu từng mệnh đề của yêu cầu với mã thật, không tin result cũ. Task giao diện thì nhìn trang cục bộ: br goto "http://127.0.0.1:8000/dev-login/1?to=<đường dẫn đã mã hoá>", br look rồi Read ảnh, so với ảnh của task. Không sửa mã trong lượt này. Chắc chắn lệch yêu cầu thì đặt Rework, --result nêu rõ thiếu gì như tasks.md cho phép. Mỗi lệnh một dòng phẳng.
KẾT THÚC bằng dòng "BÁO ANH:" rồi tiếng Việt lời thường cho anh đọc trên điện thoại, không tên tệp, nhóm theo 3 nhãn của Hành động D: ✅ khớp · ⚠ lệch (đã đặt Rework, thiếu gì) · ⏸ cần anh xem. Mỗi task một dòng. Xưng "con", gọi "anh".`;
if (thu) { console.log(giao); process.exit(0); }

try { execFileSync('rsync', ['-a', '--delete', '-e', 'ssh -o BatchMode=yes -o ConnectTimeout=5', NHO_NGUON, `${NHO}/`], { env: ENV, timeout: 120000 }); } catch (e) { log(`chưa chép được ghi nhớ từ MacBook, dùng bản lần trước: ${e.message.split('\n')[0]}`); }
try { execFileSync(path.join(os.homedir(), 'bin/br'), ['open', ENV.BR_PROFILE], { encoding: 'utf8', env: ENV, timeout: 90000 }); } catch (e) { log(`chưa mở được br: ${e.message.split('\n')[0]}`); }

if (dsReview) {
  baoHang(`🔍 Hết hàng chờ, con review lại các task: ${dsReview}.`); log(`mở phiên re-review: ${dsReview}`);
  const { r: rr, kq: kr } = claude(EFFORT_THIET_KE, giaoReview);
  fs.rmSync(REVIEW, { force: true });
  log(`re-review xong · ${kr.num_turns ?? '?'} lượt · ${Math.round((kr.duration_ms || 0) / 6e4)} phút`);
  baoHang(`🔍 Review lại: ${dsReview}\n${String(kr.result || '').replace(/^\s*\**Việc chính:.*$/gim, '').trim().split(/^\s*[*#\s]*BÁO ANH:?\**[ \t]*/im).pop().trim() || `Dừng giữa chừng: Claude thoát ${rr.status ?? rr.signal} (${String(rr.stderr || rr.error?.message || '').slice(0, 200)})`}`);
  luu(); process.exit(0);
}
// một lô có task thiết kế thì cả phiên lên medium: effort đặt theo phiên, /tasks làm cả lô trong một phiên
const nhom = [...(ph.task ? [{ id: ph.task }] : []), ...hang].slice(0, 5), ef = nhom.some((t) => coThietKe(art('show', `--id=${t.id}`))) ? EFFORT_THIET_KE : effort;
log(`mở phiên /tasks · hàng ${demHang(hang)} · model ${model} · effort ${ef}`);
const xongTruoc = st.xong ?? 0, { r, kq } = claude(ef, giao);
st = docSt();   // cổng xong đã ghi số vào tệp trong lúc phiên chạy
log(`phiên xong: ${(st.xong ?? 0) - xongTruoc} task · ${kq.num_turns ?? '?'} lượt · ${Math.round((kq.duration_ms || 0) / 6e4)} phút`);
if (!kq.result) baoHang(`⏹ Phiên làm task dừng giữa chừng: Claude thoát ${r.status ?? r.signal} (${String(r.stderr || r.error?.message || '').slice(0, 200)}). Task dở vẫn ở In progress, lượt sau con làm tiếp.`);

// anh 06/11/2026: "sau khoảng 15 tasks làm xong thì chạy command audit 1 lần (có báo telegram)". Chạy khi hết phiên, đúng lệnh /audit của anh, phạm vi chỉ các commit của Thành từ lần audit trước. Sửa gì cũng qua đẩy thường.
if (!nghiDem() && (st.audit ?? []).length >= AUDIT_SAU) {
  const ds = st.audit, ids = [...new Set(ds.map((x) => `#${x.id}`))].join(', ');
  baoHang(`🔎 Đã đủ ${ds.length} lần sửa, con chạy audit các task: ${ids}.`);
  const truoc = git('rev-parse', 'HEAD');
  const { r: ra, kq: kqa } = claude(effort, `Bạn là Thành, kỹ sư của Phòng Astrolas, chạy không giao diện. Anh đã ra lệnh chạy /audit sau mỗi khoảng ${AUDIT_SAU} task.
Read ${os.homedir()}/.claude/commands/audit.md và làm đúng lệnh đó, không lược bỏ mục nào. Phạm vi CHỈ các commit sau của bạn (git show <mã>), không lấy cây làm việc, không lan sang mã khác:
${ds.map((x) => `#${x.id}: ${x.sha}`).join('\n')}
Mục cần đo màn: nhìn bằng br trên site cục bộ http://127.0.0.1:8000 (br goto, br look rồi Read ảnh); không đo được thì ghi "chưa đo". Trước khi sửa phải Read đủ tệp .agents/contexts/ và .claude/skills/ của phần đó theo bảng Auto-load trong CLAUDE.md. Sửa thì chạy php artisan ship:check, git add đúng tệp, git commit -m "refactor: audit <các #task>"; không git push, script tự đẩy. Đổi bố cục, đổi đặc tả, hay việc CẤM (tinker, đẩy dữ liệu, gọi AI tốn tiền, giá, xoá dữ liệu, hoàn tác git) thì KHÔNG làm, ghi thành mục cần anh quyết.
KẾT THÚC bằng một dòng "BÁO ANH:" rồi 3–6 dòng tiếng Việt lời thường cho anh đọc trên điện thoại, không tên tệp: tìm thấy gì · đã sửa gì · mục nào bỏ qua hoặc chưa đo · gì cần anh quyết. Xưng "con", gọi "anh".`);
  const sau = git('rev-parse', 'HEAD'); let than = String(kqa.result || '').replace(/^\s*\**Việc chính:.*$/gim, '').trim().split(/^\s*[*#\s]*BÁO ANH:?\**[ \t]*/im).pop().trim() || `Audit dừng giữa chừng: Claude thoát ${ra.status ?? ra.signal} (${String(ra.stderr || ra.error?.message || '').slice(0, 200)})`;
  if (sau !== truoc) { try { git('fetch', '-q', 'origin', NHANH); git('merge', '-q', '--no-edit', `origin/${NHANH}`); git('push', '-q', 'origin', `HEAD:refs/heads/${NHANH}`); st.deploy_cho = git('rev-parse', 'HEAD'); than += `\nĐã đẩy lên máy chủ (${sau.slice(0, 8)}).`; } catch (e) { try { git('merge', '--abort'); } catch { /* không có merge dở */ } than += `\nChưa đẩy được lên máy chủ: ${e.message.split('\n')[0].slice(0, 200)}`; } }
  st.audit = []; luu();
  log(`audit xong: commit ${sau === truoc ? 'không' : sau.slice(0, 8)} · ${kqa.num_turns ?? '?'} lượt · ${Math.round((kqa.duration_ms || 0) / 6e4)} phút`);
  baoHang(`🔎 Audit ${ids}\n${than}`);
}
luu();
