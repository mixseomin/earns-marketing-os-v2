#!/usr/bin/env node
// Tải ẢNH THẬT có toạ độ chỗ đứng chụp (Wikimedia Commons, ghi tác giả + giấy phép) để đối chiếu mô hình: đặt camera đúng chỗ chụp, chồng ảnh.
// Ghi vào apps/castle/public/du-lieu/<ten>-anh.json + du-lieu/anh/<ten>-<k>.jpg (bản 1920 px của Commons).
// Dùng: node apps/castle/scripts/tai-anh-doi-chieu.mjs neuschwanstein "File:A.jpg" "File:B.jpg" …
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [ten, ...tep] = process.argv.slice(2);
if (!ten || !tep.length) { console.error('thiếu: <tên> "File:…" …'); process.exit(1); }
const UA = { 'User-Agent': 'castle-lau-dai-that/1.0' };
const goc = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'du-lieu');
mkdirSync(join(goc, 'anh'), { recursive: true });
const u = new URL('https://commons.wikimedia.org/w/api.php');
for (const [k, v] of Object.entries({ action: 'query', format: 'json', titles: tep.join('|'), prop: 'coordinates|imageinfo', coprop: 'type', iiprop: 'url|size|extmetadata', iiurlwidth: '1920', iiextmetadatafilter: 'LicenseShortName|Artist|LicenseUrl' })) u.searchParams.set(k, v);
const d = await (await fetch(u, { headers: UA })).json();
const boThe = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
const ra = [];
let k = 0;
for (const t of tep) {
  const p = Object.values(d.query.pages).find((x) => x.title === t);
  if (!p?.coordinates?.[0] || !p.imageinfo?.[0]) { console.log('bỏ (thiếu toạ độ / ảnh):', t); continue; }
  const c = p.coordinates[0], ii = p.imageinfo[0], m = ii.extmetadata || {};
  const r = await fetch(ii.thumburl, { headers: UA });
  if (!r.ok) { console.log('bỏ (tải ảnh lỗi', r.status, '):', t); continue; }
  const file = `anh/${ten}-${++k}.jpg`;
  writeFileSync(join(goc, file), Buffer.from(await r.arrayBuffer()));
  ra.push({ tieuDe: t.replace(/^File:/, ''), tep: file, trang: ii.descriptionurl, lat: c.lat, lng: c.lon, rong: ii.thumbwidth, cao: ii.thumbheight,
    tacGia: boThe(m.Artist?.value), giayPhep: m.LicenseShortName?.value, giayPhepUrl: m.LicenseUrl?.value || null,
    camera: null }); // camera = { y, yaw, pitch, fov } chỉnh tay cho khớp ảnh, ghi lại vào tệp này
  console.log('đã tải', file, '←', t);
}
writeFileSync(join(goc, `${ten}-anh.json`), JSON.stringify(ra, null, 1));
console.log(`đã ghi du-lieu/${ten}-anh.json: ${ra.length} ảnh`);
