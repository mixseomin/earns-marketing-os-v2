// HUY — KỸ SƯ ETHOPEX (anh 10/11/2026: "Giống thằng Thành phòng Astrolas, mày phải có 1 con CLI chuyên làm việc fix này" · "ko phải mỗi lần lại tạo 1 cái
// như vậy" · "Phòng ETP này phải có 1 con riêng phụ trách vì nó là dự án quan trọng"). Bộ điều phối iMac gọi mỗi 5 phút (viec-nen.json iMac:tc.on.cty.etp-sua).
// Lấy MỘT việc ở hàng riêng của Huy (worker/tho-may-viec.mjs với THO_MAY_TEP=etp-sua.json — Phát xếp mỗi nhịp từ lỗi máy luật, lệnh Ethopex bị từ chối,
// thẻ xét luật đứng, camp ROAS đọc lại sai), báo đã nhận dưới chủ đề 📂 Ethopex, chạy Claude Code KHÔNG GIAO DIỆN trong repo mos2 để tìm gốc + sửa + kiểm +
// deploy, rồi trả lời ngay dưới tin đó. Cùng khuôn thợ máy Mạnh (may/tho-may.mjs) — luật: Claude không giao diện bằng gói thuê bao CHỈ chạy trên iMac.
//   node etp-sua.mjs        một lượt      · node etp-sua.mjs --thu   in lời giao cho việc đang chờ, không gọi Claude, không nhận việc
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cayHoacBao, MOS2_GOC } from './cay-rieng.mjs';

if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`Huy chỉ chạy trên iMac (máy này: ${os.hostname()}) — Claude không giao diện bằng gói thuê bao chỉ iMac`); process.exit(3); }

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'huy', TEP = 'etp-sua.json';
const CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 30, thu = process.argv.includes('--thu');
// CÂY REPO RIÊNG (may/cay-rieng.mjs, anh 10/11/2026 "chạy ổn định … tao ko phải tham gia"): sửa + commit trong worktree ~/may-ky-su/<người>, không đụng cây mos2 chính đang có việc dở
// của các phiên khác. Kéo origin/main đầu lượt (chỉ fast-forward) — không được thì chưa nhận việc (việc vẫn chờ ở hàng).
const cay = thu ? { dir: MOS2_GOC, do: [] } : cayHoacBao(NGUOI, { ten: 'Huy', khoa: 'etp:cay-rieng', phong: 'ethopex', tep: TEP });
const MOS2 = cay.dir;
// QUYỀN HẸP: sửa CHỈ phần Ethopex của repo mos2 (máy chạy box3 apps/etp, máy luật / tạo camp apps/xuong-video/scripts/ethopex, worker Phát, trang etp / etp2,
// danh sách điều kiện chống quay về bản cũ apps/etp/gop-y-luat.mjs); đọc box3 qua ssh; kiểm tĩnh; push (GHA deploy box3). Không web, không hỏi, không lan việc.
const SUA = ['apps/etp', 'apps/xuong-video/scripts/ethopex', 'apps/etp2/src', 'apps/web/src/components', 'apps/web/src/lib'].map((d) => path.join(MOS2, d));
const QUYEN = ['Read', 'Glob', 'Grep', ...SUA.flatMap((d) => [`Edit(/${d}/**)`, `Write(/${d}/**)`]), `Edit(/${MOS2}/apps/cty/worker/ethopex.mjs)`,
  `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`, 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add apps/:*)', 'Bash(git commit:*)',
  'Bash(git push origin HEAD:main)', `Bash(${os.homedir()}/bin/gh-watch deploy.yml)`, 'Bash(node scripts/check-:*)', 'Bash(node --check:*)', 'Bash(python3 -m py_compile:*)',
  'Bash(python3 apps/xuong-video/scripts/ethopex/nhip_tang.py)', 'Bash(python3 apps/etp/cong.py --tu-kiem)', 'Bash(node apps/cty/worker/ethopex.mjs --tu-kiem)',
  'Bash(./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit)', 'Bash(grep:*)', 'Bash(tail:*)', 'Bash(cat:*)', 'Bash(ls:*)', 'Bash(sed -n:*)',
  // dạng lệnh Claude thật gõ (anh 10/11/2026 "chạy ổn định … tao ko phải tham gia" — cùng gốc Khang: danh sách hẹp bị từ chối im lặng → báo "cần anh"); CAM_BASH chặn hoàn tác / xoá
  `Bash(cd ${MOS2}:*)`, `Bash(git -C ${MOS2}:*)`, 'Bash(git show:*)', 'Bash(head:*)', 'Bash(wc:*)', 'Bash(awk:*)', 'Bash(sort:*)', 'Bash(uniq:*)'];
const CAM_BASH = ['git reset', 'git revert', 'git checkout', 'git restore', 'git clean', 'git stash', 'git rebase', 'git push --force', 'git push -f', 'git branch -D', 'git tag -d',
  'rm', 'rmdir', 'rsync', 'scp', 'br', 'open', 'npm install', 'npm i', 'npx', 'brew', 'pip', 'launchctl', 'crontab', 'sudo', 'kill', 'pkill'].map((c) => `Bash(${c}:*)`);
const CAM = [...CAM_BASH, 'AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` };
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; } } };
const viec = (args, input) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} THO_MAY_TEP=${TEP} node worker/tho-may-viec.mjs ${args}`, input);
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -E '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Huy đang tắt'); process.exit(0); }
const dm = (soul.match(/^model:.*$/m) || [''])[0], model = (dm.match(/claude-code:([\w.-]+)/) || [])[1] || 'opus', effort = (dm.match(/effort:(low|medium|high|max)\b/) || [])[1] || null;
const git = (...a) => execFileSync('git', ['-C', MOS2, ...a], { encoding: 'utf8' }).trim();
const tepDo = () => execFileSync('git', ['-C', MOS2, 'status', '--porcelain'], { encoding: 'utf8' }).split('\n').filter(Boolean).map((l) => l.slice(3));
const doTruoc = new Set(tepDo());
const r0 = thu ? (() => { const st = JSON.parse(box(`cat ${DATA}/${TEP} 2>/dev/null || echo '{"hang":[]}'`) || '{"hang":[]}'); const x = (st.hang || []).find((y) => y.tt === 'cho'); return x ? { viec: x } : { ly_do: 'không có việc' }; })()
  : JSON.parse(viec('--lay'));
if (!r0.viec) { log(`không nhận việc: ${r0.ly_do}`); process.exit(0); }
const v = r0.viec, chu = String(v.chu).replace(/<[^>]+>/g, '');

const loiGiao = `Bạn là Huy, kỹ sư Phòng Ethopex (công ty AI của anh Tuấn). Ethopex là dự án quan trọng: máy chạy camp quảng cáo Facebook phim ngắn bằng TIỀN THẬT.
Máy vừa báo một lỗi. Bạn phải tìm GỐC, sửa một lần cho cả lớp lỗi, kiểm, deploy, rồi báo lại — anh không ngồi máy.

${/^anh:/.test(v.khoa) ? `LỆNH ANH (anh vừa trả lời trên Telegram — đây là việc phải LÀM, không hỏi lại điều anh vừa trả lời; giới hạn bên dưới chỉ mở đúng phần anh nói):
${v.cau_hoi ? `CÂU HỎI / BÁO CÁO ANH ĐANG TRẢ LỜI:\n${String(v.cau_hoi).replace(/<[^>]+>/g, '').slice(0, 3000)}\n` : ''}ANH TRẢ LỜI: ${v.anh ?? chu}
VIỆC: ${chu}` : `LỖI (${v.luc}) · khoá ${v.khoa}:
${chu}`}

ĐỌC TRƯỚC: /${MOS2}/CLAUDE.md · /${MOS2}/.claude/commands/tasks-etp.md (luật riêng Ethopex).
HẠ TẦNG:
- box3 ${BOX}, mã chạy ở /opt/earns-marketing-os-v2: máy luật apps/xuong-video/scripts/ethopex/luat-ethopex.py (xuất danh sách luật + thẻ etp.xet_luat), tạo / nhân bản / ROAS
  nhan-ban.py, máy làm lam-ethopex.py, cổng nhịp tăng nhip_tang.py, cổng chung apps/etp/cong.py, cổng API apps/etp/ethopex_api.py, đồng bộ apps/etp/dong-bo.py (10 phút),
  cảnh báo apps/etp/canh-bao.py, đọc lại ROAS apps/etp/doc_lai_roas.py; worker Phát apps/cty/worker/ethopex.mjs (nhịp + Telegram).
  Sổ: cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -c "…" — etp.camp, etp.so_ngay, etp.so_gio_camp, etp.nhat_ky (lệnh máy, cột loi),
  etp.xet_luat, etp.bao, etp.canh_bao, etp.cau_hinh, xv_khoa_ngoai (sổ máy). Chạy thử máy luật (không làm lệnh): cd apps/xuong-video/scripts/ethopex && python3 luat-ethopex.py --json.
- Sửa ở iMac (repo ${MOS2}), lên box3 bằng git push origin HEAD:main (cây riêng của bạn trên nhánh ky-su/<tên>; GHA deploy ~2 phút; chờ bằng ${os.homedir()}/bin/gh-watch deploy.yml). KHÔNG rsync / scp mã lên box3.
- Bạn làm trong CÂY RIÊNG ${MOS2} (không ai khác sửa ở đây): git add đúng tệp bạn sửa rồi commit + push, không để thay đổi nằm lại.${cay.do.length ? `\n- Cây riêng còn thay đổi CHƯA COMMIT từ lượt trước của chính bạn: ${cay.do.join(', ')} — kiểm rồi commit nếu đúng, sai thì sửa tới (không hoàn tác).` : ''}

CÁCH LÀM:
1. Đọc lỗi nguyên văn + nhật ký + mã liên quan; đo trên số thật (psql, chạy thử máy luật). Phân loại: (a) lỗi mã / lệch giữa hai đầu → sửa GỐC (một lần cho cả lớp, không vá riêng camp);
   (b) Ethopex / Meta từ chối có lý do (bài bị từ chối, tên miền tắt…) → không sửa mã nếu máy đã xử đúng, báo rõ lý do + ai phải làm; (c) cần quyết định luật / tiền → CAN_ANH.
2. Kiểm: python3 -m py_compile / node --check tệp đã sửa, bài tự kiểm liên quan (nhip_tang.py, cong.py --tu-kiem, worker --tu-kiem), tsc nếu đụng trang,
   node scripts/check-etp-gop-y.mjs --tu-kiem và node scripts/check-etp-gop-y.mjs (xanh mới được push). Sửa xong thêm điều kiện giữ vào apps/etp/gop-y-luat.mjs.
3. git add đúng tệp + git commit (tiếng Việt: gốc + cách sửa) + git push origin HEAD:main + gh-watch deploy.yml; kiểm lại trên box3 (chạy thử máy luật, đọc sổ).

CẤM: tạo / bật / nhân bản / lên ROAS camp, đổi ngân sách, tắt camp bằng tay (máy luật làm theo luật, bạn chỉ sửa mã) · đổi NGƯỠNG / LUẬT camp (thang bậc, cổng tăng, luật tắt, trần)
mà anh chưa chốt — sửa lỗi mã thì được, đổi luật là CAN_ANH · xoá dữ liệu · git revert / reset / checkout · sửa tệp ngoài phần Ethopex · in khoá / token · mua / nạp tiền.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 3–6 dòng tiếng Việt cho anh đọc trên điện thoại,
lời thường, không bảng, không dán lệnh dài, mỗi ý một dòng mở bằng nhãn ngắn và dấu hai chấm: lỗi gì · gốc ở đâu · đã sửa gì (tệp + commit) · đã kiểm thế nào. Viết gọn, xưng "con", gọi "anh".`;
// LỆNH BỊ TỪ CHỐI LƯỢT TRƯỚC (anh 10/11/2026 "làm sao để chúng nó chạy ổn định, tự fix được lỗi mà tao ko phải tham gia"): chế độ không giao diện từ chối lệnh không khớp
// danh sách quyền mà không báo — kỹ sư tưởng bị chặn rồi hỏi anh. Máy ghi lại (kq.permission_denials) và đưa vào lời giao lượt sau để kỹ sư gõ dạng khớp quyền.
const TEP_TU_CHOI = path.join(os.homedir(), '.cache', `${NGUOI}-tu-choi.json`);
const tuChoiCu = (() => { try { return JSON.parse(fs.readFileSync(TEP_TU_CHOI, 'utf8')); } catch { return []; } })();
const loiGiaoDu = tuChoiCu.length ? `${loiGiao}\n\nLƯỢT TRƯỚC MÁY ĐÃ TỪ CHỐI các lệnh sau vì không khớp danh sách quyền (KHÔNG phải anh chặn, KHÔNG báo anh):\n${tuChoiCu.map((c) => `- ${c}`).join('\n')}\nGõ lại dạng khớp: mỗi lệnh bắt đầu bằng đúng tên lệnh được phép (git add apps/…, git commit …, git push origin HEAD:main, ssh ${BOX} '…'), không gán biến tạm, không cd sang thư mục khác.` : loiGiao;
if (thu) { console.log(loiGiaoDu); process.exit(0); }
try { viec(`--nhan ${v.id}`); } catch (e) { log(`báo nhận lỗi: ${e.message.split('\n')[0]}`); }
log(`nhận việc #${v.id} ${v.khoa} · model ${model}${effort ? ` · effort ${effort}` : ''}`);
const truoc = git('rev-parse', 'HEAD');
const r = spawnSync(CLAUDE, ['-p', loiGiaoDu, '--model', model, ...(effort ? ['--effort', effort] : []), '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM],
  { cwd: MOS2, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
const tuChoi = [...new Set((kq.permission_denials || []).map((d) => String(d.tool_input?.command ?? d.tool_name ?? '').replace(/\s+/g, ' ').slice(0, 160)).filter(Boolean))].slice(0, 8);
try { fs.mkdirSync(path.dirname(TEP_TU_CHOI), { recursive: true }); fs.writeFileSync(TEP_TU_CHOI, JSON.stringify(tuChoi)); } catch { /* ổ đầy: lượt sau không có gợi ý, vẫn chạy */ }
const ra = String(kq.result || '').trim(), ketDong = (ra.match(/^\s*\**KET:\**\s*(DA_SUA|KHONG_SUA|CAN_ANH)\b.*$/gim) || []).pop();
const ket0 = ketDong ? ketDong.match(/DA_SUA|KHONG_SUA|CAN_ANH/i)[0].toLowerCase() : (r.signal || r.error ? 'treo' : 'khong_sua');
// "cần anh" mà lượt có lệnh bị máy từ chối và lời báo nói về quyền / git → lỗi công cụ, không phải quyết định của anh: ghi không sửa được (lượt sau tự gõ lại), không bật nút hỏi anh
const ket = ket0 === 'can_anh' && tuChoi.length && /quyền|git|bị chặn|permission/i.test(ra) ? 'khong_sua' : ket0;
const sau = git('rev-parse', 'HEAD'), commit = sau === truoc ? '' : git('log', '--format=%h %s', `${truoc}..${sau}`).split('\n').slice(0, 5).join('\n');
const lan = sau === truoc ? [] : git('diff', '--name-only', `${truoc}..${sau}`).split('\n').filter((f) => doTruoc.has(f));   // commit kèm tệp đã dở từ trước = lẫn việc của việc nền khác
const boKet = ra.replace(/^\s*\**KET:.*$/gim, '').trim(), sauBao = boKet.split(/^\s*[*#\s]*BÁO ANH:?\**\s*$/im);
const than = ((sauBao.length > 1 ? sauBao.pop().trim() : boKet.split('\n').slice(-8).join('\n')) || `Claude thoát ${r.status ?? r.signal} không kèm báo cáo (${String(r.stderr || r.error?.message || '').slice(0, 200)})`)
  + (tuChoi.length ? `\n⚙ Máy từ chối ${tuChoi.length} lệnh (lượt sau tự gõ lại dạng khớp quyền${ket !== ket0 ? ', không phải việc anh' : ''}).` : '') + (commit ? `\n\nCommit:\n${commit}` : '') + (lan.length ? `\n⚠ Commit có kèm tệp vốn đang dở từ trước (của việc nền khác trên iMac): ${lan.join(', ')} — anh xem lại.` : '') + `\n(${Math.round((kq.duration_ms || 0) / 6e4)} phút)` + (() => {
  // SỨC KHOẺ trong ngày (anh 10/11/2026 "chạy ổn định … tao ko phải tham gia"): đếm kết quả hôm nay của chính hàng này — tỉ lệ "cần anh" cao là dấu máy đang hỏi thừa
  try { const hom = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10), h = (JSON.parse(box(`cat ${DATA}/${TEP}`)).hang || []).filter((x) => x.xong && new Date(Date.parse(x.xong) + 7 * 36e5).toISOString().slice(0, 10) === hom);
    const d = (k) => h.filter((x) => x.ket === k || (k === 'da_sua' && x.tt === 'xong')).length; return `\nHôm nay: ${h.length + 1} việc · ${d('da_sua') + (ket === 'da_sua' ? 1 : 0)} đã sửa · ${d('can_anh') + (ket === 'can_anh' ? 1 : 0)} cần anh`; } catch { return ''; } })();
log(`xong #${v.id}: ${ket} · commit ${commit ? sau.slice(0, 8) : 'không'} · ${kq.num_turns ?? '?'} lượt`);
viec(`--bao ${v.id} ${ket === 'treo' ? 'treo' : ket}`, than);
