// Ảnh LaunchAgent của máy Mac đang đứng → JSON ra stdout (việc máy, worker/viec-may.mjs). KHÔNG import gì ngoài node: iMac không có repo
// MOS2 — puzzle-books scripts/nhan-lenh.mjs đọc tệp này từ box qua ssh, chạy bằng `node --input-type=module -`, đẩy kết quả lên box mỗi 10 phút.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

/** Ảnh LaunchAgent của máy Mac đang đứng (chạy trên Mac). Nhãn hãng phần mềm bỏ qua. lần chạy cuối ≈ giờ sửa tệp nhật ký của việc. */
function doMac() {
  const dir = path.join(os.homedir(), 'Library', 'LaunchAgents'); const ds = [];
  const ls = Object.fromEntries(execFileSync('launchctl', ['list'], { encoding: 'utf8' }).split('\n').slice(1).map((l) => l.split('\t')).filter((x) => x.length === 3).map(([pid, st, nhan]) => [nhan, { pid, st }]));
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.plist'))) {
    let p; try { p = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path.join(dir, f)], { encoding: 'utf8' })); } catch { continue; }
    const nhan = String(p.Label ?? f.replace(/\.plist$/, '')); if (/^(com\.google|com\.apple|com\.adobe|homebrew\.)|keystone/i.test(nhan)) continue;   // phần mềm hãng (box lọc lại bằng BO_QUA)
    const ci = [].concat(p.StartCalendarInterval ?? []).map((c) => `${c.Weekday !== undefined ? `thứ ${c.Weekday} ` : ''}${c.Hour !== undefined ? String(c.Hour).padStart(2, '0') : '**'}:${String(c.Minute ?? 0).padStart(2, '0')}`);
    const lich = [ci.length ? `lúc ${ci.join(', ')}` : '', p.StartInterval ? `mỗi ${p.StartInterval >= 3600 ? `${p.StartInterval / 3600} giờ` : `${Math.round(p.StartInterval / 60)} phút`}` : '', p.KeepAlive ? 'chạy liền' : ''].filter(Boolean).join(' · ') || (p.RunAtLoad ? 'khi bật máy' : '');
    const log = p.StandardOutPath || p.StandardErrorPath; let cuoi = '', dong = [];
    try { cuoi = fs.statSync(log).mtime.toISOString(); dong = execFileSync('tail', ['-n', '6', log], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { /* chưa có nhật ký */ }
    const l = ls[nhan]; const args = [].concat(p.ProgramArguments ?? p.Program ?? []).join(' ');
    ds.push({ loai: 'launchd', ma: nhan, ten: (args.split('/').pop() ?? '').split(' · ').pop()?.slice(0, 80) ?? ''   /* tệp bọc ~/viec-nen đặt tên "Phòng · Người · Việc" — cty chỉ cần phần việc */, lich, cuoi, ket: !l ? 'chưa nạp' : l.pid !== '-' ? 'đang chạy' : l.st === '0' ? 'success' : `thoát ${l.st}`, ma_thoat: l?.st ?? '', log: dong });
  }
  return ds;
}

// ÁP LỊCH admin đặt trên cty (worker/lich-may.mjs, <DATA>/lich-chinh.json) cho LaunchAgent của máy này, TRƯỚC khi chụp ảnh → ảnh đã là lịch mới.
// Ý muốn: { kieu: 'moi', phut } → StartInterval · { kieu: 'luc', gio } → StartCalendarInterval (giờ máy = giờ VN). Việc chạy liền không có lịch.
const MAY = os.hostname().startsWith('Tuans-iMac') ? 'iMac' : 'MacBook';
function apLich() {
  let s = {}; try { s = JSON.parse(execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@167.233.241.16', 'cat /var/lib/cty/lich-chinh.json 2>/dev/null || echo {}'], { encoding: 'utf8', timeout: 40_000 })); } catch { return []; }
  const ra = []; const uid = process.getuid();
  for (const [id, x] of Object.entries(s)) {
    if (!id.startsWith(`${MAY}:`) || (x.ap && x.ap.luc >= x.luc)) continue;
    const nhan = id.slice(MAY.length + 1), f = path.join(os.homedir(), 'Library', 'LaunchAgents', `${nhan}.plist`);
    try {
      const p = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', f], { encoding: 'utf8' }));
      if (p.KeepAlive) throw new Error('việc chạy liền (KeepAlive) — không có lịch để đổi');
      for (const k of ['StartInterval', 'StartCalendarInterval']) if (k in p) execFileSync('plutil', ['-remove', k, f]);
      if (x.kieu === 'moi') execFileSync('plutil', ['-insert', 'StartInterval', '-integer', String(x.phut * 60), f]);
      else { const [h, m] = x.gio.split(':').map(Number); execFileSync('plutil', ['-insert', 'StartCalendarInterval', '-json', JSON.stringify({ Hour: h, Minute: m }), f]); }
      let nap = true; try { execFileSync('launchctl', ['print', `gui/${uid}/${nhan}`], { stdio: 'ignore' }); } catch { nap = false; }   // việc đang tắt: sửa lịch, không tự bật
      if (nap) {
        try { execFileSync('launchctl', ['bootout', `gui/${uid}/${nhan}`], { stdio: 'ignore' }); } catch { /* đã ra */ }
        let ok = false; for (let i = 0; i < 20 && !ok; i++) { try { execFileSync('launchctl', ['bootstrap', `gui/${uid}`, f], { stdio: 'ignore' }); ok = true; } catch { execFileSync('sleep', ['0.5']); } }
        if (!ok) throw new Error('đã sửa lịch nhưng nạp lại việc không được (launchctl bootstrap) — việc đang TẮT');
      }
      ra.push({ id, luc: x.luc, ok: true });
    } catch (e) { ra.push({ id, luc: x.luc, ok: false, loi: String(e.message).slice(0, 300) }); }
  }
  return ra;
}
const ap = apLich();
console.log(JSON.stringify({ may: MAY, luc: new Date().toISOString(), ap, ds: doMac() }));
