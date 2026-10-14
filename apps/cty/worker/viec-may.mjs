// VIỆC MÁY — mọi việc chạy tự động ngoài cty (timer + cron trên box1/box3, LaunchAgent trên MacBook/iMac) gắn về một PHÒNG + người phụ trách
// (anh 14/10/2026: "các activity khác chưa gắn với phòng ban nào thì chủ động thêm vào luôn trong cty để đồng bộ").
// Không khai tay từng việc: bộ gom TỰ DÒ máy (việc mới tự hiện), QUY_TAC xếp phòng theo tên; việc không khớp quy tắc nào về Phòng Bảo trì với
// cờ `chua_gan` (hiện đỏ — Bảo phải xếp, tức là thêm một dòng QUY_TAC). Ảnh chụp ghi ở <DATA>/viec-may.json, bảng nhân sự đọc ảnh này.
//   node worker/viec-may.mjs --gom       dò box3 (tại chỗ) + box1 (ssh) + ảnh launchd các Mac đã đẩy lên → <DATA>/viec-may.json
// Ảnh LaunchAgent của từng Mac: scripts/do-launchd.mjs (không import gì — iMac không có repo này, nhan-lenh.mjs đọc tệp đó từ box rồi chạy,
// đẩy kết quả lên <DATA>/may/launchd-<máy>.json mỗi 10 phút).
//   node worker/viec-may.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';
import { ghiAp, apBox, docLich, choAp } from './lich-may.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
export const TEP = () => path.join(DATA(), 'viec-may.json');
const BOX1 = 'root@5.78.65.158';

/** [mẫu tên việc, phòng, người (bỏ trống = trưởng phòng)] — xét theo thứ tự, khớp đầu tiên thắng. Tên việc = unit / nhãn LaunchAgent / lệnh cron. */
export const QUY_TAC = [
  [/mt5|\/forward|fx_trend|btc_|xsection|strategy_trades|polymarket|betting/i, 'vp-giam-doc', 'an'],                       // giao dịch → Tài chính
  [/chaturbate|chatwhenbored|cwb-/i, 'dung-san-pham'],                                                                     // chatwhenbored: CẤM gắn adfond (18/09)
  [/adfond|hotel-arb|yieldboard|keo-mang|merchant-feed|vf-lam-moi|keo-so-cj-adpia|\/phu\/(bidvertiser|trafficfactory|exo-goal|ga4-ngay|bv-chan-nguon|log-box2)/i, 'adfond'],
  [/puzzle|amazon-pull|pinterest-doc-so|gumroad-views/i, 'sach'],
  [/astrolas/i, 'astrolas'],
  [/courseforge/i, 'du-an'],
  [/awin|cj-sync|umbrella|mos2-shop|bao-sp-telegram|billing-kick/i, 'kinh-doanh'],
  [/outreach|backlink|publications|warmup|fb-giu-am|seo-review|ses-sandbox|mailtester|engagement-summary|cgg-chat-seed/i, 'marketing'],
  [/spy|app-store-so/i, 'nghien-cuu-thi-truong'],
  [/cgg-|cities|cee-|check-indexed|gsc-check|mc-data|mm-|militarymarkdown|govcalcs|visagps|steamsolo|chatlt|hljournal|orit|adsense-site-check/i, 'dung-san-pham'],
  [/backup|sao-luu|don-nhat-ky|dotsync|reaper|pm2 restart|box3-tunnel|browsers-refresh|stats-collector|clickup|bridge-sync|followup-nhac|inbox-bot/i, 'bao-tri'],
  [/cty-nhip|mos2-|actions\.runner|devserver|chatqueue|nhan-lenh/i, 'ky-thuat'],
];
/** Việc của hệ điều hành / phần mềm hãng — không phải việc của công ty, không hiện. */
const BO_QUA = /^(apt-daily|apport|certbot|dpkg-db-backup|e2scrub|fstrim|logrotate|man-db|motd-news|phpsessionclean|snapd|sysstat|systemd-tmpfiles|ua-timer|update-notifier|xfs_scrub|cloudflared-update|com\.google|com\.apple|com\.adobe|homebrew\.|.*keystone)/i;

/** Người phụ trách phòng: người có chức danh "Trưởng…" (ít thu_tu nhất), không có thì người đầu tiên của phòng. */
function nguoiPhong(phong) {
  const dir = path.join(GOC, 'cong-ty', 'nhan-su');
  const ds = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'SOUL.md'))).map((d) => ({ id: d, fm: parseFm(fs.readFileSync(path.join(dir, d, 'SOUL.md'), 'utf8')).fm }))
    .filter((x) => x.fm.phong === phong).sort((a, b) => (/^Trưởng/.test(String(b.fm.chuc_danh)) - /^Trưởng/.test(String(a.fm.chuc_danh))) || Number(a.fm.thu_tu ?? 99) - Number(b.fm.thu_tu ?? 99));
  return ds[0]?.id ?? null;
}
/** Tên ngắn để người đọc: phòng ("Phòng Sách (KDP…)" → "Sách", Văn phòng Giám đốc → "Văn phòng GĐ") · người (tên trong hồ sơ). Mac dùng cho
 *  tên hiện ở Cài đặt › Mục đăng nhập ("Sách · Thảo · Sản xuất sách", ~/viec-nen/doi-ten.py). */
const fmCua = (loai, id) => { try { return parseFm(fs.readFileSync(path.join(GOC, 'cong-ty', loai, loai === 'phong' ? `${id}.md` : `${id}/SOUL.md`), 'utf8')).fm; } catch { return {}; } };
export const tenPhong = (p) => (p === 'vp-giam-doc' ? 'Văn phòng GĐ' : String(fmCua('phong', p).ten ?? p).replace(/\s*\(.*\)$/, '').replace(/^Phòng /, '').replace(/^./, (c) => c.toUpperCase()));
export const tenNguoi = (id) => (id ? String(fmCua('nhan-su', id).ten ?? id) : '');
/** Xếp một việc: { phong, nguoi, chua_gan }. */
export function xep(ma, nguoiCua = nguoiPhong) {
  const q = QUY_TAC.find(([re]) => re.test(ma));
  const phong = q?.[1] ?? 'bao-tri';
  return { phong, nguoi: q?.[2] ?? nguoiCua(phong), chua_gan: !q };
}

// Dò một box: timer (lần chạy cuối / kế tiếp / kết quả / vài dòng nhật ký) + cron (lần chạy cuối đọc từ nhật ký cron 26 giờ qua). Chạy bằng python3
// có sẵn trên box (một lượt ssh cho cả box, không gọi từng unit qua mạng).
const DO_BOX = String.raw`
import json,re,subprocess as s
r=lambda *a: s.run(a,capture_output=True,text=True).stdout
out=[]
for t in json.loads(r('systemctl','list-timers','--all','-o','json') or '[]'):
  svc=t['activates']; p=dict(l.split('=',1) for l in r('systemctl','show',svc,'-p','Description,Result,ExecMainStatus').splitlines() if '=' in l)
  lich=' · '.join(m.group(1)+'='+m.group(2).strip() for m in re.finditer(r'(OnCalendar|OnUnitActiveUSec|OnBootUSec|OnActiveUSec)=([^;]+)', r('systemctl','show',t['unit'],'-p','TimersCalendar,TimersMonotonic')))
  out.append(dict(loai='timer',ma=svc[:-8] if svc.endswith('.service') else svc,ten=p.get('Description',''),lich=lich,cuoi=t.get('last') or 0,tiep=t.get('next') or 0,ket=p.get('Result',''),ma_thoat=p.get('ExecMainStatus',''),log=r('journalctl','-u',svc,'-n','6','-o','short-iso','--no-pager').splitlines()[-6:]))
cmd={}
for l in r('journalctl','-u','cron','--since','-26h','-o','short-iso','--no-pager').splitlines():
  m=re.match(r'(\S+) .*CMD \((.*)\)$',l)
  if m: cmd[m.group(2)]=m.group(1)
for l in r('crontab','-l').splitlines():
  l=l.strip()
  if not l or l.startswith('#') or '=' in l.split()[0]: continue
  f=l.split(None,5)
  if len(f)<6: continue
  c=f[5].split(' #')[0].strip(); out.append(dict(loai='cron',ma=c,ten='',lich=' '.join(f[:5]),cuoi=cmd.get(c,''),log=[]))
print(json.dumps(out))
`;
const usTuIso = (us) => (us ? new Date(Number(us) / 1000).toISOString() : '');
/** Gom mọi máy → ảnh chụp. Máy không trả lời: giữ ảnh cũ của máy đó, ghi lỗi (không xoá việc khỏi bảng chỉ vì mạng chập). */
export function gom() {
  const cu = docViecMay(); const kq = []; const loi = {};
  try { apBox(cu); } catch (e) { loi.ap = String(e.message); }   // áp lịch admin đặt cho box TRƯỚC khi dò → ảnh mới đã là lịch mới
  const theo = (may, ds) => { for (const v of ds) if (!BO_QUA.test(v.ma)) { const x = xep(v.ma); kq.push({ ...v, may, id: `${may}:${v.ma}`, cuoi: /^\d+$/.test(String(v.cuoi)) ? usTuIso(v.cuoi) : v.cuoi, tiep: v.tiep ? usTuIso(v.tiep) : '', ...x, phong_ten: tenPhong(x.phong), nguoi_ten: tenNguoi(x.nguoi) }); } };
  const giuCu = (may, e) => { loi[may] = String(e.message ?? e).slice(0, 200); kq.push(...(cu?.ds ?? []).filter((v) => v.may === may)); };
  try { theo('box3', JSON.parse(execFileSync('python3', ['-c', DO_BOX], { encoding: 'utf8', timeout: 120_000 }))); } catch (e) { giuCu('box3', e); }
  try { theo('box1', JSON.parse(execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', BOX1, 'python3 -'], { input: DO_BOX, encoding: 'utf8', timeout: 120_000 }))); } catch (e) { giuCu('box1', e); }
  const thu = path.join(DATA(), 'may');
  const mac = {};   // mỗi máy một ảnh, mới nhất thắng (tên tệp theo đối số máy của nhan-lenh, tên máy thật nằm trong ảnh)
  for (const f of (fs.existsSync(thu) ? fs.readdirSync(thu) : []).filter((f) => /^launchd-.+\.json$/.test(f))) {
    try { const x = JSON.parse(fs.readFileSync(path.join(thu, f), 'utf8')); if (!mac[x.may] || x.luc > mac[x.may].luc) mac[x.may] = x; } catch (e) { loi[f] = String(e.message); }
  }
  for (const x of Object.values(mac)) { theo(x.may, x.ds); for (const a of x.ap ?? []) ghiAp(a.id, a.luc, a.ok, a.loi ?? ''); }   // Mac tự áp lịch admin đặt, báo kết quả trong ảnh
  const anh = { luc: new Date().toISOString(), loi, ds: kq };
  fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(`${TEP()}.tam`, JSON.stringify(anh)); fs.renameSync(`${TEP()}.tam`, TEP());
  return `${kq.length} việc máy · ${kq.filter((v) => v.chua_gan).length} chưa gắn phòng${Object.keys(loi).length ? ` · lỗi: ${Object.keys(loi).join(', ')}` : ''}`;
}
export function docViecMay() { try { return JSON.parse(fs.readFileSync(TEP(), 'utf8')); } catch { return null; } }
/** Có ý muốn đổi lịch đang chờ áp trên BOX (bộ chạy nhịp gom ngay, không đợi lượt 10 phút; Mac tự áp lúc đẩy ảnh). */
export const choApBox = () => { const vm = docViecMay(); const s = docLich(); return Object.entries(s).some(([id, x]) => choAp(x) && ['box3', 'box1'].includes(vm?.ds.find((v) => v.id === id)?.may)); };
/** Mac vừa đẩy ảnh có kết quả áp lịch mà ảnh chụp chung chưa gộp → gom ngay để ô chỉnh hết "chờ áp". */
export function choGomMac() {
  const thu = path.join(DATA(), 'may'); let moc = 0; try { moc = fs.statSync(TEP()).mtimeMs; } catch { return true; }
  try { return fs.readdirSync(thu).some((f) => /^launchd-.+\.json$/.test(f) && fs.statSync(path.join(thu, f)).mtimeMs > moc && (JSON.parse(fs.readFileSync(path.join(thu, f), 'utf8')).ap ?? []).length > 0); } catch { return false; }
}
/** Tên người đọc của một việc: timer / LaunchAgent có mô tả sẵn; cron chỉ có lệnh → "<dự án> · <tệp chạy>" (bỏ đường log, chuyển hướng, flock).
 *  vd "cd /root/steamsolo && flock -n /tmp/x.lock ./scripts/drip.sh" → "steamsolo · drip.sh". */
export function tenCron(cmd) {
  const s = String(cmd).replace(/\s*\d?>>?\s*\S+/g, ' ').replace(/2>&1/g, ' ');   // bỏ ">> /var/log/x.log", "2>&1"
  const m = [...s.matchAll(/(\S*?)([\w.-]+\.(?:sh|mjs|js|py|php|ts|sql))\b/g)].pop();   // tệp chạy cuối cùng trong lệnh (đường dẫn + tên)
  const tep = m?.[2]; const daTu = (x) => (String(x ?? '').match(/\/(?:opt|root|var\/www)\/([\w-][\w.-]*)/) ?? [])[1];
  const da = daTu(m?.[1]) ?? daTu(s.match(/\bcd\s+(\S+)/)?.[1]);   // dự án = thư mục của tệp chạy, không có thì thư mục `cd` vào
  const lenh = tep ?? (s.match(/\bcurl\b[^|;&]*?([\w-]+\/[\w-]+)(?:\s|$)/)?.[1]) ?? (/\bwp cron\b/.test(s) ? 'wp cron' : null)
    ?? ((x) => x && `pm2 restart ${x[1]}`)(s.match(/\bpm2 restart (\S+)/)) ?? ((x) => x && `SQL ${x[1]} ${x[2]}`)(s.match(/\b(UPDATE|INSERT INTO|DELETE FROM)\s+(\w+)/i))
    ?? s.trim().split(/\s+/)[0]?.split('/').pop();
  // cùng tệp chạy nhiều dòng (bidvertiser hôm nay / hôm qua, trafficfactory theo mạng) → kèm cờ + biến môi trường để phân biệt
  const them = [...s.matchAll(/\b[A-Z][A-Z_]+=([\w-]+)/g)].map((x) => x[1]).concat([...(tep ? s.slice(s.indexOf(tep)) : '').matchAll(/\s(--[\w-]+)/g)].map((x) => x[1]));
  const ten = [da && !String(lenh).startsWith(da) ? (BI_DANH[da] ?? da) : '', lenh].filter(Boolean).join(' · ');
  return (them.length ? `${ten} (${them.join(' ')})` : ten).slice(0, 70);
}
const BI_DANH = { 'earns-marketing-os-v2': 'mos2', 'earns-marketing-os': 'mos1', 'militarymarkdown.com': 'militarymarkdown' };
export const tenViec = (v) => v.ten || (v.loai === 'cron' ? tenCron(v.ma) : String(v.ma).split('/').pop());
/** Việc máy một người phụ trách (bảng nhân sự). */
export const viecMayCua = (id) => (docViecMay()?.ds ?? []).filter((v) => v.nguoi === id);
// Lịch bằng chữ người đọc, giờ VN (box chạy giờ UTC). Dạng lạ giữ nguyên chữ máy.
const vn = (h, m) => `${String((Number(h) + 7) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const doiKy = (x) => { const m = String(x).trim().match(/^(\d+)\s*(min|h|s|d)$/); return m ? `mỗi ${m[1]} ${{ min: 'phút', h: 'giờ', s: 'giây', d: 'ngày' }[m[2]]}` : null; };
const THU_EN = { Mon: 'thứ Hai', 'Mon..Fri': 'thứ Hai–Sáu', Sun: 'Chủ nhật', Sat: 'thứ Bảy', Tue: 'thứ Ba', Wed: 'thứ Tư', Thu: 'thứ Năm', Fri: 'thứ Sáu' };
export function lichNguoi(v) {
  if (v.loai === 'launchd') return v.lich || '—';
  if (v.loai === 'cron') {
    const [mi, h, dom, mon, dow] = String(v.lich).split(' ');
    const thu = dow !== '*' ? ` thứ ${dow === '1' ? 'Hai' : dow}` : '';
    if (/^\*\/\d+$/.test(mi) && h === '*') return `mỗi ${mi.slice(2)} phút`;
    if (mi === '*' && h === '*') return 'mỗi phút';
    if (/^\d+$/.test(mi) && h === '*') return `mỗi giờ (phút ${mi})`;
    if (/^\d+$/.test(mi) && /^(\*|\d+-\d+)\/\d+$/.test(h)) return `mỗi ${h.split('/')[1]} giờ`;
    if (/^[\d,]+$/.test(mi) && h === '*') return `mỗi giờ (phút ${mi})`;
    if (/^\d+$/.test(mi) && /^\d+$/.test(h) && dom === '*' && mon === '*') return `${vn(h, mi)} ${thu ? `mỗi${thu}` : 'hằng ngày'}`;
    return v.lich;
  }
  const ra = [];
  const coLap = /OnUnitActiveUSec=|OnCalendar=/.test(String(v.lich));   // OnActiveSec chỉ là cú hích MỘT lần sau khi bật timer (drop-in lich-may) — có mốc lặp thì bỏ
  for (const [, k, x] of String(v.lich).matchAll(/(OnCalendar|OnUnitActiveUSec|OnActiveUSec)=([^·]+)/g)) {
    if (k === 'OnActiveUSec' && coLap) continue;
    if (k !== 'OnCalendar') { ra.push(doiKy(x) ?? x.trim()); continue; }
    const c = x.trim().replace(/ UTC$/, '');   // box chạy giờ UTC; systemd mới ghi kèm ' UTC'
    const m = c.match(/^(?:([A-Za-z.,]+) )?\*-\*-\* ([\d,*/]+):([\d,/]+)(?::\d+)?$/);
    if (!m) { ra.push(c); continue; }
    const [, dow, h, mi] = m; const sau = dow ? ` ${THU_EN[dow] ?? dow}` : ' hằng ngày';
    if (h === '*') ra.push(/^0*0\/(\d+)$/.test(mi) ? `mỗi ${mi.split('/')[1]} phút` : `mỗi giờ (phút ${mi})`);
    else if (/^\d+\/\d+$/.test(h)) ra.push(`mỗi ${h.split('/')[1]} giờ`);
    else if (/^[\d,]+$/.test(h) && /^\d+$/.test(mi)) ra.push(`${h.split(',').map((x) => vn(x, mi)).join(', ')}${sau}`);
    else ra.push(c);
  }
  return ra.join(' · ') || '—';
}
/** Việc còn đang chạy theo lịch: timer có lần kế tiếp · cron luôn · LaunchAgent đã nạp. */
export const dangChay = (v) => (v.loai === 'timer' ? !!v.tiep : v.loai === 'launchd' ? v.ket !== 'chưa nạp' : true);
const phutCua = (l) => { const m = String(l).match(/^mỗi (\d+) (giây|phút|giờ|ngày)/); if (m) return Number(m[1]) * { giây: 1 / 60, phút: 1, giờ: 60, ngày: 1440 }[m[2]]; if (l === 'mỗi phút') return 1; if (/^mỗi giờ/.test(l)) return 60; if (l === 'chạy liền') return 0; return 1440; };
/** NHỊP theo việc máy của một người (anh 14/10/2026 "việc đang chạy thì bật luôn nhân sự đó và set nhịp cho khớp"): số việc · số đang chạy ·
 *  nhịp dày nhất (chữ lịch của việc chạy dày nhất) · lần chạy gần nhất trong mọi việc. */
export function nhipMay(id, ds = viecMayCua(id)) {   // việc chạy liền (KeepAlive) không phải nhịp — chỉ tính khi người đó chỉ có loại đó
  const chay = ds.filter(dangChay); const nhanh = chay.map((v) => lichNguoi(v)).filter((l, _, ds) => l !== 'chạy liền' || ds.every((x) => x === 'chạy liền')).sort((a, b) => phutCua(a) - phutCua(b))[0] ?? '';
  return { so: ds.length, chay: chay.length, nhanh, cuoi: ds.map((v) => v.cuoi).filter(Boolean).sort().pop() ?? '' };
}
/** Lỗi lần chạy cuối? timer: Result khác success; launchd: thoát ≠ 0; cron: không biết. */
export const hong = (v) => (v.loai === 'timer' ? v.ket && v.ket !== 'success' : v.loai === 'launchd' ? /^thoát/.test(v.ket) : false);

if (process.argv[1]?.endsWith('viec-may.mjs')) {
  if (process.argv.includes('--gom')) console.log(gom());
  else if (process.argv.includes('--tu-kiem')) {
    const { strict: a } = await import('node:assert'); const ng = (p) => `tp-${p}`;
    a.deepEqual(xep('adfond-ga4', ng), { phong: 'adfond', nguoi: 'tp-adfond', chua_gan: false });
    a.equal(xep('python3 /opt/chatwhenbored/lander/live.py --day', ng).phong, 'dung-san-pham', 'chatwhenbored không bao giờ về adfond');
    a.equal(xep('com.earns.mt5hb', ng).nguoi, 'an'); a.equal(xep('com.earns.puzzle-sx', ng).phong, 'sach'); a.equal(xep('cgg-gsc-check', ng).phong, 'dung-san-pham');
    a.deepEqual(xep('viec-la-hoac', ng), { phong: 'bao-tri', nguoi: 'tp-bao-tri', chua_gan: true }, 'không khớp → Bảo trì, cờ chưa gắn');
    a.ok(BO_QUA.test('apt-daily-upgrade') && BO_QUA.test('com.google.GoogleUpdater.wake') && !BO_QUA.test('adfond-push'));
    a.ok(hong({ loai: 'timer', ket: 'exit-code' }) && !hong({ loai: 'timer', ket: 'success' }) && hong({ loai: 'launchd', ket: 'thoát 1' }) && !hong({ loai: 'cron', ket: '' }));
    for (const p of new Set(QUY_TAC.map((q) => q[1]))) { a.ok(fs.existsSync(path.join(GOC, 'cong-ty', 'phong', `${p}.md`)), `QUY_TAC trỏ phòng không có: ${p}`); a.ok(nguoiPhong(p), `phòng ${p} chưa có nhân sự — việc máy không có người phụ trách`); }
    const L = (loai, lich) => lichNguoi({ loai, lich });
    a.equal(L('timer', 'OnUnitActiveUSec=1min · OnBootUSec=2min'), 'mỗi 1 phút'); a.equal(L('timer', 'OnBootUSec=2min · OnUnitActiveUSec=30min · OnActiveUSec=1min'), 'mỗi 30 phút', 'cú hích một lần không phải nhịp'); a.equal(L('timer', 'OnCalendar=*-*-* *:00/10:00'), 'mỗi 10 phút');
    a.equal(L('timer', 'OnCalendar=*-*-* 01:00:00'), '08:00 hằng ngày'); a.equal(L('timer', 'OnCalendar=*-*-* 01:00:00 UTC'), '08:00 hằng ngày'); a.equal(L('cron', '30 0 * * *'), '07:30 hằng ngày'); a.equal(L('cron', '*/5 * * * *'), 'mỗi 5 phút');
    a.equal(L('cron', '40 */6 * * *'), 'mỗi 6 giờ'); a.equal(L('cron', '30 9 * * 1'), '16:30 mỗi thứ Hai'); a.equal(L('timer', 'OnCalendar=Mon *-*-* 03:00'), '10:00 thứ Hai'); a.equal(L('timer', 'OnCalendar=*-*-* 02,14:00:00 UTC'), '09:00, 21:00 hằng ngày');
    a.equal(L('timer', 'OnCalendar=Mon..Fri *-*-* 14:00:00'), '21:00 thứ Hai–Sáu'); a.equal(L('timer', 'OnCalendar=*-*-* *:17:00 UTC'), 'mỗi giờ (phút 17)'); a.equal(L('timer', 'OnCalendar=*-10-* 03:00'), '*-10-* 03:00', 'dạng lạ giữ nguyên');
    const nm = nhipMay('x', [{ loai: 'timer', lich: 'OnCalendar=*-*-* 01:00', tiep: 'a', cuoi: '2026-10-14T01:00:00Z' }, { loai: 'cron', lich: '*/5 * * * *', cuoi: '2026-10-14T05:00:00Z' }, { loai: 'launchd', lich: 'lúc 09:00', ket: 'chưa nạp' }, { loai: 'launchd', lich: 'chạy liền', ket: 'đang chạy' }]);
    a.deepEqual(nm, { so: 4, chay: 3, nhanh: 'mỗi 5 phút', cuoi: '2026-10-14T05:00:00Z' }, 'nhịp = việc chạy dày nhất; LaunchAgent chưa nạp không tính đang chạy');
    a.equal(tenCron('cd /root/steamsolo && /usr/bin/flock -n /tmp/ss-drip.lock ./scripts/drip.sh'), 'steamsolo · drip.sh');
    a.equal(tenCron('python3 /opt/chatwhenbored/lander/live.py --day >> /var/log/cwb-lander.log 2>&1'), 'chatwhenbored · live.py (--day)');
    a.equal(tenCron('/usr/bin/psql "$(cat /root/.mos2_dburl)" -f /opt/forward/refresh_mt5_summary.sql >> /var/log/refresh_mt5.log 2>&1'), 'forward · refresh_mt5_summary.sql');
    a.equal(tenCron('cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && EXADS_MANG=exoclick node scripts/phu/trafficfactory.mjs --hom-qua >> /var/log/mos2-phu.log 2>&1'), 'mos2 · trafficfactory.mjs (exoclick --hom-qua)');
    a.equal(tenCron('/usr/bin/pm2 restart cities-v2 cities-v2-b >> /var/log/pm2.log 2>&1'), 'pm2 restart cities-v2');
    a.equal(tenCron(`/usr/bin/psql "$(cat /root/.mos2_dburl)" -c "UPDATE strategy_trades SET raw=1" >/dev/null 2>&1`), 'SQL UPDATE strategy_trades');
    a.equal(tenCron('/usr/bin/curl -s -X POST http://localhost:3001/betting/settle >> /var/log/betting-settle.log 2>&1'), 'betting/settle');
    a.ok(tenPhong('sach') === 'Sách' && tenPhong('vp-giam-doc') === 'Văn phòng GĐ' && tenPhong('nghien-cuu-thi-truong') === 'Nghiên cứu thị trường' && tenNguoi('thao') === 'Thảo');
    a.ok(nguoiPhong('bao-tri') === 'bao' && nguoiPhong('sach') === 'thao', 'người phụ trách = trưởng phòng');
    console.log('✓ viec-may: xếp phòng theo quy tắc, chatwhenbored ≠ adfond, không khớp → Bảo trì (chưa gắn), bỏ việc hệ điều hành, phòng trong quy tắc có thật');
  }
}
