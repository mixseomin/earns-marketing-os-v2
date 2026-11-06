// THÀNH — kỹ sư task Astrolas (anh 06/11/2026: "tạo 1 con CLI cho phòng Astrolas để chuyên nhận và xử lý các tasks … Dùng opus low"). Bộ điều phối iMac gọi mỗi 2 phút (tệp đọc từ box3 mỗi lượt); từ 23:00 đến 07:00 giờ VN thì nghỉ (anh 06/11/2026).
// Một lô = tối đa 5 task (anh 06/11/2026: "làm theo lô 5 tasks để đảm bảo chất lượng", đúng trần của /tasks): nhận cả lô một lúc để máy khác không làm trùng, rồi mỗi task một phiên Claude riêng để
// ngữ cảnh luôn sạch; xong task nào đẩy lên nhánh ai (deploy thật, anh: "cho phép nó push lên repo luôn") và báo Telegram ngay task đó. Lô dở (máy tắt, tới giờ nghỉ) lưu ở ~/.cache, lượt sau làm tiếp.
// Thứ tự: câu anh trả lời dưới tin báo → Rework → Not started, ưu tiên cao trước. Không đụng In progress của máy khác. Claude KHÔNG có quyền git push: script tự đẩy.
//   node astrolas-tasks.mjs        một lượt  · node astrolas-tasks.mjs --thu   in lời giao cho task sẽ nhận, không gọi Claude, không nhận task  · --tu-kiem
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Các task máy được nhận từ bảng `ai-tasks list`, đã xếp thứ tự: chưa giao ai hoặc giao iMAC; Rework trước, rồi ưu tiên cao, rồi id cũ. */
export function hangTask(bang) {
  const hang = bang.split('\n').map((d) => d.split('|').map((x) => x.trim())).filter((c) => /^\d+$/.test(c[1] ?? ''))
    .map((c) => ({ id: Number(c[1]), status: c[3], pri: c[4], giao: c[5] })).filter((t) => ['Rework', 'Not started'].includes(t.status) && (!t.giao || /^imac$/i.test(t.giao)));
  const hang2 = (t) => [t.status === 'Rework' ? 0 : 1, { High: 0, Medium: 1, Low: 2 }[t.pri] ?? 1, t.id];
  return hang.sort((a, b) => { const x = hang2(a), y = hang2(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
}
/** Tin hiện trạng: task chưa từng báo (da = id đã báo) thì báo, không có gì mới thì null — nhịp 2 phút không được thành 2 phút một tin. */
export function tinMoi(hang, da = []) {
  const moi = hang.filter((t) => !da.includes(t.id)); if (!moi.length) return null;
  return `📥 ${moi.length} task mới: ${moi.slice(0, 10).map((t) => `#${t.id}`).join(', ')}${moi.length > 10 ? '…' : ''}\nHàng chờ: ${demHang(hang)}.`;
}
export const demHang = (hang) => { const n = (s) => hang.filter((t) => t.status === s).length; return `${n('Rework')} làm lại · ${n('Not started')} mới`; };
/** Phần báo anh trong trả lời của Claude: sau "BÁO ANH:" (cùng dòng hay xuống dòng), bỏ dòng KET và dòng neo phiên. */
export const tachBao = (ra) => ra.replace(/^\s*\**(KET:|Việc chính:).*$/gim, '').trim().split(/^\s*[*#\s]*BÁO ANH:?\**[ \t]*/im).pop().trim();
/** Result đọc từ `ai-tasks show`. */
export const docKetQua = (show) => (show.match(/^result: ([\s\S]*?)\n(?:images:|issue_url:|conversation_id:)/m) || [])[1]?.trim() ?? '';
/** Dòng bản do máy ghi, không để mô hình đoán: nó ghi trước khi đẩy nên từng ra "chưa lên máy chủ" trên bản đã lên (#4469). Đặt ngay trước dòng entity. */
export const ghiBan = (kq, sha) => { const r = kq.replace(/\s*↳ bản:[^\n]*/g, '').trim(), ban = `↳ bản: đã lên máy chủ ${sha}`, i = r.indexOf('↳ entity:'); return i < 0 ? `${r}\n${ban}` : `${r.slice(0, i).trimEnd()}\n${ban}\n${r.slice(i)}`; };
/** Lỗi đo được của Result theo luật tasks.md: thiếu dòng entity, phần mô tả lộ tên kỹ thuật (tên tệp, seeder, khoá icon / locale, biến CSS). Lời văn thì không đo được, phần đó vẫn do mô hình. */
export const loiKetQua = (kq) => { const than = kq.replace(/↳[^\n]*/g, '').replace(/\S*astrolas\.com\S*/g, ''), ky = than.match(/[\w/-]+\.(?:blade|php|css|js|json)\b|\bSeed[A-Z]\w*|\b[a-z]+\.[a-z][a-z_-]*\b|\b[a-z]+_[a-z_]+\b|--[a-z][\w-]+|\bfs-[a-z]+\b/g) ?? []; return [...(kq.includes('↳ entity:') ? [] : ['thiếu dòng cuối ↳ entity:']), ...(ky.length ? [`phần mô tả có tên kỹ thuật: ${[...new Set(ky)].join(', ')}`] : [])]; };
/** Task có bản thiết kế (anh 06/11/2026: "với task có thiết kế thì cho nâng lên medium"): đọc đúng lời người báo, không đọc result cũ hay đường dẫn trang. */
export const coThietKe = (show) => /thiết\s*kế|bản\s*mẫu|mockup|\bdesign\b/i.test((show.match(/^human_query:([\s\S]*?)(?:^result:|^images:|^issue_url:)/m) || [])[1] ?? '');
/** Giờ nghỉ: 23:00 → 07:00 giờ VN, không phụ thuộc múi giờ máy. */
export const nghiDem = (ms = Date.now()) => { const h = new Date(ms + 7 * 36e5).getUTCHours(); return h >= 23 || h < 7; };
if (process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  const chonTask = (b) => hangTask(b)[0] ?? null;
  t.equal(chonTask(''), null); t.equal(chonTask('No tasks found.'), null);
  const d = (id, s, p, g = '') => `| ${id} | ten | ${s} | ${p} | ${g} |  |`;
  t.equal(chonTask([d(1, 'Not started', 'Low'), d(2, 'Not started', 'High')].join('\n')).id, 2, 'ưu tiên cao trước');
  t.equal(chonTask([d(2, 'Not started', 'High'), d(9, 'Rework', 'Low')].join('\n')).id, 9, 'Rework trước');
  t.equal(chonTask(d(3, 'Not started', 'High', 'MacPRO')), null, 'giao máy khác: bỏ'); t.equal(chonTask(d(3, 'Not started', 'High', 'iMAC')).id, 3);
  t.equal(chonTask(d(4, 'In progress', 'High')), null, 'In progress của máy khác: bỏ'); t.equal(chonTask(d(4, 'Rejected', 'High')), null);
  const h2 = [{ id: 1, status: 'Rework' }, { id: 2, status: 'Not started' }];
  t.match(tinMoi(h2, []), /2 task mới: #1, #2\nHàng chờ: 1 làm lại · 1 mới/); t.equal(tinMoi(h2, [1, 2]), null, 'đã báo: im'); t.match(tinMoi(h2, [1]), /1 task mới: #2/); t.equal(tinMoi([], []), null);
  t.equal(tachBao('dài dòng\nBÁO ANH: Sửa xong.\nKET: DA_SUA\n\n**Việc chính:** x'), 'Sửa xong.', 'cùng dòng'); t.equal(tachBao('a\n**BÁO ANH:**\nb\nc\nKET: CAN_ANH'), 'b\nc'); t.equal(tachBao('không có dấu'), 'không có dấu');
  t.deepEqual(loiKetQua('Đã sửa, xem https://astrolas.com/birth?a_b=1.\n↳ bản: x\n↳ entity: x-entity.a_b (reuse)'), [], 'dòng ↳ và link không tính');
  t.match(loiKetQua('Thêm planet.sect_balance vào SeedUiIcons, cỡ fs-xl.\n↳ entity: —')[0], /planet\.sect_balance, SeedUiIcons, fs-xl/); t.match(loiKetQua('Việc.')[0], /thiếu dòng/); t.equal(loiKetQua('Dùng --space-1.\n↳ entity: —').length, 1); t.equal(loiKetQua('Sửa file a.blade.php.\n↳ entity: —').length, 1);
  t.ok(coThietKe('human_query: Hãy format lại, giống như bản thiết kế\nĐây là lần 3\nresult: x')); t.ok(!coThietKe('human_query: Xoá chữ này\nresult: theo Design System, thiết kế\nissue_url: /design')); t.ok(!coThietKe('status: x'));
  t.equal(docKetQua('status: x\nresult: dòng 1\n↳ entity: —\nimages:\n  [1] a'), 'dòng 1\n↳ entity: —'); t.equal(docKetQua('status: x\nissue_url: y'), '');
  t.equal(ghiBan('Việc.\n↳ bản: chưa lên máy chủ\n↳ entity: a (reuse)', 'abc'), 'Việc.\n↳ bản: đã lên máy chủ abc\n↳ entity: a (reuse)', 'thay dòng sai'); t.equal(ghiBan('Việc. ↳ bản: đã lên máy chủ x.', 'abc'), 'Việc.\n↳ bản: đã lên máy chủ abc', 'dòng dính cuối câu');
  const gio = (h, p = 0) => Date.UTC(2026, 10, 6, h - 7, p);
  t.ok(!nghiDem(gio(7)) && !nghiDem(gio(22, 59)), 'ban ngày làm'); t.ok(nghiDem(gio(23)) && nghiDem(gio(6, 59)) && nghiDem(gio(2)), 'đêm nghỉ');
  console.log('astrolas-tasks (máy): tự kiểm đạt'); process.exit(0);
}

// CHỈ iMAC (luật anh 23/10/2026) — cùng một dòng ở mọi script gọi Claude không giao diện
if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`Thành chỉ chạy trên iMac (máy này: ${os.hostname()})`); process.exit(3); }

if (!process.argv.includes('--thu') && nghiDem()) { console.log('Thành nghỉ đêm (23:00 → 07:00 giờ VN)'); process.exit(0); }

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'thanh';
const REPO = path.join(os.homedir(), 'Me/GitHub/Astrolas.com'), CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 30, TRAN_NGAY = 30, LO = 5, AUDIT_SAU = 15, EFFORT_THIET_KE = 'medium', MA = 'thanh-imac', NHANH = 'ai';
// ghi nhớ dự án nằm trên MacBook; bản trong ~/.claude của iMac đứng từ 06/09/2026 và thiếu tệp → mỗi lượt có việc chép về đây (MacBook tắt thì dùng bản lần trước)
const NHO = path.join(os.homedir(), '.cache/astrolas-memory'), NHO_NGUON = 'nguyens-macbook-pro:.claude/projects/-Users-htuan-Documents-GitHub-Astrolas-com/memory/';
const TEP = path.join(os.homedir(), '.cache/astrolas-tasks.json');
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${os.homedir()}/bin:${process.env.PATH}`, GIT_SSH_COMMAND: 'ssh -o ControlPath=none', BR_SESSION: 'thanh', BR_PROFILE: path.join(os.homedir(), '.cache/astrolas-br'), BR_URL_NGUON: 'site-astrolas-cuc-bo' };   // br: hồ sơ trình duyệt riêng, chỉ mở site cục bộ (anh 06/11/2026: "bật lại cho Thành vào qua br")
const thu = process.argv.includes('--thu');
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; } } };
const baoHang = (than) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/astrolas-tasks.mjs --hang`, than);
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
if (st.ngay !== homNay) { st.ngay = homNay; st.n = 0; st.xong = 0; st.can_anh = 0; }
if (st.n >= TRAN_NGAY) { log(`đã đủ ${TRAN_NGAY} lượt hôm nay`); process.exit(0); }

// cây bẩn = lượt trước để sót hoặc có người đang sửa tay: không nhận việc, báo một lần
if (git('status', '--porcelain')) { log('cây làm việc có thay đổi dở: không nhận task'); if (!thu && !st.bao_ban) { bao(st.task_cuoi ?? 0, 'treo', `Bản Astrolas trên iMac còn thay đổi chưa commit nên con dừng nhận task.\nCách duy nhất là xem lại ở iMac vì máy không biết các thay đổi đó của ai: ${REPO}.`); st.bao_ban = true; luu(); } process.exit(0); }
st.bao_ban = false;

// deploy lượt trước hỏng thì câu "đã lên máy chủ" trong tin báo là sai: báo to, một lần
const kiemDeploy = () => { if (!st.deploy_cho) return; try { const r = JSON.parse(execFileSync('gh', ['run', 'list', '--branch', NHANH, '--limit', '20', '--json', 'headSha,conclusion,status,name'], { cwd: REPO, encoding: 'utf8', env: ENV, timeout: 60000 })).find((x) => x.headSha === st.deploy_cho && /deploy/i.test(x.name)); if (!r || r.status !== 'completed') return; if (r.conclusion === 'failure') baoHang(`❌ Deploy mã ${st.deploy_cho.slice(0, 8)} lên astrolas.com bị lỗi: bản sửa của các task vừa báo CHƯA lên máy chủ.`); st.deploy_cho = null; luu(); } catch (e) { log(`đọc trạng thái deploy lỗi: ${e.message.split('\n')[0]}`); } };
if (!thu) kiemDeploy();

// bám origin/ai trước mỗi task để không làm trên mã cũ; xung đột thì dừng, không tự gỡ
const capNhat = () => {
  git('fetch', '-q', 'origin', NHANH); if (git('branch', '--show-current') !== NHANH) git('checkout', '-q', NHANH);
  const lock = git('rev-parse', 'HEAD:composer.lock'); git('merge', '-q', '--no-edit', `origin/${NHANH}`);
  if (git('rev-parse', 'HEAD:composer.lock') !== lock) execFileSync('composer', ['install', '-q', '--no-interaction'], { cwd: REPO, env: ENV, timeout: 300000 });
  if (git('status', '--porcelain')) throw new Error('nhập mã mới xong cây làm việc bị đổi (móc sau khi nhập)');
};
const docHang = () => hangTask(['Rework', 'Not started'].map((s) => art('list', `--status=${s}`)).join('\n'));
const hang = docHang();
// anh 06/11/2026: "Khi Thành check tasks thì sẽ báo về hiện trạng số lượng tasks mới, làm xong cũng báo cáo số lượng"
if (!thu) { const tin = tinMoi(hang, st.da_bao ?? []); if (tin) baoHang(tin); st.da_bao = [...new Set([...(st.da_bao ?? []), ...hang.map((t) => t.id)])].slice(-500); }

const giaoCho = ({ id, rework }, anh) => `Bạn là Thành, kỹ sư của Phòng Astrolas. Bạn chạy không giao diện, anh không ngồi máy, không hỏi được ai trong lúc làm. Làm ĐÚNG MỘT task #${id} của astrolas.com rồi dừng; không nhận task khác, không tạo task mới.
${anh ? `\nANH VỪA TRẢ LỜI VỀ TASK NÀY (thắng mọi nội dung cũ, đây là đề bài của lượt này): ${anh}\n` : rework ? '\nTask này bị trả về (Rework): tập trung vào feedback mới nhất, mô tả gốc chỉ để hiểu bối cảnh; đọc cả result cũ để biết lần trước còn sót gì.\n' : ''}
NẠP ĐỦ THÔNG TIN DỰ ÁN TRƯỚC KHI SỬA:
- Read ${NHO}/MEMORY.md (ghi nhớ dự án, bản mới nhất), mở mọi mục đụng tới việc này. Bỏ qua các ghi nhớ khác nếu phiên tự nạp: bản đó cũ.
- Theo bảng Auto-load trong CLAUDE.md: Read đúng tệp .agents/contexts/ và .claude/skills/ của phần đang sửa (dùng Read, không có công cụ Skill). BẮT BUỘC: chưa Read tệp .agents/contexts/ nào thì máy chặn Edit / Write.
- Read .claude/commands/tasks.md: làm theo Hành động A từ mục "Nạp ngữ cảnh" tới "Sau khi hoàn thành", giọng văn Result, và khối TUYỆT ĐỐI THEO ĐÚNG HƯỚNG DẪN. Bỏ qua phần về batch, suất, multi-agent, Workflow.

CÁCH LÀM:
1. php artisan ai-tasks show --id=${id} --pull-images rồi Read trực tiếp mọi ảnh.
2. Có ảnh bản thiết kế hoặc ảnh khoanh vùng: TRƯỚC khi sửa, liệt kê TỪNG khác biệt nhìn thấy giữa ảnh và hiện trạng (icon từng dòng và tiêu đề, viền, nền, kẻ dòng, căn lề, cỡ chữ, dạng pill, thứ tự, chữ thừa), rồi sửa đủ hết; không làm một phần rồi dừng. Icon chọn đúng hình trong ảnh. Task Rework mà result cũ có danh sách mục: danh sách đó chính là đề bài. Trước khi báo, đi lại TỪNG mục (grep trong mã đã sửa); mục chưa làm phải ghi rõ "Chưa làm: …" trong result và BÁO ANH, không gộp mục mới cho đủ số.
3. Sửa tận gốc, dùng lại component có sẵn. Bản đang chạy ở máy này là nhánh ai; mã bạn commit sẽ LÊN TRANG THẬT ngay, nên kiểm kỹ.
   NHÌN TRANG THẬT trước khi commit, với mọi task đụng giao diện: site cục bộ chạy sẵn ở http://127.0.0.1:8000, cùng mã bạn vừa sửa, dữ liệu riêng của máy này. Sau php artisan view:clear và cache:clear, br goto "http://127.0.0.1:8000/dev-login/1?to=<đường dẫn trang trong issue_url, đã mã hoá URL>" (đăng nhập admin, chỉ cần một lần mỗi phiên; đổi ngôn ngữ theo task bằng nút trên trang), br wait, cuộn tới đúng phần bằng br eval "document.querySelector('<selector>').scrollIntoView()", mở khối cần xem bằng br click, rồi br look và Read tệp ảnh nó in ra NGAY. So với ảnh của task, còn lệch thì sửa rồi chụp lại. Thiếu dữ liệu giống ảnh thì so phần bố cục. Chỉ được viết "khớp bản thiết kế" khi đã chụp và so; không mở được trang thì ghi "chưa nhìn trên trang thật" và lý do.
4. Read .claude/skills/ship-check/SKILL.md, chạy php artisan ship:check, sửa hết ⚠ và chạy các lệnh 🔧 đúng điều kiện. Đối chiếu lại từng mệnh đề của yêu cầu.
5. git add đúng các tệp đã sửa rồi git commit -m "fix: #${id} <mô tả tiếng Việt>". Không được để sót thay đổi chưa commit. Không git push: script tự đẩy ngay sau lượt của bạn.
6. php artisan ai-tasks update --id=${id} --status="Need Reviews" --result="..." đúng giọng văn tasks.md, dòng cuối riêng bắt buộc: ↳ entity: <tên>(reuse|new|extend) hoặc ↳ entity: —. Không ghi dòng ↳ bản: máy tự ghi sau khi đẩy.
Mỗi lệnh một dòng phẳng: không cd, không &&, không ;, không vòng lặp (lớp quyền chặn).

Seed chỉ đụng dữ liệu cục bộ của máy này: chạy được để nhìn thử. Seeder mới vẫn phải thêm vào deploy như CLAUDE.md.

CẤM (gặp là dừng, đặt Blocked, --result ghi rõ cần anh quyết gì): tinker · migration xoá hoặc đổi dữ liệu có sẵn · đẩy dữ liệu lên máy chủ (interp2 push, db-sync) · gọi mô hình AI tốn tiền · đổi giá, gói, thanh toán · xoá dữ liệu · git revert / reset / checkout / stash · đặt Done · in khoá, mật khẩu.
Thiếu thông tin không đoán được, hoặc task quá lớn cho 30 phút → php artisan ai-tasks update --id=${id} --status="Blocked" --result="<lý do + cần gì>", không commit dở.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 2–4 dòng tiếng Việt lời thường cho anh đọc trên điện thoại, không tên tệp, không lệnh: yêu cầu gì · vì sao bị · đã sửa thế nào (hoặc câu hỏi cần anh trả lời). Xưng "con", gọi "anh".`;
if (thu) { const v = (st.lo ?? [])[0] ?? hang[0]; console.log(v ? giaoCho({ id: v.id, rework: v.status === 'Rework' || v.rework }) : 'không có task'); process.exit(0); }

const dungVi = (e, id, tin) => { try { git('merge', '--abort'); } catch { /* không có merge dở */ } log(`không nhập được mã mới: ${e.message.split('\n')[0]}`); if (!st.bao_ban) { bao(id ?? st.task_cuoi ?? 0, 'treo', `Con chưa làm được${id ? ` task #${id}` : ''}: bản trên iMac không nhập được mã mới từ nhánh ai.\n${e.message.split('\n')[0].slice(0, 300)}`, tin); st.bao_ban = true; } luu(); process.exit(1); };
try { capNhat(); } catch (e) { dungVi(e); }
const ph = JSON.parse(box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/astrolas-tasks.mjs --phan-hoi`));
// lô mới chỉ mở khi lô cũ đã xong; nhận cả lô ngay để chat / máy khác đang chạy /tasks bỏ qua
if (!(st.lo ?? []).length) { st.lo = hang.slice(0, Math.min(LO, TRAN_NGAY - st.n)).map((t) => ({ id: t.id, rework: t.status === 'Rework' })); if (st.lo.length) art('update', `--id=${st.lo.map((t) => t.id).join(',')}`, '--status=In progress', `--conversation-id=${MA}`); st.lo_tong = st.lo.length; }
luu();
if (!st.lo.length && !ph.task) { log('hết task'); process.exit(0); }
try { execFileSync('rsync', ['-a', '--delete', '-e', 'ssh -o BatchMode=yes -o ConnectTimeout=5', NHO_NGUON, `${NHO}/`], { env: ENV, timeout: 120000 }); } catch (e) { log(`chưa chép được ghi nhớ từ MacBook, dùng bản lần trước: ${e.message.split('\n')[0]}`); }

const QUYEN = ['Read', 'Glob', 'Grep', `Edit(/${REPO}/**)`, `Write(/${REPO}/**)`, 'Bash(php artisan ai-tasks:*)', 'Bash(php artisan ship:check:*)', 'Bash(php artisan lint:*)', 'Bash(php artisan view:clear)', 'Bash(php artisan cache:clear)', 'Bash(php artisan optimize:clear)', 'Bash(php artisan lang:sync:*)', 'Bash(php artisan db:seed --class=:*)', 'Bash(br goto:*)', 'Bash(br look)', 'Bash(br read)', 'Bash(br wait:*)', 'Bash(br click:*)', 'Bash(br eval:*)', 'Bash(php artisan migrate)', 'Bash(php artisan deps:export:*)', 'Bash(php artisan design:export:*)', 'Bash(php artisan chart-config:export:*)', 'Bash(php artisan chat-eval:export:*)', 'Bash(php artisan route:list:*)', 'Bash(php -l:*)', 'Bash(node --check:*)',
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(grep:*)', 'Bash(ls:*)', 'Bash(shell-smells:*)'];
const CAM = ['AskUserQuestion', 'Skill', 'RemoteTrigger', 'Agent', 'Task', 'Workflow', 'WebFetch', 'WebSearch', 'CronCreate', 'Bash(git push:*)', 'Bash(git reset:*)', 'Bash(git revert:*)', 'Bash(git checkout:*)', 'Bash(git stash:*)', 'Bash(git clean:*)', 'Bash(php artisan tinker:*)', 'Bash(php artisan db:wipe:*)', 'Bash(composer:*)', 'Bash(npm:*)'];

// phiên trước chỉ đọc MEMORY và tasks.md rồi sửa, lời dặn không đủ (3/3 phiên 06/11/2026): chặn ở máy, đọc nhật ký phiên chứ không tin lời báo
const GAC = `f=$(jq -r .transcript_path); grep -q '"file_path":"[^"]*/\\.agents/contexts/' "$f" || { echo 'CHƯA ĐỌC TÀI LIỆU PHẦN ĐANG SỬA: Read đúng tệp .agents/contexts/ theo bảng Auto-load trong CLAUDE.md rồi mới được sửa.' >&2; exit 2; }`;
const CO = (ef) => ['--model', model, '--effort', ef, '--output-format', 'json', '--setting-sources', 'project,local', '--settings', JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: GAC }] }] } }), '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM];
const claude = (ef, ...a) => { const r = spawnSync(CLAUDE, [...a, ...CO(ef)], { cwd: REPO, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }); let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ } return { r, kq }; };
const day = () => { try { git('push', '-q', 'origin', `HEAD:refs/heads/${NHANH}`); } catch { git('fetch', '-q', 'origin', NHANH); git('merge', '-q', '--no-edit', `origin/${NHANH}`); git('push', '-q', 'origin', `HEAD:refs/heads/${NHANH}`); } };
/** Làm một task, đẩy mã, báo Telegram ngay. false = phải dừng cả lô. */
function lamTask(v, anh, tin, nhan) {
  const id = v.id; st.n++; st.task_cuoi = id; luu();
  const ef = coThietKe(art('show', `--id=${id}`)) ? EFFORT_THIET_KE : effort;
  try { execFileSync(path.join(os.homedir(), 'bin/br'), ['open', ENV.BR_PROFILE], { encoding: 'utf8', env: ENV, timeout: 90000 }); } catch (e) { log(`chưa mở được br: ${e.message.split('\n')[0]}`); }
  log(`nhận task #${id}${nhan ? ` (${nhan})` : ''} · model ${model} · effort ${ef}`);
  const truoc = git('rev-parse', 'HEAD');
  const { r, kq } = claude(ef, '-p', giaoCho(v, anh));
  const ra = String(kq.result || '').trim();
  // Result sai luật đo được (#4470, #4471): cho chính phiên đó viết lại một lần
  if (trangThai(id) === 'Need Reviews' && kq.session_id) { const loi = loiKetQua(docKetQua(art('show', `--id=${id}`))); if (loi.length) { log(`#${id} result sai luật: ${loi.join(' · ')}`); claude(ef, '-p', `Result của task #${id} sai luật: ${loi.join('; ')}. Viết lại bằng php artisan ai-tasks update --id=${id} --status="Need Reviews" --result="...": lời thường cho người không phải dev (vì sao bị · đã sửa thế nào · giờ thấy gì), giữ đủ các mục "Chưa làm", dòng cuối ↳ entity: <tên>(reuse|new|extend) hoặc ↳ entity: —. Tên kỹ thuật chỉ được ở dòng entity. Không sửa mã.`, '--resume', kq.session_id); } }
  const sau = git('rev-parse', 'HEAD'), than0 = tachBao(ra);
  // đọc nhật ký phiên, không tin lời báo: #4479 báo "đã verify" mà chỉ đọc mã HTML vì lệnh br bị chặn
  let chuaNhin = false; if (sau !== truoc && /resources\/views|public\/(css|js)\//.test(git('diff', '--name-only', truoc, sau))) { try { chuaNhin = !fs.readFileSync(path.join(os.homedir(), '.claude/projects/-Users-htuan-Me-GitHub-Astrolas-com', `${kq.session_id}.jsonl`), 'utf8').includes('"command":"br look'); } catch { chuaNhin = true; } }
  let ket = /KET:\**\s*DA_SUA/i.test(ra) ? 'da_sua' : /KET:\**\s*CAN_ANH/i.test(ra) ? 'can_anh' : 'treo', than = than0 || `Claude thoát ${r.status ?? r.signal} không kèm báo cáo (${String(r.stderr || r.error?.message || '').slice(0, 200)})`, tiep = true;
  if (chuaNhin) { than += '\n👁 Máy đo: phiên này CHƯA chụp màn hình trang đã sửa.'; log(`#${id} sửa giao diện mà không chụp màn`); }
  // đọc lại trên bảng, không tin lời báo: còn In progress = task kẹt lại, chat khác sẽ tưởng đang có người làm
  if (trangThai(id) === 'In progress') { ket = 'treo'; art('update', `--id=${id}`, '--status=Blocked', `--result=Máy dừng giữa chừng: ${than.slice(0, 500)}`); than += '\nTask đã chuyển Blocked để không kẹt.'; }
  if (sau !== truoc) { try { day(); st.deploy_cho = git('rev-parse', 'HEAD'); art('update', `--id=${id}`, `--result=${ghiBan(docKetQua(art('show', `--id=${id}`)), sau.slice(0, 9))}`); (st.audit ??= []).push({ id, sha: sau.slice(0, 9), truoc: truoc.slice(0, 9) }); than += `\nĐã đẩy lên máy chủ (${sau.slice(0, 8)}).`; } catch (e) { ket = 'treo'; tiep = false; try { git('merge', '--abort'); } catch { /* không có merge dở */ } art('update', `--id=${id}`, '--status=Blocked', `--result=Đã sửa nhưng chưa đẩy được lên máy chủ: ${e.message.split('\n')[0].slice(0, 300)}`); than += `\nChưa đẩy được lên máy chủ, task chuyển Blocked: ${e.message.split('\n')[0].slice(0, 200)}`; } }
  if (git('status', '--porcelain')) { tiep = false; than += '\nCòn thay đổi chưa commit nên con dừng lô này.'; }
  log(`xong #${id}: ${ket} · commit ${sau === truoc ? 'không' : sau.slice(0, 8)} · ${kq.num_turns ?? '?'} lượt · ${Math.round((kq.duration_ms || 0) / 6e4)} phút`);
  if (ket === 'da_sua') st.xong = (st.xong ?? 0) + 1; else st.can_anh = (st.can_anh ?? 0) + 1; luu();
  let con = '?'; try { con = demHang(docHang()); } catch (e) { log(`đọc lại hàng chờ lỗi: ${e.message.split('\n')[0]}`); }
  bao(id, ket, `${than}\n\n${nhan ? `Lô: ${nhan} · ` : ''}Hôm nay: ${st.xong ?? 0} xong · ${st.can_anh ?? 0} cần anh. Hàng chờ: ${con}.`, tin);
  return tiep;
}

if (ph.task) { art('update', `--id=${ph.task}`, '--status=In progress', `--conversation-id=${MA}`); if (!lamTask({ id: ph.task }, ph.anh, ph.tin, '')) process.exit(1); }
while (st.lo.length && !nghiDem()) {
  const v = st.lo[0], thuTu = `${st.lo_tong - st.lo.length + 1}/${st.lo_tong}`;
  if (trangThai(v.id) !== 'In progress') { log(`#${v.id} đã đổi trạng thái ngoài máy: bỏ khỏi lô`); st.lo.shift(); luu(); continue; }
  try { capNhat(); } catch (e) { dungVi(e, v.id); }
  const tiep = lamTask(v, null, null, thuTu); st.lo.shift(); luu();
  if (!tiep) process.exit(1);
}

// anh 06/11/2026: "sau khoảng 15 tasks làm xong thì chạy command audit 1 lần (có báo telegram)". Chạy khi hết lô, đúng lệnh /audit của anh, phạm vi chỉ các commit của Thành từ lần audit trước.
if (!st.lo.length && !nghiDem() && (st.audit ?? []).length >= AUDIT_SAU) {
  const ds = st.audit, ids = ds.map((x) => `#${x.id}`).join(', ');
  try { capNhat(); } catch (e) { dungVi(e); }
  baoHang(`🔎 Đã đủ ${ds.length} task, con chạy audit các task: ${ids}.`);
  const truoc = git('rev-parse', 'HEAD');
  const { r, kq } = claude(effort, '-p', `Bạn là Thành, kỹ sư của Phòng Astrolas, chạy không giao diện. Anh đã ra lệnh chạy /audit sau mỗi khoảng ${AUDIT_SAU} task.
Read ${os.homedir()}/.claude/commands/audit.md và làm đúng lệnh đó. Phạm vi CHỈ các commit sau của bạn (git show <mã>), không lấy cây làm việc, không lan sang mã khác:
${ds.map((x) => `#${x.id}: ${x.sha}`).join('\n')}
Mục cần đo màn: nhìn bằng br trên site cục bộ http://127.0.0.1:8000 (br goto, br look rồi Read ảnh); không đo được thì ghi "chưa đo". Trước khi sửa phải Read tệp .agents/contexts/ của phần đó. Sửa thì chạy php artisan ship:check, git add đúng tệp, git commit -m "refactor: audit <các #task>"; không git push, script tự đẩy. Đổi bố cục, đổi đặc tả, hay việc trong danh sách CẤM (tinker, đẩy dữ liệu, gọi AI tốn tiền, giá, xoá dữ liệu, hoàn tác git) thì KHÔNG làm, ghi thành mục cần anh quyết.
KẾT THÚC bằng một dòng "BÁO ANH:" rồi 3–6 dòng tiếng Việt lời thường cho anh đọc trên điện thoại, không tên tệp: tìm thấy gì · đã sửa gì · mục nào bỏ qua hoặc chưa đo · gì cần anh quyết. Xưng "con", gọi "anh". Dòng cuối "KET: DA_SUA" hoặc "KET: CAN_ANH".`);
  const sau = git('rev-parse', 'HEAD'); let than = tachBao(String(kq.result || '').trim()) || `Audit dừng giữa chừng: Claude thoát ${r.status ?? r.signal} (${String(r.stderr || r.error?.message || '').slice(0, 200)})`;
  if (sau !== truoc) { try { day(); st.deploy_cho = git('rev-parse', 'HEAD'); than += `\nĐã đẩy lên máy chủ (${sau.slice(0, 8)}).`; } catch (e) { try { git('merge', '--abort'); } catch { /* không có merge dở */ } than += `\nChưa đẩy được lên máy chủ: ${e.message.split('\n')[0].slice(0, 200)}`; } }
  st.audit = []; luu();
  log(`audit xong: commit ${sau === truoc ? 'không' : sau.slice(0, 8)} · ${kq.num_turns ?? '?'} lượt · ${Math.round((kq.duration_ms || 0) / 6e4)} phút`);
  baoHang(`🔎 Audit ${ids}\n${than}`);
}
