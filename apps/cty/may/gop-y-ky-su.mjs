// KHUNG CHUNG CHO KỸ SƯ HÒM GÓP Ý (tách từ mos2-gop-y.mjs của Đạt, anh 12/11/2026 "Thêm 1 con CLI cho spy tasks"): mỗi hòm góp ý của một app = MỘT tệp cấu hình
// gọi chayKySu(cfg). Đạt = may/mos2-gop-y.mjs (mos2.on.tc), Hiếu = may/spy-gop-y.mjs (spy.on.tc). Phần chung ở đây: chọn card, chống lặp, effort theo việc,
// phiên br đăng nhập, chạy Claude Code KHÔNG GIAO DIỆN, đọc kết quả, ghi tin khi hỏng, đóng br. Phần riêng (cây repo, quyền, lời giao, cách trả lời card) nằm ở cấu hình.
import { execFileSync, spawnSync } from 'node:child_process';
import { chotCard, cardTuCommit } from './chot-card.mjs';   // card dừng giữa chừng → mục Kẹt; commit kẹt đẩy hộ → nộp (anh 14/11/2026)
import { chayClaude } from './claude-chay.mjs';
import { chayTmux } from './claude-tmux.mjs';   // cfg.tmux: phiên Claude thật trong tmux tên kỹ sư, xem trực tiếp bằng tmux attach -t <tên> (anh 15/11/2026, như Thành)   // spawnSync + báo lỗi API vào 🚨 (anh 13/11/2026)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chonMuc } from './chon-muc.mjs';

export const BOX = 'root@167.233.241.16', HOME = os.homedir(), BR = `${HOME}/bin/br`;
const APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', CLAUDE = '/opt/homebrew/bin/claude';
export const log = (s) => console.log(`${new Date().toISOString()} ${s}`);
export const box = (cmd) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000 }); } catch (e) { if (i >= 3) throw e; } } };
export const sql = (q) => box(`cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -tA -c ${JSON.stringify(q.replace(/\s+/g, " ")).replace(/\$/g, '\\$')}`).trim();
/** Quyền đọc + nhìn trang chung của mọi kỹ sư hòm góp ý; cấu hình cộng thêm quyền sửa / deploy / trả lời riêng. */
const quyenChung = (dir, ANH) => ['Read', 'Glob', 'Grep', `Read(/${ANH}/**)`, `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`, `Bash(cd ${dir}:*)`, `Bash(git -C ${dir}:*)`,
  `Bash(curl -s -o ${ANH}/*)`, 'Bash(curl -s:*)', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git commit:*)', 'Bash(node --check:*)',
  'Bash(grep:*)', 'Bash(tail:*)', 'Bash(head:*)', 'Bash(cat:*)', 'Bash(ls:*)', 'Bash(sed -n:*)', 'Bash(wc:*)', 'Bash(awk:*)', 'Bash(sort:*)', 'Bash(uniq:*)', 'Bash(diff:*)',
  `Bash(${BR} goto:*)`, `Bash(${BR} look:*)`, `Bash(${BR} read:*)`, `Bash(${BR} scroll:*)`, `Bash(${BR} wait:*)`];
/** GỐC "CLI mới mở là lỗi liên tục" (anh 17/11/2026): chế độ dontAsk chỉ cho lệnh KHỚP ĐÚNG CHUỖI trong danh sách — mỗi kỹ sư chép tay danh sách riêng, gõ khác
 *  một chữ (thêm đối số, đường dẫn tuyệt đối của cây, cd trước) là bị chặn, lộ ra sau khi lượt hỏng (Thắng #1623, Vinh #1637). Máy tự nới MỌI quyền Bash ra các dạng
 *  tương đương: (1) quyền khớp đúng chuỗi → thêm dạng có đối số (":*"); (2) đường dẫn 'apps/…' tương đối → thêm dạng tuyệt đối trong cây; (3) lệnh đọc / đo / đi lại
 *  vô hại (cd, git fetch / rev-parse, python3 -c, node -e, find, jq, echo, printf, ffprobe) cho mọi kỹ sư. CAM (git reset / rm / npx…) vẫn chặn — luật cấm đè quyền. */
export function moRongQuyen(ds, dir) {
  const ra = new Set(ds);
  for (const p of ds) {
    const m = /^Bash\((.*)\)$/.exec(p); if (!m) continue;
    const c = m[1];
    if (!c.endsWith(':*') && !c.endsWith('*')) ra.add(`Bash(${c}:*)`);
    if (/(^|\s)apps\//.test(c)) { const t = c.replace(/(^|\s)apps\//g, `$1${dir}/apps/`); ra.add(`Bash(${t})`); if (!t.endsWith('*')) ra.add(`Bash(${t}:*)`); }
  }
  if (ra.has('Bash(git push origin HEAD:main)')) for (const c of ['git push -q origin HEAD:main', 'git push origin HEAD:main -q']) ra.add(`Bash(${c})`);   // cờ -q đặt trước / sau
  for (const c of ['cd', 'git fetch', 'git rev-parse', 'git pull --rebase origin main', 'python3 -c', 'node -e', 'find', 'jq', 'echo', 'printf', 'ffprobe', 'test', 'true', 'pwd', 'which']) ra.add(`Bash(${c}:*)`);
  return [...ra];
}
/** Lệnh Bash bị CHẶN trong một phiên (đọc nhật ký jsonl của chính phiên) → [lệnh]. Máy báo nguyên văn vào card để sửa danh sách ngay, không chết im. */
export function lenhBiChan(cwd, id) {
  try {
    const f = path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'), `${id}.jsonl`); const lenh = new Map(), chan = [];
    for (const d of fs.readFileSync(f, 'utf8').split('\n')) { if (!d) continue; let o; try { o = JSON.parse(d); } catch { continue; }
      for (const c of o.message?.content ?? []) {
        if (c?.type === 'tool_use' && c.name === 'Bash') lenh.set(c.id, String(c.input?.command ?? ''));
        if (c?.type === 'tool_result' && /Permission to use Bash has been denied|has been denied because Claude Code is running in don't ask mode/.test(JSON.stringify(c.content ?? ''))) chan.push(lenh.get(c.tool_use_id) ?? '?');
      } }
    return chan;
  } catch { return []; }
}
export const CAM = [...['git reset', 'git revert', 'git checkout', 'git restore', 'git clean', 'git stash', 'git rebase', 'git push --force', 'git push -f', 'git branch -D', 'git tag -d',
  'rm', 'rmdir', 'rsync', 'scp', 'open', 'npm install', 'npm i', 'npx', 'brew', 'pip', 'launchctl', 'crontab', 'sudo', 'kill', 'pkill'].map((c) => `Bash(${c}:*)`),
  'AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];
// Lời AI trong luồng card ghi nguoi = 'ai' (play reply) HOẶC 'claude' (gop-y.sh reply). Chỉ so 'ai' thì lời 'claude' bị đếm là tin NGƯỜI:
// kỹ sư lấy câu trả lời cũ làm đề bài, và mỗi lần chính nó trả lời qua gop-y.sh lại thành "tin mới" → tự mở lại card mỗi 5 phút (12/11/2026, card spy #1293).
export const NGUOI_AI = ['ai', 'claude'];
export const laAi = (t) => NGUOI_AI.includes(String(t?.nguoi ?? '').toLowerCase());
const urlAnh = (a) => (typeof a === 'string' ? a : a?.url) || '';   // ảnh lưu dạng chuỗi (cũ) hoặc {ten, url} (trao-doi-card)

/** cfg: { nguoi, ten, duAn (project_id + khoá site_status), boQuaUrl?: [mẫu LIKE], tranPhut, cay: () => { dir, do }, cayThu: dir,
 *  chiUrl?: ['https://castle.on.tc/%'] (chỉ nhận card gửi từ trang đó — hòm dùng chung project), quyen: (dir) => [], loiGiao: (ctx) => string, kiemThu: (ctx) => string, traLoi: (id, chu) => void } — ctx: { card, luong, cuoiNguoi, tin, moiAnh, ANH, dir, cay } */
/** Kỹ sư nhận việc giao thẳng (thư mục ~/may-ky-su/<người>/giao) — dùng chayKySu. */
export const KY_SU_GIAO = { dat: 'mos2 apps/web + packages', khoi: 'cty.on.tc', vinh: 'studio xuong-video', hieu: 'spy', thang: 'castle' };
/** Giao một việc cho kỹ sư khác (dòng CHUYỂN: của một kỹ sư). Trả chuỗi báo. */
export function giaoCho(nguoi, viec, tu) {
  if (!KY_SU_GIAO[nguoi]) throw new Error(`không có kỹ sư nhận giao "${nguoi}"`);
  const d = path.join(HOME, 'may-ky-su', nguoi, 'giao'); fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 13)}-chuyen-${Math.random().toString(36).slice(2, 6)}.json`);
  fs.writeFileSync(f, JSON.stringify({ tieu_de: String(viec).slice(0, 80), noi_dung: `${tu} chuyển (việc thuộc phần của bạn): ${viec}`, luc: new Date().toISOString() }, null, 1));
  return `${nguoi} ← ${String(viec).slice(0, 80)}`;
}
/** Card đã sửa đang chờ deploy (daLam['deploy:<id>']): commit "#<id>" đã nằm trong một lượt deploy.yml XANH → nộp Review; quá 6 giờ → Kẹt. */
export function choDeployNop(daLam, cfg, dir, TEN, log, luu) {
  const cho = Object.keys(daLam).filter((k) => k.startsWith('deploy:')); if (!cho.length) return;
  let runs = []; try { runs = JSON.parse(execFileSync('gh', ['run', 'list', '--workflow', 'deploy.yml', '--limit', '30', '--json', 'headSha,conclusion'], { cwd: dir, encoding: 'utf8', timeout: 60000 })).filter((r) => r.conclusion === 'success'); } catch (e) { log(`đọc deploy lỗi: ${String(e.message).split('\n')[0]}`); return; }
  for (const k of cho) {
    const id = k.slice(7); let sha = '';
    try { execFileSync('git', ['-C', dir, 'fetch', '-q', 'origin', 'main'], { timeout: 60000 }); sha = execFileSync('git', ['-C', dir, 'log', 'origin/main', '-1', '--format=%H', `--grep=#${id}([^0-9]|$)`, '-E'], { encoding: 'utf8' }).trim(); } catch { /* chưa có commit */ }
    const len = sha && runs.some((r) => { try { execFileSync('git', ['-C', dir, 'merge-base', '--is-ancestor', sha, r.headSha], { stdio: 'ignore' }); return true; } catch { return false; } });
    if (len) { try { log(`chờ deploy: ${chotCard({ duAn: cfg.duAn, id, cach: 'nop', chu: `[${TEN}] Bản sửa ${sha.slice(0, 9)} đã lên máy chủ (deploy xanh) — máy tự nộp Review.` })}`); delete daLam[k]; luu(); } catch (e) { log(`nộp #${id} lỗi: ${String(e.message).split('\n')[0]}`); } }
    else if (Date.now() - Date.parse(daLam[k].luc) > 6 * 36e5) { try { log(`chờ deploy quá 6 giờ: ${chotCard({ duAn: cfg.duAn, id, cach: 'ket', chu: `[${TEN}] Đã sửa${sha ? ` (${sha.slice(0, 9)})` : ''} nhưng 6 giờ chưa thấy deploy xanh chứa bản sửa.` })}`); delete daLam[k]; luu(); } catch { /* lượt sau */ } }
  }
}
export function chayKySu(cfg) {
  const { nguoi: NGUOI, ten: TEN } = cfg;
  if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`${TEN} chỉ chạy trên iMac (máy này: ${os.hostname()}) — Claude không giao diện bằng gói thuê bao chỉ iMac`); process.exit(3); }
  const thu = process.argv.includes('--thu'), kiem = Number(process.argv[process.argv.indexOf('--kiem') + 1]) || 0;
  const ANH = path.join(HOME, '.cache', `${NGUOI}-anh`), TEP_DA = path.join(HOME, '.cache', `${NGUOI}-da-lam.json`);
  // PROFILE br RIÊNG của từng kỹ sư (anh 12/11/2026 "phải cho nó mở và đọc br"): mọi lệnh br của Claude đi thẳng profile này qua BR_PROFILE
  const HO_SO = path.join(HOME, 'may-ky-su', NGUOI, 'br-profile');
  const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`, BR_PROFILE: HO_SO };

  // KIỂM QUYỀN THẬT (anh 17/11/2026 "phải làm cho thằng Vinh sửa được tự động, không được lỗi"): chạy Claude Code ĐÚNG chế độ dontAsk + ĐÚNG danh sách quyền của kỹ sư,
  // gõ các dạng lệnh kỹ sư hay dùng (cfg.thuLenh — đường dẫn giả, không đổi gì, không push), đọc nhật ký phiên → lệnh nào bị chặn. Mô hình haiku, vài trăm đồng.
  //   node <kỹ-sư>-gop-y.mjs --thu-quyen      in ✓ / ✗ từng lệnh, thoát 1 nếu có lệnh bị chặn
  if (process.argv.includes('--thu-quyen')) {
    const cay = cfg.cay(), dir = cay.dir; fs.mkdirSync(ANH, { recursive: true });
    const QUYEN = moRongQuyen([...quyenChung(dir, ANH), ...cfg.quyen(dir)], dir);
    const ds = (cfg.thuLenh ? cfg.thuLenh(dir) : []).concat(['git status --short | head -3', 'git log --oneline -1', `git -C ${dir} rev-parse --short HEAD`]);
    const loi = `Kiểm quyền: chạy LẦN LƯỢT từng lệnh dưới đây bằng công cụ Bash, mỗi lệnh MỘT lần gọi, GIỮ NGUYÊN từng chữ (không sửa, không gộp, không bỏ). Lệnh lỗi hay bị chặn cũng cứ chạy lệnh kế. Xong trả lời đúng một chữ XONG.\n${ds.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
    const r = spawnSync(CLAUDE, ['-p', loi, '--model', 'haiku', '--output-format', 'json', '--permission-mode', 'dontAsk', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM],
      { cwd: dir, encoding: 'utf8', timeout: 15 * 60000, maxBuffer: 64 << 20, env: ENV });
    let kq = {}; try { kq = JSON.parse(r.stdout); } catch { console.error('Claude không trả JSON:', String(r.stderr || r.stdout).slice(0, 400)); process.exit(2); }
    const chan = new Set(lenhBiChan(dir, kq.session_id).map((c) => c.trim()));
    for (const c of ds) console.log(chan.has(c.trim()) ? '✗ BỊ CHẶN' : '✓', c);
    for (const c of chan) if (!ds.some((d) => d.trim() === c)) console.log('✗ BỊ CHẶN (lệnh Claude tự gõ thêm)', c.slice(0, 200));
    console.log(`${TEN}: ${chan.size ? `${chan.size} lệnh bị chặn` : 'ĐẠT — không lệnh nào bị chặn'} · chi $${(kq.total_cost_usd ?? 0).toFixed(4)}`);
    process.exit(chan.size ? 1 : 0);
  }
  const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -E '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md || true`).split('@@');
  if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log(`${TEN} đang tắt`); process.exit(0); }
  const dm = (soul.match(/^model:.*$/m) || [''])[0], model = (dm.match(/claude-code:([\w.-]+)/) || [])[1] || 'opus', effort = (dm.match(/effort:(low|medium|high|max)\b/) || [])[1] || null;
  // QUA CỔNG AI (anh 17/11/2026: "Việc mà tốn token claude-code mà ko cần data nội bộ, bảo mật thì dùng donk" → "dùng API AI"): SOUL ghi `qua:cong` trên dòng model
  // → Claude Code gọi endpoint kiểu Anthropic của cổng spy (Hiếu, /api/ai/cc/<người>, chuỗi donk → ckey), KHÔNG dùng gói Claude. Khoá cổng đọc từ box3, không in.
  if (/\bqua:cong\b/.test(dm)) {
    const khoa = box(`grep -h '^CONG_AI_KEY=' /root/.secrets/spy.env | cut -d= -f2- | tr -d "\\"'"`).trim();
    if (!khoa) { log(`${TEN}: SOUL đòi qua cổng AI mà không đọc được CONG_AI_KEY — dừng lượt, không rơi về gói Claude`); process.exit(0); }
    Object.assign(ENV, { ANTHROPIC_BASE_URL: `https://spy.on.tc/api/ai/cc/${NGUOI}`, ANTHROPIC_AUTH_TOKEN: khoa, ANTHROPIC_API_KEY: '' });
    log(`${TEN}: chạy qua cổng AI (donk → ckey), không dùng gói Claude`);
  }

  // CHỐNG VÒNG LẶP (cùng luật hàng thợ máy, anh 11/11/2026 "phải biết giới hạn đúng lúc, đúng chỗ"): card đã chạy mà luồng chưa có tin NGƯỜI mới → không làm lại trong 24 giờ.
  // Anh trả lời / bấm làm lại = có tin mới → nhận lại ngay.
  const daLam = (() => { try { return JSON.parse(fs.readFileSync(TEP_DA, 'utf8')); } catch { return {}; } })();
  const boQua = (cfg.boQuaUrl || []).map((m) => `\n  and coalesce(prep_payload->>'source_url','') not like '${m}'`).join('');
  const chiLay = cfg.chiUrl ? `\n  and (${cfg.chiUrl.map((m) => `coalesce(prep_payload->>'source_url','') like '${m}'`).join(' or ')})` : '';
  // Card đã nộp Review mà anh TRẢ LỜI tiếp trong luồng (không bấm Làm lại) vẫn là việc: tin cuối là của người → nhận lại (anh 15/11/2026 "tao rep tiếp qua đó thì mày có nhận ko").
  // Không viết chú thích "--" trong câu SQL: sql() gộp mọi dòng thành một, "--" nuốt hết phần sau.
  const ds = JSON.parse(sql(`select coalesce(json_agg(x order by x.created_at), '[]') from (select id, created_at, title,
  (select count(*) from jsonb_array_elements(coalesce(prep_payload->'trao_doi','[]')) t where lower(coalesce(t->>'nguoi','')) not in (${NGUOI_AI.map((x) => `'${x}'`).join(',')})) as tin_nguoi
  from human_tasks where project_id='${cfg.duAn}' and prep_payload->>'source_platform'='feedback'${boQua}${chiLay}
  and (coalesce(prep_payload->'site_status'->>'${cfg.duAn}', status) in ('pending','claimed','broken')
    or (coalesce(prep_payload->'site_status'->>'${cfg.duAn}', status) in ('review','submitted')
        and lower(coalesce(prep_payload->'trao_doi'->-1->>'nguoi','')) not in (${NGUOI_AI.map((x) => `'${x}'`).join(',')})))) x`) || '[]');
  // VIỆC GIAO THẲNG (anh 17/11/2026: "mày chỉ đc sửa và ra lệnh cho các con CLI kia" — Claude giao việc mà không ghi card thay anh vào hòm):
  // tệp ~/may-ky-su/<người>/giao/<tên>.json { tieu_de, noi_dung, trang? } — cũ nhất làm trước, THẮNG card hòm. Xong máy chuyển sang giao/xong/ kèm kết quả.
  const GIAO = path.join(HOME, 'may-ky-su', NGUOI, 'giao');
  const tepGiao = !kiem && !thu && fs.existsSync(GIAO) ? fs.readdirSync(GIAO).filter((f) => f.endsWith('.json')).sort()[0] : null;
  const viecGiao = tepGiao ? (() => { try { return JSON.parse(fs.readFileSync(path.join(GIAO, tepGiao), 'utf8')); } catch { return null; } })() : null;
  const card = viecGiao ? { id: `giao-${tepGiao.replace(/\.json$/, '')}`, title: String(viecGiao.tieu_de ?? tepGiao), tin_nguoi: 1, giao: true } : kiem ? JSON.parse(sql(`select json_build_object('id', id, 'title', title, 'tin_nguoi', 0) from human_tasks where id=${kiem}`)) : ds.find((c) => { const d = daLam[c.id]; return !d || d.tin_nguoi < c.tin_nguoi || Date.now() - Date.parse(d.luc) > 24 * 36e5; });
  // cây riêng dọn MỖI LƯỢT, kể cả khi không có card (13/11/2026: Đạt commit #1580 lúc 00:03, push bị từ chối vì main vừa đổi; bước tự đẩy commit kẹt
  // trong cayRieng chỉ chạy khi có card mới → bản sửa nằm kẹt tới card kế). cfg.cayMoiLuot: chỉ người dùng cây riêng (Hiếu làm cây chính, kiểm box3 đắt hơn).
  const cayDau = !thu && !kiem && cfg.cayMoiLuot ? cfg.cay() : null;
  // commit đã nằm trên main (máy vừa đẩy hộ) → nộp đúng card của nó sang Review
  const nopCommitDay = (c, nhan) => { for (const t of c?.day ?? []) { const id = cardTuCommit(t); if (id) try { log(`${nhan}: ${chotCard({ duAn: cfg.duAn, id, cach: 'nop', chu: `Máy đã đẩy bản sửa lên main: ${t}` })}`); } catch (e) { log(`nộp card #${id} lỗi: ${String(e.message).split('\n')[0]}`); } } };
  nopCommitDay(cayDau, 'commit kẹt đã lên main');
  if (!thu && !kiem) choDeployNop(daLam, cfg, cayDau?.dir ?? cfg.cayThu, TEN, log, () => fs.writeFileSync(TEP_DA, JSON.stringify(daLam)));
  if (!card) { log(`không có card mới (${ds.length} card mở, đã làm cả)`); process.exit(0); }

  ENV.BR_URL_NGUON = `card góp ý ${cfg.duAn} #${card.id} (trang lưu trong luồng card trên box3)`;   // luật br chống bịa URL: link trang lấy từ card là nguồn thật
  const luong = card.giao ? [{ nguoi: 'claude (chuyển lệnh anh Tuấn)', noiDung: String(viecGiao.noi_dung ?? ''), luc: viecGiao.luc ?? new Date().toISOString(), trang: viecGiao.trang, anh: [] }]
    : JSON.parse(sql(`select coalesce(prep_payload->'trao_doi','[]') from human_tasks where id=${Number(card.id)}`) || '[]');
  const cuoiNguoi = [...luong].reverse().find((t) => !laAi(t));
  const cay = thu ? { dir: cfg.cayThu, do: [] } : cayDau ?? cfg.cay();
  const dir = cay.dir;
  fs.mkdirSync(ANH, { recursive: true });
  const QUYEN = moRongQuyen([...quyenChung(dir, ANH), ...cfg.quyen(dir)], dir);

  const moiAnh = luong.flatMap((t) => (t.anh || []).map(urlAnh)).filter(Boolean);
  const tin = luong.map((t, i) => `#${i + 1} ${laAi(t) ? 'AI' : 'NGƯỜI'} · ${String(t.luc || '').slice(0, 16)}${t.trang ? `\n  trang: ${t.trang}` : ''}${t.nguCanh ? `\n  ngữ cảnh: ${t.nguCanh}` : ''}${(t.anh || []).length ? `\n  ảnh / tệp: ${t.anh.map((a) => `${urlAnh(a)}${a?.ten ? ` (${a.ten})` : ''}`).join(' ')}` : ''}\n  ${String(t.noiDung || '').slice(0, 3000)}`).join('\n');
  // ảnh nằm sau SSO (spy.on.tc/tep/…) thì Claude không curl được, scp lại bị cấm → MÁY tải sẵn về ANH trước khi giao (cfg.taiAnh, card spy #1426 12/11/2026)
  const anhMay = (() => { try { return cfg.taiAnh ? cfg.taiAnh(moiAnh, ANH) : []; } catch (e) { log(`tải ảnh lỗi: ${String(e.message).split('\n')[0]}`); return []; } })();
  const ctx = { card, luong, cuoiNguoi, tin, moiAnh, anhMay, ANH, dir, cay };
  const loiGiao = cfg.loiGiao(ctx);
  if (thu) { console.log(loiGiao); process.exit(0); }
  // PUSH BỊ TỪ CHỐI KHÔNG PHẢI VIỆC CỦA ANH (anh chửi 15/11/2026, card studio #1603: Vinh viết vào card "cần mở quyền git pull --rebase cho máy Vinh"):
  // máy tự đặt commit lên main mới và đẩy ngay khi Claude kết thúc (bước dưới), rồi nộp card. Nói rõ để Claude không hỏi, không kêu kẹt.
  const PUSH = cfg.cayMoiLuot ? `\n\nPUSH BỊ TỪ CHỐI (main trên GitHub đi trước): KHÔNG hỏi anh, KHÔNG viết vào card chuyện quyền git / kẹt push, KHÔNG thử pull / rebase. Máy tự đặt commit của bạn lên main mới, đẩy và nộp card ngay khi bạn kết thúc. Bạn cứ commit, reply nội dung đã sửa (bỏ bước submit) rồi kết KET: DA_SUA.` : '';
  // LUẬT LỆNH (17/11/2026): danh sách quyền khớp theo CHUỖI — nói rõ cách gõ để lệnh khớp, khỏi bị chặn rồi mới biết
  const LENH = `\n\nCÁCH GÕ LỆNH (chế độ không hỏi: lệnh KHÔNG khớp danh sách sẽ bị chặn, lượt của bạn sẽ hỏng): đứng ở GỐC CÂY ${dir} (thư mục hiện tại), KHÔNG cd vào thư mục con; git chạy thẳng hoặc git -C <cây> — KHÔNG \"cd … && git …\" (Claude Code chặn dạng này dù có quyền); đường dẫn ghi tương đối từ gốc cây (apps/…); mỗi lệnh một lần gọi, hạn chế nối && / | nhiều lệnh khác loại. Được chạy: ${QUYEN.filter((q) => q.startsWith('Bash(')).map((q) => q.slice(5, -1)).join(' · ')}. Lệnh bị chặn → đổi sang đúng dạng trên, KHÔNG dừng lượt vì chuyện quyền.`;
  // BỘ CHUẨN Huy / Khang (etp-sua.mjs, social-sua.mjs 10/11/2026): lệnh bị từ chối LƯỢT TRƯỚC → đưa vào lời giao lượt này để kỹ sư gõ lại đúng dạng, không hỏi anh
  const TEP_TU_CHOI = path.join(HOME, '.cache', `${NGUOI}-tu-choi.json`);
  const tuChoiCu = (() => { try { return JSON.parse(fs.readFileSync(TEP_TU_CHOI, 'utf8')); } catch { return []; } })();
  const DU = tuChoiCu.length ? `\n\nLƯỢT TRƯỚC MÁY ĐÃ TỪ CHỐI các lệnh sau vì không khớp danh sách quyền (KHÔNG phải anh chặn, KHÔNG báo anh, KHÔNG dừng lượt):\n${tuChoiCu.map((c) => `- ${c}`).join('\n')}\nGõ lại dạng khớp: đứng gốc cây, mỗi lệnh bắt đầu đúng tên lệnh được phép; git chạy thẳng (đã ở gốc cây) hoặc git -C ${dir} — KHÔNG "cd … && git …" (Claude Code chặn dạng này dù có quyền, đo 17/11/2026).` : '';
  const GIAO_THANG = card.giao ? `VIỆC GIAO THẲNG từ anh Tuấn (qua Claude), KHÔNG có card trong hòm: BỎ QUA mọi lệnh claim / reply / submit / play reply / play done của hòm góp ý — các bước làm, kiểm, commit, push, deploy, kiểm sau deploy vẫn làm ĐỦ như dưới. Kết quả viết trong phần BÁO ANH (máy chuyển cho anh).\n\n` : '';
  // VIỆC CỦA NGƯỜI KHÁC (anh 17/11/2026: "thằng Khôi cũng ko đc hỏi việc của người khác"): kỹ sư thấy chỗ hỏng ngoài phần mình → KHÔNG hỏi / kể cho anh,
  // ghi dòng CHUYỂN: <người> · <việc>; máy tự giao thẳng cho người đó (thư mục giao của họ) sau lượt.
  const CHUYEN = `\n\nVIỆC CỦA KỸ SƯ KHÁC: thấy chỗ cần sửa nằm ngoài phần được giao / ngoài quyền của bạn → KHÔNG hỏi anh, KHÔNG liệt kê cho anh trong BÁO ANH. Ghi riêng mỗi việc một dòng "CHUYỂN: <mã người> · <việc cần làm, đủ để họ làm>" (mã người: ${Object.keys(KY_SU_GIAO).join(', ')}) — máy tự giao cho đúng người.`;
  const giao = kiem ? `${loiGiao}\n\n${cfg.kiemThu(ctx)}` : `${GIAO_THANG}${loiGiao}${PUSH}${LENH}${DU}${CHUYEN}`;

  // PHIÊN mos2 60 phút cho profile br: tạo trên box3 rồi nạp cookie httpOnly thẳng vào daemon (/datcookie) — token không qua dòng lệnh br, Claude không thấy.
  // Cookie mos2-session trên .on.tc cũng là phiên SSO của các app con (spy.on.tc …).
  try {
    const tk = execFileSync('openssl', ['rand', '-hex', '32'], { encoding: 'utf8' }).trim();
    sql(`insert into auth_sessions (session_token, user_id, expires_at) values ('${tk}', (select user_id from members where role='admin' order by user_id limit 1), now() + interval '60 minutes')`);
    execFileSync(BR, ['open', HO_SO], { encoding: 'utf8', env: ENV, timeout: 90000 });
    const kq = execFileSync('curl', ['-s', '-m', '20', '-X', 'POST', 'http://127.0.0.1:39222/datcookie', '-H', 'content-type: application/json', '--data-binary', '@-'],
      { input: JSON.stringify({ profile: HO_SO, domain: '.on.tc', name: 'mos2-session', value: tk }), encoding: 'utf8' });
    if (!/"ok":true/.test(kq)) throw new Error(kq.slice(0, 200));
  } catch (e) { log(`chưa nạp được phiên br: ${String(e.message).split('\n')[0]} — Claude vẫn chạy, chỉ thiếu mắt`); }
  // effort theo việc (may/chon-muc.mjs): đề bài = tin người mới nhất; anh nhắn lại nhiều lần = làm lại
  const muc = chonMuc({ chu: `${card.title}\n${cuoiNguoi?.noiDung ?? ''}`, soAnh: moiAnh.length, lanLamLai: Math.max(0, card.tin_nguoi - 1), macDinh: effort || 'low' });
  log(`nhận card #${card.id} ${card.title} · model ${model} · effort ${muc.effort} (${muc.ly_do.join(', ')})`);
  // BẢNG NHÂN SỰ thấy ĐÚNG việc đang làm (anh 17/11/2026: "Làm sao tao biết nó đã nhận việc gì?"): đẩy dòng 'nhận việc' về nhật ký nhịp của chính người này
  if (!kiem) try { execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', BOX, `cd ${APP} && CTY_DATA_DIR=${DATA} node worker/nhip.mjs --ghi-may`],
    { input: JSON.stringify({ nguoi: NGUOI, viec: 'nhan-viec', luc: new Date().toISOString(), ket: `◆ nhận ${card.giao ? 'việc giao' : `card #${card.id}`}: ${card.title} · ${model} ${muc.effort}` }), encoding: 'utf8', timeout: 30000 }); } catch (e) { log(`chưa báo được bảng nhân sự: ${String(e.message).split('\n')[0]}`); }
  if (!kiem && !card.giao) daLam[card.id] = { tin_nguoi: card.tin_nguoi, luc: new Date().toISOString(), lanQuyen: Number(daLam[`quyen:${card.id}`] ?? 0) };   // ghi TRƯỚC khi chạy: lượt treo / chết cũng không chạy lại liền mỗi 5 phút
  fs.writeFileSync(TEP_DA, JSON.stringify(daLam));
  const r = (cfg.tmux ? (c, a, o) => chayTmux(c, a, { ...o, ten: NGUOI }) : chayClaude)(CLAUDE, ['-p', giao, '--model', model, '--effort', muc.effort, '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM],
    { cwd: dir, encoding: 'utf8', timeout: (cfg.tranPhut || 40) * 60000, maxBuffer: 64 << 20, env: ENV });
  // đẩy NGAY trong lượt này commit mà Claude không push được (trước: chờ lượt 5 phút sau, card nằm Kẹt + một tin "can_anh" thừa giữa chừng)
  if (!kiem && cfg.cayMoiLuot) nopCommitDay(cfg.cay(), 'đẩy ngay commit Claude không push được');
  let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
  // Lệnh bị chặn trong lượt → ghi nhật ký + báo nguyên văn vào card (17/11/2026: Vinh #1637 bị chặn hết mà chỉ thấy "cần anh" chung chung)
  const chan = kq.session_id ? lenhBiChan(dir, kq.session_id) : [];
  if (chan.length) { log(`⚠ ${chan.length} lệnh bị chặn: ${chan.map((c) => c.slice(0, 120)).join(' ‖ ')}`); fs.appendFileSync(path.join(os.homedir(), '.cache', 'ky-su-lenh-bi-chan.log'), chan.map((c) => `${new Date().toISOString()}\t${NGUOI}\t#${card.id}\t${c.replace(/\s+/g, ' ').slice(0, 300)}\n`).join('')); }
  const tuChoi = [...new Set([...chan, ...(kq.permission_denials || []).map((d) => String(d.tool_input?.command ?? d.tool_name ?? ''))].map((c) => c.replace(/\s+/g, ' ').slice(0, 160)).filter(Boolean))].slice(0, 8);
  if (!kiem) try { fs.writeFileSync(TEP_TU_CHOI, JSON.stringify(tuChoi)); } catch { /* ổ đầy: lượt sau không có gợi ý, vẫn chạy */ }
  if (!kiem) for (const m of String(kq.result || '').matchAll(/^\s*CHUYỂN:\s*([a-z]+)\s*·\s*(.+)$/gim)) try { log(`chuyển việc: ${giaoCho(m[1], m[2], `${TEN} (#${card.id})`)}`); } catch (e) { log(`chuyển việc lỗi: ${e.message}`); }
  const ra = String(kq.result || '').trim(), ket0 = ((ra.match(/KET:\**\s*(DA_SUA|KHONG_SUA|CAN_ANH)/gi) || []).pop() || (r.signal || r.error ? 'treo' : 'khong_sua')).replace(/.*KET:\**\s*/i, '').toLowerCase();
  // "cần anh" / không sửa mà lượt có lệnh bị máy từ chối và lời báo nói về quyền → lỗi công cụ, KHÔNG phải việc anh (bộ chuẩn Huy): ghi khong_sua, và CHẠY LẠI ngay lượt 5 phút kế
  // với gợi ý lệnh khớp (trước 17/11/2026: card bị đánh dấu "đã làm" tới khi anh nhắn tin mới → Vinh không tự làm lại #1637). Tối đa 2 lần chạy lại vì quyền / card.
  const loiQuyen = ket0 !== 'da_sua' && tuChoi.length > 0 && (ket0 === 'can_anh' ? /quyền|git|bị chặn|chặn|permission|shell|bash/i.test(ra) : true);
  const ket = loiQuyen ? 'khong_sua' : ket0;
  if (!kiem && loiQuyen) { const lan = (daLam[card.id]?.lanQuyen ?? 0) + 1; if (lan <= 2) { delete daLam[card.id]; daLam[`quyen:${card.id}`] = lan; } fs.writeFileSync(TEP_DA, JSON.stringify(daLam)); log(`#${card.id}: lượt hỏng vì ${tuChoi.length} lệnh bị từ chối → ${lan <= 2 ? `tự chạy lại lượt kế (lần ${lan}/2)` : 'đã chạy lại 2 lần, chờ tin mới'}`); }
  log(`xong #${card.id}: ${ket} · ${kq.num_turns ?? '?'} lượt · ${Math.round((kq.duration_ms || 0) / 6e4)} phút`);
  // Claude không tự trả lời được (treo, chết, bị từ chối) → máy ghi một tin vào luồng để anh thấy ngay trong card, không im lặng
  if (card.giao) {   // việc giao thẳng: không có luồng card — lưu kết quả cạnh tệp việc, chuyển sang giao/xong/
    const xong = path.join(GIAO, 'xong'); fs.mkdirSync(xong, { recursive: true });
    fs.writeFileSync(path.join(xong, tepGiao), JSON.stringify({ ...viecGiao, ket, xong_luc: new Date().toISOString(), bao: (ra.split(/BÁO ANH:?/i).pop() || ra).trim().slice(0, 3000), lenh_bi_chan: chan.slice(0, 10) }, null, 1));
    if (!(loiQuyen && (daLam[`quyen:${card.id}`] ?? 0) <= 2)) fs.rmSync(path.join(GIAO, tepGiao), { force: true });
    else daLam[`quyen:${card.id}`] = (daLam[`quyen:${card.id}`] ?? 0) + 1, fs.writeFileSync(TEP_DA, JSON.stringify(daLam));
    log(`việc giao ${tepGiao}: ${ket} — kết quả ở ${path.join(xong, tepGiao)}`);
    try { execFileSync(BR, ['close', HO_SO], { encoding: 'utf8', env: ENV, timeout: 30000 }); } catch { /* chưa mở */ }
    return;
  }
  const moi = JSON.parse(sql(`select coalesce(prep_payload->'trao_doi','[]') from human_tasks where id=${Number(card.id)}`) || '[]');
  if (kiem) console.log(ra, '\n· từ chối:', JSON.stringify((kq.permission_denials || []).map((d) => d.tool_input?.command ?? d.tool_name)));
  else if (moi.length === luong.length) {
    const bao = (ra.split(/BÁO ANH:?/i).pop() || '').replace(/^\s*\**KET:.*$/gim, '').trim().slice(0, 1500) || `${TEN} chạy hỏng (${ket}, thoát ${r.status ?? r.signal}) — lượt sau có tin mới của anh thì làm lại.`;
    const baoChan = chan.length ? `\nLệnh bị chặn (máy ghi ~/.cache/ky-su-lenh-bi-chan.log, sửa danh sách quyền ở apps/cty/may): ${chan.slice(0, 5).map((c) => c.replace(/\s+/g, ' ').slice(0, 160)).join(' ‖ ')}` : '';
    try { cfg.traLoi(card.id, `[${TEN} · ${ket}] ${bao}${baoChan}`, ENV); } catch (e) { log(`ghi tin lỗi: ${String(e.message).split('\n')[0]}`); }
  }
  // card còn "Đang làm" khi lượt dừng = chết im (anh 14/11/2026) → mục Kẹt kèm lý do; Claude đã nộp / trả lời thì chotCard để yên
  // ĐÃ SỬA mà chưa nộp (thường vì deploy toàn monorepo đang đỏ do người khác): KHÔNG đẩy về anh — máy chờ deploy xanh rồi tự nộp (anh 17/11/2026:
  // "việc của chúng nó thì gọi tao làm cái đéo gì"). Quá 6 giờ vẫn chưa xanh mới đặt Kẹt.
  if (!kiem && !card.giao && ket === 'da_sua' && !loiQuyen) { daLam[`deploy:${card.id}`] = { luc: new Date().toISOString() }; fs.writeFileSync(TEP_DA, JSON.stringify(daLam)); log(`#${card.id}: đã sửa, chờ deploy xanh để máy tự nộp Review`); }
  else if (!kiem) try { log(`card ${chotCard({ duAn: cfg.duAn, id: card.id, cach: 'ket', chu: loiQuyen ? `[${TEN} · ${ket}] Lượt vướng ${tuChoi.length} lệnh bị máy từ chối (không phải việc anh) — máy tự chạy lại lượt kế với dạng lệnh khớp quyền.` : `[${TEN} · ${ket}] Lượt dừng mà card chưa nộp Review — con để ở mục Kẹt: lỗi / cần anh, hoặc commit chưa lên main (máy tự đẩy ở lượt sau rồi nộp).` }).replace(/^#\d+ /, '')}`); } catch (e) { log(`chốt card lỗi: ${String(e.message).split('\n')[0]}`); }
  try { execFileSync(BR, ['close', HO_SO], { encoding: 'utf8', env: ENV, timeout: 30000 }); } catch { /* chưa mở được thì thôi */ }   // xong là dọn: đóng ĐÍCH DANH profile của kỹ sư
}

if (process.argv[1]?.endsWith('gop-y-ky-su.mjs') && process.argv.includes('--tu-kiem')) {
  const t = (await import('node:assert/strict')).default;
  t.ok(laAi({ nguoi: 'ai' }) && laAi({ nguoi: 'claude' }) && laAi({ nguoi: 'Claude' }), 'cả hai cách ghi lời AI');
  t.ok(!laAi({ nguoi: 'admin@earns.local' }) && !laAi({ nguoi: 'Hoàng Tuấn' }) && !laAi({}), 'người thật không phải AI');
  console.log('gop-y-ky-su: tự kiểm đạt');
}
