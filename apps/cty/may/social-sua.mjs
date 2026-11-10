// KHANG — KỸ SƯ SOCIAL (anh 10/11/2026: 9 bài Scam or Real? kẹt SỬA LẠI từ 01/11 không ai làm lại → "Phải có 1 con CLI phụ trách việc này. Tham khảo thằng Thành
// (astrolas) và Huy (Ethopex) để làm 1 con phụ trách"). Cùng khuôn Huy (may/etp-sua.mjs): bộ điều phối iMac gọi mỗi 5 phút (viec-nen.json iMac:tc.on.cty.social-sua).
// Lấy MỘT việc ở hàng riêng của Khang (worker/tho-may-viec.mjs với THO_MAY_TEP=social-sua.json — Phòng Nội dung xếp `social:sua|<máy>` sau mỗi lượt chấm khi máy có bài
// chưa đăng bị SỬA LẠI quá 1 giờ; anh trả lời dưới tin của Khang = lệnh `anh:`), báo đã nhận trong 📂 Social Traffic, chạy Claude Code KHÔNG GIAO DIỆN trong repo mos2:
// làm lại bài (may-dung --lam-lai-sua) hoặc sửa GỐC máy sinh bài, kiểm, deploy, rồi trả lời ngay dưới tin. Luật: Claude không giao diện bằng gói thuê bao CHỈ chạy trên iMac.
//   node social-sua.mjs        một lượt      · node social-sua.mjs --thu   in lời giao cho việc đang chờ, không gọi Claude, không nhận việc
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`Khang chỉ chạy trên iMac (máy này: ${os.hostname()}) — Claude không giao diện bằng gói thuê bao chỉ iMac`); process.exit(3); }

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'khang', TEP = 'social-sua.json';
const MOS2 = path.join(os.homedir(), 'Me/GitHub/earns-marketing-os-v2'), CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 30;
// QUYỀN HẸP: sửa CHỈ phần bài social của repo mos2 (máy sinh / dựng bài apps/xuong-video/scripts + src/lib/xuong-video, mẫu apps/xuong-video/mau, tệp sự thật
// apps/xuong-video/su-that, Phòng Nội dung chấm bài đăng apps/cty/worker/cham-dang.mjs); đọc + chạy lệnh box3 qua ssh; kiểm tĩnh; push (GHA deploy box3). Không web, không hỏi, không lan việc.
const SUA = ['apps/xuong-video/scripts', 'apps/xuong-video/src/lib/xuong-video', 'apps/xuong-video/mau', 'apps/xuong-video/su-that'].map((d) => path.join(MOS2, d));
// QUYỀN THEO CÁCH CLAUDE THẬT GÕ LỆNH (anh 10/11/2026 "Sao thằng Khang sửa hỏi lắm thế"): danh sách hẹp kiểu Huy chỉ khớp lệnh mở đầu đúng chữ (git add apps/:*…) — Claude thật
// gõ "cd <repo> && git add …", "git -C <repo> diff", ống "| wc / awk / head" → chế độ không giao diện TỪ CHỐI im lặng → Khang báo "bị chặn quyền git, cần anh" (2/2 lượt đầu CAN_ANH).
// Mở đúng các dạng đó (vẫn là danh sách cụ thể, không mở Bash trọn); CAM_BASH chặn hoàn tác git, xoá, đẩy mã ngoài GHA, trình duyệt, cài gói.
const QUYEN = ['Read', 'Glob', 'Grep', ...SUA.flatMap((d) => [`Edit(/${d}/**)`, `Write(/${d}/**)`]), `Edit(/${MOS2}/apps/cty/worker/cham-dang.mjs)`,
  `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`, `Bash(cd ${MOS2}:*)`, `Bash(cd ${MOS2}/apps/:*)`, `Bash(git -C ${MOS2}:*)`,
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git add apps/:*)', 'Bash(git commit:*)', 'Bash(git push origin main)',
  `Bash(${os.homedir()}/bin/gh-watch deploy.yml)`, 'Bash(node --check:*)', 'Bash(node apps/cty/:*)', 'Bash(node_modules/.bin/tsx apps/xuong-video/:*)', 'Bash(../../node_modules/.bin/tsx:*)',
  'Bash(grep:*)', 'Bash(tail:*)', 'Bash(head:*)', 'Bash(cat:*)', 'Bash(ls:*)', 'Bash(sed -n:*)', 'Bash(wc:*)', 'Bash(awk:*)', 'Bash(sort:*)', 'Bash(uniq:*)', 'Bash(diff:*)'];
const CAM_BASH = ['git reset', 'git revert', 'git checkout', 'git restore', 'git clean', 'git stash', 'git rebase', 'git push --force', 'git push -f', 'git branch -D', 'git tag -d',
  'rm', 'rmdir', 'rsync', 'scp', 'br', 'open', 'npm install', 'npm i', 'npx', 'brew', 'pip', 'launchctl', 'crontab', 'sudo', 'kill', 'pkill'].map((c) => `Bash(${c}:*)`);
const CAM = [...CAM_BASH, 'AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` };
const thu = process.argv.includes('--thu');
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; } } };
const viec = (args, input) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} THO_MAY_TEP=${TEP} node worker/tho-may-viec.mjs ${args}`, input);
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -E '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Khang đang tắt'); process.exit(0); }
const dm = (soul.match(/^model:.*$/m) || [''])[0], model = (dm.match(/claude-code:([\w.-]+)/) || [])[1] || 'opus', effort = (dm.match(/effort:(low|medium|high|max)\b/) || [])[1] || null;
const git = (...a) => execFileSync('git', ['-C', MOS2, ...a], { encoding: 'utf8' }).trim();
const tepDo = () => execFileSync('git', ['-C', MOS2, 'status', '--porcelain'], { encoding: 'utf8' }).split('\n').filter(Boolean).map((l) => l.slice(3));
// SERVER LÀ CHUẨN (anh: "trước hết luôn phải pull bản mới nhất về"): kéo origin/main TRƯỚC khi nhận việc. Cây MOS2 trên iMac dùng chung với
// việc nền xưởng video (studio-shot-code, lich-su-*) nên KHÔNG dọn tệp dở của chúng; chỉ fast-forward — không được thì chưa nhận việc (việc vẫn chờ ở hàng).
if (!thu) { try { git('fetch', '-q', 'origin', 'main'); git('merge', '-q', '--ff-only', 'origin/main'); } catch (e) { log(`chưa kéo được bản mới nhất, chưa nhận việc: ${String(e.stderr || e.message).split('\n')[0]}`); process.exit(0); } }
const doTruoc = new Set(tepDo());
const r0 = thu ? (() => { const st = JSON.parse(box(`cat ${DATA}/${TEP} 2>/dev/null || echo '{"hang":[]}'`) || '{"hang":[]}'); const x = (st.hang || []).find((y) => y.tt === 'cho'); return x ? { viec: x } : { ly_do: 'không có việc' }; })()
  : JSON.parse(viec('--lay'));
if (!r0.viec) { log(`không nhận việc: ${r0.ly_do}`); process.exit(0); }
const v = r0.viec, chu = String(v.chu).replace(/<[^>]+>/g, '');

const loiGiao = `Bạn là Khang, kỹ sư Phòng Social Traffic (công ty AI của anh Tuấn). Phòng chạy các máy làm + đăng bài social (video ngắn, ảnh, bài chữ) kéo khách về site affiliate.
Máy vừa báo một việc. Bạn phải xử tới khi bài đăng được, tìm GỐC để lớp lỗi không quay lại, kiểm, deploy, rồi báo lại — anh không ngồi máy.

${/^anh:/.test(v.khoa) ? `LỆNH ANH (anh vừa trả lời trên Telegram — đây là việc phải LÀM, không hỏi lại điều anh vừa trả lời; giới hạn bên dưới chỉ mở đúng phần anh nói):
${v.cau_hoi ? `CÂU HỎI / BÁO CÁO ANH ĐANG TRẢ LỜI:\n${String(v.cau_hoi).replace(/<[^>]+>/g, '').slice(0, 3000)}\n` : ''}ANH TRẢ LỜI: ${v.anh ?? chu}
VIỆC: ${chu}` : `VIỆC (${v.luc}) · khoá ${v.khoa}:
${chu}`}
${(v.quyet_gan ?? []).length ? `ANH ĐÃ CHỐT CHO CÙNG MÁY TRONG 7 NGÀY (làm theo, không hỏi lại):\n${v.quyet_gan.join('\n')}\n` : ''}
ĐỌC TRƯỚC: /${MOS2}/CLAUDE.md · /${MOS2}/.claude/contexts/xuong-video.md · chuẩn chấm /${MOS2}/apps/cty/cong-ty/quy-dinh/noi-dung/chuan-bai-dang.md.
HẠ TẦNG:
- box3 ${BOX}, mã chạy ở /opt/earns-marketing-os-v2. Lệnh máy bài (chạy trên box3):
  cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts --may <máy> <lệnh>
  · --lam-lai-sua [--toi-da N]: bài chưa đăng bị SỬA LẠI chỉ vì lỗi đề (hook khác ngách / hứa sai / nhạt / sửa xa QC gốc, tiêu đề trùng, chưa gắn góc) → đề mới cùng góc + dạng với hook khác
    (kho đã qua Ngọc lọc), dựng, cất bài cũ (không xoá). Chữ AI vài chục đồng / đề — được tự chạy (dưới 5.000₫ một lượt), ghi tiền thật vào báo cáo.
  · --ds, --xuat <slug>, --sinh-kho … (đọc đầu tệp scripts/may-dung.mts).
  Phòng Nội dung chấm lại: cd /opt/earns-marketing-os-v2/apps/cty && set -a && . ../../.env.production && set +a && CTY_DATA_DIR=/var/lib/cty node worker/cham-dang.mjs --chay
  Sổ: psql "$DATABASE_URL" — xv_may (máy, dang[] nơi đăng), xv_may_video (bài: mau = dạng, dang (title, hook, goc), cham (ket, chan_cung[]), da_dang, luu_tru).
- Sửa ở iMac (repo ${MOS2}), lên box3 bằng git push origin main (GHA deploy ~2 phút; chờ bằng ${os.homedir()}/bin/gh-watch deploy.yml). KHÔNG rsync / scp mã lên box3.
- Cây làm việc có tệp phiên khác đang sửa dở: chỉ git add đúng tệp chính bạn sửa.

CÁCH LÀM:
1. Đọc lý do chặn nguyên văn (cham.chan_cung) của từng bài trong việc. Phân loại: (a) lỗi đề sửa được bằng đề mới → chạy --lam-lai-sua cho máy đó, rồi chấm lại, đọc kết quả;
   (b) cùng lỗi lặp ở nhiều bài / bài làm lại vẫn bị chặn cùng lý do → lỗi ở MÁY SINH (khoGocHook, may-de.ts, mẫu) hoặc ở phòng chấm chặn oan → sửa GỐC một lần cho cả lớp;
   (c) lỗi không do đề (ảnh, bản xuất, link) → sửa ở mẫu / máy dựng.
   TỰ QUYẾT, KHÔNG HỎI (anh 10/11/2026 "Sao thằng Khang sửa hỏi lắm thế"): nới / đổi nguồn hook (biểu thức nhóm spy, hook_sp lân cận, ngưỡng YouTube), đổi góc, đổi dạng bài,
   sửa máy sinh / mẫu dựng, làm lại bài, cất bài kẹt, commit + push + deploy. Bị từ chối một lệnh shell thì viết lại lệnh đơn giản hơn (một lệnh một dòng, không biến tạm),
   KHÔNG báo "bị chặn quyền" cho anh. CAN_ANH CHỈ khi: tiền AI trên 5.000₫ một lượt · tài khoản / nền tảng bị khoá, cảnh báo · phải xoá dữ liệu · phải nới CHUẨN CHẤM của Phòng Nội dung.
2. Kiểm: node --check tệp đã sửa, node apps/cty/worker/cham-dang.mjs --tu-kiem nếu đụng phòng chấm, tsx các tệp *.test.mts liên quan; sau deploy chạy lại trên box3 và đọc sổ:
   bài mới DUYỆT chưa, còn bao nhiêu bài kẹt.
3. git add đúng tệp + git commit (tiếng Việt: gốc + cách sửa) + git push origin main + gh-watch deploy.yml.

CẤM: đăng bài bằng tay / bấm đăng / viết script đăng riêng (một đường đăng: máy đăng dang-may.mjs tự lấy bài DUYỆT) · nới chuẩn chấm cho bài qua · xoá dữ liệu (cất = luu_tru, không DELETE)
· git revert / reset / checkout · sửa tệp ngoài phần bài social · in khoá / token · mua / nạp tiền · lượt AI trên 5.000₫ (dừng, CAN_ANH kèm giá).

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 3–6 dòng tiếng Việt cho anh đọc trên điện thoại,
lời thường, không bảng, không dán lệnh dài, mỗi ý một dòng mở bằng nhãn ngắn và dấu hai chấm: việc gì · gốc ở đâu · đã làm gì (bài mới / tệp + commit) · kết quả chấm lại · tiền AI thật. Viết gọn, xưng "con", gọi "anh".`;
if (thu) { console.log(loiGiao); process.exit(0); }
try { viec(`--nhan ${v.id}`); } catch (e) { log(`báo nhận lỗi: ${e.message.split('\n')[0]}`); }
log(`nhận việc #${v.id} ${v.khoa} · model ${model}${effort ? ` · effort ${effort}` : ''}`);
const truoc = git('rev-parse', 'HEAD');
const r = spawnSync(CLAUDE, ['-p', loiGiao, '--model', model, ...(effort ? ['--effort', effort] : []), '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM],
  { cwd: MOS2, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
const ra = String(kq.result || '').trim(), ketDong = (ra.match(/^\s*\**KET:\**\s*(DA_SUA|KHONG_SUA|CAN_ANH)\b.*$/gim) || []).pop();
const ket = ketDong ? ketDong.match(/DA_SUA|KHONG_SUA|CAN_ANH/i)[0].toLowerCase() : (r.signal || r.error ? 'treo' : 'khong_sua');
const sau = git('rev-parse', 'HEAD'), commit = sau === truoc ? '' : git('log', '--format=%h %s', `${truoc}..${sau}`).split('\n').slice(0, 5).join('\n');
const lan = sau === truoc ? [] : git('diff', '--name-only', `${truoc}..${sau}`).split('\n').filter((f) => doTruoc.has(f));   // commit kèm tệp đã dở từ trước = lẫn việc của việc nền khác
const boKet = ra.replace(/^\s*\**KET:.*$/gim, '').trim(), sauBao = boKet.split(/^\s*[*#\s]*BÁO ANH:?\**\s*$/im);
const than = ((sauBao.length > 1 ? sauBao.pop().trim() : boKet.split('\n').slice(-8).join('\n')) || `Claude thoát ${r.status ?? r.signal} không kèm báo cáo (${String(r.stderr || r.error?.message || '').slice(0, 200)})`)
  + (commit ? `\n\nCommit:\n${commit}` : '') + (lan.length ? `\n⚠ Commit có kèm tệp vốn đang dở từ trước (của việc nền khác trên iMac): ${lan.join(', ')} — anh xem lại.` : '') + `\n(${Math.round((kq.duration_ms || 0) / 6e4)} phút)`;
log(`xong #${v.id}: ${ket} · commit ${commit ? sau.slice(0, 8) : 'không'} · ${kq.num_turns ?? '?'} lượt`);
viec(`--bao ${v.id} ${ket === 'treo' ? 'treo' : ket}`, than);
