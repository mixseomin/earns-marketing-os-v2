// THỢ MÁY — Mạnh (anh 23–24/10/2026: "làm sao để mày biết mà fix rồi mày báo cho tao" → "có dựng thợ máy tự sửa ở iMac"). Bộ điều phối iMac gọi mỗi 5 phút
// (viec-nen.json iMac:tc.on.cty.tho-may; tệp đọc từ box3 mỗi lượt). Lấy MỘT việc ở hàng worker/tho-may-viec.mjs (Phòng Tài nguyên xếp từ cảnh báo máy cào),
// báo đã nhận dưới tin cảnh báo, chạy Claude Code KHÔNG GIAO DIỆN trong repo spy-on-tc để tìm gốc + sửa + kiểm, rồi trả lời dưới tin đó.
// LUẬT (anh 23/10/2026): Claude không giao diện bằng gói thuê bao (không API) CHỈ chạy trên iMac — chặn ngay dưới đây; trần 6 lượt / ngày + 30 phút / lượt
// nằm ở hàng việc trên box3 (dùng bình thường của một cá nhân, điều khoản Anthropic đọc 23/10/2026). Phải chạy trong phiên đăng nhập (bộ điều phối):
// qua ssh, Claude Code không mở được Keychain → "Not logged in".
//   node tho-may.mjs        một lượt      · node tho-may.mjs --thu   in lời giao cho việc đang chờ, không gọi Claude, không nhận việc
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

// CHỈ iMAC (luật anh 23/10/2026) — script đến qua `ssh cat | node -` nên không import được tệp chung; cùng một dòng ở mọi script gọi Claude không giao diện
if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`thợ máy chỉ chạy trên iMac (máy này: ${os.hostname()}) — Claude không giao diện bằng gói thuê bao chỉ iMac`); process.exit(3); }

const BOX = 'root@167.233.241.16', VPS = 'root@116.118.28.214', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'manh';
const REPO = path.join(os.homedir(), 'Me/GitHub/spy-on-tc'), CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 30;
// QUYỀN HẸP: đọc / sửa CHỈ trong repo spy-on-tc; lệnh: ssh tới box3 + VPS máy cào, git trong repo, deploy của repo, bài tự kiểm. Không web, không hỏi, không lan việc.
const QUYEN = ['Read', 'Glob', 'Grep', `Edit(/${REPO}/**)`, `Write(/${REPO}/**)`, `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`, `Bash(ssh ${VPS}:*)`,
  `Bash(ssh -o BatchMode=yes ${VPS}:*)`, 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(./deploy.sh)',
  'Bash(bash scripts/:*)', 'Bash(node scripts/:*)', 'Bash(node --check:*)', 'Bash(bash -n:*)', 'Bash(grep:*)', 'Bash(tail:*)', 'Bash(cat:*)'];
const CAM = ['AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` };
const thu = process.argv.includes('--thu');
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; } } };
const viec = (args, input) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/tho-may-viec.mjs ${args}`, input);
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -m1 '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Mạnh đang tắt'); process.exit(0); }
const model = (soul.match(/claude-code:([\w.-]+)/) || [])[1] || 'sonnet';
const r0 = JSON.parse(thu ? box(`cd ${APP} && CTY_DATA_DIR=${DATA} node -e "const s=require('fs').existsSync('${DATA}/tho-may.json')?JSON.parse(require('fs').readFileSync('${DATA}/tho-may.json','utf8')):{hang:[]};const v=(s.hang||[]).find(x=>x.tt==='cho');console.log(JSON.stringify(v?{viec:v}:{ly_do:'không có việc'}))"`) : viec('--lay'));
if (!r0.viec) { log(`không nhận việc: ${r0.ly_do}`); process.exit(0); }
const v = r0.viec, chu = v.chu.replace(/<[^>]+>/g, '');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim();

const giao = `Bạn là Mạnh, thợ máy của Phòng Tài nguyên (công ty AI của anh Tuấn). Máy cào spy.on.tc vừa báo lỗi, bạn phải tìm GỐC, sửa, kiểm, rồi báo lại — anh không ngồi máy.

CẢNH BÁO (${v.luc}): ${chu}

HẠ TẦNG (đọc /${REPO}/CLAUDE.md nếu có, đầu deploy.sh, các script trong scripts/):
- box3 ${BOX}: dữ liệu (Postgres spy, sudo -u postgres psql -d spy), web spy.on.tc (systemd spy-web, /opt/spy), nạp dữ liệu, AI sinh góc. KHÔNG cào ở box3.
- VPS máy cào ${VPS} (may-cao-vn): mọi làn cào — spy-may-cao.timer (lượt chính, scripts/cao.sh), spy-may-cao-nen.timer (scripts/lan-nen.sh: đối thủ / góc ưu tiên / góc thường,
  chốt tài nguyên scripts/con-suc.sh, khoá có PID scripts/khoa.sh), daemon trình duyệt spy-may-cao-daemon (cổng 39222) + spy-may-cao-daemon-nen (39223), bộ canh tab spy-canh-tab.
  Nhật ký: /opt/spy/logs/, journalctl -u <unit>. Bảng làn ↔ máy: may_cao_lan (DB spy).
- Repo trên iMac: ${REPO} (cây làm việc có thể có tệp phiên khác đang sửa dở: chỉ commit tệp CHÍNH BẠN sửa, git add đúng tệp; deploy = ./deploy.sh).

CÁCH LÀM:
1. Đo trước khi đoán: trạng thái unit, nhật ký, CPU rỗi thật (/proc/stat, KHÔNG dùng load average), RAM, khoá trong ~/.cache, phiên daemon (curl 127.0.0.1:39223/status).
2. Tìm GỐC (vì sao lỗi tồn tại được), sửa một lần ở tầng gốc trong repo, có kiểm (bài tự kiểm sẵn có trong scripts/*.test.* hoặc kiểm tay bằng số đo). Chữa cháy tạm
   (khởi động lại unit, gỡ khoá mồ côi) được phép khi cần để máy chạy lại NGAY, nhưng vẫn phải tìm và sửa gốc.
3. Commit (tiếng Việt, ghi gốc + cách sửa) rồi ./deploy.sh, kiểm lại trên máy thật.

CẤM: xoá dữ liệu (DB, tệp dữ liệu, nhật ký) · mua / gia hạn / nạp tiền bất cứ thứ gì (kể cả 2proxy) · in khoá, mật khẩu, proxy · cài trình duyệt ngoài VPS máy cào ·
git revert / reset / checkout tệp · sửa tệp ngoài repo spy-on-tc · đề xuất nâng cấp máy khi chưa đo CPU rỗi + RAM. Việc cần tiền hoặc cần anh quyết → dừng, ghi CAN_ANH.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó 3–6 dòng tiếng Việt cho anh đọc trên Telegram:
lỗi gì · gốc ở đâu · đã sửa gì (tệp + commit) · đã kiểm thế nào (số đo). Viết gọn, xưng "con", gọi "anh".`;

if (thu) { console.log(giao); process.exit(0); }
try { viec(`--nhan ${v.id}`); } catch (e) { log(`báo nhận lỗi: ${e.message.split('\n')[0]}`); }
log(`nhận việc #${v.id} ${v.khoa} · model ${model}`);
const truoc = git('rev-parse', 'HEAD');
const r = spawnSync(CLAUDE, ['-p', giao, '--model', model, '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM],
  { cwd: REPO, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
const ra = String(kq.result || '').trim(), ketDong = (ra.match(/^\s*\**KET:\**\s*(DA_SUA|KHONG_SUA|CAN_ANH)\b.*$/gim) || []).pop();
const ket = ketDong ? ketDong.match(/DA_SUA|KHONG_SUA|CAN_ANH/i)[0].toLowerCase() : (r.signal || r.error ? 'treo' : 'khong_sua');
const sau = git('rev-parse', 'HEAD'), commit = sau === truoc ? '' : git('log', '--format=%h %s', `${truoc}..${sau}`).split('\n').slice(0, 5).join('\n');
const than = (ra.replace(/^\s*\**KET:.*$/gim, '').trim().split('\n').slice(-8).join('\n') || `Claude thoát ${r.status ?? r.signal} không kèm báo cáo (${String(r.stderr || r.error?.message || '').slice(0, 200)})`)
  + (commit ? `\n\nCommit:\n${commit}` : '') + `\n(${kq.num_turns ?? '?'} lượt · ${Math.round((kq.duration_ms || 0) / 6e4)} phút · ${model})`;
log(`xong #${v.id}: ${ket} · commit ${commit ? sau.slice(0, 8) : 'không'} · ${kq.num_turns ?? '?'} lượt`);
viec(`--bao ${v.id} ${ket === 'treo' ? 'treo' : ket}`, than);
