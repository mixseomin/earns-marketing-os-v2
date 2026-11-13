// TÀI — KỸ SƯ TÀI NGUYÊN (anh 13/11/2026: "Phòng Tài Nguyên có con CLI nào quản lý ko? … trên tele ta muốn trao đổi với nó … hỏi xem hiện trạng thế nào, nhắc nó tối ưu …
// nó phải có repo riêng để còn kế thừa kiến thức" → "Có cho nó chạy. Mày đặt tên · Chỉ cần trên iMac · máy cào spy nếu liên quan đến tài nguyên thì phải fw cho kỹ sư mới này").
// Cùng khuôn Khang (may/social-sua.mjs): bộ điều phối iMac gọi mỗi 5 phút (viec-nen.json iMac:tc.on.cty.tai-nguyen-sua), chỉ gọi Claude khi hàng có việc, mỗi lần một việc.
// Hàng riêng (worker/tho-may-viec.mjs, THO_MAY_TEP=tai-nguyen-sua.json) nhận: (1) cảnh báo máy móc Nguyên phát (worker/tai-nguyen.mjs: làn cào đứng, box3 / VPS quá tải,
// RAM, daemon, ckey…) · (2) MỌI tin anh gõ trong chủ đề 🧰 Tài nguyên (worker/thu-ky.mjs, KY_SU thang) · (3) anh trả lời dưới tin của Tài.
// KHO KIẾN THỨC RIÊNG: repo git ~/Me/GitHub/tai-nguyen-ky-su trên iMac (chỉ iMac, anh chốt) — CLAUDE.md (vai + hạ tầng + luật), so-tay/bai-hoc.md, toi-uu/de-xuat.md.
// Tài đọc đầu lượt, ghi bài học / đề xuất cuối lượt; MÁY (không phải Tài) commit kho sau lượt, nên kiến thức không rơi dù Tài quên git.
// Luật: Claude không giao diện bằng gói thuê bao CHỈ chạy trên iMac.
//   node tai-nguyen-sua.mjs        một lượt      · node tai-nguyen-sua.mjs --thu   in lời giao cho việc đang chờ, không gọi Claude, không nhận việc
import { execFileSync, spawnSync } from 'node:child_process';
import { chayClaude } from './claude-chay.mjs';   // spawnSync + báo lỗi API vào 🚨 (anh 13/11/2026)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cayHoacBao, MOS2_GOC } from './cay-rieng.mjs';
import { chonMuc } from './chon-muc.mjs';

if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`Tài chỉ chạy trên iMac (máy này: ${os.hostname()}) — Claude không giao diện bằng gói thuê bao chỉ iMac`); process.exit(3); }

const BOX = 'root@167.233.241.16', VPS = 'root@116.118.28.214', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'tai', TEP = 'tai-nguyen-sua.json';
const CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 30, thu = process.argv.includes('--thu');
const SPY = path.join(os.homedir(), 'Me/GitHub/spy-on-tc'), KHO = path.join(os.homedir(), 'Me/GitHub/tai-nguyen-ky-su');
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` };
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; } } };
const viec = (args, input) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} THO_MAY_TEP=${TEP} node worker/tho-may-viec.mjs ${args}`, input);
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();

// kho kiến thức thiếu = kỹ sư mất trí nhớ mà không ai biết → báo phòng (≤ 1 tin / 24 giờ) rồi bỏ lượt, không chạy "trắng"
if (!fs.existsSync(path.join(KHO, '.git'))) {
  log(`thiếu kho kiến thức ${KHO}`);
  if (!thu) try { viec('--canh tai:kho tai-nguyen', `Tài không thấy kho kiến thức riêng ${KHO} trên iMac (repo git) nên chưa nhận việc. Kho phải có lại trước khi Tài chạy tiếp.`); } catch (e) { log(`báo kẹt lỗi: ${e.message.split('\n')[0]}`); }
  process.exit(0);
}
// CÂY REPO RIÊNG mos2 (may/cay-rieng.mjs): sửa mã phòng (worker tai-nguyen*) trong worktree ~/may-ky-su/tai, không đụng cây mos2 chính đang có việc dở
const cay = thu ? { dir: MOS2_GOC, do: [] } : cayHoacBao(NGUOI, { ten: 'Tài', khoa: 'tai:cay-rieng', phong: 'tai-nguyen', tep: TEP });
const MOS2 = cay.dir;
// QUYỀN HẸP: sửa trong spy-on-tc (máy cào), phần Tài nguyên của mos2 (worker + hồ sơ phòng), kho kiến thức; ssh box3 + VPS máy cào; git; deploy của từng repo.
// Viết theo cách Claude thật gõ lệnh (cd <repo> && …, git -C <repo> …, ống | head) — chế độ không giao diện từ chối im lặng lệnh không khớp (bài học Khang 10/11/2026).
const SUA_MOS2 = ['apps/cty/worker/tai-nguyen.mjs', 'apps/cty/worker/tai-nguyen-api.mjs', 'apps/cty/worker/site-chuan.mjs', 'apps/cty/cong-ty/phong/tai-nguyen.md'].map((f) => path.join(MOS2, f));
const QUYEN = ['Read', 'Glob', 'Grep', `Edit(/${SPY}/**)`, `Write(/${SPY}/**)`, `Edit(/${KHO}/**)`, `Write(/${KHO}/**)`, ...SUA_MOS2.map((f) => `Edit(/${f})`),
  `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`, `Bash(ssh ${VPS}:*)`, `Bash(ssh -o BatchMode=yes ${VPS}:*)`,
  `Bash(cd ${SPY}:*)`, `Bash(cd ${MOS2}:*)`, `Bash(cd ${KHO}:*)`, `Bash(git -C ${SPY}:*)`, `Bash(git -C ${MOS2}:*)`,
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git push origin HEAD:main)',
  `Bash(${os.homedir()}/bin/gh-watch deploy.yml)`, 'Bash(./deploy.sh)', 'Bash(bash scripts/*)', 'Bash(node scripts/*)', 'Bash(node apps/cty/*)', 'Bash(node --check:*)', 'Bash(bash -n:*)',
  'Bash(grep:*)', 'Bash(tail:*)', 'Bash(head:*)', 'Bash(cat:*)', 'Bash(ls:*)', 'Bash(sed -n:*)', 'Bash(wc:*)', 'Bash(awk:*)', 'Bash(sort:*)', 'Bash(uniq:*)', 'Bash(diff:*)', 'Bash(date:*)'];
const CAM_BASH = ['git reset', 'git revert', 'git checkout', 'git restore', 'git clean', 'git stash', 'git rebase', 'git push --force', 'git push -f', 'git branch -D', 'git tag -d',
  'rm', 'rmdir', 'rsync', 'scp', 'br', 'open', 'npm install', 'npm i', 'npx', 'brew', 'pip', 'launchctl', 'crontab', 'sudo', 'kill', 'pkill'].map((c) => `Bash(${c}:*)`);
const CAM = [...CAM_BASH, 'AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -E '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Tài đang tắt'); process.exit(0); }
const dm = (soul.match(/^model:.*$/m) || [''])[0], model = (dm.match(/claude-code:([\w.-]+)/) || [])[1] || 'opus', effort = (dm.match(/effort:(low|medium|high|max)\b/) || [])[1] || null;
const doTruoc = { [SPY]: new Set(git(SPY, 'status', '--porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))), [MOS2]: new Set(cay.do) };
const r0 = thu ? (() => { const st = JSON.parse(box(`cat ${DATA}/${TEP} 2>/dev/null || echo '{"hang":[]}'`) || '{"hang":[]}'); const x = (st.hang || []).find((y) => y.tt === 'cho'); return x ? { viec: x } : { ly_do: 'không có việc' }; })()
  : JSON.parse(viec('--lay'));
if (!r0.viec) { log(`không nhận việc: ${r0.ly_do}`); process.exit(0); }
const v = r0.viec, chu = String(v.chu).replace(/<[^>]+>/g, ''), laAnh = /^anh:/.test(v.khoa);

const loiGiao = `Bạn là Tài, Kỹ sư Phòng Tài nguyên (công ty AI của anh Tuấn). Phòng giữ mọi tài nguyên đã trả tiền có việc làm và không chết im lặng:
làn cào spy.on.tc, khoá 2proxy, box3 + VPS máy cào, số dư cổng API (TokenHot, FlatKey, ShopAIKey, Kie.ai, RunPod, ckey), kho tệp R2. Trưởng phòng Nguyên là nhịp máy
30 phút trên box3 (không có tay); bạn là người có tay: đo, tìm gốc, sửa, trả lời anh bằng số thật. Anh không ngồi máy.

${laAnh ? `LỆNH / CÂU HỎI CỦA ANH (anh vừa nhắn trên Telegram trong chủ đề 🧰 Tài nguyên — đây là việc phải LÀM, không hỏi lại điều anh vừa nói):
${v.cau_hoi ? `TIN ANH ĐANG TRẢ LỜI:\n${String(v.cau_hoi).replace(/<[^>]+>/g, '').slice(0, 3000)}\n` : ''}ANH: ${v.anh ?? chu}
VIỆC: ${chu}
- Hỏi hiện trạng / số dư / tốn tiền ở đâu → đọc SỐ LIỆU THẬT bên dưới rồi trả lời bằng số (kèm giờ chụp), không đoán, không chuyển người khác.
- Nhắc tối ưu → đo trước (khoá trả tiền nằm không, làn đứng, cổng đắt hơn cổng khác cùng việc, kho R2 phình, máy rỗi hay quá tải), làm ngay phần không tốn tiền
  (sửa mã, gỡ khoá mồ côi, chỉnh nhịp), phần tốn tiền hay cần anh quyết thì ghi rõ giá + chỗ bấm, KET: CAN_ANH.` : `CẢNH BÁO MÁY (${v.luc}) · khoá ${v.khoa}:
${chu}`}

KHO KIẾN THỨC CỦA BẠN: ${KHO} (thư mục làm việc). ĐỌC TRƯỚC: CLAUDE.md, so-tay/bai-hoc.md, toi-uu/de-xuat.md — đó là những gì các lượt trước đã học.
CUỐI LƯỢT (bắt buộc khi học được điều mới): thêm 1–3 dòng vào so-tay/bai-hoc.md dạng "- <ngày> · <việc> · <bài học: gốc / dấu hiệu / lệnh đo đúng / chỗ hay hỏng>",
không chép lại điều đã có; đề xuất tối ưu thì thêm vào toi-uu/de-xuat.md dạng "- <ngày> · <đề xuất> · <ước tiết kiệm> · <chờ anh | đã làm | anh không duyệt>".
Máy tự commit kho này sau lượt — bạn không cần git ở kho.

SỐ LIỆU THẬT (đọc bằng ssh ${BOX}):
- /var/lib/cty/tai-nguyen.json — ảnh chụp mỗi 30 phút: làn ↔ máy + lần chạy gần nhất, khoá 2proxy (hạn, gắn làn nào), CPU / RAM box3 + VPS.
- /var/lib/cty/tai-nguyen-api.json — số dư từng cổng + lịch sử. Báo cáo xem tại chỗ (không gửi):
  cd ${APP} && set -a && . ../../.env.production && set +a && CTY_DATA_DIR=${DATA} node worker/tai-nguyen-api.mjs --in
- Tiền studio theo cổng: psql "$DATABASE_URL" (sau khi nạp .env.production), bảng xv_job. Sổ quyết định của anh: /var/lib/cty/quyet-dinh.jsonl.

HẠ TẦNG (đọc ${SPY}/CLAUDE.md nếu có, đầu deploy.sh, scripts/):
- box3 ${BOX}: Postgres spy (sudo -u postgres psql -d spy), web spy.on.tc (systemd spy-web, /opt/spy), nạp dữ liệu, AI sinh góc. KHÔNG cào ở box3.
- VPS máy cào ${VPS}: mọi làn cào — spy-may-cao.timer (scripts/cao.sh), spy-may-cao-nen.timer (scripts/lan-nen.sh, chốt tài nguyên scripts/con-suc.sh, khoá có PID
  scripts/khoa.sh), daemon trình duyệt spy-may-cao-daemon (39222) + spy-may-cao-daemon-nen (39223), bộ canh tab spy-canh-tab. Nhật ký /opt/spy/logs/, journalctl -u <unit>.
  Bảng làn ↔ máy: may_cao_lan (DB spy).
- Repo máy cào trên iMac: ${SPY} — cây dùng chung với người khác: chỉ git add đúng tệp BẠN sửa; deploy = cd ${SPY} && ./deploy.sh.
- Mã của phòng trong mos2, CÂY RIÊNG của bạn ${MOS2} (nhánh ky-su/tai): apps/cty/worker/tai-nguyen.mjs (chụp + cảnh báo), tai-nguyen-api.mjs (số dư, R2, báo cáo ngày),
  site-chuan.mjs, hồ sơ apps/cty/cong-ty/phong/tai-nguyen.md. Sửa xong: node --check + node apps/cty/worker/<tệp> --tu-kiem, git add đúng tệp, commit,
  git push origin HEAD:main (GHA deploy box3 ~2 phút), chờ bằng ${os.homedir()}/bin/gh-watch deploy.yml. KHÔNG rsync / scp mã lên box3.${cay.do.length ? `\n- Cây riêng còn thay đổi CHƯA COMMIT từ lượt trước của chính bạn: ${cay.do.join(', ')} — kiểm rồi commit nếu đúng, sai thì sửa tới (không hoàn tác).` : ''}${cay.vat ? `\n- Lượt trước bạn để dở một bản sửa KHÔNG áp được lên main mới: tệp vá ${cay.vat}. Còn cần thì làm lại trên main hiện tại.` : ''}

CÁCH LÀM:
1. Đo trước khi đoán: trạng thái unit, nhật ký, CPU rỗi thật (/proc/stat, KHÔNG dùng load average), RAM, khoá trong ~/.cache, phiên daemon (curl 127.0.0.1:39223/status).
2. Tìm GỐC (vì sao lỗi tồn tại được), sửa một lần ở tầng gốc, có kiểm (bài tự kiểm sẵn có hoặc số đo). Chữa cháy tạm (khởi động lại unit, gỡ khoá mồ côi) được phép để
   máy chạy lại NGAY, nhưng vẫn phải tìm và sửa gốc. Bị từ chối một lệnh shell thì viết lại lệnh đơn giản hơn (một lệnh một dòng, không biến tạm), KHÔNG báo "bị chặn quyền" cho anh.
3. Commit (tiếng Việt: gốc + cách sửa), deploy, kiểm lại trên máy thật.

CẤM: nạp tiền / mua credit bất kỳ cổng nào · gia hạn / mua / bật tự gia hạn khoá 2proxy · đổi làn ↔ máy hay bật làn đang tắt khi anh chưa bảo · xoá dữ liệu (DB, tệp dữ liệu,
nhật ký) · in khoá, mật khẩu, proxy · cài trình duyệt ngoài VPS máy cào · git revert / reset / checkout · sửa tệp ngoài spy-on-tc, phần Tài nguyên của mos2 và kho kiến thức
· đề xuất nâng cấp máy khi chưa đo CPU rỗi + RAM. Việc cần tiền hoặc cần anh quyết → dừng, ghi giá + chỗ bấm, KET: CAN_ANH.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH" (câu hỏi đã trả lời đủ bằng số thật = DA_SUA), ngay trên nó một dòng "BÁO ANH:" rồi 3–8 dòng
tiếng Việt cho anh đọc trên điện thoại, lời thường, không bảng, không dán lệnh dài, mỗi ý một dòng mở bằng nhãn ngắn và dấu hai chấm: việc gì · số đo / hiện trạng · gốc ở đâu ·
đã làm gì (tệp + commit) · còn chờ anh gì. Giờ ghi theo giờ Việt Nam. Viết gọn, xưng "con", gọi "anh".`;
// LỆNH BỊ TỪ CHỐI LƯỢT TRƯỚC (bài học Khang 10/11/2026): máy ghi kq.permission_denials, đưa vào lời giao lượt sau để kỹ sư gõ dạng khớp quyền
const TEP_TU_CHOI = path.join(os.homedir(), '.cache', `${NGUOI}-tu-choi.json`);
const tuChoiCu = (() => { try { return JSON.parse(fs.readFileSync(TEP_TU_CHOI, 'utf8')); } catch { return []; } })();
const loiGiaoDu = tuChoiCu.length ? `${loiGiao}\n\nLƯỢT TRƯỚC MÁY ĐÃ TỪ CHỐI các lệnh sau vì không khớp danh sách quyền (KHÔNG phải anh chặn, KHÔNG báo anh):\n${tuChoiCu.map((c) => `- ${c}`).join('\n')}\nGõ lại dạng khớp: mỗi lệnh bắt đầu bằng đúng tên lệnh được phép (ssh ${BOX} '…', git -C <repo> …, cd <repo> && …), không gán biến tạm.` : loiGiao;
if (thu) { console.log(loiGiaoDu); process.exit(0); }
try { viec(`--nhan ${v.id}`); } catch (e) { log(`báo nhận lỗi: ${e.message.split('\n')[0]}`); }
const muc = chonMuc({ chu: v.chu, lanLamLai: laAnh && v.goc ? 1 : 0, macDinh: effort || 'low' });
log(`nhận việc #${v.id} ${v.khoa} · model ${model} · effort ${muc.effort} (${muc.ly_do.join(', ')})`);
const truoc = { [SPY]: git(SPY, 'rev-parse', 'HEAD'), [MOS2]: git(MOS2, 'rev-parse', 'HEAD') };
const r = chayClaude(CLAUDE, ['-p', loiGiaoDu, '--model', model, '--effort', muc.effort, '--output-format', 'json', '--setting-sources', 'project,local', '--add-dir', SPY, '--add-dir', MOS2,
  '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM], { cwd: KHO, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
const tuChoi = [...new Set((kq.permission_denials || []).map((d) => String(d.tool_input?.command ?? d.tool_name ?? '').replace(/\s+/g, ' ').slice(0, 160)).filter(Boolean))].slice(0, 8);
try { fs.mkdirSync(path.dirname(TEP_TU_CHOI), { recursive: true }); fs.writeFileSync(TEP_TU_CHOI, JSON.stringify(tuChoi)); } catch { /* ổ đầy: lượt sau không có gợi ý, vẫn chạy */ }
// KHO KIẾN THỨC: máy commit mọi thay đổi của lượt (Tài không cần nhớ git) — đây là chỗ kiến thức được giữ cho lượt sau
let khoGhi = '';
try { if (git(KHO, 'status', '--porcelain')) { git(KHO, 'add', '-A'); git(KHO, 'commit', '-q', '-m', `lượt #${v.id} ${v.khoa}: ${chu.split('\n')[0].slice(0, 80)}`); khoGhi = git(KHO, 'log', '-1', '--format=%h'); } }
catch (e) { khoGhi = `lỗi commit kho: ${String(e.message).split('\n')[0]}`; }
const ra = String(kq.result || '').trim(), ketDong = (ra.match(/^\s*\**KET:\**\s*(DA_SUA|KHONG_SUA|CAN_ANH)\b.*$/gim) || []).pop();
const ket0 = ketDong ? ketDong.match(/DA_SUA|KHONG_SUA|CAN_ANH/i)[0].toLowerCase() : (r.signal || r.error ? 'treo' : 'khong_sua');
const ket = ket0 === 'can_anh' && tuChoi.length && /quyền|git|bị chặn|permission/i.test(ra) ? 'khong_sua' : ket0;
const commit = [], lan = [];
for (const dir of [SPY, MOS2]) {
  const sau = git(dir, 'rev-parse', 'HEAD'); if (sau === truoc[dir]) continue;
  commit.push(...git(dir, 'log', '--format=%h %s', `${truoc[dir]}..${sau}`).split('\n').slice(0, 5).map((l) => `${path.basename(dir === MOS2 ? MOS2_GOC : dir)} ${l}`));
  lan.push(...git(dir, 'diff', '--name-only', `${truoc[dir]}..${sau}`).split('\n').filter((f) => doTruoc[dir].has(f)));   // commit kèm tệp đã dở từ trước = lẫn việc người khác
}
const boKet = ra.replace(/^\s*\**KET:.*$/gim, '').trim(), sauBao = boKet.split(/^\s*[*#\s]*BÁO ANH:?\**\s*$/im);
const than = ((sauBao.length > 1 ? sauBao.pop().trim() : boKet.split('\n').slice(-8).join('\n')) || `Claude thoát ${r.status ?? r.signal} không kèm báo cáo (${String(r.stderr || r.error?.message || '').slice(0, 200)})`)
  + (tuChoi.length ? `\n⚙ Máy từ chối ${tuChoi.length} lệnh (lượt sau tự gõ lại dạng khớp quyền${ket !== ket0 ? ', không phải việc anh' : ''}).` : '') + (commit.length ? `\n\nCommit:\n${commit.join('\n')}` : '')
  + (lan.length ? `\n⚠ Commit có kèm tệp vốn đang dở từ trước (của người khác trên iMac): ${lan.join(', ')} — anh xem lại.` : '') + (khoGhi ? `\nSổ tay: ${khoGhi}` : '') + `\n(${Math.round((kq.duration_ms || 0) / 6e4)} phút)`;
log(`xong #${v.id}: ${ket} · commit ${commit.length} · kho ${khoGhi || 'không đổi'} · ${kq.num_turns ?? '?'} lượt`);
viec(`--bao ${v.id} ${ket === 'treo' ? 'treo' : ket}`, than);
