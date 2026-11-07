#!/usr/bin/env node
// LỒNG TIẾNG một tập shot-code (05/11/2026, anh: "bổ sung thêm âm thanh + voice"): CAU (vd mau-chart-vs-chart.json) → giọng đọc từng câu (ckey) + nhạc nền + tiếng động
// → video có tiếng. Dùng chung mọi trang shot-code (la-so.html, giang-troi.html…) và mọi kênh có sổ kênh (so-kenh.json › <kênh>.am_thanh { giong, nhac }).
//   node long-tieng.mjs --cau mau-chart-vs-chart.json --ra /đường/ra.mp4 [--trang la-so.html] [--rong 1920 --cao 1080] [--giong-lai] [--khung 2,8 --khung-ra k.jpg]
// 1. Lời đọc mỗi câu = q.doc nếu có, không thì chữ trên màn q.chu (bỏ <br>). Giọng qua CKEY (anh 05/11/2026 "Ckey cũng có voice này"): ElevenLabs của người bán
//    Speakvela, 156₫ / câu (lich-su/giong-ckey.mjs chạy trên box3, khoá không rời máy chủ). Mỗi câu một lượt, nhớ theo (giọng + chữ) ở ~/.cache/shot-code-giong/cau —
//    sửa một câu chỉ đọc lại câu đó, lời không đổi thì 0đ.
// 2. Mốc cảnh theo tiếng: cảnh i dài = tiếng câu i (đã cắt lặng hai đầu) + 0,3 s vào + 0,45 s nghỉ, tối thiểu 2,6 s cho kịp đọc chữ; cảnh cuối thêm 1,2 s.
// 3. Dựng hình bằng dung.mjs (CAU mới) rồi trộn: giọng · nhạc nền tự sinh 0đ (troi = hợp âm mở thở chậm, không bản quyền) nhún xuống khi có tiếng đọc ·
//    tiếng "vút" nhẹ mỗi lần đổi cảnh · tiếng chuông nhỏ khi thẻ số / thanh điểm hiện. Chuẩn âm lượng −14 LUFS (YouTube).
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, box } from '../lich-su/box3.mjs';
import { nenH264 } from '../../src/lib/xuong-video/nen-video.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const tepCau = arg('cau'), ra = arg('ra'); if (!tepCau || !ra) { console.error('dùng: --cau <CAU.json> --ra <ra.mp4>'); process.exit(2); }
const C = JSON.parse(readFileSync(resolve(tepCau), 'utf8')), SO = JSON.parse(readFileSync(join(DIR, '../lich-su/so-kenh.json'), 'utf8'));
const AM = { giong: 'Charlotte', nhac: 'troi', ...(SO[C.kenh]?.am_thanh ?? {}) };
const sach = (s) => s.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// NHÓM ĐỌC: các khung tách từ cùng một câu (chu-man.mjs › tachCanh đánh dấu tiep) đọc CHUNG một lượt — giọng liền câu, một lượt ckey, rồi chia khung theo chữ
const nhom = []; C.cau.forEach((q, i) => { if (q.tiep && nhom.length) nhom.at(-1).push(i); else nhom.push([i]); });
const loi = nhom.map((ds) => sach(ds.map((i) => C.cau[i].doc ?? C.cau[i].chu).join(' ').replace(/…/g, '')));
const CACHE = join(process.env.HOME, '.cache/shot-code-giong', basename(tepCau, '.json')); mkdirSync(CACHE, { recursive: true });

// ---------- 1. giọng từng câu (box3 qua ckey, chỉ câu chưa có) ----------
const KHO = join(process.env.HOME, '.cache/shot-code-giong/cau'); mkdirSync(KHO, { recursive: true });
const khoa = loi.map((l) => createHash('sha1').update(`${AM.giong}\n${l}`).digest('hex').slice(0, 16));
const thieu = loi.map((chu, i) => ({ khoa: khoa[i], chu })).filter((c) => process.argv.includes('--giong-lai') || !existsSync(join(KHO, `${c.khoa}.mp3`)));
if (thieu.length) {
  const ten = `sc-${basename(tepCau, '.json')}`, tam = join(CACHE, 'yeu-cau.json');
  writeFileSync(tam, JSON.stringify({ giong: AM.giong, engine: 'v3', cau: [...new Map(thieu.map((c) => [c.khoa, c])).values()] }));
  execFileSync('scp', ['-q', tam, `${BOX}:/tmp/${ten}.json`]);
  console.log(execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && node - /tmp/${ten}.json /tmp/${ten}`],
    { input: readFileSync(join(DIR, '../lich-su/giong-ckey.mjs')), encoding: 'utf8' }).trim());   // chạy bản trong repo của máy này, khoá ckey ở box
  execFileSync('scp', ['-q', ...thieu.map((c) => `${BOX}:/tmp/${ten}/${c.khoa}.mp3`), KHO]);
  execFileSync('ssh', [BOX, `rm -f /tmp/${ten}.json /tmp/${ten}/*.mp3 && rmdir /tmp/${ten}`]);
} else console.log('= mọi câu đã có giọng — 0đ');
// cắt lặng hai đầu mỗi câu → wav 48 kHz, đo độ dài thật
const giay = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }));
const cat = khoa.map((k) => { const f = join(KHO, `${k}.cat.wav`);
  if (!existsSync(f)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(KHO, `${k}.mp3`), '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,aresample=48000', f]);
  return { f, d: giay(f) }; });

// ---------- 2. mốc cảnh theo tiếng ----------
const VAO = 0.3, NGHI = 0.45, TOI_THIEU = 2.6, KHUNG_TOI_THIEU = 1.8, tron = (x) => Math.round(x * 100) / 100; let t = 0;
const cau = [], batDau = [];
nhom.forEach((ds, g) => { const cuoi = g === nhom.length - 1, dai = Math.max(TOI_THIEU, VAO + cat[g].d + NGHI) + (cuoi ? 1.2 : 0);
  const chu = ds.map((i) => sach(C.cau[i].chu).length), tong = chu.reduce((a, b) => a + b, 0); batDau.push(t);
  let u = t; ds.forEach((i, k) => { const d = k === ds.length - 1 ? t + dai - u : Math.max(KHUNG_TOI_THIEU, (dai * chu[k]) / tong); cau.push({ ...C.cau[i], tu: tron(u), den: tron(u + d) }); u += d; });
  t = tron(t + dai); });
const DAI = cau.at(-1).den;
const C2 = { ...C, DAI, cau }, tepC2 = join(dirname(resolve(tepCau)), `.${basename(tepCau, '.json')}.tieng.json`);
writeFileSync(tepC2, JSON.stringify(C2));   // cùng thư mục CAU gốc: đường ảnh / lá số tương đối vẫn đúng
// dải giọng: từng câu đặt đúng giây vào của cảnh
const tepGiong = join(CACHE, 'giong.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...cat.flatMap((c) => ['-i', c.f]), '-filter_complex',
  cat.map((_, i) => `[${i}:a]adelay=${Math.round((batDau[i] + VAO) * 1000)}:all=1[c${i}]`).join(';') + ';' + cat.map((_, i) => `[c${i}]`).join('') + `amix=inputs=${cat.length}:normalize=0,apad,atrim=0:${DAI}[a]`, '-map', '[a]', tepGiong]);
const moi = thieu.length;

// ---------- 3. hình + trộn tiếng ----------
const hinh = join(CACHE, 'hinh.mp4'), dung = ['dung.mjs', '--trang', arg('trang', 'la-so.html'), '--cau', tepC2, ...(arg('rong') ? ['--rong', arg('rong'), '--cao', arg('cao')] : [])];
if (arg('khung')) { execFileSync('node', [...dung, '--khung', arg('khung'), '--khung-ra', arg('khung-ra')], { cwd: DIR, stdio: 'inherit' }); process.exit(0); }
execFileSync('taskpolicy', ['-b', 'node', ...dung, '--ra', hinh], { cwd: DIR, stdio: 'inherit' });
const SR = 48000, N = Math.ceil(DAI * SR), sfx = new Float32Array(N); let hat = 7;
const rnd = () => ((hat = (hat * 16807) % 2147483647) / 2147483647) * 2 - 1;
const vut = (t0) => { const o = Math.round(t0 * SR), L = 0.55 * SR; let lp = 0; for (let i = 0; i < L && o + i < N; i++) { const u = i / L, a = Math.sin(Math.PI * u) ** 2 * 0.22; lp += (rnd() - lp) * (0.02 + 0.25 * u); sfx[o + i] += lp * a; } };
const chuong = (t0) => { const o = Math.round(t0 * SR); for (let i = 0; i < 1.6 * SR && o + i < N; i++) { const t = i / SR; sfx[o + i] += (Math.sin(2 * Math.PI * 1318.5 * t) + 0.5 * Math.sin(2 * Math.PI * 1975.5 * t)) * Math.exp(-t * 3.2) * 0.07; } };
cau.forEach((q, i) => { if (i) vut(Math.max(0, q.tu - 0.15)); if (q.the || q.nhin?.diem) chuong(q.tu + 0.35); });
const ghiWav = (f, mau) => { let dinh = 0; for (const v of mau) dinh = Math.max(dinh, Math.abs(v)); const g = dinh > 0.95 ? 0.95 / dinh : 1, n = mau.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mau[i] * g)) * 32767), 44 + i * 2); writeFileSync(f, b); };
const tepSfx = join(CACHE, 'sfx.wav'); ghiWav(tepSfx, sfx);
// nhạc nền 0đ: troi = hợp âm Dmaj9 mở (D–A–E–F#) thở chậm + lấp lánh cao rất nhỏ — không bản quyền, đổi theo am_thanh.nhac của kênh
const NHAC = { troi: '0.05*sin(2*PI*73.4*t)*(0.7+0.3*sin(2*PI*0.07*t))+0.04*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.05*t+1))+0.03*sin(2*PI*164.8*t)*(0.6+0.4*sin(2*PI*0.09*t+2))+0.025*sin(2*PI*185*t)*(0.5+0.5*sin(2*PI*0.04*t+3))+0.006*sin(2*PI*1480*t)*(0.5+0.5*sin(2*PI*0.3*t))' };
// OUTRO LOGO (anh 05/11/2026): sổ kênh › <kênh>.outro { doc, ngang } → nối vào cuối tập (Short 1 s, video dài 3 s); thiếu tệp thì dựng bằng outro.mjs của kênh (0đ)
// outro theo PLAYLIST của tập (ra/outro-<khung>-<playlist>.mp4, nền = nền playlist) — chưa có thì dựng; playlist không có nền → bộ chung (nền navy của site)
const OUT = SO[C.kenh]?.outro, plTap = C.playlist_ma ?? C.playlist?.ma, coNenPl = (SO[C.kenh]?.playlist ?? []).some((p) => p.ma === plTap && p.nen);
const tepOutro = OUT && join(DIR, '../lich-su', OUT[C.khung === 'ngang' ? 'ngang' : 'doc'].replace(/\.mp4$/, coNenPl ? `-${plTap}.mp4` : '.mp4'));
if (tepOutro && !existsSync(tepOutro)) execFileSync(process.execPath, [join(dirname(tepOutro), '../outro.mjs'), ...(coNenPl ? ['--pl', plTap] : [])], { stdio: 'inherit' });
const coOutro = tepOutro && existsSync(tepOutro), [RW, RH] = C.khung === 'ngang' ? [1920, 1080] : [1080, 1920];
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', hinh, '-i', tepGiong, '-f', 'lavfi', '-t', String(DAI), '-i', `aevalsrc='${NHAC[AM.nhac] ?? NHAC.troi}':s=${SR}`, '-i', tepSfx, ...(coOutro ? ['-i', tepOutro] : []),
  '-filter_complex', `[1:a]aresample=${SR},volume=1.0,asplit=2[g][gk];[2:a]volume=0.55,afade=t=in:d=1.2,afade=t=out:st=${DAI - 1.6}:d=1.6[n0];[n0][gk]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[n];[3:a]volume=0.6[s];[g][n][s]amix=inputs=3:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5` +
    (coOutro ? `,atrim=0:${DAI},aresample=48000[a0];[0:v]trim=0:${DAI},setpts=PTS-STARTPTS,fps=30,scale=${RW}:${RH},setsar=1[v0];[4:v]fps=30,scale=${RW}:${RH},setsar=1[v1];[4:a]aresample=48000[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]` : '[a]'),
  // hình nén lại thành BẢN PHÁT HÀNH (crf 23, như máy làm tập): bản trung gian của dung.mjs là 16 Mbit/s — chép thẳng ra 92 MB cho 46 giây (05/11/2026)
  '-map', coOutro ? '[v]' : '0:v', '-map', '[a]', ...nenH264({ crf: 23, preset: 'medium' }), '-c:a', 'aac', '-b:a', '160k', ...(coOutro ? [] : ['-t', String(DAI)]), '-movflags', '+faststart', resolve(ra)], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
// sổ hook video đã dựng (lich-su/hook-kenh.mjs): tập khác của kênh không mở bằng cùng câu hook
if (C.hook?.goc) (await import('../lich-su/hook-kenh.mjs')).ghiHookVideo(C, resolve(ra));
console.log(`✓ ${ra} · ${DAI}s${coOutro ? ` + outro ${C.khung === 'ngang' ? 3 : 1}s` : ''} · ${cau.length} khung / ${nhom.length} lượt đọc · giọng ${AM.giong} (ckey) · tiền giọng lượt này ${moi * 156}₫${moi < nhom.length ? ` (${nhom.length - moi} lượt dùng lại)` : ''}`);
