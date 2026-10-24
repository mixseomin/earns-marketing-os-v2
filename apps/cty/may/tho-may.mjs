// THỢ MÁY — Mạnh (anh 23–24/10/2026: "làm sao để mày biết mà fix rồi mày báo cho tao" → "có dựng thợ máy tự sửa ở iMac"). Bộ điều phối iMac gọi mỗi 5 phút
// (viec-nen.json iMac:tc.on.spy.tu-sua-may-cao, tên "Spy - tự sửa máy cào (Claude)" — có chữ Spy để biết đây là việc spy chạy trên iMac; tệp đọc từ box3 mỗi lượt). Lấy MỘT việc ở hàng worker/tho-may-viec.mjs (Phòng Tài nguyên xếp từ cảnh báo máy cào),
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
// MÁY ĐĂNG (anh 25/10/2026 "cho Mạnh quản lý luôn"): việc `dang:lo|<máy>|<nền>` do Phòng Nội dung xếp — chạy trong bản puzzle-books của iMac (bản chạy lượt 20:00),
// sửa xong chép cùng bản sửa sang repo git trên MacBook; đăng bù đúng MỘT bài qua đường thường (nhịp an toàn vẫn quyết).
const DANG = path.join(os.homedir(), 'puzzle-books'), MB = 'htuan@100.67.220.128';
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
const v = r0.viec, chu = v.chu.replace(/<[^>]+>/g, ''), laDang = v.khoa.startsWith('dang:');
const [, mayMa = '', nenMa = ''] = laDang ? v.khoa.slice(5).split('|') : [];
const git = (...a) => (laDang ? '' : execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim());   // máy đăng: bản iMac không có git — commit nằm ở repo MacBook, Mạnh tự ghi trong báo cáo

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

const QUYEN_DANG = ['Read', 'Glob', 'Grep', `Edit(/${DANG}/**)`, `Write(/${DANG}/**)`, `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`, `Bash(ssh ${MB}:*)`,
  `Bash(ssh -o BatchMode=yes ${MB}:*)`, `Bash(scp:*)`, 'Bash(node scripts/:*)', 'Bash(node --check:*)', 'Bash(bash -n:*)', 'Bash(grep:*)', 'Bash(tail:*)', 'Bash(cat:*)', 'Bash(diff:*)', 'Bash(md5:*)',
  `Bash(${os.homedir()}/bin/br status:*)`, `Bash(${os.homedir()}/bin/profile-locks:*)`];
const giaoDang = `Bạn là Mạnh, thợ máy của công ty AI của anh Tuấn, nay quản lý cả MÁY ĐĂNG (đăng video / ảnh / link lên kênh social). Phòng Nội dung vừa báo một kênh LỠ LƯỢT:
hôm qua (giờ VN) cả họ nền đó không có bài nào. Bạn phải tìm GỐC, sửa, đăng bù nếu được, kiểm, rồi báo lại — anh không ngồi máy.

CẢNH BÁO (${v.luc}): ${chu}
máy (xv_may.ma) = ${mayMa} · nền = ${nenMa}

HẠ TẦNG:
- Sổ studio ở box3 ${BOX}: cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -c "…"
  xv_may (ma, chay, dang[]: nen, gio_tu, may 'iMac'|'MacBook', br {acct, profile}) · xv_may_video (slug, da_dang theo nền, cham.ket DUYET, dang.dang_tu/dang_den = hạn đăng, luu_tru)
  · xv_may_nhat_ky (luc, nen, buoc, ok, noi_dung — mỗi lượt đăng ghi một dòng, đọc đây TRƯỚC) · platform_alerts (cảnh báo tài khoản, xong_luc null = chưa xử).
- iMac (máy này): ${DANG} — bản chạy lượt hằng ngày \`node scripts/dang-may.mjs --het\` lúc 20:00 + bù 21:00 (bộ điều phối cty) cho mọi máy có dang[].may = iMac.
  Xem trước lượt (không đăng): node scripts/dang-may.mjs --het --xem · tự kiểm: node scripts/dang-may.mjs --tu-kiem
- MacBook ${MB} (ssh, đầu lệnh: export PATH=/opt/homebrew/bin:$PATH; cd ~/Me/Earns/puzzle-books): repo GIT của cùng bộ script. Front Porch (máy front-porch-only-one) đăng bằng
  scripts/dang-short.mjs <nền> qua launchd com.earns.puzzle-short-yt lúc 20:05, nhật ký ~/.cache/puzzle-short-yt.log.
- Trình duyệt: script gọi ~/bin/br (khoá xác minh theo profile + tên miền ở ~/.br-xac-minh.d trên từng máy). ~/bin đồng bộ hai máy qua ~/claude-sync/sync.sh (cờ kẹt ~/claude-sync/CONFLICT.flag).

CÁCH LÀM:
1. Đọc xv_may_nhat_ky của máy + nền 3 ngày qua, chạy --xem, đọc nhật ký launchd nếu là Front Porch. Phân loại: (a) lỗi máy / mã (script hỏng, giao diện nền tảng đổi, br lệch bản,
   đồng bộ kẹt) → sửa; (b) dừng đúng luật (nhịp an toàn: trần ngày, cách ≥ 3 giờ, xoay nền, chưa tới hạn đăng, cảnh báo tài khoản) → KHÔNG phải lỗi, báo lại là đúng luật;
   (c) tài khoản bị nền tảng chặn / đòi xác minh / hết bài phải làm thêm → CAN_ANH.
2. Sửa GỐC trong ${DANG}/scripts (bản iMac), rồi chép CÙNG bản sửa sang MacBook: hai tệp giống nhau trước khi sửa (md5) thì scp tệp; khác nhau thì áp đúng đoạn sửa bằng python qua ssh.
   Sau đó trên MacBook: node --check + --tu-kiem + git add đúng tệp + git commit (tiếng Việt, ghi gốc + cách sửa). node --check + --tu-kiem ở iMac nữa.
3. ĐĂNG BÙ đúng MỘT bài cho nền lỡ, bằng đường thường để nhịp an toàn tự quyết: iMac \`node scripts/dang-may.mjs ${nenMa || '<nền>'} --may ${mayMa || '<máy>'}\`;
   Front Porch: ssh MacBook \`node scripts/dang-short.mjs <nền>\`. Nhịp an toàn nói không thì THÔI, ghi lý do. Đăng xong đọc lại nhật ký / link bài để chắc bài lên đúng kênh.

CẤM: dùng --slug hay mọi cách lách nhịp an toàn, sửa trần / khoảng cách / luật dừng trong nhip-an-toan.mjs để "đăng cho đủ" (luật anh: đăng nhiều nhưng không spam) · đụng trang đăng nhập,
gõ mật khẩu, bấm xác minh, gỡ khoá xác minh (br xac-minh-xong) — gặp là CAN_ANH · lập tài khoản · mua / nạp / bật quảng cáo · xoá dữ liệu · git revert / reset / checkout ·
sửa tệp ngoài puzzle-books (iMac + repo MacBook) · in khoá / mật khẩu / token.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó 3–6 dòng tiếng Việt cho anh đọc trên Telegram:
lỗi gì · gốc ở đâu · đã sửa gì (tệp + commit MacBook) · đã đăng bù chưa (link bài) / vì sao không. Viết gọn, xưng "con", gọi "anh".`;
const loiGiao = laDang ? giaoDang : giao, quyen = laDang ? QUYEN_DANG : QUYEN, noiChay = laDang ? DANG : REPO;
if (thu) { console.log(loiGiao); process.exit(0); }
try { viec(`--nhan ${v.id}`); } catch (e) { log(`báo nhận lỗi: ${e.message.split('\n')[0]}`); }
log(`nhận việc #${v.id} ${v.khoa} · model ${model}`);
const truoc = git('rev-parse', 'HEAD');
const r = spawnSync(CLAUDE, ['-p', loiGiao, '--model', model, '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...quyen, '--disallowedTools', ...CAM],
  { cwd: noiChay, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
const ra = String(kq.result || '').trim(), ketDong = (ra.match(/^\s*\**KET:\**\s*(DA_SUA|KHONG_SUA|CAN_ANH)\b.*$/gim) || []).pop();
const ket = ketDong ? ketDong.match(/DA_SUA|KHONG_SUA|CAN_ANH/i)[0].toLowerCase() : (r.signal || r.error ? 'treo' : 'khong_sua');
const sau = git('rev-parse', 'HEAD'), commit = sau === truoc ? '' : git('log', '--format=%h %s', `${truoc}..${sau}`).split('\n').slice(0, 5).join('\n');
const than = (ra.replace(/^\s*\**KET:.*$/gim, '').trim().split('\n').slice(-8).join('\n') || `Claude thoát ${r.status ?? r.signal} không kèm báo cáo (${String(r.stderr || r.error?.message || '').slice(0, 200)})`)
  + (commit ? `\n\nCommit:\n${commit}` : '') + `\n(${kq.num_turns ?? '?'} lượt · ${Math.round((kq.duration_ms || 0) / 6e4)} phút · ${model})`;
log(`xong #${v.id}: ${ket} · commit ${commit ? sau.slice(0, 8) : 'không'} · ${kq.num_turns ?? '?'} lượt`);
viec(`--bao ${v.id} ${ket === 'treo' ? 'treo' : ket}`, than);
