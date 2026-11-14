// THẢO — KỸ SƯ PHÒNG SÁCH (anh 15/11/2026: 15 cuốn tới đợt dựng mà máy đêm không dựng được — Kakuro / Christmas Crossword / Christmas Trivia trễ 3–13 ngày —
// "phải có 1 con CLI phụ trách việc đó để nó gọi script kia. Nó ko cần làm trực tiếp cho đỡ tốn token nếu có giải pháp script rồi").
// Cùng khuôn Khang (may/social-sua.mjs): bộ điều phối iMac gọi mỗi 30 phút (viec-nen.json iMac:tc.on.cty.sach-sua), CHỈ gọi Claude khi hàng có việc, mỗi lần một việc.
// Hàng riêng (worker/tho-may-viec.mjs, THO_MAY_TEP=sach-sua.json) nhận `sach:ket|<id dòng sổ>` — puzzle-books scripts/may-chay.mjs (quetKet) xếp khi một cuốn
// tới đợt mà máy không dựng được (lý do đã ghi ở sổ: listing_config.ketSx). Thảo làm trong bản puzzle-books của iMac (repo git, bản máy đêm chạy):
// viết thứ máy THIẾU (hồ sơ dựng themes/<tên>.json, bộ sinh scripts/loai/<loại>.mjs), còn lại GIAO SCRIPT làm (quy-trinh.mjs dựng ruột / bìa / ảnh / bản xem).
//   node sach-sua.mjs        một lượt      · node sach-sua.mjs --thu   in lời giao cho việc đang chờ, không gọi Claude, không nhận việc
import { execFileSync } from 'node:child_process';
import { chayClaude } from './claude-chay.mjs';   // spawnSync + báo lỗi API vào 🚨 (anh 13/11/2026)
import os from 'node:os';
import path from 'node:path';
import { cayRieng } from './cay-rieng.mjs';
import { chonMuc } from './chon-muc.mjs';

if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`Thảo chỉ chạy trên iMac (máy này: ${os.hostname()}) — Claude không giao diện bằng gói thuê bao chỉ iMac`); process.exit(3); }

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'thao', TEP = 'sach-sua.json';
const CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 45, thu = process.argv.includes('--thu');
// mã của chính tệp này chạy từ cây riêng ~/may-ky-su/thao (viec-nen.json) — kéo origin/main đầu lượt để lượt sau chạy mã mới; kéo hỏng thì chạy bản đang có
if (!thu) { try { cayRieng(NGUOI); } catch (e) { console.error(`cây riêng Thảo chưa kéo được: ${e.message.split('\n')[0]}`); } }
// NƠI LÀM = bản puzzle-books của iMac (máy đêm may-chay.mjs chạy ở đây). Repo dùng chung với các việc nền khác → chỉ commit tệp mình sửa (doTruoc).
const SACH = path.join(os.homedir(), 'puzzle-books');
// kdp-<tên>.json = mô tả bán hàng (trạm 'mo-ta' của quy-trinh đọc tệp này) — lượt đầu 15/11/2026 Thảo kẹt vì thiếu quyền ghi tệp này
const QUYEN = ['Read', 'Glob', 'Grep', `Edit(/${SACH}/themes/**)`, `Write(/${SACH}/themes/**)`, `Edit(/${SACH}/scripts/**)`, `Write(/${SACH}/scripts/**)`, `Edit(/${SACH}/kdp-*.json)`, `Write(/${SACH}/kdp-*.json)`,
  `Bash(cd ${SACH}:*)`, `Bash(git -C ${SACH}:*)`, 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add themes/*)', 'Bash(git add scripts/*)', 'Bash(git add kdp-*)', 'Bash(git commit:*)',
  'Bash(node scripts/*)', 'Bash(node --check:*)', `Bash(${os.homedir()}/bin/sanpham:*)`, `Bash(${SACH}/.cong-cu/sanpham:*)`,
  'Bash(grep:*)', 'Bash(tail:*)', 'Bash(head:*)', 'Bash(cat:*)', 'Bash(ls:*)', 'Bash(sed -n:*)', 'Bash(wc:*)', 'Bash(diff:*)', 'Bash(pdfinfo:*)'];
const CAM_BASH = ['git reset', 'git revert', 'git checkout', 'git restore', 'git clean', 'git stash', 'git rebase', 'git push --force', 'git push -f', 'git branch -D', 'git tag -d',
  'rm', 'rmdir', 'rsync', 'scp', 'br', 'open', 'npm install', 'npm i', 'npx', 'brew', 'pip', 'launchctl', 'crontab', 'sudo', 'kill', 'pkill', 'ssh'].map((c) => `Bash(${c}:*)`);
const CAM = [...CAM_BASH, 'AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`, SANPHAM: path.join(SACH, '.cong-cu/sanpham') };
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; } } };
const viec = (args, input) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} THO_MAY_TEP=${TEP} node worker/tho-may-viec.mjs ${args}`, input);
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -E '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Thảo đang tắt'); process.exit(0); }
const dm = (soul.match(/^model:.*$/m) || [''])[0], model = (dm.match(/claude-code:([\w.-]+)/) || [])[1] || 'opus', effort = (dm.match(/effort:(low|medium|high|max)\b/) || [])[1] || null;
const git = (...a) => execFileSync('git', ['-C', SACH, ...a], { encoding: 'utf8' }).trim();
const doTruoc = new Set(git('status', '--porcelain').split('\n').filter(Boolean).map((l) => l.slice(3)));
const r0 = thu ? (() => { const st = JSON.parse(box(`cat ${DATA}/${TEP} 2>/dev/null || echo '{"hang":[]}'`) || '{"hang":[]}'); const x = (st.hang || []).find((y) => y.tt === 'cho'); return x ? { viec: x } : { ly_do: 'không có việc' }; })()
  : JSON.parse(viec('--lay'));
if (!r0.viec) { log(`không nhận việc: ${r0.ly_do}`); process.exit(0); }
const v = r0.viec, chu = String(v.chu).replace(/<[^>]+>/g, '');

const loiGiao = `Bạn là Thảo, Trưởng phòng Sách (công ty AI của anh Tuấn). Phòng làm sách đố vui khổ chữ to (KDP / Etsy / Gumroad) bằng máy trong repo ${SACH}.
Máy dựng đêm vừa báo một cuốn TỚI ĐỢT mà nó không dựng được. Việc của bạn: bổ sung đúng thứ máy thiếu rồi GIAO SCRIPT dựng, tới khi cuốn sang "chờ anh duyệt" — anh không ngồi máy.

${/^anh:/.test(v.khoa) ? `LỆNH ANH (anh trả lời trên Telegram — làm, không hỏi lại):\n${v.cau_hoi ? `ANH ĐANG TRẢ LỜI:\n${String(v.cau_hoi).replace(/<[^>]+>/g, '').slice(0, 3000)}\n` : ''}ANH: ${v.anh ?? chu}\nVIỆC: ${chu}` : `VIỆC (${v.luc}) · khoá ${v.khoa}:\n${chu}`}

TIẾT KIỆM TOKEN — LUẬT SỐ MỘT (anh 15/11/2026): script đã làm được thì GỌI SCRIPT, không tự làm tay, không đọc cả repo.
- Dựng ruột / bìa / ảnh bán / bản xem / ghi sổ = node scripts/quy-trinh.mjs <tên> --den het (máy làm, 0₫). Không tự viết PDF, không tự chạy từng bước nếu quy-trinh làm được.
- Hồ sơ dựng themes/<tên>.json: CHÉP hồ sơ của một cuốn CÙNG LOẠI đã bán (ls themes/, chọn cuốn gần nhất) rồi đổi phần riêng (tên, chủ đề, nội dung, book.sanPham = id dòng sổ). Đọc đúng 1–2 tệp mẫu, không đọc hết.
- Bộ sinh scripts/loai/<loại>.mjs CHỈ viết khi loại chưa có (ls scripts/loai/). Viết theo khuôn bộ sinh gần nhất (kakuro / samurai-sudoku ≈ sudoku.mjs + killer.mjs; fill-in / crossword ≈ tim-chu.mjs;
  trivia / logic grid ≈ hoat-dong.mjs): sinh + KIỂM (đáp án đúng, câu đố có lời giải duy nhất) + tự kiểm (--tu-kiem). Câu đố chữ / trivia: mọi dữ kiện phải đúng, tra được.
- Sổ sản phẩm: ${SACH}/.cong-cu/sanpham show <id> | set <id> --listing_config '{"loai":"…"}' (ghi loại sách nếu sổ chưa có).

CÁCH LÀM:
1. Đọc lý do kẹt trong việc (đã có trong sổ). Xác định loại sách → có bộ sinh chưa → có hồ sơ chưa.
2. Thiếu bộ sinh → viết + node scripts/loai/<loại>.mjs --tu-kiem đạt. Thiếu hồ sơ → chép mẫu + sửa. Thiếu loại trong sổ → ghi.
3. node scripts/quy-trinh.mjs <tên> --den het → đọc kết quả. Trạm hỏng thì sửa đúng chỗ rồi chạy lại. Xong khi sổ sang owner_review (bot tự báo anh "Sản xuất xong").
4. node scripts/may-chay.mjs ket (xoá lý do kẹt khỏi sổ). git add đúng tệp bạn tạo / sửa (themes/…, scripts/loai/…, kdp-<tên>.json) + git commit (tiếng Việt). Repo này KHÔNG có remote (bản máy chạy của iMac) — commit là xong, không push. Không add tệp người khác đang dở.
   Mô tả bán hàng: viết kdp-<tên>.json theo khuôn kdp-<cuốn cùng loại>.json (description + gumroad.description, không tên thương hiệu, không link ra ngoài sàn).
TỰ QUYẾT, KHÔNG HỎI: tên tệp hồ sơ, chủ đề, số câu đố, độ khó, cấu trúc bộ sinh, sửa trạm hỏng của quy-trinh. Lệnh bị từ chối thì gõ lại dạng đơn giản (một lệnh một dòng), không báo anh.
Thiếu thư viện / công cụ trên máy (pypdf, …) hay một lệnh bị từ chối KHÔNG phải việc của anh: ghi rõ vào BÁO ANH và kết KHONG_SUA (máy tự sửa hạ tầng), không hỏi anh.
CAN_ANH CHỈ khi: phải tiêu tiền (AI trả phí trên 5.000₫, mua gì) · phải xoá dữ liệu · phải đổi ngày đăng / bỏ cuốn khỏi lịch.

CẤM: đăng / bấm Publish / bật bán (máy đăng tự làm sau khi anh duyệt) · tự duyệt thay anh · xoá dữ liệu · git revert / reset / checkout / stash · sửa ngoài ${SACH}/themes và ${SACH}/scripts · in khoá / token.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 3–6 dòng tiếng Việt cho anh đọc trên điện thoại,
lời thường, không bảng, mỗi ý một dòng mở bằng nhãn ngắn và dấu hai chấm: cuốn nào · thiếu gì · đã làm gì (tệp + commit) · trạng thái sổ bây giờ. Viết gọn, xưng "con", gọi "anh".`;
if (thu) { console.log(loiGiao); process.exit(0); }
try { viec(`--nhan ${v.id}`); } catch (e) { log(`báo nhận lỗi: ${e.message.split('\n')[0]}`); }
const muc = chonMuc({ chu: v.chu, lanLamLai: String(v.khoa).startsWith('anh:') ? 1 : 0, macDinh: effort || 'low' });
log(`nhận việc #${v.id} ${v.khoa} · model ${model} · effort ${muc.effort} (${muc.ly_do.join(', ')})`);
const truoc = git('rev-parse', 'HEAD');
const r = chayClaude(CLAUDE, ['-p', loiGiao, '--model', model, '--effort', muc.effort, '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM],
  { cwd: SACH, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
const ra = String(kq.result || '').trim(), ketDong = (ra.match(/^\s*\**KET:\**\s*(DA_SUA|KHONG_SUA|CAN_ANH)\b.*$/gim) || []).pop();
const ket = ketDong ? ketDong.match(/DA_SUA|KHONG_SUA|CAN_ANH/i)[0].toLowerCase() : (r.signal || r.error ? 'treo' : 'khong_sua');
const sau = git('rev-parse', 'HEAD'), commit = sau === truoc ? '' : git('log', '--format=%h %s', `${truoc}..${sau}`).split('\n').slice(0, 5).join('\n');
const lan = sau === truoc ? [] : git('diff', '--name-only', `${truoc}..${sau}`).split('\n').filter((f) => doTruoc.has(f));
const boKet = ra.replace(/^\s*\**KET:.*$/gim, '').trim(), sauBao = boKet.split(/^\s*[*#\s]*BÁO ANH:?\**\s*$/im);
const than = ((sauBao.length > 1 ? sauBao.pop().trim() : boKet.split('\n').slice(-8).join('\n')) || `Claude thoát ${r.status ?? r.signal} không kèm báo cáo (${String(r.stderr || r.error?.message || '').slice(0, 200)})`)
  + (commit ? `\n\nCommit:\n${commit}` : '') + (lan.length ? `\n⚠ Commit có kèm tệp vốn đang dở từ trước (của việc nền khác trên iMac): ${lan.join(', ')} — anh xem lại.` : '') + `\n(${Math.round((kq.duration_ms || 0) / 6e4)} phút)`;
log(`xong #${v.id}: ${ket} · commit ${commit ? sau.slice(0, 8) : 'không'} · ${kq.num_turns ?? '?'} lượt`);
viec(`--bao ${v.id} ${ket === 'treo' ? 'treo' : ket}`, than);
