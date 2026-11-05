#!/usr/bin/env node
// ẢNH THẬT cho Sky Calendar (05/11/2026, luật "mọi bài có ảnh minh hoạ thật"): mỗi chuyện trời xưa lấy ảnh ngay trên các trang Wikipedia nguồn của chuyện
// (ảnh đầu trang + ảnh trong bài), CHỈ giữ ảnh giấy phép công cộng / CC0 / CC BY(-SA) theo Commons, bỏ biểu tượng / sơ đồ svg / gif. 0đ.
// → brand/astrolas/tranh/<ma>-<i>.jpg (rộng 1400, sips) + troi-xua/_anh.json { <ma>: [{ tep, trang, file, giay_phep, tac_gia, nguon }] } — tác giả đi vào bài đăng (viet-sky.mjs).
//   node troi-xua/_may/lay-anh.mjs [--chuyen sc-leonids-1833] [--toi-da 3]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TX = join(dirname(fileURLToPath(import.meta.url)), '..'), LS = join(TX, '..'), TRANH = join(LS, 'brand/astrolas/tranh');
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const UA = { 'User-Agent': 'AstrolasSkyCalendar/1.0 (https://astrolas.com)' }, API = 'https://en.wikipedia.org/w/api.php?format=json&';
const lay = async (u) => (await fetch(u, { headers: UA })).json();
const BO = /icon|logo|ambox|symbol|edit-ltr|question|wiki|flag|map of|locator|portal|padlock|disambig|stub/i, GIAY = /public domain|^pd|cc0|cc by/i;

const SO = JSON.parse(readFileSync(join(TX, '_so.json'), 'utf8')).chuyen, toiDa = +arg('toi-da', 3), RA = join(TX, '_anh.json');
const KHO = existsSync(RA) ? JSON.parse(readFileSync(RA, 'utf8')) : {};
for (const c of SO.filter((x) => !arg('chuyen') || x.ma === arg('chuyen'))) {
  const T = JSON.parse(readFileSync(join(TX, c.tep.split('/').pop()), 'utf8'));
  const trang = [...new Set(T.moc.map((m) => decodeURIComponent(m.nguon.split('/wiki/')[1].split('#')[0])))];
  // trang chung của loại sự kiện: chỉ để LẤP khi trang của chuyện thiếu ảnh (Thales, Hsi và Ho, NEOWISE…) — xếp sau mọi ảnh của chuyện
  // CHỈ nhật / nguyệt thực: ảnh thực nào trông cũng như nhau; sao chổi / sao băng chung thì là MỘT sự kiện khác (Hale-Bopp lấp cho NEOWISE = sai chuyện)
  const CHUNG = { nhat_thuc: 'Solar eclipse', nguyet_thuc: 'Lunar eclipse' };
  const ung = [];   // ứng viên theo ưu tiên: ảnh đầu trang của chuyện (0) → ảnh trong bài của chuyện (1) → trang chung (2)
  for (const t of [...trang, ...(CHUNG[c.loai] ? [CHUNG[c.loai]] : [])]) {
    const chung = !trang.includes(t), p = Object.values((await lay(`${API}action=query&prop=pageimages&piprop=name&titles=${encodeURIComponent(t)}`)).query.pages)[0];
    if (p.pageimage) ung.push({ trang: t, file: `File:${p.pageimage.replace(/_/g, ' ')}`, uu: chung ? 2 : 0 });
    // chỉ ảnh MINH HOẠ TRONG THÂN BÀI (figure mw:File/Thumb): ảnh của hộp điều hướng cuối trang (Crab Nebula, Solar system…) là span mw:File, không vào
    const html = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(t.replace(/ /g, '_'))}`, { headers: UA })).text();
    for (const m of html.matchAll(/<figure[^>]*typeof="mw:File\/Thumb"[^>]*>[\s\S]*?href="\.\/(File:[^"#?]+)"/g)) ung.push({ trang: t, file: decodeURIComponent(m[1]).replace(/_/g, ' '), uu: chung ? 2 : 1 });
  }
  const chon = [], da = new Set();
  for (const u of ung.sort((a, b) => a.uu - b.uu)) {
    if (chon.length >= toiDa || da.has(u.file) || !/\.(jpe?g|png|tiff?)$/i.test(u.file) || BO.test(u.file)) continue; da.add(u.file);
    const ii = Object.values((await lay(`${API}action=query&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600&titles=${encodeURIComponent(u.file)}`)).query.pages)[0]?.imageinfo?.[0];
    const md = ii?.extmetadata ?? {}, gp = md.LicenseShortName?.value ?? '';
    if (!ii || !GIAY.test(gp) || ii.width < 700) continue;
    const tep = `${c.ma}-${chon.length + 1}.jpg`, tam = join(TRANH, `.tai-${tep}`);
    writeFileSync(tam, Buffer.from(await (await fetch(ii.thumburl ?? ii.url, { headers: UA })).arrayBuffer()));
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', '--resampleWidth', '1400', tam, '--out', join(TRANH, tep)], { stdio: 'ignore' });
    execFileSync('rm', ['-f', tam]);
    chon.push({ tep: `brand/astrolas/tranh/${tep}`, trang: u.trang, file: u.file, giay_phep: gp, tac_gia: (md.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 120), nguon: ii.descriptionurl });
  }
  KHO[c.ma] = chon; console.log(`${chon.length ? '✓' : '✗'} ${c.ma}: ${chon.length} ảnh ${chon.map((x) => `${x.file.slice(5, 40)} [${x.giay_phep}]`).join(' · ')}`);
}
writeFileSync(RA, JSON.stringify(KHO, null, 1) + '\n');
