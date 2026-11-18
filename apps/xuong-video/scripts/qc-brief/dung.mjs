#!/usr/bin/env node
// tra-repo-ok: dán keo nội bộ — dùng lại giọng có mốc từng chữ (lich-su/giong.mts), máy quay trang (shot-code/dung.mjs), lối sang box3 (lich-su/box3.mjs)
// DỰNG VIDEO "QC BRIEF" cho máy anglebrief (anh 19/11/2026: dạng canh-dong "xấu quá, không sinh động", tham khảo YNT). Chạy trên iMac (quay bằng Chromium):
//   node scripts/qc-brief/dung.mjs scripts/qc-brief/mau-1.json [--soat thư-mục/] [--giong-lai]
// Tệp tập: { id, ngon_ngu, giong:{voice}, cau:[{chu, canh:{loai: dt|nv|so|chu|ds|ket, …, khi:"chữ"}}], tai_san:{qc, nen[], nv{dáng:png}} } — đường tài sản
// tính từ /Users/htuan/.cache/qc-brief/. Giọng (box3, ElevenLabs qua cổng fal, ~$0,10/1.000 ký tự) chỉ sinh khi lời đổi. Mỗi câu một cảnh; "khi" = chữ trong câu
// mà hình bật đúng lúc giọng đọc tới. Ra /Users/htuan/.cache/qc-brief/<id>/<id>.mp4 = hình + giọng + nhạc nảy + tiếng vút / con dấu / pốp.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BOX, box, len } from '../lich-su/box3.mjs';

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const DIR = dirname(fileURLToPath(import.meta.url)), KHO = `${process.env.HOME}/.cache/qc-brief`;
const tepTap = resolve(process.argv[2]), tap = JSON.parse(readFileSync(tepTap, 'utf8')), RA = join(KHO, tap.id);
mkdirSync(RA, { recursive: true });

// ---------- giọng có mốc từng chữ (box3, chỉ khi lời đổi) — mẫu không giọng (giong: false) chạy theo giây khai từng câu (cau[].giay) ----------
const COGIONG = tap.giong !== false;
const loi = tap.cau.map((c) => c.chu.trim()).join(' '), tepLoi = join(RA, 'giong.txt');
if (COGIONG && (!existsSync(join(RA, 'moc-tho.json')) || process.argv.includes('--giong-lai') || !existsSync(tepLoi) || readFileSync(tepLoi, 'utf8') !== loi)) {
  len(tepTap, `/tmp/qcb-${tap.id}.json`);
  console.log(box(`scripts/lich-su/giong.mts /tmp/qcb-${tap.id}.json /tmp/qcb-ra-${tap.id}`));
  execFileSync('scp', ['-q', `${BOX}:/tmp/qcb-ra-${tap.id}/*`, RA]); execFileSync('ssh', [BOX, `rm -rf /tmp/qcb-ra-${tap.id} /tmp/qcb-${tap.id}.json`]);
  writeFileSync(tepLoi, loi);
}
const tho = COGIONG ? JSON.parse(readFileSync(join(RA, 'moc-tho.json'), 'utf8')) : [], GIONG = COGIONG ? join(RA, 'giong.mp3') : null;
const kt = tho.flatMap((o) => o.characters.map((ch, i) => ({ ch, a: o.character_start_times_seconds[i], b: o.character_end_times_seconds[i] })));
const tu = []; let cur = null;
for (const k of kt) { if (/\s/.test(k.ch)) { if (cur) tu.push(cur); cur = null; continue; } cur ? ((cur.chu += k.ch), (cur.b = k.b)) : (cur = { chu: k.ch, a: k.a, b: k.b }); }
if (cur) tu.push(cur);

// ---------- câu → cảnh ----------
const chuan = (w) => String(w).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
let i = 0, mocKhai = 0;
const canh = tap.cau.map((c, k) => { if (!COGIONG) { const bd = mocKhai; mocKhai += c.giay; return { bd, ws: [], c: structuredClone(c.canh) }; }
  const n = c.chu.trim().split(/\s+/).length, ws = tu.slice(i, i + n); ws.forEach((w) => (w.cau = k)); i += n;
  return { bd: k ? ws[0]?.a ?? 0 : 0, ws, c: structuredClone(c.canh) }; });
if (COGIONG && i !== tu.length) console.warn(`⚠ số chữ giọng (${tu.length}) lệch số chữ kịch bản (${i}) — phụ đề / mốc "khi" có thể lệch`);
// "khi" → giây tính từ đầu cảnh: chữ đầu tiên trong câu bắt đầu bằng chữ khai (không thấy = báo, hình bật theo mặc định của trang)
const khi = (s, chu) => { const q = chuan(chu), w = s.ws.find((x) => chuan(x.chu).startsWith(q)); if (!w) { console.warn(`⚠ không thấy chữ "${chu}" trong câu: ${s.ws.map((x) => x.chu).join(' ')}`); return undefined; } return Math.max(0, w.a - s.bd); };
for (const s of canh) { if (s.c.khi) s.c._khi = khi(s, s.c.khi); if (s.c.dau?.khi) s.c.dau._khi = khi(s, s.c.dau.khi); for (const m of s.c.muc || []) if (m.khi) m._khi = khi(s, m.khi); }
const giay = COGIONG ? Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', GIONG], { encoding: 'utf8' })) : mocKhai;
const DAI = Math.round((giay + (COGIONG ? 1.8 : 0)) * 100) / 100;   // đuôi: thẻ kết đứng thêm cho người xem đọc link
canh.forEach((s, k) => { s.kt = canh[k + 1]?.bd ?? DAI; delete s.ws; });

// ---------- tài sản ----------
const url = (p) => pathToFileURL(join(KHO, p)).href, T = tap.tai_san;
const anh = { ...(T.qc ? { qc: url(T.qc) } : {}), ...Object.fromEntries((T.nen || []).map((p, k) => [`nen${k}`, url(p)])), ...Object.fromEntries(Object.entries(T.nv || {}).map(([d, p]) => [`nv_${d}`, url(p)])),
  ...Object.fromEntries(Object.entries(T.anh || {}).map(([k, p]) => [k, url(p)])) };
const cauTep = join(RA, 'cau.json');
writeFileSync(cauTep, JSON.stringify({ DAI, tu, canh, anh, page: tap.nguon_qc?.page ?? null }));

// ---------- quay ----------
const quay = (them) => { const r = spawnSync(process.execPath, [join(DIR, '../shot-code/dung.mjs'), '--trang', join(DIR, tap.trang || 'san-khau.html'), '--cau', cauTep, '--rong', '1080', '--cao', '1920', '--fps', '30', ...them], { stdio: 'inherit' }); if (r.status) process.exit(r.status); };
if (arg('soat')) { quay(['--ra', '/dev/null', '--khung', canh.map((s) => Math.min(s.kt - 0.05, s.bd + 1.6).toFixed(2)).join(','), '--khung-ra', resolve(arg('soat'))]); process.exit(0); }
const hinh = join(RA, 'hinh.mp4'), ra = join(RA, `${tap.id}.mp4`);
quay(['--ra', hinh]);

// ---------- tiếng: nhạc nảy + tiếng động khớp hình (0đ, tổng hợp số học) ----------
const SR = 48000, N = Math.ceil(DAI * SR); let hat = 7; const rnd = () => ((hat = (hat * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
const ghiWav = (f, mau) => { let dinh = 0; for (const v of mau) dinh = Math.max(dinh, Math.abs(v)); const g = dinh > 0.95 ? 0.95 / dinh : 1, n = mau.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); for (let k = 0; k < n; k++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mau[k] * g)) * 32767), 44 + k * 2); writeFileSync(f, b); };
const sfx = new Float32Array(N), dat = (t, dai, f, vol) => { const o = Math.round(t * SR); for (let k = 0; k < dai * SR && o + k < N; k++) if (o + k >= 0) sfx[o + k] += f(k / SR) * vol; };
const VUT = (t) => rnd() * Math.sin(Math.PI * Math.min(1, t / 0.45)) * (0.3 + 0.7 * (t / 0.45)) * 0.5;
const DAU = (t) => Math.sin(2 * Math.PI * (95 - 45 * t) * t) * Math.exp(-t * 12) + (t < 0.012 ? rnd() * 0.6 : 0);
const POP = (t) => Math.sin(2 * Math.PI * (900 - 500 * Math.min(1, t / 0.05)) * t) * Math.exp(-t * 30) * 0.8;
canh.forEach((s, k) => { if (k) dat(s.bd - 0.05, 0.45, VUT, 0.7);
  if (s.c.dau) dat(s.bd + (s.c.dau._khi ?? 0.9) + 0.2, 0.5, DAU, 1.0);
  for (const m of s.c.muc || []) dat(s.bd + (m._khi ?? 0.3), 0.2, POP, 0.7);
  if (s.c.loai === 'nv' || s.c.loai === 'hook') dat(s.bd + 0.3, 0.2, POP, 0.6);
  (s.c.ds || []).forEach((_, j) => dat(s.bd + 0.15 + j * 0.35, 0.2, POP, 0.6)); if (s.c.loai === 'so') dat(s.bd + (s.c._khi ?? 0.15) + 0.9, 0.5, DAU, 0.8); });
const wavSfx = join(RA, 'sfx.wav'); ghiWav(wavSfx, sfx);
// nhạc nền nảy kiểu bản tin (gảy rải C–G–Am–F 118 bpm + bass + hi-hat) — cùng tinh thần nhạc "nhay" của YNT
const m = new Float32Array(N), BUOC = 60 / 118 / 2, HOP = [[261.6, 329.6, 392, 523.3], [196, 246.9, 293.7, 392], [220, 261.6, 329.6, 440], [174.6, 220, 261.6, 349.2]], RAI = [0, 2, 1, 3, 2, 1, 3, 2];
for (let b = 0; b * BUOC < DAI; b++) { const h = HOP[Math.floor(b / 8) % 4], f = h[RAI[b % 8]], o = Math.round(b * BUOC * SR);
  for (let k = 0; k < 0.5 * SR && o + k < N; k++) { const t = k / SR; m[o + k] += (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t)) * Math.exp(-t * 9) * 0.22; }
  if (b % 4 === 0 || b % 4 === 3) for (let k = 0; k < 0.45 * SR && o + k < N; k++) { const t = k / SR; m[o + k] += Math.sin(2 * Math.PI * (h[0] / 2) * t) * Math.exp(-t * 5) * 0.32; }
  if (b % 2 === 1) for (let k = 0; k < 0.05 * SR && o + k < N; k++) m[o + k] += rnd() * Math.exp(-(k / SR) * 90) * (tap.nhac === 'manh' ? 0.16 : 0.08);
  // nhac: "manh" (mẫu trailer cắt theo phách) — thêm trống đá mỗi phách, cùng 118 bpm với BEAT của trang
  if (tap.nhac === 'manh' && b % 2 === 0) for (let k = 0; k < 0.3 * SR && o + k < N; k++) { const t = k / SR; m[o + k] += Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9) * 0.9; } }
const wavNhac = join(RA, 'nhac.wav'); ghiWav(wavNhac, m.map((v) => v * 0.25));
// không giọng: nhạc lên to hơn (0,9) — nó là tiếng chính của mẫu
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', hinh, ...(COGIONG ? ['-i', GIONG] : []), '-i', wavNhac, '-i', wavSfx,
  '-filter_complex', COGIONG ? `[1:a]volume=1.0[g];[2:a]volume=0.45,afade=t=in:d=1,afade=t=out:st=${DAI - 1.5}:d=1.5[n];[3:a]volume=0.4[s];[g][n][s]amix=inputs=3:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5[a]`
    : `[1:a]volume=0.9,afade=t=in:d=0.5,afade=t=out:st=${DAI - 1.5}:d=1.5[n];[2:a]volume=0.5[s];[n][s]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-maxrate', '5M', '-bufsize', '10M', '-pix_fmt', 'yuv420p',   // nén cho mạng xã hội (bản quay thô ~15 Mbit/s → 1 phút ≈ 100 MB)
  '-c:a', 'aac', '-b:a', '160k', '-t', String(DAI), '-movflags', '+faststart', ra], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
console.log(`${ra} · ${DAI}s · ${canh.length} cảnh · ${tu.length} chữ`);
