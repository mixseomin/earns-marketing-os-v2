// XƯỞNG AFF TRÊN iMAC — hai phần, mỗi 5 phút qua bộ điều phối việc nền (viec-nen.json iMac:tc.on.cty.long-sua-bai); tệp đọc từ box3 mỗi lượt.
// Anh 17/10/2026: "Long là con claude nội bộ — nhận bài, xử lý và lưu nội bộ. Trưởng phòng Nội dung (Ngọc) là AI bên ngoài, cho phép commit
// (và cũng phải báo cáo)".
//   A. ĐƯA LÊN (script cố định, KHÔNG mô hình): bài Ngọc đã DUYỆT (kiem-bai --cho-dang) → kiểm commit đã duyệt nằm trong nhánh + cây sạch → dựng,
//      deploy ratesbyroom, push commit về origin → báo `--da-dang` (tin Telegram dưới tên Ngọc). Chỉ đúng bản Ngọc duyệt mới lên trang.
//   B. SỬA (Long = Claude Code không giao diện, quyền hẹp: đọc / sửa tệp, dựng, git commit — KHÔNG deploy, KHÔNG push): bài bị trả về → báo nhận →
//      sửa + dựng + commit nội bộ → nộp BẢN NHÁP vừa dựng + mã commit cho Ngọc chấm. Không xong → báo DỪNG, máy không thử lại bài đó.
// Giới hạn chung: cây hotel-arb có thay đổi chưa commit (phiên khác đang làm) thì đợi · chỉ ratesbyroom.com · 30 phút mỗi lượt sửa · trần 3 lượt chấm.
// Phải chạy trong phiên đăng nhập của máy (bộ điều phối): qua ssh, Claude Code không mở được Keychain → "Not logged in".
//   node long-sua-bai.mjs          một lượt          · node long-sua-bai.mjs --thu   in việc sẽ làm + lời giao, không gọi Claude, không deploy
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'long';
const REPO = path.join(os.homedir(), 'Me/Earns/hotel-arb'), SITES = path.join(REPO, 'scripts/sites'), CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 45;
const HOST = /^https:\/\/(www\.)?ratesbyroom\.com(\/[^?#]*)/, DIST = 'dist-ratesbyroom';
// QUYỀN: sửa / ghi CHỈ trong repo hotel-arb (17/10/2026: quyền Edit không giới hạn đường dẫn → Long sửa ~/.claude/settings.json của anh).
const QUYEN = ['Read', 'Glob', 'Grep', `Edit(/${REPO}/**)`, `Write(/${REPO}/**)`, 'Bash(python3 build-hr.py:*)', 'Bash(python3 sm_theme_rbr.py:*)', 'Bash(python3 sm_hosts.py:*)',
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git add:*)', 'Bash(git commit:*)'];
const CAM = ['AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];   // Long không có ai để hỏi, không đi lạc sang việc khác
// --setting-sources project,local: KHÔNG nạp ~/.claude/settings.json (hook Stop cá nhân của anh dành cho phiên chat). Có nạp thì mỗi lần Long dừng
// bị hook chặn (787 lần trong một lượt 17/10, cộng hook ban-lui.py thiếu tệp trên iMac) → hết 45 phút mà gần như không làm gì.
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` };
const thu = process.argv.includes('--thu');
// ssh riêng mỗi lệnh (ControlPath=none): socket ghép kết nối gãy sau lượt Claude dài từng làm lệnh báo kết quả hỏng im lặng (17/10/2026); thử lại 3 lần
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; execFileSync('sleep', ['5']); } } };
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const kb = (args, input) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/kiem-bai.mjs ${args}`, input);
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim();
const chay = (cmd, a) => execFileSync(cmd, a, { cwd: SITES, encoding: 'utf8', env: ENV, timeout: 15 * 60000, maxBuffer: 64 << 20 });
const nhatKy = (o) => { try { box(`mkdir -p ${DATA}/nhip && echo ${q(JSON.stringify({ luc: new Date().toISOString(), ...o }))} >> ${DATA}/nhip/${NGUOI}.jsonl`); } catch { /* box im */ } };
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -m1 '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Long đang tắt'); process.exit(0); }
const model = (soul.match(/claude-code:([\w.-]+)/) || [])[1] || 'sonnet';

// Cây hotel-arb có thay đổi chưa commit = phiên khác đang làm → đợi (dựng từ cây bẩn là đưa việc dở của người khác lên trang). Có bài chờ sửa thì
// báo MỘT lần lên Telegram kèm nút; anh bấm "nhận luôn việc dở" → Long commit phần dở làm nền rồi sửa tiếp (anh 17/10/2026).
let ban = git('status', '--porcelain');
if (ban) {
  const cho = JSON.parse(kb(`--tra-ve ${NGUOI} --json`)).find((v) => !v.nhan_luc && !v.dung);
  const tep5 = ban.split('\n').slice(0, 5).map((l) => l.replace(/^\s*\S+\s+/, '')), ds5 = tep5.join(', ');   // git() đã trim nên dòng đầu mất dấu cách: tách theo cột, không cắt cứng 3 ký tự
  if (cho?.nhan_do && !thu) {
    const tepNhan = (cho.cho_tep || []).filter((f) => tep5.includes(f) || ban.includes(f));   // CHỈ tệp đã hiện trong tin chờ anh bấm — tệp phiên khác sinh ra sau đó không gom
    if (!tepNhan.length) { log('tin chờ không ghi tệp nào khớp — không nhận'); process.exit(0); }
    git('add', '--', ...tepNhan); git('commit', '-q', '-m', `Long [Xưởng Aff] nhận việc dở chưa commit (anh cho) để sửa ${cho.url}: ${tepNhan.join(', ')}`.slice(0, 300));
    log(`nhận việc dở: ${tepNhan.join(', ')}`); ban = git('status', '--porcelain');
  } else {
    if (cho && !cho.cho_luc && !thu) { let t = '?'; try { t = execFileSync('stat', ['-f', '%Sm', '-t', '%H:%M %d/%m', path.join(REPO, tep5[0].replace(/\/$/, ''))], { encoding: 'utf8' }).trim(); } catch { /* không đọc được giờ: vẫn báo */ }
      kb(`--cho ${q(cho.url)} --nguoi ${NGUOI} --tep ${q(JSON.stringify(tep5))} --ly-do ${q(`Repo hotel-arb trên iMac đang có việc dở chưa commit của phiên khác (${ds5} · sửa lúc ${t}). Long không đè việc của người khác.`)}`); }
    log(`hotel-arb đang có thay đổi chưa commit, đợi:\n${ban}`); process.exit(0);
  }
}
const banKhac = ban;   // tệp dở còn lại sau khi nhận = của phiên khác: phần A không đưa lên (dựng sẽ lẫn), phần B được sửa nhưng chỉ xét tệp của Long

// ── A. ĐƯA LÊN bản Ngọc đã DUYỆT ──
for (const d of JSON.parse(kb('--cho-dang'))) {
  if (!HOST.test(d.url)) continue;
  if (banKhac) { log(`chưa đưa lên ${d.url}: repo còn việc dở của phiên khác`); continue; }
  if (thu) { log(`[thử] sẽ đưa lên ${d.url} bản ${d.ban}`); continue; }
  try {
    try { git('merge-base', '--is-ancestor', d.ban, 'HEAD'); } catch { throw new Error(`commit đã duyệt ${d.ban.slice(0, 8)} không nằm trong nhánh hiện tại`); }
    if (git('diff', '--name-only', d.ban, 'HEAD')) throw new Error(`nhánh đã có commit mới sau bản duyệt ${d.ban.slice(0, 8)} — chưa duyệt, không đưa lên`);
    chay('python3', ['build-hr.py', 'ratesbyroom.com']);
    const ra = chay('sh', ['deploy-sm.sh', DIST, '/var/www/ratesbyroom', 'ratesbyroom.com']);
    let day = ''; try { git('push', 'origin', 'HEAD'); day = 'đã push commit về origin'; } catch (e) { day = `push origin lỗi: ${String(e.message).split('\n')[0]}`; }
    kb(`--da-dang ${q(d.id)} --ket ok --ghi ${q(`${ra.trim().split('\n').pop()} · ${day}`)}`); nhatKy({ viec: 'dua-len', ket: `${d.url} → đã lên trang (bản ${d.ban.slice(0, 8)})` }); log(`đã đưa lên ${d.url}`);
  } catch (e) {
    const lyDo = String(e.stderr || e.message).trim().split('\n').slice(-2).join(' ').slice(0, 300);
    kb(`--da-dang ${q(d.id)} --ket loi --ghi ${q(lyDo)}`); nhatKy({ viec: 'dua-len', ket: `${d.url} → lỗi: ${lyDo}` }); log(`đưa lên lỗi: ${lyDo}`);
  }
}

// ── B. LONG SỬA bài bị trả về ──
const ds = JSON.parse(kb(`--tra-ve ${NGUOI} --json`));
for (const k of ds.filter((v) => v.nhan_luc && !v.dung && Date.now() - Date.parse(v.nhan_luc) > (TRAN_PHUT + 15) * 60000))
  kb(`--dung ${q(k.url)} --nguoi ${NGUOI} --ly-do ${q(`lượt nhận lúc ${k.nhan_luc.slice(11, 16)} UTC không trả kết quả (máy chết / mất kết nối giữa chừng)`)}`);
const x = ds.find((v) => !v.nhan_luc && !v.dung);
if (!x) { log(`không có bài chờ sửa (${ds.length} bài đã nhận / đã dừng)`); process.exit(0); }
const m = x.url.match(HOST);
if (!m) { if (!thu) kb(`--dung ${q(x.url)} --nguoi ${NGUOI} --ly-do ${q('Xưởng Aff mới mở ratesbyroom.com; host này chưa có đường dựng')}`); process.exit(0); }
const tepDung = path.join(SITES, DIST, m[2].replace(/^\/+|\/+$/g, ''), 'index.html');

const chuan = box(`sed '/^<!--/,/-->$/d' ${APP}/cong-ty/quy-dinh/noi-dung/chuan-duyet-bai.md`);
const ds2 = (xs) => (xs.length ? xs.map((s) => `- ${s}`).join('\n') : '- (không)');
const giao = `Bạn là Long, Trưởng Xưởng Aff của công ty (cty.on.tc). Phòng Nội dung (Ngọc) trả bài về cho bạn sửa.

Bài: ${x.url} (lượt ${x.luot}/3 — hết 3 lượt chưa DUYỆT thì bài bị khoá, nên sửa TRỌN mọi nhận xét)
Kết luận: ${x.ket} · ${x.kq.tom_tat || ''}
Thiếu:
${ds2(x.kq.thieu)}
Thừa:
${ds2(x.kq.thua)}
Giọng văn:
${ds2(x.kq.giong)}

VIỆC: đọc CLAUDE.md của repo, sửa mã dựng bài này theo mọi nhận xét và THƯỚC CHẤM bên dưới; dựng (python3 build-hr.py ratesbyroom.com — đang đứng ở
scripts/sites); git add + git commit đúng tệp bạn sửa. KHÔNG deploy, KHÔNG push: bạn lưu nội bộ, Phòng Nội dung chấm bản dựng của bạn, duyệt thì máy
tự đưa lên. Bạn chỉ được chạy các lệnh đó. Không đụng bài / host khác. Không đụng ~/.claude hay bất cứ thứ gì ngoài repo này;
không có ai đọc câu trả lời giữa chừng nên đừng hỏi, đừng viết báo cáo dài: làm, commit, rồi in dòng KET.

LUẬT: nội dung công khai tiếng Anh; không gạch ngang dài, không từ máy; không bịa số liệu, nghiên cứu, lời chứng thực, tên người thật.
Ảnh: ảnh thật có quyền dùng hoặc hình minh hoạ tự dựng, <img> có alt. Video: chỉ nhúng video CÓ THẬT đúng chủ đề (ưu tiên video của mình có
trong repo / media); không có thì KHÔNG nhúng bừa, dừng. Khung tin nhắn mẫu đặt trong phần tử class tin / msg / bubble / mock / phone / chat.

KẾT THÚC: câu trả lời cuối có đúng một dòng "KET: OK <đã sửa gì>" khi đã dựng + commit xong, hoặc "KET: DUNG <lý do>".

THƯỚC CHẤM:
${chuan}`;
if (thu) { console.log(`bài: ${x.url} · model ${model} · bản dựng ${tepDung}\nquyền: ${QUYEN.join(' ')}\n\n${giao}`); process.exit(0); }

kb(`--nhan ${q(x.url)} --nguoi ${NGUOI}`); log(`nhận ${x.url} · model ${model}`);
const truoc = git('rev-parse', 'HEAD');
const r = spawnSync(CLAUDE, ['-p', giao, '--model', model, '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM],
  { cwd: SITES, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng */ }
const u = kq.usage || {}, token = { vao: u.input_tokens || 0, ra: u.output_tokens || 0, cache_doc: u.cache_read_input_tokens || 0, cache_ghi: u.cache_creation_input_tokens || 0, gia_api_usd: kq.total_cost_usd || 0, model };
const chu = String(kq.result || r.stderr || r.error?.message || '').trim();
const ket = (chu.match(/^\s*\**KET:\**\s*(OK|DUNG)\b.*$/gim) || []).pop();
const sau = git('rev-parse', 'HEAD');
// Long bỏ sót = tệp Long đã commit mà vẫn còn sửa dở; tệp dở của phiên khác không tính cho Long
const cuaLong = new Set(sau === truoc ? [] : git('diff', '--name-only', truoc, sau).split('\n').filter(Boolean));
const sach = !git('status', '--porcelain').split('\n').filter(Boolean).some((l) => cuaLong.has(l.replace(/^\s*\S+\s+/, '')));
log(`claude thoát ${r.status ?? r.signal} · ${kq.num_turns ?? '?'} lượt · ${JSON.stringify(token)} · ${ket || 'không có dòng KET'} · commit ${sau.slice(0, 8)}`);

let lyDo = '';
if (!ket || !/KET:\**\s*OK/i.test(ket)) lyDo = ket ? ket.replace(/^\s*\**KET:\**\s*DUNG\s*/i, '') : r.signal ? `quá ${TRAN_PHUT} phút` : (chu.split('\n').pop() || 'Claude Code không trả kết quả').slice(0, 300);
else if (sau === truoc) lyDo = 'báo OK nhưng không có commit mới';
else if (!sach) lyDo = 'Long còn sửa dở chưa commit ở chính tệp mình đã đụng';
else if (!fs.existsSync(tepDung)) lyDo = `không thấy bản dựng ${path.relative(REPO, tepDung)}`;
if (lyDo) { kb(`--dung ${q(x.url)} --nguoi ${NGUOI} --ly-do ${q(lyDo)}`); nhatKy({ viec: 'sua-bai', ket: `${x.url} → dừng: ${lyDo}`, token }); process.exit(0); }
kb(`--nop ${q(x.url)} --tu Long --html - --ban ${sau}`, fs.readFileSync(tepDung, 'utf8'));
nhatKy({ viec: 'sua-bai', ket: `${x.url} → sửa xong, commit ${sau.slice(0, 8)} nội bộ, nộp bản nháp (lượt ${x.luot + 1}/3)`, token }); log('đã nộp bản nháp');
