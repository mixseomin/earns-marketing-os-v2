#!/usr/bin/env node
// NẠP TẬP ĐÃ DỰNG VÀO MÁY ĐĂNG (G7 kênh Astrolas, 07/11/2026) — chỉ NẠP, không đăng: đẩy bản phát hành + khung hình lên R2 (day-demo.mts nhánh tap, tên tệp mang dấu nội dung vì CDN giữ bản cũ),
// rồi đúng cổng chung may-dung.mts --nap → --xuat (mẫu video-ngoai). Phòng Nội dung chấm ở lượt kế; máy đăng (dang-may.mjs) tự lấy bài DUYỆT theo nhịp an toàn.
//   node nap-tap.mjs --tap ../shot-code/tap-astrolas/my-saturn.json --video brand/astrolas/ra/g6-my-saturn.mp4
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, GOC_BOX } from './box3.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const TRAN_TIEU_DE = 100;   // YouTube cắt ở 100 ký tự
/** tiêu đề ≤ 100 ký tự: giữ NGUYÊN câu hook (luật hook), rút phần đuôi về tên người ("Steve Jobs's year in…" → "Steve Jobs", "Jolie: a life…" → "Jolie"), còn dài thì chỉ hook. Thuần. */
export function gonTieuDe(tieuDe, hook) {
  if (tieuDe.length <= TRAN_TIEU_DE) return tieuDe;
  const duoi = tieuDe.startsWith(hook) ? tieuDe.slice(hook.length).trim() : '', ngan = duoi.split(/'s\b|:|,/)[0].trim(), thu = `${hook} ${ngan}`;
  return ngan && thu.length <= TRAN_TIEU_DE ? thu : hook;
}
if (process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert'), h = 'What if your birth chart could show you how you naturally relate to money?';
  t.equal(gonTieuDe(`${h} Steve Jobs's year in Annual Profections`, h), `${h} Steve Jobs`); t.equal(gonTieuDe('ngắn', 'ngắn'), 'ngắn'); t.equal(gonTieuDe(`${'x'.repeat(99)} đuôi dài`, 'x'.repeat(99)), 'x'.repeat(99));
  console.log('nap-tap: tự kiểm đạt'); process.exit(0);
}
const tepTap = arg('tap'), video = arg('video'); if (!tepTap || !video) { console.error('dùng: --tap <tập.json> --video <bản dựng.mp4>'); process.exit(2); }
const tap = JSON.parse(readFileSync(resolve(tepTap), 'utf8')), so = docSo()[tap.kenh], id = tap.y_tuong;
const loi = kiemTap(tap, so, tap.kenh); if (loi.length) { console.error(`✗ ${id} trái sổ kênh:\n${loi.map((l) => `   · ${l}`).join('\n')}`); process.exit(3); }
// video phải khớp hook của tập: tập viết lại sau khi dựng thì tiếng đọc đã cũ
const soVideo = JSON.parse(readFileSync(join(DIR, `hook-kho/${tap.kenh}-video.json`), 'utf8'))[id]; if (soVideo?.chu !== tap.hook?.goc) { console.error(`✗ ${id}: hook của tập khác hook trong video đã dựng — dựng lại trước khi nạp`); process.exit(3); }
const pl = so.playlist.find((p) => p.ma === tap.playlist_ma), nguon = JSON.parse(readFileSync(join(DIR, `brand/${tap.kenh}/anh/nen/nguon.json`), 'utf8')).anh[pl.ma]; if (!nguon?.pexels_id) { console.error(`✗ playlist ${pl.ma} thiếu nguồn ảnh nền`); process.exit(3); }
const dau = (b) => createHash('md5').update(b).digest('hex').slice(0, 10), bMp4 = readFileSync(resolve(video)), TAM = mkdtempSync(join(tmpdir(), 'nap-tap-')), ten = `${id}-${dau(bMp4)}`;
copyFileSync(resolve(video), join(TAM, `${ten}.mp4`));
const giay = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', resolve(video)], { encoding: 'utf8' }));
const cat = (tl, tenAnh) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(giay * tl), '-i', resolve(video), '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4', join(TAM, `${tenAnh}.jpg`)]);
const K = [0.12, 0.5, 0.85], S = Array.from({ length: 8 }, (_, i) => 0.05 + (i * 0.9) / 7);   // 3 khung + 8 keyframe rải đều cho Phòng Nội dung xem hình
K.forEach((x, i) => cat(x, `${ten}-k${i}`)); S.forEach((x, i) => cat(x, `${ten}-s${i}`));
const bt = `/var/tmp/nap-tap-${id}`, tsx = (lenh) => execFileSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server timeout 300s ../../node_modules/.bin/tsx ${lenh}`], { encoding: 'utf8', maxBuffer: 16 << 20 });
try {
  execFileSync('ssh', [BOX, `rm -rf ${bt} && mkdir -p ${bt}/f`]); execFileSync('sh', ['-c', `scp -q ${TAM}/* ${BOX}:${bt}/f/`]);
  const u = JSON.parse(tsx(`scripts/lich-su/day-demo.mts ${tap.kenh} ${bt}/f tap`).trim().split('\n').pop());
  const nap = [{ slug: id, chu_de: tap.tieu_de.replace(tap.hook.goc, '').trim() || tap.tieu_de, mau: 'video-ngoai', nen_url: `https://images.pexels.com/photos/${nguon.pexels_id}/pexels-photo-${nguon.pexels_id}.jpeg`,
    de: { loai: 'video-ngoai', video_url: u[ten], giay: Math.round(giay * 100) / 100, khung: K.map((_, i) => u[`${ten}-k${i}`]), soat: S.map((_, i) => u[`${ten}-s${i}`]), tom_tat: tap.tieu_de, thumb: null },
    dang: { title: gonTieuDe(tap.tieu_de, tap.cau[0].chu), description: `${tap.dang.mo_ta}\n\nMade by the Astrolas team.`, link: tap.dang.link, goc: tap.goc, hook: tap.hook, playlist: tap.playlist_ma, mau: tap.mau, y_tuong: id } }];
  writeFileSync(join(TAM, 'nap.json'), JSON.stringify(nap)); execFileSync('scp', ['-q', join(TAM, 'nap.json'), `${BOX}:${bt}/nap.json`]);
  console.log(tsx(`scripts/may-dung.mts --may ${tap.kenh} --nap < ${bt}/nap.json`).trim().split('\n').pop()); console.log(tsx(`scripts/may-dung.mts --may ${tap.kenh} --xuat ${id}`).trim().split('\n').pop());
  console.log(`✓ nạp ${id} · "${nap[0].dang.title}" (${nap[0].dang.title.length} ký tự) · ${(bMp4.length / 1e6).toFixed(1)} MB · Phòng Nội dung chấm ở lượt kế`);
} finally { try { execFileSync('ssh', [BOX, `rm -rf ${bt}`]); } catch { /* đã xong */ } rmSync(TAM, { recursive: true, force: true }); }
