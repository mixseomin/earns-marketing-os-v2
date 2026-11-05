#!/usr/bin/env node
// ẢNH THẬT cho Sky Calendar: mỗi chuyện trời xưa lấy ảnh trên các trang Wikipedia nguồn của chuyện (lõi chung lich-su/anh-wiki.mjs). 0đ.
// → brand/astrolas/tranh/<ma>-<i>.jpg + troi-xua/_anh.json { <ma>: [{ tep, trang, file, giay_phep, tac_gia, nguon }] } — tác giả đi vào bài đăng (viet-sky.mjs).
//   node troi-xua/_may/lay-anh.mjs [--chuyen sc-leonids-1833] [--toi-da 3]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layAnhWiki, tenTrang } from '../../anh-wiki.mjs';

const TX = join(dirname(fileURLToPath(import.meta.url)), '..'), arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const SO = JSON.parse(readFileSync(join(TX, '_so.json'), 'utf8')).chuyen, RA = join(TX, '_anh.json'), KHO = existsSync(RA) ? JSON.parse(readFileSync(RA, 'utf8')) : {};
// CHỈ nhật / nguyệt thực được lấp bằng trang chung: ảnh thực nào trông cũng như nhau; sao chổi / sao băng chung là MỘT sự kiện khác (Hale-Bopp lấp cho NEOWISE = sai chuyện)
const LAP = { nhat_thuc: ['Solar eclipse'], nguyet_thuc: ['Lunar eclipse'] };
for (const c of SO.filter((x) => !arg('chuyen') || x.ma === arg('chuyen'))) {
  const T = JSON.parse(readFileSync(join(TX, c.tep.split('/').pop()), 'utf8')), trang = [...new Set(T.moc.map((m) => tenTrang(m.nguon)))];
  const chon = await layAnhWiki(trang, { ma: c.ma, toiDa: +arg('toi-da', 3), lap: LAP[c.loai] ?? [] });
  KHO[c.ma] = chon; console.log(`${chon.length ? '✓' : '✗'} ${c.ma}: ${chon.length} ảnh ${chon.map((x) => `${x.file.slice(5, 40)} [${x.giay_phep}]`).join(' · ')}`);
}
writeFileSync(RA, JSON.stringify(KHO, null, 1) + '\n');
