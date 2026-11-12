// KHUNG CHUNG CHO KỸ SƯ HÒM GÓP Ý (tách từ mos2-gop-y.mjs của Đạt, anh 12/11/2026 "Thêm 1 con CLI cho spy tasks"): mỗi hòm góp ý của một app = MỘT tệp cấu hình
// gọi chayKySu(cfg). Đạt = may/mos2-gop-y.mjs (mos2.on.tc), Hiếu = may/spy-gop-y.mjs (spy.on.tc). Phần chung ở đây: chọn card, chống lặp, effort theo việc,
// phiên br đăng nhập, chạy Claude Code KHÔNG GIAO DIỆN, đọc kết quả, ghi tin khi hỏng, đóng br. Phần riêng (cây repo, quyền, lời giao, cách trả lời card) nằm ở cấu hình.
import { execFileSync, spawnSync } from 'node:child_process';
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
  `Bash(curl -s -o ${ANH}/:*)`, 'Bash(curl -s:*)', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git commit:*)', 'Bash(node --check:*)',
  'Bash(grep:*)', 'Bash(tail:*)', 'Bash(head:*)', 'Bash(cat:*)', 'Bash(ls:*)', 'Bash(sed -n:*)', 'Bash(wc:*)', 'Bash(awk:*)', 'Bash(sort:*)', 'Bash(uniq:*)', 'Bash(diff:*)',
  `Bash(${BR} goto:*)`, `Bash(${BR} look:*)`, `Bash(${BR} read:*)`, `Bash(${BR} scroll:*)`, `Bash(${BR} wait:*)`];
const CAM = [...['git reset', 'git revert', 'git checkout', 'git restore', 'git clean', 'git stash', 'git rebase', 'git push --force', 'git push -f', 'git branch -D', 'git tag -d',
  'rm', 'rmdir', 'rsync', 'scp', 'open', 'npm install', 'npm i', 'npx', 'brew', 'pip', 'launchctl', 'crontab', 'sudo', 'kill', 'pkill'].map((c) => `Bash(${c}:*)`),
  'AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];
// Lời AI trong luồng card ghi nguoi = 'ai' (play reply) HOẶC 'claude' (gop-y.sh reply). Chỉ so 'ai' thì lời 'claude' bị đếm là tin NGƯỜI:
// kỹ sư lấy câu trả lời cũ làm đề bài, và mỗi lần chính nó trả lời qua gop-y.sh lại thành "tin mới" → tự mở lại card mỗi 5 phút (12/11/2026, card spy #1293).
export const NGUOI_AI = ['ai', 'claude'];
export const laAi = (t) => NGUOI_AI.includes(String(t?.nguoi ?? '').toLowerCase());
const urlAnh = (a) => (typeof a === 'string' ? a : a?.url) || '';   // ảnh lưu dạng chuỗi (cũ) hoặc {ten, url} (trao-doi-card)

/** cfg: { nguoi, ten, duAn (project_id + khoá site_status), boQuaUrl?: [mẫu LIKE], tranPhut, cay: () => { dir, do }, cayThu: dir,
 *  quyen: (dir) => [], loiGiao: (ctx) => string, kiemThu: (ctx) => string, traLoi: (id, chu) => void } — ctx: { card, luong, cuoiNguoi, tin, moiAnh, ANH, dir, cay } */
export function chayKySu(cfg) {
  const { nguoi: NGUOI, ten: TEN } = cfg;
  if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`${TEN} chỉ chạy trên iMac (máy này: ${os.hostname()}) — Claude không giao diện bằng gói thuê bao chỉ iMac`); process.exit(3); }
  const thu = process.argv.includes('--thu'), kiem = Number(process.argv[process.argv.indexOf('--kiem') + 1]) || 0;
  const ANH = path.join(HOME, '.cache', `${NGUOI}-anh`), TEP_DA = path.join(HOME, '.cache', `${NGUOI}-da-lam.json`);
  // PROFILE br RIÊNG của từng kỹ sư (anh 12/11/2026 "phải cho nó mở và đọc br"): mọi lệnh br của Claude đi thẳng profile này qua BR_PROFILE
  const HO_SO = path.join(HOME, 'may-ky-su', NGUOI, 'br-profile');
  const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`, BR_PROFILE: HO_SO };

  const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -E '^model:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md || true`).split('@@');
  if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log(`${TEN} đang tắt`); process.exit(0); }
  const dm = (soul.match(/^model:.*$/m) || [''])[0], model = (dm.match(/claude-code:([\w.-]+)/) || [])[1] || 'opus', effort = (dm.match(/effort:(low|medium|high|max)\b/) || [])[1] || null;

  // CHỐNG VÒNG LẶP (cùng luật hàng thợ máy, anh 11/11/2026 "phải biết giới hạn đúng lúc, đúng chỗ"): card đã chạy mà luồng chưa có tin NGƯỜI mới → không làm lại trong 24 giờ.
  // Anh trả lời / bấm làm lại = có tin mới → nhận lại ngay.
  const daLam = (() => { try { return JSON.parse(fs.readFileSync(TEP_DA, 'utf8')); } catch { return {}; } })();
  const boQua = (cfg.boQuaUrl || []).map((m) => `\n  and coalesce(prep_payload->>'source_url','') not like '${m}'`).join('');
  const ds = JSON.parse(sql(`select coalesce(json_agg(x order by x.created_at), '[]') from (select id, created_at, title,
  (select count(*) from jsonb_array_elements(coalesce(prep_payload->'trao_doi','[]')) t where lower(coalesce(t->>'nguoi','')) not in (${NGUOI_AI.map((x) => `'${x}'`).join(',')})) as tin_nguoi
  from human_tasks where project_id='${cfg.duAn}' and prep_payload->>'source_platform'='feedback'${boQua}
  and coalesce(prep_payload->'site_status'->>'${cfg.duAn}', status) in ('pending','claimed','broken')) x`) || '[]');
  const card = kiem ? JSON.parse(sql(`select json_build_object('id', id, 'title', title, 'tin_nguoi', 0) from human_tasks where id=${kiem}`)) : ds.find((c) => { const d = daLam[c.id]; return !d || d.tin_nguoi < c.tin_nguoi || Date.now() - Date.parse(d.luc) > 24 * 36e5; });
  if (!card) { log(`không có card mới (${ds.length} card mở, đã làm cả)`); process.exit(0); }

  ENV.BR_URL_NGUON = `card góp ý ${cfg.duAn} #${card.id} (trang lưu trong luồng card trên box3)`;   // luật br chống bịa URL: link trang lấy từ card là nguồn thật
  const luong = JSON.parse(sql(`select coalesce(prep_payload->'trao_doi','[]') from human_tasks where id=${Number(card.id)}`) || '[]');
  const cuoiNguoi = [...luong].reverse().find((t) => !laAi(t));
  const cay = thu ? { dir: cfg.cayThu, do: [] } : cfg.cay();
  const dir = cay.dir;
  fs.mkdirSync(ANH, { recursive: true });
  const QUYEN = [...quyenChung(dir, ANH), ...cfg.quyen(dir)];

  const moiAnh = luong.flatMap((t) => (t.anh || []).map(urlAnh)).filter(Boolean);
  const tin = luong.map((t, i) => `#${i + 1} ${laAi(t) ? 'AI' : 'NGƯỜI'} · ${String(t.luc || '').slice(0, 16)}${t.trang ? `\n  trang: ${t.trang}` : ''}${t.nguCanh ? `\n  ngữ cảnh: ${t.nguCanh}` : ''}${(t.anh || []).length ? `\n  ảnh / tệp: ${t.anh.map((a) => `${urlAnh(a)}${a?.ten ? ` (${a.ten})` : ''}`).join(' ')}` : ''}\n  ${String(t.noiDung || '').slice(0, 3000)}`).join('\n');
  // ảnh nằm sau SSO (spy.on.tc/tep/…) thì Claude không curl được, scp lại bị cấm → MÁY tải sẵn về ANH trước khi giao (cfg.taiAnh, card spy #1426 12/11/2026)
  const anhMay = (() => { try { return cfg.taiAnh ? cfg.taiAnh(moiAnh, ANH) : []; } catch (e) { log(`tải ảnh lỗi: ${String(e.message).split('\n')[0]}`); return []; } })();
  const ctx = { card, luong, cuoiNguoi, tin, moiAnh, anhMay, ANH, dir, cay };
  const loiGiao = cfg.loiGiao(ctx);
  if (thu) { console.log(loiGiao); process.exit(0); }
  const giao = kiem ? `${loiGiao}\n\n${cfg.kiemThu(ctx)}` : loiGiao;

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
  if (!kiem) daLam[card.id] = { tin_nguoi: card.tin_nguoi, luc: new Date().toISOString() };   // ghi TRƯỚC khi chạy: lượt treo / chết cũng không chạy lại liền mỗi 5 phút
  fs.writeFileSync(TEP_DA, JSON.stringify(daLam));
  const r = spawnSync(CLAUDE, ['-p', giao, '--model', model, '--effort', muc.effort, '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...QUYEN, '--disallowedTools', ...CAM],
    { cwd: dir, encoding: 'utf8', timeout: (cfg.tranPhut || 40) * 60000, maxBuffer: 64 << 20, env: ENV });
  let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
  const ra = String(kq.result || '').trim(), ket = ((ra.match(/KET:\**\s*(DA_SUA|KHONG_SUA|CAN_ANH)/gi) || []).pop() || (r.signal || r.error ? 'treo' : 'khong_sua')).replace(/.*KET:\**\s*/i, '').toLowerCase();
  log(`xong #${card.id}: ${ket} · ${kq.num_turns ?? '?'} lượt · ${Math.round((kq.duration_ms || 0) / 6e4)} phút`);
  // Claude không tự trả lời được (treo, chết, bị từ chối) → máy ghi một tin vào luồng để anh thấy ngay trong card, không im lặng
  const moi = JSON.parse(sql(`select coalesce(prep_payload->'trao_doi','[]') from human_tasks where id=${Number(card.id)}`) || '[]');
  if (kiem) console.log(ra, '\n· từ chối:', JSON.stringify((kq.permission_denials || []).map((d) => d.tool_input?.command ?? d.tool_name)));
  else if (moi.length === luong.length) {
    const bao = (ra.split(/BÁO ANH:?/i).pop() || '').replace(/^\s*\**KET:.*$/gim, '').trim().slice(0, 1500) || `${TEN} chạy hỏng (${ket}, thoát ${r.status ?? r.signal}) — lượt sau có tin mới của anh thì làm lại.`;
    try { cfg.traLoi(card.id, `[${TEN} · ${ket}] ${bao}`, ENV); } catch (e) { log(`ghi tin lỗi: ${String(e.message).split('\n')[0]}`); }
  }
  try { execFileSync(BR, ['close', HO_SO], { encoding: 'utf8', env: ENV, timeout: 30000 }); } catch { /* chưa mở được thì thôi */ }   // xong là dọn: đóng ĐÍCH DANH profile của kỹ sư
}

if (process.argv[1]?.endsWith('gop-y-ky-su.mjs') && process.argv.includes('--tu-kiem')) {
  const t = (await import('node:assert/strict')).default;
  t.ok(laAi({ nguoi: 'ai' }) && laAi({ nguoi: 'claude' }) && laAi({ nguoi: 'Claude' }), 'cả hai cách ghi lời AI');
  t.ok(!laAi({ nguoi: 'admin@earns.local' }) && !laAi({ nguoi: 'Hoàng Tuấn' }) && !laAi({}), 'người thật không phải AI');
  console.log('gop-y-ky-su: tự kiểm đạt');
}
