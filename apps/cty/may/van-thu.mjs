// VÂN [SOCIAL TRAFFIC] · XỬ THƯ KIÊN CHUYỂN VÀO PHÒNG — tự động, không người can thiệp (anh 20/10/2026: "Phòng Social chưa có ai phụ trách việc
// tiếp theo" → "OK, cho chạy"). Chạy trên iMac qua bộ điều phối (viec-nen.json iMac:tc.on.cty.van-thu, mỗi 5 phút); tệp đọc từ box3 mỗi lượt.
// Một lượt: cờ bật của Vân → thư chờ (worker/phong-thu.mjs --cho social-traffic) → báo NHẬN → Claude Code không giao diện ĐỌC thư + mã liên quan
// (puzzle-books trên iMac: dây chuyền Pinterest) + tài liệu nền tảng → báo cáo việc tiếp theo vào chủ đề 📂 Social Traffic → XONG.
// GIỚI HẠN: chỉ ĐỌC — không sửa tệp, không chạy lệnh, không gọi API nền tảng, không tiêu tiền (QUYEN); tách khỏi cấu hình cá nhân
// (--setting-sources project,local); 20 phút mỗi lượt; một thư một lượt; không xong → báo DỪNG, máy không thử lại thư đó.
// Phải chạy trong phiên đăng nhập của máy (bộ điều phối): qua ssh, Claude Code không mở được Keychain.
//   node van-thu.mjs          một lượt          · node van-thu.mjs --thu   in thư sẽ xử + lời giao, không gọi Claude
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'van', PHONG = 'social-traffic';
const REPO = path.join(os.homedir(), 'puzzle-books'), CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 20;
const QUYEN = [`Read(/${REPO}/**)`, 'Glob', 'Grep', 'WebFetch', 'WebSearch'];   // chỉ đọc
const CAM = ['Edit', 'Write', 'Bash', 'NotebookEdit', 'AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'CronCreate'];
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` };
const thu = process.argv.includes('--thu');
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; execFileSync('sleep', ['5']); } } };
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const pt = (args, input) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/phong-thu.mjs ${args}`, input);
const nhatKy = (o) => { try { box(`mkdir -p ${DATA}/nhip && echo ${q(JSON.stringify({ luc: new Date().toISOString(), ...o }))} >> ${DATA}/nhip/${NGUOI}.jsonl`); } catch { /* box im */ } };
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -m1 '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Vân đang tắt'); process.exit(0); }
const model = (soul.match(/claude-code:([\w.-]+)/) || [])[1] || 'sonnet';
const x = JSON.parse(pt(`--cho ${PHONG} --json`))[0];
if (!x) { log('không có thư chờ'); process.exit(0); }
const phong = box(`sed -n '1,/^---$/!p' ${APP}/cong-ty/phong/${PHONG}.md | head -40`);

const giao = `Bạn là Vân, Trưởng phòng Social Traffic của công ty (cty.on.tc): giữ traffic từ mạng xã hội (Pinterest trước tiên) cho các dự án.
Kiên (phòng Bảo mật) vừa chuyển cho bạn một thư. Việc của bạn: đọc thư, đọc mã liên quan trong repo đang đứng (puzzle-books — dây chuyền
Pinterest: scripts/pins.mjs, pin-hang.mjs, pin-so.mjs, kenh.mjs…), đọc tài liệu chính thức của nền tảng nếu cần, rồi lập VIỆC TIẾP THEO.

BẠN CHỈ ĐỌC: không sửa tệp, không chạy lệnh, không gọi API nền tảng, không tiêu tiền. Không có ai trả lời giữa chừng: đừng hỏi.
Không đụng ~/.claude hay thứ gì ngoài repo này.

THƯ: ${x.tieuDe}
Người gửi: ${x.gui} (${x.mien})
Kiên đọc: ${x.chu}
Việc Kiên ghi: ${x.viec}
NỘI DUNG:
${x.than}

VỀ PHÒNG:
${phong}

TRẢ LỜI bằng tiếng Việt, ngắn, đúng 4 mục (không chào hỏi, không tóm tắt lại thư dài dòng):
1. Thư nói gì (1–2 câu, có số liệu / quyền / hạn chót nếu có).
2. Việc tiếp theo: các bước cụ thể, tệp nào trong repo phải sửa và sửa gì.
3. Cần anh cung cấp gì (vd khoá ứng dụng trong trang nhà phát triển) — chỉ ghi khi máy thật sự không tự lấy được, kèm vì sao.
4. Rủi ro chính sách nền tảng cần tránh.
Dòng CUỐI: "KET: OK" khi đã lập xong, hoặc "KET: DUNG <lý do>".`;
if (thu) { console.log(`thư: ${x.id} · ${x.tieuDe} · model ${model}\nquyền: ${QUYEN.join(' ')}\n\n${giao}`); process.exit(0); }

pt(`--nhan ${PHONG} ${q(x.id)} --ai ${NGUOI}`); log(`nhận ${x.id} · ${x.tieuDe} · model ${model}`);
const r = spawnSync(CLAUDE, ['-p', giao, '--model', model, '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM],
  { cwd: REPO, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng */ }
const u = kq.usage || {}, token = { vao: u.input_tokens || 0, ra: u.output_tokens || 0, cache_doc: u.cache_read_input_tokens || 0, cache_ghi: u.cache_creation_input_tokens || 0, gia_api_usd: kq.total_cost_usd || 0, model };
const chu = String(kq.result || '').trim(), ket = (chu.match(/^\s*\**KET:\**\s*(OK|DUNG)\b.*$/gim) || []).pop();
log(`claude thoát ${r.status ?? r.signal} · ${kq.num_turns ?? '?'} lượt · ${JSON.stringify(token)} · ${ket || 'không có dòng KET'}`);
if (ket && /KET:\**\s*OK/i.test(ket)) {
  pt(`--xong ${PHONG} ${q(x.id)} --ai ${NGUOI} --bao -`, chu.replace(/^\s*\**KET:.*$/gim, '').trim());
  nhatKy({ viec: 'thu-phong', ket: `${x.mien} · ${x.tieuDe} → đã lập việc tiếp theo`, token }); log('đã báo xong');
} else {
  const lyDo = ket ? ket.replace(/^\s*\**KET:\**\s*DUNG\s*/i, '') : r.signal || r.error?.code === 'ETIMEDOUT' ? `quá ${TRAN_PHUT} phút` : (String(r.stderr || chu || 'Claude Code không trả kết quả').split('\n').pop()).slice(0, 300);
  pt(`--dung ${PHONG} ${q(x.id)} --ai ${NGUOI} --ly-do ${q(lyDo)}`); nhatKy({ viec: 'thu-phong', ket: `${x.mien} · ${x.tieuDe} → dừng: ${lyDo}`, token }); log(`dừng: ${lyDo}`);
}
