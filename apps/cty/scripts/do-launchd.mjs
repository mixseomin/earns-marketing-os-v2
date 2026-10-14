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
    ds.push({ loai: 'launchd', ma: nhan, ten: args.split('/').pop()?.slice(0, 80) ?? '', lich, cuoi, ket: !l ? 'chưa nạp' : l.pid !== '-' ? 'đang chạy' : l.st === '0' ? 'success' : `thoát ${l.st}`, ma_thoat: l?.st ?? '', log: dong });
  }
  return ds;
}

console.log(JSON.stringify({ may: os.hostname().startsWith('Tuans-iMac') ? 'iMac' : 'MacBook', luc: new Date().toISOString(), ds: doMac() }));
