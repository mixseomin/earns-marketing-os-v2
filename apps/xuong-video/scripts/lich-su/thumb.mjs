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
import { apPlaylist, playlistCuaTap } from './playlist.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; }, co = (k) => process.argv.includes(`--${k}`);
const id = arg('id'); if (!id) { console.error('node thumb.mjs --id <tập> [--viet-lai]'); process.exit(2); }
const tepTap = join(DIR, 'tap', `${id}.json`), tap = JSON.parse(readFileSync(tepTap, 'utf8'));
const kenhId = tap.kenh ?? 'saga', K = apPlaylist(JSON.parse(readFileSync(join(DIR, 'kenh.json'), 'utf8'))[kenhId], playlistCuaTap(JSON.parse(readFileSync(join(DIR, 'kenh.json'), 'utf8'))[kenhId], tap.playlist ?? null)), nn = tap.ngon_ngu ?? 'en';
const RA = join(KHO, id); mkdirSync(RA, { recursive: true });

// 1. CHỮ
// ảnh nền thumbnail phải còn là ảnh Commons đang dùng trong tập (đổi ảnh tranh → chọn lại, kẻo thumbnail giữ ảnh đã bị loại — Alaska 02/11/2026)
const anhTap = new Map(tap.cau.map((c) => c.canh?.tranh).filter((t) => t?.anh && t?.commons).map((t) => [t.commons, t.anh]));
if (tap.thumb?.commons && anhTap.get(tap.thumb.commons) !== tap.thumb.anh) { console.log(`· ảnh nền thumbnail cũ (${tap.thumb.commons}) không còn trong tập — viết lại`); delete tap.thumb; }
if (!tap.thumb?.chu || co('viet-lai')) {
  const tmp = `/var/tmp/thumb-${id}`; execFileSync('ssh', [BOX, `rm -rf ${tmp} && mkdir -p ${tmp}`]); len(tepTap, `${tmp}/tap.json`);
  console.log(box(`scripts/lich-su/viet-tap.mts ${tmp}/thumb.json --id ${q(id)} --nn ${nn} --kenh ${kenhId} --chi-thumb --cu ${tmp}/tap.json`).split('\n').pop());
  ve(`${tmp}/thumb.json`, join(RA, 'thumb.json')); execFileSync('ssh', [BOX, `rm -rf ${tmp}`]);
  tap.thumb = JSON.parse(readFileSync(join(RA, 'thumb.json'), 'utf8')).thumb; writeFileSync(tepTap, JSON.stringify(tap, null, 1) + '\n');
}

// 2. DỰNG
const PW = process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`;
const { chromium } = createRequire(import.meta.url)(PW);
const ra = join(RA, `${id}-thumb.jpg`);
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto(pathToFileURL(join(DIR, 'thumb.html')).href);
const do_ = await p.evaluate(async (t) => { window.THUMB = t; return window.__dung(); },
  { chu: tap.thumb.chu, phu: tap.thumb.phu, anh: pathToFileURL(join(KHO, tap.thumb.anh)).href, kenh: K.ten_kenh ?? K.ten, bao: K.thumb_bao ?? null });
for (const ql of [90, 82, 74]) { writeFileSync(ra, await p.screenshot({ type: 'jpeg', quality: ql })); if (statSync(ra).size < 1.9e6) break; }
await b.close();
console.log(`✓ ${ra} · chữ ${do_.co}px ${do_.dong} dòng · ${(statSync(ra).size / 1e6).toFixed(2)} MB`);

// 3. NGỌC CHẤM
const den = `/var/tmp/xet-thumb-${id}.jpg`; len(ra, den);
const kq = JSON.parse(box(`scripts/lich-su/xet-thumb.mts ${q(id)} ${q(tap.tieu_de)} ${den} ${q(tap.chu_de ?? '')} ${q(tap.thumb.commons ?? '')}`).split('\n').pop());
tap.thumb = { ...tap.thumb, url: kq.url, xet: { chan: kq.chan, canh: kq.canh, luc: new Date().toISOString() } }; writeFileSync(tepTap, JSON.stringify(tap, null, 1) + '\n');
for (const c of kq.canh) console.log(`⚠ Ngọc (thumbnail): ${c}`);
if (kq.chan.length) { console.error(`✗ Ngọc chặn thumbnail:\n  ${kq.chan.join('\n  ')}\n  ${ra}`); process.exit(4); }
console.log(`✓ Ngọc duyệt thumbnail · ${kq.url}`);
