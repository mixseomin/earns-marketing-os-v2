#!/usr/bin/env node
// DỰNG MỘT TẬP KÊNH LỊCH SỬ (02/11/2026, S08 bước 2) trên iMac: tệp tập (tap/<id>.json) → giọng có mốc từng chữ (giong.mts trên box3, chỉ sinh khi
// chưa có — tốn ~$0,10/1.000 ký tự) → chia cảnh theo chữ đầu mỗi câu → trang ban-do.html quay bằng shot-code/dung.mjs → trộn giọng + nhạc nền.
//   node scripts/lich-su/dung-tap.mjs tap/kaliningrad-a.json [--khung 1,8,20 --khung-ra to.jpg] [--giong-lai]
// Tài nguyên ở /Users/htuan/.cache/lich-su/: ne_50m.geojson (Natural Earth), ảnh nền giấy, <id>/giong.mp3 + moc-tho.json, <id>/<id>.mp4.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const DIR = dirname(fileURLToPath(import.meta.url)), KHO = `${process.env.HOME}/.cache/lich-su`, BOX = 'root@167.233.241.16';
const tepTap = resolve(DIR, process.argv[2]), tap = JSON.parse(readFileSync(tepTap, 'utf8')), RA = join(KHO, tap.id);
mkdirSync(RA, { recursive: true });

// ---------- giọng (box3, một lần) ----------
if (!existsSync(join(RA, 'moc-tho.json')) || process.argv.includes('--giong-lai')) {
  execFileSync('scp', ['-q', tepTap, `${BOX}:/tmp/tap-${tap.id}.json`]);
  console.log(execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && ../../node_modules/.bin/tsx scripts/lich-su/giong.mts /tmp/tap-${tap.id}.json /tmp/ra-${tap.id} && rm -f /tmp/tap-${tap.id}.json`], { encoding: 'utf8' }).trim());
  execFileSync('scp', ['-q', `${BOX}:/tmp/ra-${tap.id}/*`, RA]); execFileSync('ssh', [BOX, `rm -rf /tmp/ra-${tap.id}`]);
}
// mốc ký tự → chữ {chu, a, b}
const tho = JSON.parse(readFileSync(join(RA, 'moc-tho.json'), 'utf8'));
const kt = tho.flatMap((o) => o.characters.map((ch, i) => ({ ch, a: o.character_start_times_seconds[i], b: o.character_end_times_seconds[i] })));
const tu = []; let cur = null;
for (const k of kt) { if (/\s/.test(k.ch)) { if (cur) tu.push(cur); cur = null; continue; } cur ? (cur.chu += k.ch, cur.b = k.b) : (cur = { chu: k.ch, a: k.a, b: k.b }); }
if (cur) tu.push(cur);
// gán chữ vào câu theo số chữ của từng câu trong tệp tập
let i = 0; const canh = tap.cau.map((c, k) => { const n = c.chu.trim().split(/\s+/).length; const ds = tu.slice(i, i + n); ds.forEach((w) => (w.cau = k)); i += n; return { bd: k ? ds[0]?.a ?? 0 : 0, c: c.canh }; });
if (i !== tu.length) console.warn(`⚠ số chữ giọng (${tu.length}) lệch số chữ kịch bản (${i}) — phụ đề có thể lệch câu`);
const giay = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(RA, 'giong.mp3')], { encoding: 'utf8' }));
const DAI = Math.round((giay + 1.2) * 100) / 100;
canh.forEach((s, k) => (s.kt = canh[k + 1]?.bd ?? DAI));

// ---------- bản đồ: chỉ nước nằm trong vùng các cảnh nhìn tới (nhẹ trang) ----------
const geo = JSON.parse(readFileSync(join(KHO, 'ne_50m.geojson'), 'utf8'));
const lo = canh.map((s) => s.c.tam[0]), la = canh.map((s) => s.c.tam[1]), zmin = Math.min(...canh.map((s) => s.c.zoom));
const pad = 1080 / (12 * zmin); const hop = [Math.min(...lo) - pad, Math.min(...la) - pad, Math.max(...lo) + pad, Math.max(...la) + pad];
const G = {};
for (const f of geo.features) {
  const iso = f.properties.ADM0_A3; const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of polys) { const ring = p[0]; const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]);
    if (Math.max(...xs) < hop[0] || Math.min(...xs) > hop[2] || Math.max(...ys) < hop[1] || Math.min(...ys) > hop[3] || Math.max(...xs) - Math.min(...xs) > 300) continue;
    (G[iso] ||= []).push(ring.map(([a, b]) => [Math.round(a * 100) / 100, Math.round(b * 100) / 100])); }
}
const cauTep = join(RA, 'cau.json');
writeFileSync(cauTep, JSON.stringify({ DAI, nen: pathToFileURL(join(KHO, tap.nen.anh)).href, geo: G, tu, canh }));

// ---------- quay hình + tiếng ----------
const dung = (them) => { const r = spawnSync(process.execPath, [join(DIR, '../shot-code/dung.mjs'), '--trang', join(DIR, 'ban-do.html'), '--cau', cauTep, '--rong', '1080', '--cao', '1920', '--fps', '30', ...them], { stdio: 'inherit' }); if (r.status) process.exit(r.status); };
if (arg('khung')) { dung(['--ra', '/dev/null', '--khung', arg('khung'), '--khung-ra', resolve(arg('khung-ra'))]); process.exit(0); }
const hinh = join(RA, 'hinh.mp4'), ra = join(RA, `${tap.id}.mp4`);
dung(['--ra', hinh]);
// nhạc nền: hợp âm trầm thở chậm, nằm dưới giọng ~22 dB (0đ, không bản quyền)
const nhac = `0.05*sin(2*PI*98*t)*(0.6+0.4*sin(2*PI*0.08*t))+0.04*sin(2*PI*146.8*t)*(0.6+0.4*sin(2*PI*0.06*t+1))+0.03*sin(2*PI*196*t)*(0.5+0.5*sin(2*PI*0.05*t+2))`;
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', hinh, '-i', join(RA, 'giong.mp3'), '-f', 'lavfi', '-t', String(DAI), '-i', `aevalsrc='${nhac}':s=48000`,
  '-filter_complex', '[1:a]volume=1.0[g];[2:a]volume=0.5,afade=t=in:d=1.5,afade=t=out:st=' + (DAI - 1.5) + ':d=1.5[n];[g][n]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5[a]',
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', String(DAI), '-movflags', '+faststart', ra], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
console.log(`${ra} · ${DAI}s · ${canh.length} cảnh · ${tu.length} chữ`);
