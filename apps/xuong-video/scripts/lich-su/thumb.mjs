#!/usr/bin/env node
// THUMBNAIL TẬP LỊCH SỬ (02/11/2026, anh: "thumb rất rất quan trọng — phải có thiết kế + review đúng chuẩn, KHÔNG dùng thumb YouTube tự sinh"). Chạy trên iMac:
//   node thumb.mjs --id <tập> [--viet-lai]
// 1. CHỮ (box3 viet-tap --chi-thumb, ~vài trăm đồng, chỉ khi tập chưa có tap.thumb hoặc --viet-lai): chữ to 2–4 từ + nhãn phụ + chọn ảnh thật nền.
// 2. DỰNG (0đ): thumb.html (khuôn lá cải của kênh) → /Users/htuan/.cache/lich-su/<id>/<id>-thumb.jpg 1080×1920 < 2 MB.
// 3. NGỌC CHẤM (box3 xet-thumb.mts → cham-dang › xetThumbAi): chuẩn thumbnail (đọc được ở cỡ nhỏ, chủ thể rõ, không rối, đúng chuyện) — chặn thì exit 4.
// Ghi tap.thumb = { chu, phu, anh, commons, url, xet } — lam-tap đưa url vào de.thumb của máy đăng; máy đăng tải lên YouTube (dang-br › datThumbYouTube).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KHO } from './dia-ly.mjs';
import { BOX, box, len, ve, q } from './box3.mjs';
import { hoSoTap, playlistCuaTap } from './playlist.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; }, co = (k) => process.argv.includes(`--${k}`);
const id = arg('id'); if (!id) { console.error('node thumb.mjs --id <tập> [--viet-lai]'); process.exit(2); }
const tepTap = join(DIR, 'tap', `${id}.json`), tap = JSON.parse(readFileSync(tepTap, 'utf8'));
const kenhId = tap.kenh ?? 'saga', K = (() => { const K0 = JSON.parse(readFileSync(join(DIR, 'kenh.json'), 'utf8'))[kenhId]; return hoSoTap(K0, { playlist: playlistCuaTap(K0, tap.playlist ?? null), mau: tap.mau ?? null }); })(), nn = tap.ngon_ngu ?? 'en';
const RA = join(KHO, id); mkdirSync(RA, { recursive: true });
// --rieng (lam-tap chạy thumbnail SONG SONG với dựng, 03/11/2026): không ghi tệp tập (dung-tap có thể đang ghi cùng tệp) — kết quả ra <RA>/thumb-kq.json, lam-tap gộp sau
const ghiTap = () => co('rieng') ? writeFileSync(join(RA, 'thumb-kq.json'), JSON.stringify({ thumb: tap.thumb })) : writeFileSync(tepTap, JSON.stringify(tap, null, 1) + '\n');

// 1. CHỮ
// ảnh nền thumbnail phải còn là ảnh Commons đang dùng trong tập (đổi ảnh tranh → chọn lại, kẻo thumbnail giữ ảnh đã bị loại — Alaska 02/11/2026)
const anhTap = new Map(tap.cau.map((c) => c.canh?.tranh).filter((t) => t?.anh && t?.commons).map((t) => [t.commons, t.anh]));
if (tap.anh_bia?.anh && tap.anh_bia.commons) anhTap.set(tap.anh_bia.commons, tap.anh_bia.anh);   // ảnh bìa thật (lam-tap lưới cuối)
if (tap.thumb?.commons && anhTap.get(tap.thumb.commons) !== tap.thumb.anh) { console.log(`· ảnh nền thumbnail cũ (${tap.thumb.commons}) không còn trong tập — viết lại`); delete tap.thumb; }
if (!tap.thumb?.chu || co('viet-lai')) {
  const tmp = `/var/tmp/thumb-${id}`; execFileSync('ssh', [BOX, `rm -rf ${tmp} && mkdir -p ${tmp}`]); len(tepTap, `${tmp}/tap.json`);
  console.log(box(`scripts/lich-su/viet-tap.mts ${tmp}/thumb.json --id ${q(id)} --nn ${nn} --kenh ${kenhId} --chi-thumb --cu ${tmp}/tap.json`).split('\n').pop());
  ve(`${tmp}/thumb.json`, join(RA, 'thumb.json')); execFileSync('ssh', [BOX, `rm -rf ${tmp}`]);
  tap.thumb = JSON.parse(readFileSync(join(RA, 'thumb.json'), 'utf8')).thumb; ghiTap();
}

// 2–3. DỰNG + NGỌC CHẤM, THỬ ẢNH KẾ KHI BỊ CHẶN VÌ ẢNH (03/11/2026, Constantinople: ảnh bìa là ảnh ghép 6 tranh → Ngọc chặn "rối, không chủ thể" → cả lượt dừng):
// ứng viên = ảnh máy viết chọn trước, rồi mọi ảnh thật khác của tập (ảnh bìa trước, tranh Commons sau); tối đa 5 ảnh. Bị chặn vì CHỮ (khó đọc, nhiều chữ, tràn, lặp tiêu đề) thì đổi ảnh vô ích → dừng.
const PW = process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`;
const { chromium } = createRequire(import.meta.url)(PW);
const ra = join(RA, `${id}-thumb.jpg`);
for (const x of tap.anh_bia_ds ?? []) if (x?.anh && x.commons) anhTap.set(x.commons, x.anh);
// 04/11/2026 (tập săn phù thuỷ): 3 ứng viên đầu toàn chân dung người phụ, Ngọc chặn "lệch chuyện"; tranh hành quyết phù thuỷ (ảnh bìa thứ 3, đúng chuyện nhất) không được thử.
// Giờ: ảnh máy viết chọn → ảnh bìa đã qua Ngọc (xét theo chủ đề) → tranh cảnh còn lại; tối đa 5 ảnh.
const bia = new Set((tap.anh_bia_ds ?? []).map((x) => x?.commons).filter(Boolean));
const ungVien = [[tap.thumb.commons, tap.thumb.anh], ...[...anhTap].filter(([c]) => c !== tap.thumb.commons).sort(([a], [b]) => Number(bia.has(b)) - Number(bia.has(a)))].slice(0, 5);
let kq = null;
// MỖI ẢNH THỬ 2 BẢN: đủ (chữ to + dòng phụ + nhãn góc) → Ngọc chê chữ / rối thì BẢN GỌN (chỉ chữ to + tên kênh) trước khi đổi ảnh (05/11/2026, Agincourt: 3 ảnh đều bị
// "nhiều nhãn chữ gây rối mắt" rồi thoát — tập mất trắng sau khi đã tốn giọng + kho). Lỗi thuần về ảnh (chủ thể / lệch / AI / logo / nhạy cảm) mới đổi ảnh ngay.
let hetViChu = false;
for (const [i, [commons, anh]] of ungVien.entries()) { for (const gon of [false, true]) {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(pathToFileURL(join(DIR, 'thumb.html')).href);
  const do_ = await p.evaluate(async (t) => { window.THUMB = t; return window.__dung(); },
    { chu: tap.thumb.chu, phu: tap.thumb.phu, anh: pathToFileURL(join(KHO, anh)).href, kenh: K.ten_kenh ?? K.ten, bao: K.thumb_bao ?? null, gon });
  for (const ql of [90, 82, 74]) { writeFileSync(ra, await p.screenshot({ type: 'jpeg', quality: ql })); if (statSync(ra).size < 1.9e6) break; }
  await b.close();
  console.log(`✓ ${ra} · ảnh ${i + 1}/${ungVien.length} ${commons}${gon ? ' · bản gọn' : ''} · chữ ${do_.co}px ${do_.dong} dòng · ${(statSync(ra).size / 1e6).toFixed(2)} MB`);
  const den = `/var/tmp/xet-thumb-${id}.jpg`; len(ra, den);
  kq = JSON.parse(box(`scripts/lich-su/xet-thumb.mts ${q(id)} ${q(tap.tieu_de)} ${den} ${q(tap.chu_de ?? '')} ${q(commons ?? '')}`).split('\n').pop());
  tap.thumb = { ...tap.thumb, anh, commons, gon, url: kq.url, xet: { chan: kq.chan, canh: kq.canh, luc: new Date().toISOString() } }; ghiTap();
  for (const c of kq.canh) console.log(`⚠ Ngọc (thumbnail): ${c}`);
  if (!kq.chan.length) break;
  // "rối" ở BẢN GỌN (chỉ còn chữ to + tên kênh) = ẢNH rối, không phải chữ (05/11/2026, Agincourt: "rối, không có điểm nhìn — tranh trận chiến nhiều chi tiết"
  // bị xếp là lỗi chữ → dừng luôn, không thử ảnh 3) → bản gọn mà còn rối thì đổi ảnh
  const veChu = kq.chan.some((c) => /chữ khó đọc|quá 5 từ|tràn|lặp nguyên tiêu đề/.test(c) || (!gon && /rối/.test(c))),
    veAnh = kq.chan.some((c) => /chủ thể|điểm nhìn|lệch|AI|logo|nhạy cảm/.test(c) || (gon && /rối/.test(c)));
  if (!gon && veChu) { console.log(`· Ngọc chặn ảnh ${i + 1} (bản đủ): ${kq.chan.join(' · ')} — thử bản gọn cùng ảnh`); continue; }
  console.log(`· Ngọc chặn ảnh ${i + 1}${gon ? ' (bản gọn)' : ''}: ${kq.chan.join(' · ')}${veChu && !veAnh ? ' — lỗi CHỮ cả hai bản, đổi ảnh không giúp' : i + 1 < ungVien.length ? ' — thử ảnh kế' : ''}`);
  if (veChu && !veAnh) hetViChu = true; break;
} if (!kq.chan.length || hetViChu) break; }
if (kq.chan.length) { console.error(`✗ Ngọc chặn thumbnail:\n  ${kq.chan.join('\n  ')}\n  ${ra}`); process.exit(4); }
console.log(`✓ Ngọc duyệt thumbnail · ${kq.url}`);
