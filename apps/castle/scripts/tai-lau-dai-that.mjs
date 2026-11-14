#!/usr/bin/env node
// Tải SỐ ĐO THẬT của một lâu đài để dựng lại đúng tỉ lệ (chạy trên iMac, ghi vào apps/castle/public/du-lieu/<ten>.json):
//  - khối nhà 3D từ OpenStreetMap (building, building:part: chiều cao, min_height, kiểu mái, cao mái, màu, vật liệu) — giấy phép ODbL,
//    trang phải ghi "© OpenStreetMap contributors"
//  - lưới độ cao địa hình từ OpenTopoData (EU-DEM 25 m) quanh lâu đài
// Dùng:  node apps/castle/scripts/tai-lau-dai-that.mjs neuschwanstein 47.5576 10.7498 [bánKínhOSM=260] [nửaCạnhĐịaHình=420] [bước=12]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [ten, lat, lng, banKinh = 260, nua = 420, buoc = 12] = process.argv.slice(2);
if (!ten || !lat || !lng) { console.error('thiếu: <tên> <vĩ độ> <kinh độ>'); process.exit(1); }
const LAT = +lat, LNG = +lng;
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

const MAY_OSM = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
async function osm() {
  const q = `[out:json][timeout:80];(way["building"](around:${banKinh},${LAT},${LNG});way["building:part"](around:${banKinh},${LAT},${LNG});relation["building"](around:${banKinh},${LAT},${LNG});relation["building:part"](around:${banKinh},${LAT},${LNG});way["barrier"="wall"](around:${banKinh},${LAT},${LNG}););out geom;`;
  for (let lan = 0; lan < 8; lan++) {
    const may = MAY_OSM[lan % MAY_OSM.length];
    try {
      const r = await fetch(may, { method: 'POST', headers: { 'User-Agent': 'castle-lau-dai-that/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
      const t = await r.text();
      if (r.ok && t.trim().startsWith('{')) { const j = JSON.parse(t); console.log(`OSM: ${j.elements.length} phần tử từ ${may}`); return j.elements; }
      console.log(`OSM ${may}: ${r.status} ${t.slice(0, 80).replace(/\s+/g, ' ')} — thử lại`);
    } catch (e) { console.log(`OSM ${may}: ${e.message} — thử lại`); }
    await ngu(2000 * 2 ** Math.min(lan, 4));
  }
  throw new Error('OSM: hết lượt thử');
}

// đổi lat/lng ↔ mét quanh tâm (phẳng cục bộ, đủ chính xác trong vài km)
const M_LAT = 111320, M_LNG = 111320 * Math.cos(LAT * Math.PI / 180);
const raMet = (la, ln) => [(ln - LNG) * M_LNG, -(la - LAT) * M_LAT]; // x = đông, z = nam (khớp three.js: -z là bắc)

async function diaHinh() {
  const n = Math.round((2 * nua) / buoc) + 1, diem = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = -nua + i * buoc, z = -nua + j * buoc; diem.push([LAT - z / M_LAT, LNG + x / M_LNG]); }
  const cao = new Array(diem.length);
  for (let k = 0; k < diem.length; k += 100) {
    const lo = diem.slice(k, k + 100).map(([a, b]) => `${a.toFixed(6)},${b.toFixed(6)}`).join('|');
    for (let lan = 0; ; lan++) {
      const r = await fetch(`https://api.opentopodata.org/v1/eudem25m?locations=${lo}`, { headers: { 'User-Agent': 'castle-lau-dai-that/1.0' } });
      if (r.ok) { const j = await r.json(); j.results.forEach((x, i) => { cao[k + i] = x.elevation; }); break; }
      if (lan > 5) throw new Error(`OpenTopoData ${r.status}`);
      await ngu(1500 * (lan + 1));
    }
    process.stdout.write(`\rđịa hình ${Math.min(k + 100, diem.length)}/${diem.length}`);
    await ngu(1100); // giới hạn công cộng 1 lần/giây
  }
  console.log();
  return { n, buoc: +buoc, nua: +nua, cao: cao.map((v) => (v == null ? null : Math.round(v * 10) / 10)) };
}

const ptu = await osm();
const khoi = [];
for (const e of ptu) {
  const t = e.tags || {};
  const vong = (ds) => ds.map((p) => raMet(p.lat, p.lon).map((v) => Math.round(v * 100) / 100));
  let ngoai = [], trong = [];
  if (e.type === 'way' && e.geometry) ngoai = [vong(e.geometry)];
  else if (e.type === 'relation') for (const m of e.members || []) if (m.geometry) (m.role === 'inner' ? trong : ngoai).push(vong(m.geometry));
  if (!ngoai.length) continue;
  khoi.push({ id: `${e.type}/${e.id}`, ngoai, trong, tags: t });
}
const dh = await diaHinh();
const ra = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'du-lieu', `${ten}.json`);
mkdirSync(dirname(ra), { recursive: true });
writeFileSync(ra, JSON.stringify({ ten, tam: [LAT, LNG], nguon: { osm: '© OpenStreetMap contributors (ODbL)', diaHinh: 'EU-DEM 25 m qua OpenTopoData' }, tai: new Date().toISOString(), khoi, diaHinh: dh }));
console.log(`đã ghi ${ra}: ${khoi.length} khối, địa hình ${dh.n}×${dh.n}`);
