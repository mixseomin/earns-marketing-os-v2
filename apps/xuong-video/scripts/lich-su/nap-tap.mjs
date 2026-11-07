#!/usr/bin/env node
// NẠP TẬP ĐÃ DỰNG VÀO MÁY ĐĂNG (G7 kênh Astrolas, 07/11/2026) — chỉ NẠP, không đăng: đẩy bản phát hành + khung hình lên R2 (day-demo.mts nhánh tap, tên tệp mang dấu nội dung vì CDN giữ bản cũ),
// rồi đúng cổng chung may-dung.mts --nap → --xuat (mẫu video-ngoai). Phòng Nội dung chấm ở lượt kế; máy đăng (dang-may.mjs) tự lấy bài DUYỆT theo nhịp an toàn.
//   node nap-tap.mjs --tap ../shot-code/tap-astrolas/my-saturn.json --video brand/astrolas/ra/g6-my-saturn.mp4 [--dang-tu YYYY-MM-DD] [--dang-den YYYY-MM-DD]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, GOC_BOX } from './box3.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { dungBia } from './thumb-kenh.mjs';
import { ghiTacGia } from './anh-wiki.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const TRAN_TIEU_DE = 100;   // YouTube cắt ở 100 ký tự
/** tiêu đề ≤ 100 ký tự: dài quá thì chỉ giữ câu hook (Ngọc chê đuôi cụt "…relate to money? Steve Jobs", 07/11/2026). Thuần. */
export const gonTieuDe = (tieuDe, hook) => (tieuDe.length <= TRAN_TIEU_DE ? tieuDe : hook);
/** giây cắt khung chấm: giữa MẢNH ĐẦU của từng cảnh theo mốc giờ thật sau lồng tiếng — chia đều thì trúng lúc chữ đang mờ chuyển cảnh, Ngọc chê "chữ chìm" oan (Leonids 07/11/2026). Thuần. */
export function giayCanh(cau, soKhung) {
  const g = cau.map((q) => { const d = q.den - q.tu, m = (q.manh ?? [q.chu]).map((x) => String(x).length), tong = m.reduce((a, b) => a + b, 0) || 1; return q.tu + (d * m[0]) / tong / 2; });
  return Array.from({ length: Math.min(soKhung, g.length) }, (_, i) => g[Math.round((i * (g.length - 1)) / Math.max(1, Math.min(soKhung, g.length) - 1))]);
}
if (process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert'), h = 'What if your birth chart could show you how you naturally relate to money?';
  t.equal(gonTieuDe(`${h} Steve Jobs's year in Annual Profections`, h), h); t.equal(gonTieuDe('ngắn', 'x'), 'ngắn');
  t.deepEqual(giayCanh([{ tu: 0, den: 4, chu: 'a' }, { tu: 4, den: 8, chu: 'ab', manh: ['a', 'b'] }], 8), [2, 5]);
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
const cat = (g, tenAnh) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(g), '-i', resolve(video), '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4', join(TAM, `${tenAnh}.jpg`)]);
// mốc giờ THẬT sau lồng tiếng: long-tieng.mjs ghi .<tập>.tieng.json cạnh tệp tập
const C2 = JSON.parse(readFileSync(join(dirname(resolve(tepTap)), `.${basename(tepTap, '.json')}.tieng.json`), 'utf8')), K = giayCanh(C2.cau, 3), S = giayCanh(C2.cau, 8);   // 3 khung + 8 keyframe cho Phòng Nội dung xem hình
// tên ảnh mang dấu của CHÍNH ẢNH: cùng video mà cắt lại khung thì tên trùng → CDN trả ảnh cũ (Ngọc chấm lại ảnh mờ cũ của Leonids, 07/11/2026)
const anhCat = (g, dat) => { const tam = `${ten}-${dat}`; cat(g, tam); const b = readFileSync(join(TAM, `${tam}.jpg`)), moi = `${id}-${dat}-${dau(b)}`; renameSync(join(TAM, `${tam}.jpg`), join(TAM, `${moi}.jpg`)); return moi; };
const tenK = K.map((x, i) => anhCat(x, `k${i}`)), tenS = S.map((x, i) => anhCat(x, `s${i}`));
// BÌA CHUẨN (anh 07/11/2026: "Thumb phải chuẩn hoá để dùng"): dựng theo khuôn, Ngọc chấm; chặn thì dừng nạp, không để YouTube tự lấy khung
const tepBia = join(TAM, 'bia.jpeg'), bia = await dungBia(tap, tepBia).catch((e) => { rmSync(TAM, { recursive: true, force: true }); throw e; });
const bt = `/var/tmp/nap-tap-${id}`, tsx = (lenh) => execFileSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server timeout 300s ../../node_modules/.bin/tsx ${lenh}`], { encoding: 'utf8', maxBuffer: 16 << 20 });
try {
  execFileSync('ssh', [BOX, `rm -rf ${bt} && mkdir -p ${bt}/f`]); execFileSync('sh', ['-c', `scp -q ${TAM}/* ${BOX}:${bt}/f/`]);
  const u = JSON.parse(tsx(`scripts/lich-su/day-demo.mts ${tap.kenh} ${bt}/f tap`).trim().split('\n').pop());
  execFileSync('scp', ['-q', tepBia, `${BOX}:${bt}/bia.jpg`]);
  const qs = (x) => `'${String(x).replace(/'/g, `'\\''`)}'`, xet = JSON.parse(tsx(`scripts/lich-su/xet-thumb.mts ${qs(id)} ${qs(tap.tieu_de)} ${bt}/bia.jpg ${qs(bia.chu)}`).trim().split('\n').pop());
  if (xet.chan?.length) { console.error(`✗ ${id}: Ngọc chặn bìa: ${xet.chan.join(' · ')}`); process.exitCode = 4; throw new Error('bìa bị chặn'); }
  const nap = [{ slug: id, chu_de: tap.tieu_de.replace(tap.hook.goc, '').trim() || tap.tieu_de, mau: 'video-ngoai', nen_url: `https://images.pexels.com/photos/${nguon.pexels_id}/pexels-photo-${nguon.pexels_id}.jpeg`,
    de: { loai: 'video-ngoai', video_url: u[ten], giay: Math.round(giay * 100) / 100, khung: tenK.map((x) => u[x]), soat: tenS.map((x) => u[x]), tom_tat: tap.tieu_de, thumb: { url: xet.url, chu: bia.chu, nguon: bia.tac?.file ?? null } },
    dang: { title: gonTieuDe(tap.tieu_de, tap.cau[0].chu), description: `${tap.dang.mo_ta}${bia.tac && ghiTacGia([bia.tac]).length && !tap.dang.mo_ta.includes(bia.tac.nguon) ? `\nCover image: ${ghiTacGia([bia.tac])[0]}` : ''}\n\nMade by the Astrolas team.`, link: tap.dang.link, goc: tap.goc, hook: tap.hook, playlist: tap.playlist_ma, playlist_ten: pl.ten, mau: tap.mau, y_tuong: id, ...(arg('dang-tu') ? { dang_tu: arg('dang-tu') } : {}), ...(arg('dang-den') ? { dang_den: arg('dang-den') } : {}) } }];   // hạn đăng: Sky Calendar đúng tuần, This Week trước sự kiện (nhip-an-toan.mjs › trongHan)
  writeFileSync(join(TAM, 'nap.json'), JSON.stringify(nap)); execFileSync('scp', ['-q', join(TAM, 'nap.json'), `${BOX}:${bt}/nap.json`]);
  console.log(tsx(`scripts/may-dung.mts --may ${tap.kenh} --nap < ${bt}/nap.json`).trim().split('\n').pop()); console.log(tsx(`scripts/may-dung.mts --may ${tap.kenh} --xuat ${id}`).trim().split('\n').pop());
  console.log(`✓ nạp ${id} · "${nap[0].dang.title}" (${nap[0].dang.title.length} ký tự) · ${(bMp4.length / 1e6).toFixed(1)} MB · Phòng Nội dung chấm ở lượt kế`);
} finally { try { execFileSync('ssh', [BOX, `rm -rf ${bt}`]); } catch { /* đã xong */ } rmSync(TAM, { recursive: true, force: true }); }
