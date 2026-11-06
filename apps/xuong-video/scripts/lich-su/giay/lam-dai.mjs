#!/usr/bin/env node
// LÀM MỘT TẬP DÀI GHÉP GIẤY từ một sự kiện (06/11/2026). Chạy trên iMac; viết + vẽ + giọng ở box3 (ckey), dựng khung trên iMac (shot-code/dung.mjs):
//   node lam-dai.mjs --id <id> --chu-de "<sự kiện>" --nguon "Tựa wiki|Tựa wiki" [--tu 1650] [--mau <N câu đầu>] [--khung 1,8,20 --khung-ra to.jpg] [--chi-viet] [--chi-tai]
// Ra: /Users/htuan/.cache/lich-su/<id>/<id>.mp4 + <id>-chuong.txt (mốc chương cho mô tả YouTube). Tài sản đã có thì dùng lại, in tiền thật từng khâu.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { box, boxA, lenA, veA, sshA, len, ve, q, songSong, chay } from '../box3.mjs';
import { geo } from '../dia-ly.mjs';

const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; }, co = (k) => process.argv.includes(`--${k}`);
const DIR = dirname(fileURLToPath(import.meta.url)), LS = join(DIR, '..'), id = arg('id'), KHO = `${process.env.HOME}/.cache/lich-su`, RA = join(KHO, id), TAI = join(RA, 'tai'); mkdirSync(join(TAI, 'nv'), { recursive: true });
const tepTap = join(LS, 'tap', `${id}.json`), url = (f) => pathToFileURL(f).href; let tien = 0; const cong = (s) => { console.log(s); tien += Number(String(s).match(/~?(\d+)₫/)?.[1] ?? 0); };
// ---------- 1. viết ----------
if (!existsSync(tepTap)) { const bt = `/tmp/dai-${id}.json`; cong(box(`scripts/lich-su/giay/viet-dai.mts ${bt} --chu-de ${q(arg('chu-de'))} --nguon ${q(arg('nguon'))} --id ${id} --tu ${arg('tu', 1650)}`)); ve(bt, tepTap); }
const tap = JSON.parse(readFileSync(tepTap, 'utf8'));
if (co('chi-viet')) process.exit(0);
const cauDs = arg('mau') ? tap.cau.slice(0, Number(arg('mau'))) : tap.cau;
// ---------- 2. tài sản ----------
const NET = 'Handmade layered cut-paper collage, visible paper grain, flat coloured paper shapes with crisp hand-cut edges, muted earthy palette (ochre, slate blue, brick red, cream), storybook documentary';
const bcDung = new Set(cauDs.map((c) => c.boi_canh).filter(Boolean)), BC = tap.boi_canh.filter((b) => bcDung.has(b.id));
const ve1 = async (ds, thu) => { const thieu = ds.filter((d) => !existsSync(join(TAI, `${d.ten}.jpg`))); if (!thieu.length) return; const f = join(RA, `ve-${thu ? 'vat' : 'nen'}.json`), bt = `/tmp/ve-${id}-${thu ? 'v' : 'n'}`; writeFileSync(f, JSON.stringify(thieu)); await lenA(f, `${bt}.json`);
  try { cong((await boxA(`scripts/lich-su/giay/ve-giay.mts ${bt}.json ${bt}`, 20 * 60_000)).split('\n').pop()); } catch (e) { console.log(`⚠ ${String(e.stdout ?? e.message).split('\n').slice(-3).join(' ')}`); } await veA(`${bt}/.`, TAI); await sshA(`rm -rf ${bt} ${bt}.json`); };
await ve1(BC.map((b) => ({ ten: `bc-${b.id}`, ti_le: '16:9', prompt: `${NET}. Wide background scene seen as a stacked paper diorama: ${b.mo_ta_en}. No people, no text, letters or logos, no border or frame, fills the whole picture.` })), false);
const vatDs = BC.flatMap((b) => b.vat.map((v) => ({ ten: `vat-${b.id}-${v.id}`, ti_le: '3:2', prompt: `${NET}. One single cut-out: ${v.mo_ta_en}. Whole object visible, centered, on a plain pure white background, no ground, no shadow, no text, letters or logos.` })));
await ve1(vatDs, true);
await songSong(vatDs.filter((v) => existsSync(join(TAI, `${v.ten}.jpg`)) && !existsSync(join(TAI, `${v.ten}.png`))), 4, (v) => chay('swift', [join(LS, 'nen-trong.swift'), join(TAI, `${v.ten}.jpg`), join(TAI, `${v.ten}.png`)]));
// vai: kho chung kho.json (dùng lại mãi), chỉ vẽ dáng tập này dùng
const tepKho = join(LS, 'kho.json'), docKho = () => JSON.parse(readFileSync(tepKho, 'utf8'));
const canDang = new Map(); for (const c of cauDs) for (const n of c.nguoi ?? []) { if (!canDang.has(n.id)) canDang.set(n.id, new Set(['goc'])); canDang.get(n.id).add(n.dang); }
await songSong([...canDang], 3, async ([nv, ds]) => { const v = tap.nhan_vat.find((x) => x.id === nv), d = join(TAI, 'nv', nv); mkdirSync(d, { recursive: true }); const k = docKho().tai_san[nv];
  if (k?.dang) { for (const g of ds) { const u = k.dang[g] ?? k.dang.goc, f = join(d, `${g}.png`); if (!existsSync(f)) writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer())); } return; }
  const thieu = [...ds].filter((g) => !existsSync(join(d, `${g}.png`))); if (thieu.length) { const bt = `/tmp/kho-${id}-${nv}`, out = await boxA(`scripts/lich-su/kho-sinh.mts ${bt} ${q(`mota:nhan_vat:${v.mo_ta_en}`)} ${thieu.join(',')}`); cong(out.split('\n').pop()); await veA(`${bt}/.`, d); await sshA(`rm -rf ${bt}`);
    await Promise.all(readdirSync(d).filter((f) => f.endsWith('.jpg')).map((f) => chay('swift', [join(LS, 'nen-trong.swift'), join(d, f), join(d, f.replace('.jpg', '.png'))]))); }
  if (arg('mau')) return;   // bản mẫu chưa đẩy vai vào kho chung — chỉ tập trọn vẹn mới đẩy, kẻo thiếu dáng vĩnh viễn trong kho
  const png = readdirSync(d).filter((f) => f.endsWith('.png')).map((f) => join(d, f)), bt = `/tmp/kho-day-${id}-${nv}`; await sshA(`rm -rf ${bt} && mkdir -p ${bt}`); await lenA(png, `${bt}/`);
  const kq = JSON.parse((await boxA(`scripts/lich-su/kho-day.mts ${bt} ${nv} nhan_vat ${q(v.ten)} ${q(v.mo_ta_en)} ${v.tu} ${v.den}`)).split('\n').pop()); await sshA(`rm -rf ${bt}`);
  const K = docKho(); K.tai_san[nv] = { loai: 'nhan_vat', ten: v.ten, tu: v.tu, den: v.den, ghi: v.mo_ta_en, nguon: 'AI vẽ (ckey Nano Banana 2) + tách nền Vision', studio_thanh_phan: kq.thanh_phan, dang: kq.dang, tap_dau: id }; writeFileSync(tepKho, JSON.stringify(K, null, 1) + '\n'); });
// ảnh thật
const UA = { 'User-Agent': 'studio-lich-su/1.0 (studio.on.tc; admin@mixseo.net)' };
for (const k of new Set(cauDs.map((c) => c.anh).filter(Boolean))) { const f = join(TAI, `${k}.jpg`); if (existsSync(f)) continue; const a = tap.anh[k]; const r = await fetch(a.thumb, { headers: UA }); if (!r.ok) { console.log(`⚠ ảnh ${k} ${r.status}`); continue; } writeFileSync(`${f}.tam`, Buffer.from(await r.arrayBuffer())); execFileSync('sips', ['-s', 'format', 'jpeg', '--resampleWidth', '1500', `${f}.tam`, '--out', f], { stdio: 'ignore' }); execFileSync('rm', [`${f}.tam`]); await new Promise((o) => setTimeout(o, 800)); }
console.log(`tài sản xong · tiền tới đây ~${Math.round(tien)}₫`);
if (co('chi-tai')) process.exit(0);
// ---------- 3. giọng: mỗi khúc ≤ 950 ký tự trong cùng chương, ckey 156₫ / khúc ----------
const GD = join(RA, 'giong'); mkdirSync(GD, { recursive: true }); const giong = tap.giong?.voice ?? 'Daniel', khuc = [];
cauDs.forEach((c, i) => { const cuoi = khuc.at(-1); if (cuoi && cuoi.chuong === c.chuong && cuoi.chu.length + c.chu.length < 950) { cuoi.chu += ` ${c.chu}`; cuoi.cau.push(i); } else khuc.push({ chuong: c.chuong, chu: c.chu, cau: [i] }); });
for (const k of khuc) k.khoa = createHash('sha1').update(`${giong}\n${k.chu}`).digest('hex').slice(0, 16);
const thieuG = khuc.filter((k) => !existsSync(join(GD, `${k.khoa}.mp3`)));
if (thieuG.length) { const f = join(RA, 'yeu-cau-giong.json'), bt = `/tmp/giong-${id}`; writeFileSync(f, JSON.stringify({ giong, cau: thieuG.map((k) => ({ khoa: k.khoa, chu: k.chu })) })); len(f, `${bt}.json`); cong(box(`scripts/lich-su/giong-ckey.mjs ${bt}.json ${bt}`).split('\n').pop().replace('tiền ', '~')); ve(`${bt}/.`, GD); execFileSync('ssh', ['root@167.233.241.16', `rm -rf ${bt} ${bt}.json`]); }
const dai_ = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }));
const NGHI = 0.3, NGHI_CHUONG = 0.9; let moc = 0; const mocCau = [], tronTiep = [];
khuc.forEach((k, ki) => { const f = join(GD, `${k.khoa}.mp3`), D = dai_(f), lng = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'silencedetect=noise=-35dB:d=0.14', '-f', 'null', '-'], { encoding: 'utf8' }).stderr, st = [...lng.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]), en = [...lng.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]), lang = st.map((a, i) => (a + (en[i] ?? a)) / 2);
  const tong = k.cau.reduce((s, i) => s + cauDs[i].chu.length, 0); let da = 0, truoc = 0; k.cau.forEach((i, j) => { da += cauDs[i].chu.length; let b = j === k.cau.length - 1 ? D : D * da / tong; if (j < k.cau.length - 1) { const g = lang.filter((x) => Math.abs(x - b) < 0.9 && x > truoc + 0.5).sort((x, y) => Math.abs(x - b) - Math.abs(y - b))[0]; if (g) b = g; } mocCau[i] = { a: moc + truoc, b: moc + b }; truoc = b; });
  tronTiep.push({ f, t: moc }); moc += D + (khuc[ki + 1]?.chuong !== k.chuong ? NGHI_CHUONG : NGHI); });
const DAI = Math.round((moc + 1) * 100) / 100, phut = Math.max(1, Math.round(DAI / 60));
// ---------- 4. CAU cho trang ----------
const anh = {}, canh = cauDs.map((c, i) => { const ct = { ...c }; if (c.loai === 'san_khau') { const b = BC.find((x) => x.id === c.boi_canh), nen = `bc-${b.id}`; if (existsSync(join(TAI, `${nen}.jpg`))) anh[nen] = url(join(TAI, `${nen}.jpg`));
    ct.bc = { nen, mau_dat: b.mau_dat, tien_canh: b.tien_canh, hieu_ung: b.hieu_ung, vat: b.vat.map((v) => { const k = `vat-${b.id}-${v.id}`; if (existsSync(join(TAI, `${k}.png`))) anh[k] = url(join(TAI, `${k}.png`)); return { anh: k, x: v.x, cao: v.cao, sau: v.sau }; }) };
    ct.nguoi = (c.nguoi ?? []).map((n) => { for (const g of ['goc', n.dang]) { const f = join(TAI, 'nv', n.id, `${g}.png`); if (existsSync(f)) anh[`${n.id}:${g}`] = url(f); } return { anh: n.id, dang: n.dang, x: n.x, ten: tap.nhan_vat.find((v) => v.id === n.id)?.ten }; }); }
  if (c.anh && existsSync(join(TAI, `${c.anh}.jpg`))) anh[c.anh] = url(join(TAI, `${c.anh}.jpg`));
  const kt = i < cauDs.length - 1 ? (mocCau[i].b + mocCau[i + 1].a) / 2 : DAI, bd = i ? (mocCau[i - 1].b + mocCau[i].a) / 2 : 0; return { bd, kt, c: ct, ...(i === 0 || cauDs[i - 1].chuong !== c.chuong ? { chuong_moi: { so: c.chuong + 1, ten: tap.chuong[c.chuong].ten } } : {}) }; });
const phu = cauDs.flatMap((c, i) => { const ws = c.chu.split(/\s+/), dong = []; let d = ''; for (const w of ws) { if ((d + w).length > 58 && d) { dong.push(d.trim()); d = ''; } d += `${w} `; } dong.push(d.trim()); const { a, b } = mocCau[i], n = c.chu.length; let da = 0; return dong.map((x) => { const s = a + (b - a) * da / n; da += x.length + 1; return { a: s, b: a + (b - a) * da / n, chu: x.replace(/[.,;:]+$/, '') }; }); });
const ds = canh.filter((s) => s.c.ban_do).flatMap((s) => [s.c.ban_do.tam]), hop = ds.length ? [Math.min(...ds.map((o) => o[0])) - 50, Math.min(...ds.map((o) => o[1])) - 32, Math.max(...ds.map((o) => o[0])) + 50, Math.max(...ds.map((o) => o[1])) + 32] : null, G = {};
if (hop) for (const f of geo.features) { const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; for (const p of polys) { const xs = p[0].map((v) => v[0]), ys = p[0].map((v) => v[1]); if (Math.max(...xs) < hop[0] || Math.min(...xs) > hop[2] || Math.max(...ys) < hop[1] || Math.min(...ys) > hop[3]) continue; (G[f.properties.ADM0_A3] ||= []).push(p[0].map(([a, b]) => [Math.round(a * 100) / 100, Math.round(b * 100) / 100])); } }
const cauTep = join(RA, 'cau.json'), cauObj = { DAI, anh, giay: url(join(KHO, 'giay.jpg')), geo: G, phu, canh }; writeFileSync(cauTep, JSON.stringify(cauObj));
const TRANG = join(DIR, 'giay-lop.html'), dung = (them) => { const r = spawnSync(process.execPath, [join(LS, '../shot-code/dung.mjs'), '--trang', TRANG, '--cau', cauTep, '--rong', '1920', '--cao', '1080', '--fps', '30', ...them], { stdio: 'inherit' }); if (r.status) process.exit(r.status); };
console.log(`${cauDs.length} câu · ${DAI.toFixed(0)} s · ${Object.keys(anh).length} ảnh`);
if (arg('khung')) { dung(['--ra', '/dev/null', '--khung', arg('khung'), '--khung-ra', arg('khung-ra')]); process.exit(0); }
// ---------- 5. hình, tiếng ----------
const h = (o) => createHash('sha1').update(typeof o === 'string' ? o : JSON.stringify(o)).digest('hex').slice(0, 16), goc = h([readFileSync(TRANG, 'utf8'), Object.keys(anh).length]);
const doanTep = join(RA, 'doan.json'); writeFileSync(doanTep, JSON.stringify(canh.map((s, k) => ({ bd: s.bd, khoa: h([goc, canh[k - 1]?.c ?? null, s, phu.filter((p) => p.b > s.bd && p.a < s.kt)]) }))));
const hinh = join(RA, 'hinh.mp4'); dung(['--ra', hinh, '--doan', doanTep, '--kho', join(KHO, '_doan')]);
// tiếng: giọng đặt đúng mốc + nhạc gảy + xoạt giấy khi đổi cảnh + thịch khi đóng dấu (số học, 0đ)
const SR = 44100, N = Math.ceil(DAI * SR), sfx = new Float32Array(N), nhac = new Float32Array(N); let hat = 5; const rnd = () => ((hat = (hat * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
const dat = (arr, t, len_, f, v) => { const o = Math.round(t * SR); for (let i = 0; i < len_ * SR && o + i < N; i++) arr[o + i] += f(i / SR) * v; };
let nhomTr = null; canh.forEach((s) => { const n = s.c.loai === 'san_khau' ? s.c.boi_canh : s.c.loai; if (n !== nhomTr && s.bd > 0 && s.c.loai !== 'ban_do') dat(sfx, s.bd, 0.55, (t) => rnd() * Math.sin(Math.PI * t / 0.55) ** 2 * (Math.sin(t * 120) > 0 ? 1 : 0.45) * 0.5, 0.55); nhomTr = n; if (s.c.dau) dat(sfx, s.bd + 0.6, 0.45, (t) => Math.sin(2 * Math.PI * (92 - 40 * t) * t) * Math.exp(-t * 11), 0.9); if (s.c.so) dat(sfx, s.bd + 0.3, 0.2, (t) => Math.sin(2 * Math.PI * 660 * t) * Math.exp(-t * 26), 0.3); });
const HOP = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]], BUOC = 60 / 84 / 2;
for (let b = 0; b * BUOC < DAI; b++) { const t = b * BUOC, hh = HOP[Math.floor(b / 8) % 4], f = hh[[0, 2, 1, 2][b % 4]] * (b % 16 > 11 ? 2 : 1); dat(nhac, t, 0.7, (u) => (Math.sin(2 * Math.PI * f * u) + 0.3 * Math.sin(4 * Math.PI * f * u)) * Math.exp(-u * 6), 0.14); if (b % 8 === 0) dat(nhac, t, 1.8, (u) => Math.sin(Math.PI * hh[0] * u) * Math.exp(-u * 1.8), 0.22); }
const wav = (f, a) => { let d = 0; for (const v of a) d = Math.max(d, Math.abs(v)); const g = d > 0.95 ? 0.95 / d : 1, b = Buffer.alloc(44 + a.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + a.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(a.length * 2, 40); for (let i = 0; i < a.length; i++) b.writeInt16LE(Math.round(a[i] * g * 32767), 44 + i * 2); writeFileSync(f, b); };
wav(join(RA, 'sfx.wav'), sfx); wav(join(RA, 'nhac.wav'), nhac);
const vao = tronTiep.flatMap((k) => ['-i', k.f]), loc = tronTiep.map((k, i) => `[${i + 1}:a]adelay=${Math.round(k.t * 1000)}:all=1[g${i}]`).join(';'), nG = tronTiep.length;
const giongRa = join(RA, 'giong-tron.wav'); { const lo = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-t', String(DAI), '-i', 'anullsrc=r=44100:cl=mono', ...vao, '-filter_complex', `${loc};[0:a]${tronTiep.map((_, i) => `[g${i}]`).join('')}amix=inputs=${nG + 1}:normalize=0:duration=first[a]`, '-map', '[a]', giongRa], { stdio: 'inherit' }); if (lo.status) process.exit(lo.status); }
const ra = join(RA, `${id}.mp4`), r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', hinh, '-i', giongRa, '-i', join(RA, 'nhac.wav'), '-i', join(RA, 'sfx.wav'), '-filter_complex', `[1:a]asplit=2[g][gk];[2:a]volume=0.5,afade=t=out:st=${DAI - 2}:d=2[n];[3:a]volume=0.6[s];[n][gk]sidechaincompress=threshold=0.05:ratio=5:release=500[nn];[g][nn][s]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-t', String(DAI), '-movflags', '+faststart', ra], { stdio: 'inherit' }); if (r.status) process.exit(r.status);
const hh2 = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; writeFileSync(join(RA, `${id}-chuong.txt`), canh.filter((s) => s.chuong_moi).map((s) => `${hh2(s.bd)} ${s.chuong_moi.ten}`).join('\n') + '\n');
console.log(`✓ ${ra} · ${DAI.toFixed(0)} s (~${phut} phút) · tiền lượt này ~${Math.round(tien)}₫ · tiêu đề: ${tap.tieu_de.replace('{N}', phut)}`);
