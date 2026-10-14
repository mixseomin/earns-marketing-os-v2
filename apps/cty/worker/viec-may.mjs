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
  const theo = (may, ds) => { for (const v of ds) if (!BO_QUA.test(v.ma)) kq.push({ ...v, may, id: `${may}:${v.ma}`, cuoi: /^\d+$/.test(String(v.cuoi)) ? usTuIso(v.cuoi) : v.cuoi, tiep: v.tiep ? usTuIso(v.tiep) : '', ...xep(v.ma) }); };
  const giuCu = (may, e) => { loi[may] = String(e.message ?? e).slice(0, 200); kq.push(...(cu?.ds ?? []).filter((v) => v.may === may)); };
  try { theo('box3', JSON.parse(execFileSync('python3', ['-c', DO_BOX], { encoding: 'utf8', timeout: 120_000 }))); } catch (e) { giuCu('box3', e); }
  try { theo('box1', JSON.parse(execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', BOX1, 'python3 -'], { input: DO_BOX, encoding: 'utf8', timeout: 120_000 }))); } catch (e) { giuCu('box1', e); }
  const thu = path.join(DATA(), 'may');
  const mac = {};   // mỗi máy một ảnh, mới nhất thắng (tên tệp theo đối số máy của nhan-lenh, tên máy thật nằm trong ảnh)
  for (const f of (fs.existsSync(thu) ? fs.readdirSync(thu) : []).filter((f) => /^launchd-.+\.json$/.test(f))) {
    try { const x = JSON.parse(fs.readFileSync(path.join(thu, f), 'utf8')); if (!mac[x.may] || x.luc > mac[x.may].luc) mac[x.may] = x; } catch (e) { loi[f] = String(e.message); }
  }
  for (const x of Object.values(mac)) theo(x.may, x.ds);
  const anh = { luc: new Date().toISOString(), loi, ds: kq };
  fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(`${TEP()}.tam`, JSON.stringify(anh)); fs.renameSync(`${TEP()}.tam`, TEP());
  return `${kq.length} việc máy · ${kq.filter((v) => v.chua_gan).length} chưa gắn phòng${Object.keys(loi).length ? ` · lỗi: ${Object.keys(loi).join(', ')}` : ''}`;
}
export function docViecMay() { try { return JSON.parse(fs.readFileSync(TEP(), 'utf8')); } catch { return null; } }
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
  for (const [, k, x] of String(v.lich).matchAll(/(OnCalendar|OnUnitActiveUSec|OnActiveUSec)=([^·]+)/g)) {
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
    for (const p of new Set(QUY_TAC.map((q) => q[1]))) a.ok(fs.existsSync(path.join(GOC, 'cong-ty', 'phong', `${p}.md`)), `QUY_TAC trỏ phòng không có: ${p}`);
    const L = (loai, lich) => lichNguoi({ loai, lich });
    a.equal(L('timer', 'OnUnitActiveUSec=1min · OnBootUSec=2min'), 'mỗi 1 phút'); a.equal(L('timer', 'OnCalendar=*-*-* *:00/10:00'), 'mỗi 10 phút');
    a.equal(L('timer', 'OnCalendar=*-*-* 01:00:00'), '08:00 hằng ngày'); a.equal(L('timer', 'OnCalendar=*-*-* 01:00:00 UTC'), '08:00 hằng ngày'); a.equal(L('cron', '30 0 * * *'), '07:30 hằng ngày'); a.equal(L('cron', '*/5 * * * *'), 'mỗi 5 phút');
    a.equal(L('cron', '40 */6 * * *'), 'mỗi 6 giờ'); a.equal(L('cron', '30 9 * * 1'), '16:30 mỗi thứ Hai'); a.equal(L('timer', 'OnCalendar=Mon *-*-* 03:00'), '10:00 thứ Hai'); a.equal(L('timer', 'OnCalendar=*-*-* 02,14:00:00 UTC'), '09:00, 21:00 hằng ngày');
    a.equal(L('timer', 'OnCalendar=Mon..Fri *-*-* 14:00:00'), '21:00 thứ Hai–Sáu'); a.equal(L('timer', 'OnCalendar=*-*-* *:17:00 UTC'), 'mỗi giờ (phút 17)'); a.equal(L('timer', 'OnCalendar=*-10-* 03:00'), '*-10-* 03:00', 'dạng lạ giữ nguyên');
    a.ok(nguoiPhong('bao-tri') === 'bao' && nguoiPhong('sach') === 'thao', 'người phụ trách = trưởng phòng');
    console.log('✓ viec-may: xếp phòng theo quy tắc, chatwhenbored ≠ adfond, không khớp → Bảo trì (chưa gắn), bỏ việc hệ điều hành, phòng trong quy tắc có thật');
  }
}
