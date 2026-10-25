#!/usr/bin/env node
// BỘ ĐIỀU PHỐI VIỆC NỀN — mỗi máy Mac chỉ MỘT LaunchAgent (tc.on.cty.dieu-phoi, Mục đăng nhập hiện "Cty - điều phối việc nền"). Anh 14/10/2026:
// "tối ưu toàn bộ App Background về 1 file duy nhất rồi đọc từ cty". Trước đó mỗi việc một LaunchAgent → 23 dòng iMac + 16 dòng MacBook.
//   SỔ = apps/cty/cong-ty/viec-nen.json (git → box3 → máy đọc lại mỗi 5 phút qua ssh, lưu bản sao ~/viec-nen/so.json để box3 im vẫn chạy).
//   NGƯỜI chịu trách nhiệm = `lich` của quy trình phòng (cong-ty/quy-trinh/<phòng>/danh-sach.json) — tu-kiem cty đối chiếu hai bên.
// Chạy thường trực, nhịp 5 giây. hen: luc ["HH:MM"] giờ máy · moi_giay N · luon (dịch vụ: chết thì dựng lại sau ≥ 10 giây) · tay (chỉ chạy khi gọi).
// Như launchd: không chạy chồng hai lượt một việc; máy ngủ lỡ giờ thì thức dậy chạy bù MỘT lượt; nhật ký ra đúng tệp cũ.
// Tiến trình con mang TÊN việc: chạy qua liên kết ~/viec-nen/ten/<tên> → trình thông dịch (Activity Monitor hiện tên, không hiện trần node/bash).
// THU NHẬN: việc đã có trong sổ mà ~/Library/LaunchAgents vẫn còn plist cùng nhãn (tệp cài cũ của repo nào đó đặt lại) → đợi lượt launchd đang chạy
// xong (dịch vụ thì không đợi), bootout, chuyển plist + tệp bọc cũ vào ~/.Trash/claude-don-<ngày>/plist-cu/. Còn plist thì bộ điều phối không chạy
// việc đó (tránh chạy đôi).
//   node dieu-phoi.mjs chay <iMac|MacBook>      (LaunchAgent gọi)
//   node dieu-phoi.mjs goi <nhãn> [đối số…]     chạy ngay một lượt (đang chạy thì đợi lượt đó xong) — nhan-lenh.mjs, deploy-shorts.sh dùng
//   node dieu-phoi.mjs xem [nhãn]               trạng thái (một nhãn → JSON {chay, ma, runs, bat_dau, xong})
//   node dieu-phoi.mjs --tu-kiem
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const HOME = os.homedir();
const DIR = path.join(HOME, 'viec-nen');
const F = { so: path.join(DIR, 'so.json'), tt: path.join(DIR, 'trang-thai.json'), goi: path.join(DIR, 'goi'), ten: path.join(DIR, 'ten'), log: path.join(HOME, '.cache', 'dieu-phoi.log') };
const LA = path.join(HOME, 'Library', 'LaunchAgents');
const BOX = 'root@167.233.241.16', SO_BOX = '/opt/earns-marketing-os-v2/apps/cty/cong-ty/viec-nen.json';
const PATH_LAUNCHD = '/usr/bin:/bin:/usr/sbin:/sbin';   // PATH launchd đưa cho việc không khai PATH — giữ y nguyên để việc cũ chạy như trước
export const NHAN_DIEU_PHOI = 'tc.on.cty.dieu-phoi';

// ── phần THUẦN (tự kiểm được) ────────────────────────────────────────────────────────────────────────────────────────────
/** Lỗi của sổ (mảng rỗng = hợp lệ). tu-kiem cty và bộ điều phối cùng dùng: sổ hỏng thì máy giữ bản cũ, không chạy bậy. */
// CLAUDE KHÔNG GIAO DIỆN CHỈ iMAC (luật anh 23/10/2026 — gói thuê bao không qua API): việc nền gọi Claude Code (lệnh có bin/claude / claude -p, hoặc chạy
// script cty có Claude — claudeTep do scripts/tu-kiem.mjs dò trong apps/cty/may) mà xếp cho máy khác = lỗi sổ → bộ điều phối giữ sổ cũ, tu-kiem đỏ.
export const GOI_CLAUDE = /bin\/claude\b|\bclaude\s+(-p|--print)\b/;
export function kiemSo(so, { claudeTep = [] } = {}) {
  const loi = [], thay = new Set();
  if (!Array.isArray(so?.viec)) return ['thiếu mảng "viec"'];
  for (const v of so.viec) {
    const k = v?.nhan ?? '?';
    if (!/^(iMac|MacBook):[\w.-]+$/.test(k)) loi.push(`${k}: nhan phải dạng <iMac|MacBook>:<nhãn>`);
    if (thay.has(k)) loi.push(`${k}: trùng nhãn`); thay.add(k);
    if (k.endsWith(`:${NHAN_DIEU_PHOI}`)) loi.push(`${k}: nhãn của chính bộ điều phối`);
    if (typeof v.ten !== 'string' || !v.ten.trim() || /[/\0]/.test(v.ten)) loi.push(`${k}: ten phải có chữ, không chứa "/"`);
    if (!Array.isArray(v.chay) || !v.chay.length || !v.chay.every((x) => typeof x === 'string') || !path.isAbsolute(v.chay[0] ?? '')) loi.push(`${k}: chay phải là mảng chữ, phần đầu là đường dẫn tuyệt đối`);
    const h = v.hen ?? {}, kieu = ['luc', 'moi_giay', 'luon', 'tay'].filter((x) => x in h);
    if (kieu.length !== 1) loi.push(`${k}: hen phải có đúng một trong luc | moi_giay | luon | tay`);
    else if (h.luc && !(Array.isArray(h.luc) && h.luc.length && h.luc.every((g) => /^([01]\d|2[0-3]):[0-5]\d$/.test(g)))) loi.push(`${k}: hen.luc phải là ["HH:MM", …]`);
    else if ('moi_giay' in h && !(Number.isInteger(h.moi_giay) && h.moi_giay >= 10)) loi.push(`${k}: hen.moi_giay phải là số nguyên ≥ 10`);
    else if (('luon' in h && h.luon !== true) || ('tay' in h && h.tay !== true)) loi.push(`${k}: hen.luon / hen.tay chỉ nhận true`);
    for (const f of ['thu_muc', 'nhat_ky', 'nhat_ky_loi']) if (v[f] != null && !path.isAbsolute(String(v[f]))) loi.push(`${k}: ${f} phải là đường dẫn tuyệt đối`);
    const lenh = (v.chay || []).join(' ');
    if (!k.startsWith('iMac:') && (GOI_CLAUDE.test(lenh) || claudeTep.some((t) => lenh.includes(t)))) loi.push(`${k}: gọi Claude không giao diện — chỉ được chạy trên iMac (luật 23/10/2026)`);
    if (v.moi_truong != null && (typeof v.moi_truong !== 'object' || Object.values(v.moi_truong).some((x) => typeof x !== 'string'))) loi.push(`${k}: moi_truong phải là { TÊN: "chữ" }`);
  }
  return loi;
}

/** Mốc hẹn gần nhất ≤ bay (ms), theo giờ của máy; xét hôm nay + hôm qua. */
export function henGanNhat(luc, bay) {
  let tot = -Infinity;
  for (const lui of [0, 1]) for (const g of luc) {
    const d = new Date(bay); d.setDate(d.getDate() - lui); const [h, m] = g.split(':').map(Number); d.setHours(h, m, 0, 0);
    if (d.getTime() <= bay && d.getTime() > tot) tot = d.getTime();
  }
  return tot;
}

/** Tới lượt chưa? t = trạng thái việc { moc (lần đầu thấy), bat_dau, lich_cuoi }. Trả { chay, lich? } — lich = mốc hẹn vừa phục vụ. */
export function toiLuot(hen, t, bay) {
  if (hen.tay) return { chay: false };
  if (hen.luon) return { chay: bay - (t.bat_dau ?? 0) >= 10_000 };          // ThrottleInterval 10 giây như launchd
  if (hen.moi_giay) return { chay: bay - (t.bat_dau ?? t.moc) >= hen.moi_giay * 1000 };
  const m = henGanNhat(hen.luc, bay);
  return m > Math.max(t.lich_cuoi ?? 0, t.moc) ? { chay: true, lich: m } : { chay: false };
}

/** Dòng shebang → [trình thông dịch, …tham số]; `/usr/bin/env X` tìm X trong PATH của việc. null = không phải script. */
export function docShebang(dong, PATH, coTep = fs.existsSync) {
  const m = /^#!\s*(\S+)(?:\s+(.*))?$/.exec(String(dong).trim()); if (!m) return null;
  const [, tt, du] = m, them = du ? du.trim().split(/\s+/) : [];
  if (tt !== '/usr/bin/env') return [tt, ...them];
  const ten = them.shift(); const thay = PATH.split(':').map((d) => path.join(d, ten)).find(coTep);
  return thay ? [thay, ...them] : null;
}

// ── trạng thái + nhật ký ────────────────────────────────────────────────────────────────────────────────────────────────
const docJson = (f, mac) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return mac; } };
const ghiJson = (f, x) => { const t = `${f}.tam`; fs.writeFileSync(t, JSON.stringify(x, null, 1)); fs.renameSync(t, f); };
const gio = () => new Date().toLocaleString('sv-SE').slice(5, 16);
function ghiLog(dong) {
  try { if (fs.statSync(F.log).size > 5e6) fs.renameSync(F.log, `${F.log}.1`); } catch { /* chưa có tệp */ }
  fs.appendFileSync(F.log, `${gio()} ${dong}\n`);
}
const nhanCua = (v) => v.nhan.split(':')[1];
/** pid còn sống VÀ đúng là việc này (tiến trình mang argv0 = tên việc) — pid tái dùng không bị nhận nhầm. */
function conSong(pid, ten) {
  if (!pid) return false;
  try { process.kill(pid, 0); } catch { return false; }
  try { return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim().startsWith(ten); } catch { return false; }
}

// ── chạy một việc ──────────────────────────────────────────────────────────────────────────────────────────────────────
function lenhThat(v, PATH) {
  let [dau, ...ts] = v.chay;
  if (!/^\/(bin|usr\/bin|opt\/homebrew\/bin|usr\/local\/bin)\//.test(dau)) {   // script có shebang → chạy trình thông dịch, script thành tham số
    let dong = ''; try { dong = fs.readFileSync(dau, 'utf8').slice(0, 200).split('\n')[0]; } catch { /* để spawn tự báo lỗi */ }
    const sb = docShebang(dong, PATH); if (sb) { ts = [...sb.slice(1), dau, ...ts]; dau = sb[0]; }
  }
  return [dau, ts];
}
/** Liên kết tên: ~/viec-nen/ten/<tên việc> → trình thông dịch thật. /bin/sh và /usr/bin/* là shim của Apple (đọc tên mình gọi để chọn lệnh) → không đổi tên. */
function lienKetTen(ten, dau) {
  const that = fs.realpathSync(dau);
  if (dau === '/bin/sh' || that.startsWith('/usr/bin/')) return dau;
  fs.mkdirSync(F.ten, { recursive: true });
  const lk = path.join(F.ten, ten);
  try { if (fs.readlinkSync(lk) === that) return lk; fs.unlinkSync(lk); } catch { /* chưa có */ }
  fs.symlinkSync(that, lk); return lk;
}
function moViec(v, t, them, xong) {
  let da = false; const khiXong = (ma) => { if (!da) { da = true; xong(ma); } };   // 'error' và 'exit' có thể cùng tới
  const PATH = v.moi_truong?.PATH ?? PATH_LAUNCHD;
  const [dau, ts] = lenhThat(v, PATH);
  const mo = (f) => fs.openSync(f ?? '/dev/null', 'a');
  const out = mo(v.nhat_ky), err = v.nhat_ky_loi ? mo(v.nhat_ky_loi) : out;
  try {
    const c = spawn(lienKetTen(v.ten, dau), [...ts, ...them], {
      argv0: v.ten, cwd: v.thu_muc ?? HOME, detached: true, stdio: ['ignore', out, err],
      env: { ...process.env, PATH, ...v.moi_truong, XPC_SERVICE_NAME: nhanCua(v) },
    });
    c.on('error', (e) => { ghiLog(`✗ ${v.ten}: không mở được (${e.message})`); khiXong(127); });
    c.on('exit', (ma, tinHieu) => khiXong(ma ?? 128 + (os.constants.signals[tinHieu] ?? 0)));
    c.unref();
    if (v.uu_tien_thap && c.pid) try { os.setPriority(c.pid, 10); } catch { /* đã thoát */ }
    Object.assign(t, { pid: c.pid, bat_dau: Date.now(), runs: (t.runs ?? 0) + 1, ma: null, xong: null });
    ghiLog(`▶ ${v.ten}${them.length ? ` (${them.join(' ')})` : ''} pid ${c.pid}`);
  } finally { fs.closeSync(out); if (err !== out) fs.closeSync(err); }
}

// ── thu nhận plist cũ ──────────────────────────────────────────────────────────────────────────────────────────────────
const UID = process.getuid?.();
const trongLaunchd = (nhan) => { try { return execFileSync('launchctl', ['print', `gui/${UID}/${nhan}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
function thuNhan(v) {
  const nhan = nhanCua(v), plist = path.join(LA, `${nhan}.plist`);
  const bak = fs.readdirSync(LA).filter((f) => f.startsWith(`${nhan}.plist.`)).map((f) => path.join(LA, f));
  if (!fs.existsSync(plist)) { bak.forEach(cat); return true; }
  const p = trongLaunchd(nhan);
  if (p && /^\s*state = running/m.test(p) && !v.hen.luon) return false;        // lượt launchd đang chạy dở → đợi nó xong
  let boc = null; try { boc = execFileSync('plutil', ['-extract', 'ProgramArguments.0', 'raw', plist], { encoding: 'utf8' }).trim(); } catch { /* plist hỏng */ }
  if (p) try { execFileSync('launchctl', ['bootout', `gui/${UID}/${nhan}`], { stdio: 'ignore' }); } catch { /* đã gỡ */ }
  [plist, ...bak, ...(boc?.startsWith(`${DIR}/`) && path.dirname(boc) === DIR ? [boc] : [])].forEach(cat);
  ghiLog(`⇄ thu nhận ${nhan}: gỡ khỏi launchd, plist cũ vào thùng rác — từ giờ bộ điều phối chạy`);
  return true;
}
function cat(f) {
  if (!fs.existsSync(f)) return;
  const d = new Date(), ngay = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const toi = path.join(HOME, '.Trash', `claude-don-${ngay}`, 'plist-cu'); fs.mkdirSync(toi, { recursive: true });
  let dich = path.join(toi, path.basename(f)); if (fs.existsSync(dich)) dich += `.${Date.now()}`;
  fs.renameSync(f, dich);
}

// ── vòng chính ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function taiSo(dongBo) {
  const xong = (out) => {
    let so; try { so = JSON.parse(out); } catch (e) { ghiLog(`⚠ sổ trên box3 không đọc được: ${e.message}`); return; }
    const loi = kiemSo(so); if (loi.length) { ghiLog(`⚠ sổ trên box3 có lỗi, giữ bản cũ: ${loi.slice(0, 3).join(' · ')}`); return; }
    if (JSON.stringify(so) !== JSON.stringify(docJson(F.so, null))) { ghiJson(F.so, so); ghiLog(`↻ đã nạp sổ mới (${so.viec.length} việc)`); }
  };
  const ts = ['-o', 'BatchMode=yes', '-o', 'ControlMaster=no', '-o', 'ControlPath=none', '-o', 'ConnectTimeout=15', BOX, `cat ${SO_BOX}`];
  if (dongBo) { try { xong(execFileSync('ssh', ts, { encoding: 'utf8', timeout: 30_000 })); } catch (e) { ghiLog(`⚠ chưa đọc được sổ từ box3: ${e.message.split('\n')[0]}`); } return; }
  execFile('ssh', ts, { encoding: 'utf8', timeout: 30_000 }, (e, out) => (e ? ghiLog(`⚠ box3 không trả sổ (giữ bản cũ): ${e.message.split('\n')[0]}`) : xong(out)));
}

function chayVong(may) {
  fs.mkdirSync(F.goi, { recursive: true }); fs.mkdirSync(path.dirname(F.log), { recursive: true });
  // đọc sổ ĐỒNG BỘ lúc khởi động (không chỉ khi chưa có bản sao): việc đã chuyển sang máy khác thì bản sao cũ không được chạy bù nó
  taiSo(true);
  const tt = docJson(F.tt, {}), dangChay = new Map();   // nhan → true khi chính lượt này mở (có sự kiện exit)
  let lanTai = Date.now(), lanThu = 0, lanNhip = Date.now();
  ghiLog(`● bộ điều phối ${may} chạy (pid ${process.pid})`);
  const nhip = () => {
    const bay = Date.now();
    // THỨC DẬY sau khi ngủ (nhịp 5 giây bị hở > 60 giây): đọc sổ ĐỒNG BỘ trước khi xét chạy bù — bản sao cũ còn những việc đã chuyển sang máy khác
    // (25/10/2026: chuyển việc MacBook → iMac; MacBook thức dậy chạy bù theo sổ cũ = chạy đôi). box3 không trả thì giữ bản cũ như trước.
    const thuc = bay - lanNhip > 60_000; lanNhip = bay;
    if (thuc) { lanTai = bay; ghiLog("☀ thức dậy — đọc lại sổ trước khi chạy bù"); taiSo(true); }
    else if (bay - lanTai > 5 * 60_000) { lanTai = bay; taiSo(false); }
    const ds = (docJson(F.so, { viec: [] }).viec ?? []).filter((v) => v.nhan.startsWith(`${may}:`) && !v.tat);
    const thu = bay - lanThu > 30_000; if (thu) lanThu = bay;
    let doi = false;
    for (const v of ds) {
      const t = (tt[v.nhan] ??= { moc: bay, runs: 0 });
      if (thu) try { t.cho_launchd = !thuNhan(v); } catch (e) { ghiLog(`⚠ thu nhận ${v.nhan}: ${e.message}`); t.cho_launchd = true; }
      if (t.cho_launchd) continue;   // launchd còn giữ việc này → không chạy đôi
      if (dangChay.has(v.nhan)) continue;
      if (t.pid) { if (conSong(t.pid, v.ten)) continue; Object.assign(t, { pid: null, xong: bay, ma: t.ma ?? null }); doi = true; }   // lượt của bộ điều phối trước (đã khởi động lại)
      const fGoi = path.join(F.goi, `${nhanCua(v)}.json`), goi = fs.existsSync(fGoi) ? docJson(fGoi, {}) : null;
      const l = goi ? { chay: true } : toiLuot(v.hen, t, bay);
      if (!l.chay) continue;
      if (goi) fs.rmSync(fGoi, { force: true });
      if (l.lich) t.lich_cuoi = l.lich;
      dangChay.set(v.nhan, true);
      moViec(v, t, Array.isArray(goi?.them) ? goi.them.map(String) : [], (ma) => {
        dangChay.delete(v.nhan); Object.assign(t, { pid: null, xong: Date.now(), ma });
        ghiLog(`■ ${v.ten} mã ${ma} sau ${Math.round((t.xong - t.bat_dau) / 1000)} giây`); ghiJson(F.tt, tt);
      });
      doi = true;
    }
    if (doi) ghiJson(F.tt, tt);
  };
  nhip(); setInterval(nhip, 5000);
  process.on('SIGTERM', () => { ghiJson(F.tt, tt); ghiLog('○ bộ điều phối dừng (việc đang chạy vẫn chạy tiếp)'); process.exit(0); });
}

function xem(nhan) {
  const so = docJson(F.so, { viec: [] }), tt = docJson(F.tt, {});
  const ds = so.viec.filter((v) => !nhan || nhanCua(v) === nhan || v.nhan === nhan);
  const r = ds.map((v) => { const t = tt[v.nhan] ?? {}; return { nhan: v.nhan, ten: v.ten, chay: conSong(t.pid, v.ten), ma: t.ma ?? null, runs: t.runs ?? 0, bat_dau: t.bat_dau ?? null, xong: t.xong ?? null }; });
  if (nhan) { if (!r.length) { console.error(`không có việc "${nhan}" trong sổ`); process.exit(1); } console.log(JSON.stringify(r[0])); return; }
  const g = (x) => (x ? new Date(x).toLocaleString('sv-SE').slice(5, 16) : '—');
  for (const x of r) console.log(`${x.chay ? '▶' : ' '} ${x.nhan.padEnd(52)} ${x.ten.padEnd(36)} lượt ${String(x.runs).padStart(4)} · cuối ${g(x.bat_dau)} · mã ${x.ma ?? '—'}`);
}

function goi(nhan, them) {
  const so = docJson(F.so, { viec: [] });
  if (!so.viec.some((v) => nhanCua(v) === nhan)) { console.error(`không có việc "${nhan}" trong sổ (~/viec-nen/so.json)`); process.exit(1); }
  fs.mkdirSync(F.goi, { recursive: true }); ghiJson(path.join(F.goi, `${nhan}.json`), { luc: new Date().toISOString(), them });
  console.log(`đã gọi ${nhan} — bộ điều phối chạy trong ≤ 5 giây (đang chạy thì đợi lượt đó xong)`);
}

async function tuKiem() {
  const a = (await import('node:assert')).default;
  const v = (x) => ({ nhan: 'iMac:com.x', ten: 'X - y', chay: ['/bin/bash', '-c', 'true'], hen: { moi_giay: 60 }, ...x });
  a.deepEqual(kiemSo({ viec: [v({})] }), []);
  a.ok(kiemSo({ viec: [v({ nhan: 'MacBook:x.claude', chay: ['/bin/sh', '-c', '/opt/homebrew/bin/claude -p hi'] })] }).some((l) => /chỉ được chạy trên iMac/.test(l)), 'Claude trên MacBook: lỗi');
  a.ok(kiemSo({ viec: [v({ nhan: 'MacBook:x.long', chay: ['/bin/sh', '-c', 'ssh box cat /opt/x/may/tho-may.mjs | node -'] })] }, { claudeTep: ['tho-may.mjs'] }).length, 'script cty có Claude trên MacBook: lỗi');
  a.deepEqual(kiemSo({ viec: [v({ nhan: 'iMac:x.long', chay: ['/bin/sh', '-c', 'ssh box cat /opt/x/may/tho-may.mjs | node -'] })] }, { claudeTep: ['tho-may.mjs'] }), [], 'trên iMac: qua');
  a.equal(kiemSo({ viec: [v({}), v({})] }).length, 1, 'trùng nhãn');
  a.equal(kiemSo({ viec: [v({ hen: { luc: ['24:00'] } })] }).length, 1, 'giờ sai');
  a.equal(kiemSo({ viec: [v({ hen: { moi_giay: 60, luon: true } })] }).length, 1, 'hai kiểu hẹn');
  a.equal(kiemSo({ viec: [v({ ten: 'a/b' })] }).length, 1, 'tên có /');
  a.equal(kiemSo({ viec: [v({ chay: ['node', 'x.mjs'] })] }).length, 1, 'lệnh không tuyệt đối');
  a.equal(kiemSo({ viec: [v({ nhan: `iMac:${NHAN_DIEU_PHOI}` })] }).length, 1);
  a.deepEqual(kiemSo({}), ['thiếu mảng "viec"']);
  const d = (s) => new Date(s).getTime();
  a.equal(henGanNhat(['02:00', '20:00'], d('2026-10-14T10:00:00')), d('2026-10-14T02:00:00'));
  a.equal(henGanNhat(['20:00'], d('2026-10-14T10:00:00')), d('2026-10-13T20:00:00'), 'chưa tới giờ hôm nay → mốc hôm qua');
  const moc = d('2026-10-14T09:00:00');
  a.deepEqual(toiLuot({ luc: ['08:30'] }, { moc }, d('2026-10-14T09:10:00')), { chay: false }, 'mốc trước lần đầu thấy → không chạy bù');
  a.deepEqual(toiLuot({ luc: ['09:05'] }, { moc }, d('2026-10-14T09:10:00')), { chay: true, lich: d('2026-10-14T09:05:00') });
  a.deepEqual(toiLuot({ luc: ['09:05'] }, { moc, lich_cuoi: d('2026-10-14T09:05:00') }, d('2026-10-14T23:00:00')), { chay: false }, 'đã phục vụ mốc');
  a.ok(toiLuot({ luc: ['02:00'] }, { moc, lich_cuoi: d('2026-10-14T02:00:00') }, d('2026-10-17T08:00:00')).chay, 'ngủ ba ngày → chạy bù một lượt');
  a.ok(!toiLuot({ moi_giay: 900 }, { moc: 0, bat_dau: 1000 }, 800_000).chay);
  a.ok(toiLuot({ moi_giay: 900 }, { moc: 0, bat_dau: 1000 }, 901_000).chay);
  a.ok(!toiLuot({ moi_giay: 900 }, { moc: 5000 }, 6000).chay, 'lần đầu thấy: đợi đủ một chu kỳ');
  a.ok(toiLuot({ luon: true }, { moc: 0 }, 20_000).chay && !toiLuot({ luon: true }, { moc: 0, bat_dau: 15_000 }, 20_000).chay, 'dịch vụ: dựng lại sau ≥ 10 giây');
  a.ok(!toiLuot({ tay: true }, { moc: 0 }, 1e12).chay);
  a.deepEqual(docShebang('#!/bin/bash', ''), ['/bin/bash']);
  a.deepEqual(docShebang('#!/usr/bin/env bash', '/opt/x:/bin', (f) => f === '/bin/bash'), ['/bin/bash']);
  a.deepEqual(docShebang('#!/usr/bin/env node --x', '/a:/b', (f) => f === '/b/node'), ['/b/node', '--x']);
  a.equal(docShebang('console.log(1)', '/bin'), null);
  console.log('dieu-phoi: 23/23 ok');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [lenh, ...ts] = process.argv.slice(2);
  if (lenh === '--tu-kiem') await tuKiem();
  else if (lenh === 'chay' && ['iMac', 'MacBook'].includes(ts[0])) chayVong(ts[0]);
  else if (lenh === 'goi' && ts[0]) goi(ts[0], ts.slice(1));
  else if (lenh === 'xem') xem(ts[0]);
  else { console.error('dùng: dieu-phoi.mjs chay <iMac|MacBook> | goi <nhãn> [đối số…] | xem [nhãn] | --tu-kiem'); process.exit(2); }
}
