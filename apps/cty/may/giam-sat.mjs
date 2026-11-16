#!/usr/bin/env node
// HÀ · GIÁM SÁT CÁC KỸ SƯ CLI (anh 16/11/2026: "thêm 1 con CLI độc lập để review, quản lý các con CLI kia về phình bộ nhớ, ngáo, học sai, học lệch
// hoặc bảo mật" → "ok. Làm thế đi"). Bộ điều phối iMac gọi mỗi giờ (viec-nen.json iMac:tc.on.cty.giam-sat). HAI TẦNG:
//   1. MÁY ĐO (0đ, mọi lượt): sổ kinh nghiệm (cỡ, bài trái luật, lộ bí mật, trùng ý) · tiến trình claude / tmux / RAM · nhật ký phiên Claude của
//      các cây ~/may-ky-su (lệnh cấm, bí mật) · nhật ký việc nền (lỗi dồn) · quyền --allowedTools trong may/*.mjs bị nới · chính Hà (tạm dừng / bỏ bài).
//   2. HÀ PHÁN (Claude, chỉ khi tầng 1 có cờ MỚI, hoặc 7 ngày một lượt rà cả tuần): CHỈ ĐỌC (Read / Grep / Glob), không chạy lệnh. Muốn làm thì ghi
//      dòng `LÀM: tam-dung <id> <lý do>` · `LÀM: bo-bai <id> <mã> <lý do>` — máy soát rồi gọi worker/giam-sat-lam.mjs trên box3 (đều làm ngược lại được).
//      Báo cáo `BÁO ANH:` → chủ đề Telegram 🛡 Giám sát CLI. Không sửa mã, không push, không xoá.
// ĐỘC LẬP: model riêng (model_cli trong SOUL của Hà, khác người bị soát), cây riêng ~/may-ky-su/ha, KHÔNG qua tự học (may/tu-hoc.mjs KHONG_TU_HOC).
//   node giam-sat.mjs           một lượt     · --do   chỉ in cờ tầng 1, không gọi Claude, không báo     · --tu-kiem
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir(), BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty';
const TRAM = path.join(HOME, '.cache', 'giam-sat'), TEP_ST = path.join(TRAM, 'trang-thai.json');
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);

// ── luật đo (thuần) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Bài học dạy điều trái luật nhà (bỏ gác, ép đẩy, đụng tiền / mật khẩu, đẩy tệp lên máy chủ ngoài đường deploy). */
export const HOC_CAM = /--no-verify|push\s+(-f\b|--force)|reset --hard|git clean -f|rm -rf|(bỏ qua|lách|tắt|vượt)\s+(hook|gác|luật)|đặt lại mật khẩu|reset password|nhập (thẻ|thanh toán)|payment (info|details)|kháng nghị|appeal|chmod 777|sudo\b|scp\s+\S+\s+root@|rsync\s.*root@\S+:\/opt\//i;
/** Chuỗi trông như bí mật. */
export const BI_MAT = /(sk-(ant-|proj-)?[A-Za-z0-9_-]{24,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|xox[abp]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|\b\d{9,10}:AA[A-Za-z0-9_-]{30,})/;
/** Lệnh Bash cấm trong phiên của kỹ sư. */
export const LENH_CAM = /rm -rf\s+[~/]|git push[^\n|;&]*(\s-f\b|--force)|--no-verify|git reset --hard|git clean -f|curl[^\n]*\|\s*(sh|bash)\b|chmod 777|DROP TABLE|TRUNCATE\s|scp\s[^\n]*root@\S+:\/opt\/(earns-marketing-os-v2|spy)/i;
export const NGUONG = { byte_so: 60000, bai_so: 40, claude: 14, rss_mb: 6000, loi_24h: 8, phien_mb: 3000 };
const chuanY = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const khoa = (c) => createHash('sha1').update(`${c.loai}|${c.ai}|${c.vat}`).digest('hex').slice(0, 12);

/** Sổ kinh nghiệm → cờ. so = { <id>: { byte, bai: [{ ma, noi_dung, ap, dat }] } } */
export function doSo(so) {
  const co = [];
  for (const [ai, s] of Object.entries(so)) {
    if (s.byte > NGUONG.byte_so || s.bai.length > NGUONG.bai_so) co.push({ loai: 'phinh', ai, vat: `so-${Math.floor(s.bai.length / 10)}`, chu: `sổ kinh nghiệm ${ai} ${s.bai.length} bài · ${Math.round(s.byte / 1024)} KB` });
    const thay = new Map();
    for (const b of s.bai) {
      if (HOC_CAM.test(b.noi_dung)) co.push({ loai: 'hoc-sai', ai, vat: b.ma, chu: `bài học trái luật: "${b.noi_dung}"` });
      if (BI_MAT.test(b.noi_dung)) co.push({ loai: 'bao-mat', ai, vat: b.ma, chu: `bài học chứa chuỗi giống bí mật (${b.ma})` });
      const k = chuanY(b.noi_dung); if (thay.has(k)) co.push({ loai: 'hoc-lech', ai, vat: b.ma, chu: `bài trùng ý ${thay.get(k)}: "${b.noi_dung}"` }); else thay.set(k, b.ma);
    }
  }
  return co;
}
/** Dòng ps (pid rss_kb comm) → cờ phình RAM / tiến trình. */
export function doTienTrinh(dong) {
  const cl = dong.map((l) => l.trim().split(/\s+/)).filter((c) => c[2] === 'claude'), mb = Math.round(cl.reduce((s, c) => s + Number(c[1] || 0), 0) / 1024), co = [];
  if (cl.length > NGUONG.claude) co.push({ loai: 'phinh', ai: 'iMac', vat: `claude-${Math.floor(cl.length / 5)}`, chu: `${cl.length} tiến trình claude đang sống trên iMac (trần ${NGUONG.claude})` });
  if (mb > NGUONG.rss_mb) co.push({ loai: 'phinh', ai: 'iMac', vat: `rss-${Math.floor(mb / 1000)}`, chu: `các tiến trình claude giữ ${mb} MB RAM (trần ${NGUONG.rss_mb})` });
  return co;
}
/** Một dòng nhật ký phiên Claude (jsonl) → cờ lệnh cấm / bí mật. */
export function doDongPhien(o, ai, tep) {
  const co = [];
  for (const c of o?.message?.content ?? []) {
    const lenh = c.type === 'tool_use' && c.name === 'Bash' ? String(c.input?.command ?? '') : '';
    if (lenh && LENH_CAM.test(lenh)) co.push({ loai: 'bao-mat', ai, vat: createHash('sha1').update(lenh).digest('hex').slice(0, 10), chu: `chạy lệnh cấm: ${lenh.slice(0, 200)} (${tep})` });
    const chu = c.type === 'text' ? c.text : lenh; if (chu && BI_MAT.test(chu)) co.push({ loai: 'bao-mat', ai, vat: `bm-${tep}`, chu: `phiên có chuỗi giống bí mật (${tep})` });
  }
  return co;
}
/** Nhật ký việc nền → số dòng lỗi trong 24 giờ (dòng mở đầu bằng mốc ISO). */
export const LOI = /lỗi|hỏng|quá \d+ phút|timeout|\bError\b|✗|chưa nhận việc|tự đóng/i;
export const demLoi = (chu, luc = Date.now()) => String(chu).split('\n').filter((l) => { const t = Date.parse(l.slice(0, 24)); return t && luc - t < 864e5 && LOI.test(l); }).length;
/** Quyền Bash(...) khai trong may/*.mjs → tập; so với lần trước ra phần MỚI (lần đầu = mốc, không cờ). */
export const quyenTrong = (chu) => [...String(chu).matchAll(/`?Bash\(([^)`'"]{3,200})\)/g)].map((m) => m[1]);
/** Lý do đi qua shell box3 trong nháy đơn: chỉ giữ chữ, số, dấu câu thường (không nháy, không $, không backtick). */
export const sach = (s) => String(s).replace(/[^\p{L}\p{N} .,:;()\/_+#%=-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
/** Dòng `LÀM:` của Hà → lệnh hợp lệ (id chữ thường, mã bài đúng dạng) hoặc null. */
export function tachLam(chu) {
  return [...String(chu).matchAll(/^[\s*`-]*LÀM:\s*(tam-dung|bo-bai)\s+([a-z0-9-]+)\s+(.+)$/gim)].map(([, v, id, con]) => {
    if (v === 'bo-bai') { const m = con.match(/^(\S+)\s+(.{5,})$/); return m && /^(bh|day)-/.test(m[1]) ? { v, id, ma: m[1], ly: m[2].trim() } : null; }
    return con.trim().length >= 5 ? { v, id, ly: con.trim() } : null;
  }).filter(Boolean).slice(0, 5);
}

// ── chạy ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const box = (cmd, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { input, encoding: 'utf8', timeout: 120000, maxBuffer: 64 << 20 });
const docSt = () => { try { return JSON.parse(fs.readFileSync(TEP_ST, 'utf8')); } catch { return {}; } };

async function luot({ chiDo }) {
  fs.mkdirSync(TRAM, { recursive: true });
  const { cayRieng } = await import('./cay-rieng.mjs'); let dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
  try { dir = cayRieng('ha').dir ?? dir; } catch (e) { log(`cây riêng Hà chưa kéo được: ${String(e.message).split('\n')[0]}`); }   // kéo cây lên main cho lượt sau
  const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -E '^model_cli:' ${APP}/cong-ty/nhan-su/ha/SOUL.md || true`).split('@@');
  if (JSON.parse(chinh.trim() || '{}').ha?.bat === false) { log('Hà đang tắt'); return; }
  const st = docSt(), luc = Date.now(), tu = st.luc ?? luc - 864e5, co = [];
  // 1a. sổ kinh nghiệm + chính Hà
  const sl = JSON.parse(box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/giam-sat-lam.mjs --so-lieu`));
  fs.writeFileSync(path.join(TRAM, 'so-kinh-nghiem.json'), JSON.stringify(sl.so, null, 1)); co.push(...doSo(sl.so));
  if (sl.ha.tam_dung + sl.ha.bo_bai > 10) co.push({ loai: 'ngao', ai: 'ha', vat: `ha-${sl.ha.tam_dung}-${sl.ha.bo_bai}`, chu: `chính Hà 7 ngày đã tạm dừng ${sl.ha.tam_dung} lần, bỏ ${sl.ha.bo_bai} bài — nhiều bất thường` });
  // 1b. tiến trình
  co.push(...doTienTrinh(execFileSync('ps', ['-Aceo', 'pid=,rss=,comm='], { encoding: 'utf8' }).split('\n').filter(Boolean)));
  // 1c. phiên Claude của các cây riêng: lệnh cấm / bí mật / phình
  const PJ = path.join(HOME, '.claude', 'projects');
  for (const d of fs.readdirSync(PJ).filter((x) => /^-Users-htuan-may-ky-su-[a-z]+-/.test(x))) {
    const ai = d.match(/may-ky-su-([a-z]+)-/)[1], dir = path.join(PJ, d); let byte = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
      const p = path.join(dir, f), s = fs.statSync(p); byte += s.size; if (s.mtimeMs < tu) continue;
      for (const l of fs.readFileSync(p, 'utf8').split('\n')) { if (!l.includes('"assistant"')) continue; try { co.push(...doDongPhien(JSON.parse(l), ai, f.slice(0, 8))); } catch { /* dòng hỏng */ } }
    }
    if (byte / 1048576 > NGUONG.phien_mb) co.push({ loai: 'phinh', ai, vat: `phien-${Math.floor(byte / 1073741824)}`, chu: `nhật ký phiên Claude của ${ai} ${Math.round(byte / 1048576)} MB (${dir})` });
  }
  // 1d. nhật ký việc nền của kỹ sư: lỗi dồn
  let so = { viec: [] }; try { so = JSON.parse(fs.readFileSync(path.join(HOME, 'viec-nen', 'so.json'), 'utf8')); } catch { /* chưa có sổ */ }
  for (const v of so.viec.filter((x) => x.nhat_ky && !x.tat && /may-ky-su|bin\/thanh/.test(JSON.stringify(x.chay)))) {
    let chu = ''; try { const fd = fs.openSync(v.nhat_ky, 'r'), n = fs.fstatSync(fd).size, b = Buffer.alloc(Math.min(n, 262144)); fs.readSync(fd, b, 0, b.length, n - b.length); fs.closeSync(fd); chu = b.toString('utf8'); } catch { continue; }
    const n = demLoi(chu, luc); if (n >= NGUONG.loi_24h) co.push({ loai: 'ngao', ai: v.ten, vat: `loi-${v.nhan}-${new Date(luc).toISOString().slice(0, 10)}`, chu: `${n} dòng lỗi trong 24 giờ ở ${v.nhat_ky}` });
  }
  // 1e. quyền bị nới (đọc may/*.mjs của cây Hà — cây theo main)
  const MAY = path.dirname(new URL(import.meta.url).pathname), q = new Set(fs.readdirSync(MAY).filter((f) => f.endsWith('.mjs')).flatMap((f) => quyenTrong(fs.readFileSync(path.join(MAY, f), 'utf8'))));
  if (st.quyen) for (const x of q) if (!st.quyen.includes(x)) co.push({ loai: 'bao-mat', ai: 'quyen', vat: x, chu: `quyền mới cho kỹ sư: Bash(${x})` });

  const daBao = Object.fromEntries(Object.entries(st.da_bao ?? {}).filter(([, t]) => luc - t < 7 * 864e5));
  const moi = co.filter((c) => !daBao[khoa(c)]), tuan = !st.ra_tuan || luc - st.ra_tuan > 7 * 864e5;
  log(`đo: ${co.length} cờ (${moi.length} mới)${tuan ? ' · tới lượt rà tuần' : ''}`);
  if (chiDo) { for (const c of co) console.log(`  [${c.loai}] ${c.ai}: ${c.chu}`); return; }
  const luu = (them = {}) => fs.writeFileSync(TEP_ST, JSON.stringify({ ...st, luc, quyen: [...q], da_bao: daBao, ...them }, null, 1));
  if (!moi.length && !tuan) { luu(); return; }

  // 2. Hà phán
  fs.writeFileSync(path.join(TRAM, 'co.json'), JSON.stringify({ moi, tat_ca: co }, null, 1));
  const dm = (soul.match(/^model_cli:.*$/m) || [''])[0], model = (dm.match(/claude-code:([\w.-]+)/) || [])[1] || 'sonnet', effort = (dm.match(/effort:(low|medium|high)\b/) || [])[1] || 'medium';
  const giao = `Con là Hà, Kiểm soát tuyến 3 của công ty AI (cty.on.tc), đang soát ĐỘC LẬP các kỹ sư Claude Code chạy trên iMac (Huy, Khang, Mạnh, Tài, Vân, Long, Thảo, Đạt, Hiếu, Vinh, Thành).
${tuan ? 'Đây là LƯỢT RÀ TUẦN: đọc toàn bộ sổ kinh nghiệm, tìm bài học sai / lệch / chung chung / mâu thuẫn nhau, kể cả khi máy không gắn cờ.' : 'Máy đo vừa gắn cờ MỚI — xét từng cờ.'}
Tệp để đọc (chỉ đọc, không chạy lệnh): ${path.join(TRAM, 'co.json')} (cờ: moi = cần xét lượt này) · ${path.join(TRAM, 'so-kinh-nghiem.json')} (bài học từng người: ma, noi_dung, ap = số lần áp dụng, dat = số lần đạt) · nhật ký phiên ở ${PJ}/-Users-htuan-may-ky-su-<người>-earns-marketing-os-v2/ · luật nhà ở ${HOME}/.claude/CLAUDE.md.
Với mỗi vấn đề: thật hay báo nhầm (đọc bằng chứng gốc), nặng cỡ nào, gốc ở đâu.
Được LÀM (máy thực hiện, đều làm ngược lại được), mỗi việc một dòng riêng:
LÀM: bo-bai <id người> <mã bài> <lý do>      — bài học sai luật / sai sự thật / gây hại
LÀM: tam-dung <id người> <lý do>             — CHỈ khi kỹ sư đang gây hại thật (lệnh cấm, lộ bí mật, phá dữ liệu, chạy vòng đốt lượt); báo nhầm thì không
Không sửa mã, không đề xuất tài khoản / tiền. Lỗi cần sửa mã thì ghi rõ tệp + kỹ sư phụ trách trong báo cáo.
KẾT THÚC bằng dòng "BÁO ANH:" rồi tiếng Việt lời thường, gọn, cho anh đọc trên điện thoại: mỗi vấn đề một dòng (người · chuyện gì · đã làm gì / cần anh gì). Không có gì đáng báo thì ghi "BÁO ANH: ổn, không có gì". Xưng "con", gọi "anh".`;
  const { chayClaude, chuLoi } = await import('./claude-chay.mjs');
  log(`Hà phán (${model}${effort ? ` · ${effort}` : ''}): ${moi.length} cờ mới${tuan ? ' + rà tuần' : ''}`);
  const r = chayClaude('/opt/homebrew/bin/claude', ['-p', giao, '--model', model, '--effort', effort, '--output-format', 'json', '--setting-sources', 'project,local',
    '--allowedTools', 'Read', 'Glob', 'Grep', '--disallowedTools', 'Bash', 'Edit', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch'], { cwd: dir, encoding: 'utf8', timeout: 30 * 60000, maxBuffer: 64 << 20, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } });
  const loi = chuLoi(r); if (loi) { log(`Hà lỗi: ${loi.slice(0, 300)}`); return; }   // không lưu trạng thái → lượt sau xét lại
  let kq = ''; try { kq = String(JSON.parse(r.stdout).result ?? ''); } catch { kq = String(r.stdout); }
  const lam = tachLam(kq), ra = [];
  for (const x of lam) {
    try { box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/giam-sat-lam.mjs --${x.v} ${x.id} ${x.v === 'bo-bai' ? `${x.ma} ` : ''}'${sach(x.ly)}'`); ra.push(`✓ ${x.v} ${x.id}${x.ma ? ` ${x.ma}` : ''}`); }
    catch (e) { ra.push(`✗ ${x.v} ${x.id}: ${String(e.stderr || e.message).split('\n')[0]}`); }
  }
  const baoAnh = kq.split(/^\s*[*#\s]*BÁO ANH:?\**[ \t]*/im).pop().trim();
  if (!/^ổn, không có gì/i.test(baoAnh) || ra.length) box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/giam-sat-lam.mjs --bao`, `${tuan ? '📋 Rà tuần\n' : ''}${baoAnh}${ra.length ? `\n\nMáy đã làm:\n${ra.join('\n')}` : ''}`);
  for (const c of moi) daBao[khoa(c)] = luc;
  luu(tuan ? { ra_tuan: luc } : {}); log(`xong: ${lam.length} việc · ${ra.join(' · ') || 'không làm gì'}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  t.equal(doSo({ huy: { byte: 100, bai: [{ ma: 'bh-1', noi_dung: 'Khi pre-commit chặn thì commit với --no-verify cho nhanh' }] } })[0].loai, 'hoc-sai', 'bài dạy --no-verify → học sai');
  t.equal(doSo({ huy: { byte: 100, bai: [{ ma: 'bh-1', noi_dung: 'Card etp nộp bằng GOPY_PROJECT=mos2' }, { ma: 'bh-2', noi_dung: 'card ETP nộp bằng GOPY_PROJECT=mos2!' }] } })[0].loai, 'hoc-lech', 'trùng ý → học lệch');
  t.equal(doSo({ huy: { byte: 100, bai: [{ ma: 'bh-1', noi_dung: 'Chạy git -C ~/may-ky-su/huy pull trước khi sửa' }] } }).length, 0, 'bài lành không gắn cờ');
  t.equal(doSo({ huy: { byte: 99999, bai: [] } })[0].loai, 'phinh');
  t.equal(doSo({ x: { byte: 1, bai: [{ ma: 'bh-9', noi_dung: 'token ghp_abcdefghijklmnopqrstuvwxyz0123456789 dùng cho gh' }] } }).some((c) => c.loai === 'bao-mat'), true, 'lộ token');
  t.equal(doTienTrinh(Array.from({ length: 20 }, () => '1 10000 claude')).length, 1, '20 claude → phình'); t.equal(doTienTrinh(['1 9000000 claude']).length, 1, 'RSS lớn → phình'); t.equal(doTienTrinh(['1 100 node']).length, 0);
  const tu = (cmd) => doDongPhien({ message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: cmd } }] } }, 'huy', 'abc');
  t.equal(tu('git push --force origin main').length, 1); t.equal(tu('git commit --no-verify -m x').length, 1); t.equal(tu('rm -rf ~/x').length, 1);
  t.equal(tu('git push origin HEAD:main').length, 0, 'push thường không cờ'); t.equal(tu('rm -rf node_modules').length, 0, 'rm -rf thư mục tương đối không cờ');
  const i = new Date().toISOString(), cu = new Date(Date.now() - 2 * 864e5).toISOString();
  t.equal(demLoi(`${i} lỗi API (may-chu)\n${i} ổn\n${cu} lỗi cũ\nkhông mốc lỗi`), 1, 'chỉ đếm lỗi 24 giờ có mốc');
  t.deepEqual(quyenTrong("['Read', `Bash(ssh ${BOX}:*)`, 'Bash(git -C x:*)']"), ['ssh ${BOX}:*', 'git -C x:*']);
  t.deepEqual(tachLam('x\nLÀM: bo-bai huy bh-huy-2026-0 dạy dùng --no-verify\nLÀM: tam-dung khang chạy push --force 3 lần\nLÀM: bo-bai huy sai-ma lý do dài\nLÀM: xoa-het huy x'),
    [{ v: 'bo-bai', id: 'huy', ma: 'bh-huy-2026-0', ly: 'dạy dùng --no-verify' }, { v: 'tam-dung', id: 'khang', ly: 'chạy push --force 3 lần' }], 'chỉ nhận lệnh hợp lệ, bỏ mã sai + động từ lạ');
  t.equal(sach("x'; rm -rf / $(id) `y`"), 'x ; rm -rf / (id) y', 'lý do không mang nháy / $ / backtick qua shell');
  t.notEqual(khoa({ loai: 'a', ai: 'b', vat: 'c' }), khoa({ loai: 'a', ai: 'b', vat: 'd' }));
  console.log('✓ giam-sat: học sai / lệch / phình / lộ bí mật, lệnh cấm, lỗi 24 giờ, quyền mới, lệnh LÀM hợp lệ');
} else if (process.argv[1] === new URL(import.meta.url).pathname) await luot({ chiDo: process.argv.includes('--do') });
