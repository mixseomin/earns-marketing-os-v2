#!/usr/bin/env node
// NẠP TẬP DÀI GHÉP GIẤY VÀO MÁY ĐĂNG (07/11/2026, anh: "đăng lên đi"). Chạy trên iMac sau lam-dai.mjs (lam-dai tự gọi cuối lượt):
//   node nap-dai.mjs --id <id>
// Đi đúng đường chung như tập ngắn (lam-tap.mjs): R2 (video + bìa + 3 khung soát) → may-dung.mts --nap (mẫu video-ngoai) → --xuat → Phòng Nội dung chấm → máy đăng tự đăng.
// Chưa có logo kênh trong phim = không nạp (anh 07/11/2026: chờ logo rồi mới đăng) — lam-dai đã chặn dựng thiếu logo, ở đây kiểm lại tệp logo.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boxA, lenA, sshA, veA } from '../box3.mjs';

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const DIR = dirname(fileURLToPath(import.meta.url)), LS = join(DIR, '..'), id = arg('id'); if (!id) { console.error('node nap-dai.mjs --id <id>'); process.exit(2); }
const RA = join(process.env.HOME, '.cache/lich-su', id), mp4 = join(RA, `${id}.mp4`), thumb = join(RA, `${id}-thumb.jpg`), tepTap = join(LS, 'tap', `${id}.json`), tap = JSON.parse(readFileSync(tepTap, 'utf8'));
const KENH = JSON.parse(readFileSync(join(LS, 'kenh.json'), 'utf8'))[tap.kenh]; if (!KENH?.may) { console.error(`✗ kênh ${tap.kenh} chưa có máy đăng`); process.exit(3); }
if (!existsSync(join(LS, 'brand', tap.kenh_brand ?? 'yesterdays-news-tonight', 'ra', 'logo-a3', 'huy-hieu-tron-1024.png'))) { console.error('✗ kênh chưa có logo — không nạp'); process.exit(9); }
for (const f of [mp4, thumb]) if (!existsSync(f)) { console.error(`✗ thiếu ${f}`); process.exit(4); }
// GÓC + HOOK SPY (luật mọi bài, Phòng Nội dung chặn cứng nếu thiếu): cùng bước gắn hook của tập ngắn (lam-tap --gan-hook) — chọn hook QC thật hợp chuyện,
// chỉnh nhẹ thành tiêu đề + mô tả đăng; lời đọc giữ nguyên. Lần đầu 07/11/2026 tập Nga 1812 nạp thiếu → SỬA LẠI.
if (!tap.hook?.goc) { const tmp = `/var/tmp/gan-hook-${id}`, f = join(RA, 'goc-hook.json'); await sshA(`rm -rf ${tmp} && mkdir -p ${tmp}`);
  writeFileSync(f, (await boxA(`scripts/may-dung.mts --may ${KENH.may} --goc-hook${KENH.mau_dai?.goc_spy ? ` --goc ${KENH.mau_dai.goc_spy}` : ''}`)).split('\n').pop());   /* góc khai cho mẫu dài (kenh.json › mau_dai.goc_spy); không khai = góc dùng ít nhất, có thể lệch chuyện (lần đầu ra góc cướp biển) */ await lenA([f, tepTap], `${tmp}/`);
  console.log((await boxA(`scripts/lich-su/viet-tap.mts ${tmp}/gan.json --id ${id} --nn ${tap.ngon_ngu ?? 'en'} --kenh ${tap.kenh} --chi-hook --goc-hook ${tmp}/goc-hook.json --cu ${tmp}/${id}.json`)).split('\n').pop());
  await veA(`${tmp}/gan.json`, join(RA, 'gan-hook.json')); await sshA(`rm -rf ${tmp}`);
  Object.assign(tap, JSON.parse(readFileSync(join(RA, 'gan-hook.json'), 'utf8'))); writeFileSync(tepTap, JSON.stringify(tap, null, 1) + '\n'); }
// ảnh nền thật cho bài đăng (luật mọi bài): ảnh Wikimedia Commons đầu tiên phim đã dùng
const nenUrl = Object.values(tap.anh ?? {}).map((a) => a.thumb?.split('?')[0]).find(Boolean) ?? null; if (!nenUrl) { console.error('✗ tập không có ảnh thật nào làm ảnh nền bài đăng'); process.exit(6); }
const giay = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' })), phut = Math.max(1, Math.round(giay / 60));
// số phút trong tiêu đề luôn theo độ dài thật — mô hình viết có lúc ghi cứng "12 Minutes" thay vì {N} (tập Nga 1812 dài 13:02)
const title = tap.tieu_de.replace(/\{N\}|\b\d+(?= Minutes?\b)/, String(phut));
// mô tả: hai câu mở phim + mốc chương (YouTube tự thành chapter) + nguồn thật đã dùng
const chuong = readFileSync(join(RA, `${id}-chuong.txt`), 'utf8').trim(), wiki = (tap.nguon ?? []).map((u) => decodeURIComponent(u.split('/wiki/')[1] ?? '').replace(/_/g, ' ')).filter(Boolean);
const description = [tap.mo_ta_dang ?? tap.cau.slice(0, 2).map((c) => c.chu).join(' '), '', 'Chapters:', chuong, '', ...(wiki.length ? [`Sources: Wikipedia (${wiki.join('; ')})${(tap.diem_nhan?.cau_noi ?? []).length ? '; quotes from Wikiquote' : ''}.`] : []),
  'Images: Wikimedia Commons (public domain). Maps: Natural Earth; historical borders: historical-basemaps by A. Ourednik (GPL-3.0).'].join('\n');
// 3 khung soát (1/4, 1/2, 3/4 phim) cho Phòng Nội dung
const khung = [0.25, 0.5, 0.75].map((p, i) => { const f = join(RA, `khung-${i + 1}.jpg`); execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(giay * p), '-i', mp4, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '4', f]); return f; });
const bt = `/var/tmp/nap-dai-${id}`; await sshA(`rm -rf ${bt} && mkdir -p ${bt}`); await lenA([mp4, thumb, ...khung], `${bt}/`);
// CHÉP ĐỦ MỚI ĐẨY (07/11/2026: lượt chép 1,1 GB sang box3 đứt giữa chừng lúc ssh box3 chập chờn → R2 giữ bản 282 MB, YouTube nhận phim cụt 725/782 s, hai lần)
const coBox = Number(String(await sshA(`stat -c %s ${bt}/${id}.mp4`)).trim()), coMay = statSync(mp4).size;
if (coBox !== coMay) { console.error(`✗ chép sang box3 chưa đủ: ${coBox}/${coMay} byte — không đẩy R2`); await sshA(`rm -rf ${bt}`); process.exit(5); }
const r2 = JSON.parse((await boxA(`scripts/lich-su/giay/day-r2.mts ${bt}/${id}.mp4 ${bt}/${id}-thumb.jpg ${id} ${khung.map((f) => `${bt}/${f.split('/').pop()}`).join(' ')}`, 25 * 60_000)).split('\n').pop());
if (!r2.url || !r2.thumb || r2.khung.some((u) => !u)) { console.error(`✗ đẩy R2 thiếu: ${JSON.stringify(r2)}`); process.exit(5); }
// đọc lại byte CUỐI của bản trên R2: phải trả 206 và tổng dung lượng đúng bằng tệp gốc (HEAD có lúc báo đủ trong khi dữ liệu thật thiếu)
{ const kt = execFileSync('curl', ['-s', '-r', `${coMay - 16}-${coMay - 1}`, '-o', '/dev/null', '-w', '%{http_code} %{size_download}', r2.url], { encoding: 'utf8' }).trim();
  if (kt !== '206 16') { console.error(`✗ bản trên R2 không đủ (đọc 16 byte cuối: ${kt}) — không nạp`); process.exit(5); } }
const nap = [{ slug: id, chu_de: tap.chu_de, mau: 'video-ngoai', nen_url: nenUrl,
  de: { loai: 'video-ngoai', video_url: r2.url, giay: Math.round(giay * 100) / 100, khung: r2.khung, soat: [], tom_tat: tap.chu_de, thumb: { url: r2.thumb, chu: tap.thumb?.chu ?? null, nguon: null } },
  dang: { title, description, link: null, loai: 'thuong', goc: tap.goc ?? null, hook: tap.hook ?? null, playlist: tap.playlist ?? null, mau: tap.mau ?? null, y_tuong: null } }];
writeFileSync(join(RA, 'nap.json'), JSON.stringify(nap)); await lenA(join(RA, 'nap.json'), `${bt}/nap.json`);
console.log((await boxA(`scripts/may-dung.mts --may ${KENH.may} --nap < ${bt}/nap.json`)).trim().split('\n').slice(-2).join(' · '));
console.log((await boxA(`scripts/may-dung.mts --may ${KENH.may} --xuat ${id}`)).trim().split('\n').slice(-2).join(' · '));
await sshA(`rm -rf ${bt}`);
console.log(`✓ nạp máy ${KENH.may}: "${title}" · ${r2.url} · Phòng Nội dung chấm ở lượt kế, máy đăng tự đăng theo nhịp`);
