// HUY — KỸ SƯ ETHOPEX (anh 10/11/2026: "Giống thằng Thành phòng Astrolas, mày phải có 1 con CLI chuyên làm việc fix này" · "ko phải mỗi lần lại tạo 1 cái
// như vậy" · "Phòng ETP này phải có 1 con riêng phụ trách vì nó là dự án quan trọng"). Bộ điều phối iMac gọi mỗi 5 phút (viec-nen.json iMac:tc.on.cty.etp-sua).
// Lấy MỘT việc ở hàng riêng của Huy (worker/tho-may-viec.mjs với THO_MAY_TEP=etp-sua.json — Phát xếp mỗi nhịp từ lỗi máy luật, lệnh Ethopex bị từ chối,
// thẻ xét luật đứng, camp ROAS đọc lại sai), báo đã nhận dưới chủ đề 📂 Ethopex, chạy Claude Code KHÔNG GIAO DIỆN trong repo mos2 để tìm gốc + sửa + kiểm +
// deploy, rồi trả lời ngay dưới tin đó. Cùng khuôn thợ máy Mạnh (may/tho-may.mjs) — luật: Claude không giao diện bằng gói thuê bao CHỈ chạy trên iMac.
//   node etp-sua.mjs        một lượt      · node etp-sua.mjs --thu   in lời giao cho việc đang chờ, không gọi Claude, không nhận việc
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`Huy chỉ chạy trên iMac (máy này: ${os.hostname()}) — Claude không giao diện bằng gói thuê bao chỉ iMac`); process.exit(3); }

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'huy', TEP = 'etp-sua.json';
const MOS2 = path.join(os.homedir(), 'Me/GitHub/earns-marketing-os-v2'), CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 30;
// QUYỀN HẸP: sửa CHỈ phần Ethopex của repo mos2 (máy chạy box3 apps/etp, máy luật / tạo camp apps/xuong-video/scripts/ethopex, worker Phát, trang etp / etp2,
// danh sách điều kiện chống quay về bản cũ apps/etp/gop-y-luat.mjs); đọc box3 qua ssh; kiểm tĩnh; push (GHA deploy box3). Không web, không hỏi, không lan việc.
const SUA = ['apps/etp', 'apps/xuong-video/scripts/ethopex', 'apps/etp2/src', 'apps/web/src/components', 'apps/web/src/lib'].map((d) => path.join(MOS2, d));
const QUYEN = ['Read', 'Glob', 'Grep', ...SUA.flatMap((d) => [`Edit(/${d}/**)`, `Write(/${d}/**)`]), `Edit(/${MOS2}/apps/cty/worker/ethopex.mjs)`,
  `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`, 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add apps/:*)', 'Bash(git commit:*)',
  'Bash(git push origin main)', `Bash(${os.homedir()}/bin/gh-watch deploy.yml)`, 'Bash(node scripts/check-:*)', 'Bash(node --check:*)', 'Bash(python3 -m py_compile:*)',
  'Bash(python3 apps/xuong-video/scripts/ethopex/nhip_tang.py)', 'Bash(python3 apps/etp/cong.py --tu-kiem)', 'Bash(node apps/cty/worker/ethopex.mjs --tu-kiem)',
  'Bash(./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit)', 'Bash(grep:*)', 'Bash(tail:*)', 'Bash(cat:*)', 'Bash(ls:*)', 'Bash(sed -n:*)'];
const CAM = ['AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` };
const thu = process.argv.includes('--thu');
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; } } };
const viec = (args, input) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} THO_MAY_TEP=${TEP} node worker/tho-may-viec.mjs ${args}`, input);
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -E '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Huy đang tắt'); process.exit(0); }
const dm = (soul.match(/^model:.*$/m) || [''])[0], model = (dm.match(/claude-code:([\w.-]+)/) || [])[1] || 'opus', effort = (dm.match(/effort:(low|medium|high|max)\b/) || [])[1] || null;
const r0 = thu ? (() => { const st = JSON.parse(box(`cat ${DATA}/${TEP} 2>/dev/null || echo '{"hang":[]}'`) || '{"hang":[]}'); const x = (st.hang || []).find((y) => y.tt === 'cho'); return x ? { viec: x } : { ly_do: 'không có việc' }; })()
  : JSON.parse(viec('--lay'));
if (!r0.viec) { log(`không nhận việc: ${r0.ly_do}`); process.exit(0); }
const v = r0.viec, chu = String(v.chu).replace(/<[^>]+>/g, '');
const git = (...a) => execFileSync('git', ['-C', MOS2, ...a], { encoding: 'utf8' }).trim();

const loiGiao = `Bạn là Huy, kỹ sư Phòng Ethopex (công ty AI của anh Tuấn). Ethopex là dự án quan trọng: máy chạy camp quảng cáo Facebook phim ngắn bằng TIỀN THẬT.
Máy vừa báo một lỗi. Bạn phải tìm GỐC, sửa một lần cho cả lớp lỗi, kiểm, deploy, rồi báo lại — anh không ngồi máy.

LỖI (${v.luc}) · khoá ${v.khoa}:
${chu}

ĐỌC TRƯỚC: /${MOS2}/CLAUDE.md · /${MOS2}/.claude/commands/tasks-etp.md (luật riêng Ethopex).
HẠ TẦNG:
- box3 ${BOX}, mã chạy ở /opt/earns-marketing-os-v2: máy luật apps/xuong-video/scripts/ethopex/luat-ethopex.py (xuất danh sách luật + thẻ etp.xet_luat), tạo / nhân bản / ROAS
  nhan-ban.py, máy làm lam-ethopex.py, cổng nhịp tăng nhip_tang.py, cổng chung apps/etp/cong.py, cổng API apps/etp/ethopex_api.py, đồng bộ apps/etp/dong-bo.py (10 phút),
  cảnh báo apps/etp/canh-bao.py, đọc lại ROAS apps/etp/doc_lai_roas.py; worker Phát apps/cty/worker/ethopex.mjs (nhịp + Telegram).
  Sổ: cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -c "…" — etp.camp, etp.so_ngay, etp.so_gio_camp, etp.nhat_ky (lệnh máy, cột loi),
  etp.xet_luat, etp.bao, etp.canh_bao, etp.cau_hinh, xv_khoa_ngoai (sổ máy). Chạy thử máy luật (không làm lệnh): cd apps/xuong-video/scripts/ethopex && python3 luat-ethopex.py --json.
- Sửa ở iMac (repo ${MOS2}), lên box3 bằng git push origin main (GHA deploy ~2 phút; chờ bằng ${os.homedir()}/bin/gh-watch deploy.yml). KHÔNG rsync / scp mã lên box3.
- Cây làm việc có tệp phiên khác đang sửa dở: chỉ git add đúng tệp chính bạn sửa.

CÁCH LÀM:
1. Đọc lỗi nguyên văn + nhật ký + mã liên quan; đo trên số thật (psql, chạy thử máy luật). Phân loại: (a) lỗi mã / lệch giữa hai đầu → sửa GỐC (một lần cho cả lớp, không vá riêng camp);
   (b) Ethopex / Meta từ chối có lý do (bài bị từ chối, tên miền tắt…) → không sửa mã nếu máy đã xử đúng, báo rõ lý do + ai phải làm; (c) cần quyết định luật / tiền → CAN_ANH.
2. Kiểm: python3 -m py_compile / node --check tệp đã sửa, bài tự kiểm liên quan (nhip_tang.py, cong.py --tu-kiem, worker --tu-kiem), tsc nếu đụng trang,
   node scripts/check-etp-gop-y.mjs --tu-kiem và node scripts/check-etp-gop-y.mjs (xanh mới được push). Sửa xong thêm điều kiện giữ vào apps/etp/gop-y-luat.mjs.
3. git add đúng tệp + git commit (tiếng Việt: gốc + cách sửa) + git push origin main + gh-watch deploy.yml; kiểm lại trên box3 (chạy thử máy luật, đọc sổ).

CẤM: tạo / bật / nhân bản / lên ROAS camp, đổi ngân sách, tắt camp bằng tay (máy luật làm theo luật, bạn chỉ sửa mã) · đổi NGƯỠNG / LUẬT camp (thang bậc, cổng tăng, luật tắt, trần)
mà anh chưa chốt — sửa lỗi mã thì được, đổi luật là CAN_ANH · xoá dữ liệu · git revert / reset / checkout · sửa tệp ngoài phần Ethopex · in khoá / token · mua / nạp tiền.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 3–6 dòng tiếng Việt cho anh đọc trên điện thoại,
lời thường, không bảng, không dán lệnh dài, mỗi ý một dòng mở bằng nhãn ngắn và dấu hai chấm: lỗi gì · gốc ở đâu · đã sửa gì (tệp + commit) · đã kiểm thế nào. Viết gọn, xưng "con", gọi "anh".`;
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
const boKet = ra.replace(/^\s*\**KET:.*$/gim, '').trim(), sauBao = boKet.split(/^\s*[*#\s]*BÁO ANH:?\**\s*$/im);
const than = ((sauBao.length > 1 ? sauBao.pop().trim() : boKet.split('\n').slice(-8).join('\n')) || `Claude thoát ${r.status ?? r.signal} không kèm báo cáo (${String(r.stderr || r.error?.message || '').slice(0, 200)})`)
  + (commit ? `\n\nCommit:\n${commit}` : '') + `\n(${Math.round((kq.duration_ms || 0) / 6e4)} phút)`;
log(`xong #${v.id}: ${ket} · commit ${commit ? sau.slice(0, 8) : 'không'} · ${kq.num_turns ?? '?'} lượt`);
viec(`--bao ${v.id} ${ket === 'treo' ? 'treo' : ket}`, than);
