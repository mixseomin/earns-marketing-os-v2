#!/usr/bin/env node
// DỪNG MỘT TIẾN TRÌNH VIỆC NỀN MỒ CÔI trên máy Mac — tay hẹp cho Hà (anh 17/11/2026: "mày chỉ đc sửa và ra lệnh cho các con CLI kia. Cấm mày tự làm việc
// của chúng nó" — Hà sửa gốc vòng site Astrolas nhưng không dừng được 2 bản php mồ côi giữ cổng 8000, lại đẩy lệnh kill về anh).
// CHỈ dừng tiến trình mà dòng lệnh khớp ĐÚNG lệnh `chay` của một việc trong sổ ~/viec-nen/so.json (việc nền của chính bộ điều phối) — tiến trình khác
// (trình duyệt, phiên Claude của anh, app) không đụng được. SIGTERM, đợi 5 giây, còn sống thì báo, không SIGKILL.
//   node dung-viec-nen.mjs <pid> [<pid>…]     · --tu-kiem
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Thuần: dòng lệnh tiến trình có phải một việc nền trong sổ không → việc đó hoặc null. Khớp khi mọi đối số của `chay` (bỏ đường dẫn trình chạy) có mặt theo thứ tự. */
export function viecCua(lenh, so) {
  const t = String(lenh).trim();
  return (so.viec ?? []).find((v) => { const a = (v.chay ?? []).slice(1).map(String); if (!a.length) return false; let i = 0; for (const x of a) { const j = t.indexOf(x, i); if (j < 0) return false; i = j + x.length; } return true; }) ?? null;
}

if (process.argv[1] === new URL(import.meta.url).pathname && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  const so = { viec: [{ ten: 'Astrolas - site', chay: ['/opt/homebrew/bin/php', 'artisan', 'serve', '--port=8000'] }, { ten: 'Hà', chay: ['/opt/homebrew/bin/node', '/x/giam-sat.mjs'] }] };
  t.equal(viecCua('/opt/homebrew/Cellar/php/8.4/bin/php artisan serve --port=8000', so)?.ten, 'Astrolas - site', 'php serve của việc site');
  t.equal(viecCua('/usr/bin/php artisan serve --port=8001', so), null, 'cổng khác → không phải việc trong sổ');
  t.equal(viecCua('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', so), null, 'trình duyệt → không dừng được');
  t.equal(viecCua('/opt/homebrew/bin/claude -p x', so), null, 'phiên Claude → không dừng được');
  console.log('✓ dung-viec-nen: chỉ khớp tiến trình là việc nền trong sổ');
} else if (process.argv[1] === new URL(import.meta.url).pathname) {
  const so = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'viec-nen', 'so.json'), 'utf8'));
  let hong = 0;
  for (const pid of process.argv.slice(2).filter((x) => /^\d+$/.test(x))) {
    let lenh = ''; try { lenh = execFileSync('ps', ['-o', 'command=', '-p', pid], { encoding: 'utf8' }).trim(); } catch { console.log(`${pid}: không còn chạy`); continue; }
    const v = viecCua(lenh, so); if (!v) { console.log(`${pid}: KHÔNG phải việc nền trong sổ — không dừng (${lenh.slice(0, 120)})`); hong++; continue; }
    process.kill(Number(pid), 'SIGTERM'); execFileSync('sleep', ['5']);
    let con = true; try { process.kill(Number(pid), 0); } catch { con = false; }
    console.log(`${pid}: ${con ? 'vẫn sống sau SIGTERM — báo' : 'đã dừng'} (việc "${v.ten}")`); if (con) hong++;
  }
  process.exit(hong ? 1 : 0);
}
