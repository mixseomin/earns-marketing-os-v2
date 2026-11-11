// ĐẠT — KỸ SƯ HÒM GÓP Ý MOS2 (anh 12/11/2026: "tasks-mos2: cũng cần tạo 1 con giống Thành (astrolas) để tự động xử lý việc"). Cùng khuôn Khang / Huy (may/social-sua.mjs):
// bộ điều phối iMac gọi mỗi 5 phút (viec-nen.json iMac:tc.on.cty.mos2-gop-y). Không có hàng riêng: kho việc CHÍNH LÀ card góp ý trên plays mos2 (human_tasks,
// source_platform='feedback', trạng thái pending / claimed / broken — anh bấm làm lại thì card về pending với tin mới). Lấy MỘT card cũ nhất, chạy Claude Code KHÔNG GIAO DIỆN
// trong cây repo riêng theo đúng lệnh /tasks-mos2 (~/.claude/commands/tasks-mos2.md): sửa gốc, deploy, trả lời vào luồng card, nộp Review. Done vẫn là chữ ký của anh.
//   node mos2-gop-y.mjs        một lượt      · node mos2-gop-y.mjs --thu   in lời giao cho card kế, không gọi Claude
//   node mos2-gop-y.mjs --kiem <id>   CHẠY THỬ thật trên card bất kỳ (kể cả đã đóng): Claude chỉ đọc — tải + xem ảnh, tsc, ssh box3, git — không sửa, không push, không trả lời card
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cayHoacBao, MOS2_GOC } from './cay-rieng.mjs';

if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`Đạt chỉ chạy trên iMac (máy này: ${os.hostname()}) — Claude không giao diện bằng gói thuê bao chỉ iMac`); process.exit(3); }

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'dat', HOME = os.homedir();
const CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 40, thu = process.argv.includes('--thu'), kiem = Number(process.argv[process.argv.indexOf('--kiem') + 1]) || 0;
const PLAY = `${HOME}/bin/play`, ANH = path.join(HOME, '.cache', 'dat-anh'), TEP_DA = path.join(HOME, '.cache', 'dat-da-lam.json');
// PROFILE br RIÊNG của Đạt (anh 12/11/2026 "phải cho nó mở và đọc br. Giờ ko cấm mở mos2.on.tc nữa"): mọi lệnh br của Claude đi thẳng profile này qua BR_PROFILE
const BR = `${HOME}/bin/br`, HO_SO = path.join(HOME, 'may-ky-su', NGUOI, 'br-profile');
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`, BR_PROFILE: HO_SO };
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);
const box = (cmd) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000 }); } catch (e) { if (i >= 3) throw e; } } };
const sql = (q) => box(`cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -tA -c ${JSON.stringify(q.replace(/\s+/g, " ")).replace(/\$/g, '\\$')}`).trim();

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -E '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md || true`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Đạt đang tắt'); process.exit(0); }
const dm = (soul.match(/^model:.*$/m) || [''])[0], model = (dm.match(/claude-code:([\w.-]+)/) || [])[1] || 'opus', effort = (dm.match(/effort:(low|medium|high|max)\b/) || [])[1] || null;

// CHỐNG VÒNG LẶP (cùng luật hàng thợ máy, anh 11/11/2026 "phải biết giới hạn đúng lúc, đúng chỗ"): card đã chạy mà luồng chưa có tin NGƯỜI mới → không làm lại trong 24 giờ.
// Anh trả lời / bấm làm lại = có tin mới → nhận lại ngay.
const daLam = (() => { try { return JSON.parse(fs.readFileSync(TEP_DA, 'utf8')); } catch { return {}; } })();
const ds = JSON.parse(sql(`select coalesce(json_agg(x order by x.created_at), '[]') from (select id, created_at, title,
  (select count(*) from jsonb_array_elements(coalesce(prep_payload->'trao_doi','[]')) t where t->>'nguoi' <> 'ai') as tin_nguoi
  from human_tasks where project_id='mos2' and prep_payload->>'source_platform'='feedback'
  and coalesce(prep_payload->'site_status'->>'mos2', status) in ('pending','claimed','broken')) x`) || '[]');
const card = kiem ? JSON.parse(sql(`select json_build_object('id', id, 'title', title, 'tin_nguoi', 0) from human_tasks where id=${kiem}`)) : ds.find((c) => { const d = daLam[c.id]; return !d || d.tin_nguoi < c.tin_nguoi || Date.now() - Date.parse(d.luc) > 24 * 36e5; });
if (!card) { log(`không có card mới (${ds.length} card mở, đã làm cả)`); process.exit(0); }

const luong = JSON.parse(sql(`select coalesce(prep_payload->'trao_doi','[]') from human_tasks where id=${Number(card.id)}`) || '[]');
const cuoiNguoi = [...luong].reverse().find((t) => t.nguoi !== 'ai');
const cay = thu ? { dir: MOS2_GOC, do: [] } : cayHoacBao(NGUOI, { ten: 'Đạt', khoa: 'mos2:cay-rieng', phong: 'dung-san-pham', tep: 'mos2-gop-y.json' });
const MOS2 = cay.dir;
fs.mkdirSync(ANH, { recursive: true });

const SUA = ['apps/web', 'packages'].map((d) => path.join(MOS2, d));
const QUYEN = ['Read', 'Glob', 'Grep', ...SUA.flatMap((d) => [`Edit(/${d}/**)`, `Write(/${d}/**)`]), `Read(/${ANH}/**)`,
  `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`, `Bash(cd ${MOS2}:*)`, `Bash(git -C ${MOS2}:*)`, `Bash(curl -s -o ${ANH}/:*)`, `Bash(curl -s:*)`,
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git add apps/:*)', 'Bash(git add packages/:*)', 'Bash(git commit:*)', 'Bash(git push origin HEAD:main)',
  `Bash(${HOME}/bin/gh-watch deploy.yml)`, `Bash(${PLAY} reply:*)`, `Bash(${PLAY} show:*)`, `Bash(${PLAY} done:*)`, 'Bash(./node_modules/.bin/tsc:*)', 'Bash(node_modules/.bin/tsx:*)', 'Bash(node --check:*)', 'Bash(node apps/:*)',
  'Bash(grep:*)', 'Bash(tail:*)', 'Bash(head:*)', 'Bash(cat:*)', 'Bash(ls:*)', 'Bash(sed -n:*)', 'Bash(wc:*)', 'Bash(awk:*)', 'Bash(sort:*)', 'Bash(uniq:*)', 'Bash(diff:*)', `Bash(${BR} goto:*)`, `Bash(${BR} look:*)`, `Bash(${BR} read:*)`, `Bash(${BR} scroll:*)`, `Bash(${BR} wait:*)`];
const CAM = [...['git reset', 'git revert', 'git checkout', 'git restore', 'git clean', 'git stash', 'git rebase', 'git push --force', 'git push -f', 'git branch -D', 'git tag -d',
  'rm', 'rmdir', 'rsync', 'scp', 'open', 'npm install', 'npm i', 'npx', 'brew', 'pip', 'launchctl', 'crontab', 'sudo', 'kill', 'pkill'].map((c) => `Bash(${c}:*)`),
  'AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];

const urlAnh = (a) => (typeof a === 'string' ? a : a?.url) || '';   // ảnh lưu dạng chuỗi (cũ) hoặc {ten, url} (trao-doi-card)
const moiAnh = luong.flatMap((t) => (t.anh || []).map(urlAnh)).filter(Boolean);
const tin = luong.map((t, i) => `#${i + 1} ${t.nguoi === 'ai' ? 'AI' : 'NGƯỜI'} · ${String(t.luc || '').slice(0, 16)}${t.trang ? `\n  trang: ${t.trang}` : ''}${t.nguCanh ? `\n  ngữ cảnh: ${t.nguCanh}` : ''}${(t.anh || []).length ? `\n  ảnh / tệp: ${t.anh.map((a) => `${urlAnh(a)}${a?.ten ? ` (${a.ten})` : ''}`).join(' ')}` : ''}\n  ${String(t.noiDung || '').slice(0, 3000)}`).join('\n');
const loiGiao = `Bạn là Đạt, kỹ sư hòm góp ý của MOS2 (mos2.on.tc, công ty AI của anh Tuấn). Anh không ngồi máy: bạn xử tới khi xong, tự kiểm, tự deploy, tự trả lời trong card.

LÀM ĐÚNG LỆNH /tasks-mos2: đọc ${HOME}/.claude/commands/tasks-mos2.md rồi làm theo mục 2 (Làm) và 3 (Trả lời + nộp Review) cho DUY NHẤT card #${card.id} "${card.title}". Mục 1 (nạp) máy đã làm, luồng card ở dưới.
ĐỀ BÀI = tin NGƯỜI mới nhất (#${luong.indexOf(cuoiNguoi) + 1}); tin trước đó đã xử ở lượt trước.

LUỒNG CARD #${card.id}:
${tin}

ĐỌC ĐỦ TRƯỚC KHI SỬA (bắt buộc, không bỏ cái nào): lời từng tin + "trang" + "ngữ cảnh" + MỌI ảnh / tệp đính kèm (${moiAnh.length} cái): tải từng cái curl -s -o ${ANH}/<tên> <url> rồi Read.
NHÌN TRANG THẬT bằng br (profile riêng đã đăng nhập mos2, lệnh br tự đi profile đó): ${BR} goto <trang> → ${BR} look (in đường dẫn PNG, Read nó); sau khi deploy xong goto lại + look để so với ảnh của anh. Không bấm nút làm đổi dữ liệu (lưu, xoá, chạy, duyệt).
ĐỌC TRƯỚC: ${MOS2}/CLAUDE.md và ${MOS2}/.claude/contexts/ phần liên quan màn trong "trang".
CÂY RIÊNG ${MOS2} (nhánh ky-su/dat, không ai khác sửa): git add đúng tệp bạn sửa, git commit (tiếng Việt: gốc + cách sửa, ghi "góp ý #${card.id}"), git push origin HEAD:main, ${HOME}/bin/gh-watch deploy.yml. KHÔNG rsync / scp mã.${cay.do.length ? `\nCây còn thay đổi chưa commit từ lượt trước của chính bạn: ${cay.do.join(', ')} — kiểm rồi commit nếu đúng, sai thì sửa tới (không hoàn tác).` : ''}
KIỂM: ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit (chỉ đọc lỗi tệp bạn sửa); sau deploy ssh ${BOX} kiểm bản dựng / psql. CẤM mở mos2.on.tc bằng trình duyệt.
TRẢ LỜI: ${PLAY} reply ${card.id} "<sửa gì · tệp · commit · đã kiểm thế nào>" rồi ${PLAY} done ${card.id} https://github.com/mixseomin/earns-marketing-os-v2/commit/<sha>. Câu hỏi (không cần sửa mã) thì chỉ reply + done với link card.
Không rõ đề bài hoặc cần anh quyết (tiền, xoá dữ liệu, đổi luồng lớn) → ${PLAY} reply ${card.id} "<hỏi đúng một câu>" và KHÔNG done.
TỰ QUYẾT, KHÔNG HỎI: cách sửa, tệp nào, commit + deploy. Chỉ sửa đúng điều card xin (không thêm tính năng ngoài đề). Bị từ chối một lệnh shell thì viết lại dạng đơn giản (một lệnh, không biến tạm).
CẤM: hoàn tác git, xoá dữ liệu, migration xoá / đổi dữ liệu có sẵn, gọi mô hình AI tốn tiền, in khoá / token, sửa ngoài apps/web và packages.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 2–4 dòng tiếng Việt, xưng "con", gọi "anh".`;
if (thu) { console.log(loiGiao); process.exit(0); }
const giao = kiem ? `${loiGiao}\n\nCHẾ ĐỘ THỬ (máy kiểm đường chạy, KHÔNG phải việc thật): KHÔNG sửa tệp, KHÔNG commit / push, KHÔNG chạy play reply / done. Chỉ làm: tải + Read MỌI ảnh của card, ${BR} goto <trang của tin người mới nhất> rồi ${BR} look và Read ảnh chụp (nói trang đang hiện gì, có đăng nhập chưa), git status, ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit | head -3, ssh ${BOX} 'cd /opt/earns-marketing-os-v2 && git log --oneline -1', ${PLAY} show ${card.id} | head -3, rồi BÁO ANH: mỗi bước một dòng đạt / bị chặn (nguyên văn lỗi) + ảnh cho thấy màn gì. KET: KHONG_SUA` : loiGiao;

// PHIÊN MOS2 60 phút cho profile br của Đạt: tạo trên box3 rồi nạp cookie httpOnly thẳng vào daemon (/datcookie) — token không qua dòng lệnh br, Claude không thấy
try {
  const tk = execFileSync('openssl', ['rand', '-hex', '32'], { encoding: 'utf8' }).trim();
  sql(`insert into auth_sessions (session_token, user_id, expires_at) values ('${tk}', (select user_id from members where role='admin' order by user_id limit 1), now() + interval '60 minutes')`);
  execFileSync(BR, ['open', HO_SO], { encoding: 'utf8', env: ENV, timeout: 90000 });
  const kq = execFileSync('curl', ['-s', '-m', '20', '-X', 'POST', 'http://127.0.0.1:39222/datcookie', '-H', 'content-type: application/json', '--data-binary', '@-'],
    { input: JSON.stringify({ profile: HO_SO, domain: '.on.tc', name: 'mos2-session', value: tk }), encoding: 'utf8' });
  if (!/"ok":true/.test(kq)) throw new Error(kq.slice(0, 200));
} catch (e) { log(`chưa nạp được phiên br: ${String(e.message).split('\n')[0]} — Claude vẫn chạy, chỉ thiếu mắt`); }
log(`nhận card #${card.id} ${card.title} · model ${model}${effort ? ` · effort ${effort}` : ''}`);
if (!kiem) daLam[card.id] = { tin_nguoi: card.tin_nguoi, luc: new Date().toISOString() };   // ghi TRƯỚC khi chạy: lượt treo / chết cũng không chạy lại liền mỗi 5 phút
fs.writeFileSync(TEP_DA, JSON.stringify(daLam));
const r = spawnSync(CLAUDE, ['-p', giao, '--model', model, ...(effort ? ['--effort', effort] : []), '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM],
  { cwd: MOS2, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
const ra = String(kq.result || '').trim(), ket = ((ra.match(/KET:\**\s*(DA_SUA|KHONG_SUA|CAN_ANH)/gi) || []).pop() || (r.signal || r.error ? 'treo' : 'khong_sua')).replace(/.*KET:\**\s*/i, '').toLowerCase();
log(`xong #${card.id}: ${ket} · ${kq.num_turns ?? '?'} lượt · ${Math.round((kq.duration_ms || 0) / 6e4)} phút`);
// Claude không tự trả lời được (treo, chết, bị từ chối) → máy ghi một tin vào luồng để anh thấy ngay trong card, không im lặng
const moi = JSON.parse(sql(`select coalesce(prep_payload->'trao_doi','[]') from human_tasks where id=${Number(card.id)}`) || '[]');
if (kiem) console.log(ra, '\n· từ chối:', JSON.stringify((kq.permission_denials || []).map((d) => d.tool_input?.command ?? d.tool_name)));
else if (moi.length === luong.length) {
  const bao = (ra.split(/BÁO ANH:?/i).pop() || '').replace(/^\s*\**KET:.*$/gim, '').trim().slice(0, 1500) || `Đạt chạy hỏng (${ket}, thoát ${r.status ?? r.signal}) — lượt sau có tin mới của anh thì làm lại.`;
  try { execFileSync(PLAY, ['reply', String(card.id), `[Đạt · ${ket}] ${bao}`], { encoding: 'utf8', env: ENV }); } catch (e) { log(`ghi tin lỗi: ${String(e.message).split('\n')[0]}`); }
}
try { execFileSync(BR, ['close', HO_SO], { encoding: 'utf8', env: ENV, timeout: 30000 }); } catch { /* chưa mở được thì thôi */ }   // xong là dọn: đóng ĐÍCH DANH profile của Đạt
