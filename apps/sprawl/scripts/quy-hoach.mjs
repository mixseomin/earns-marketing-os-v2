// Quy hoạch chung kiểu Red Spires cho Sprawl — lấy OSM thật quanh tâm Shinjuku, chia khu theo ảnh mẫu Red Spires:
//   tháp đỏ (nhà cao thật → tháp nón đỏ chóp vòm), đại lộ đi bộ (đường lớn → lát đá sáng, chợ, người),
//   phố thấp (còn lại → khối xanh xám, vườn mái), vườn (công viên), tuyến tàu, làn xe bay, vành khối khổng lồ mờ xa.
// Chạy: node apps/sprawl/scripts/quy-hoach.mjs [--lai]   (--lai = tải lại OSM, không thì dùng bản đã lưu)
// Ra: apps/sprawl/du-lieu-goc/osm-shinjuku.json (OSM gốc) · apps/sprawl/public/du-lieu/quy-hoach.json (máy đọc) · apps/sprawl/quy-hoach.svg (bản vẽ duyệt)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TL, luoiTuyen, datThap, banKinhThon, kiem, inKiem } from '../public/khop.js';

const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TAM = { lat: 35.6900, lon: 139.6975 }; // trùng sprawl.js
const NUA = 1500; // m — vùng quy hoạch 3 × 3 km quanh tâm
const MY = 110950, MX = 111320 * Math.cos(TAM.lat * Math.PI / 180);
const bbox = [TAM.lat - NUA / MY, TAM.lon - NUA / MX, TAM.lat + NUA / MY, TAM.lon + NUA / MX].map((v) => v.toFixed(5)).join(',');
const xz = (lat, lon) => [Math.round((lon - TAM.lon) * MX * 10) / 10, Math.round((TAM.lat - lat) * MY * 10) / 10]; // X đông, Z nam (khớp sprawl.js)

// máy chủ Overpass hay quá tải (502/504) → xoay vòng máy chủ, lùi dần
const MAY = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
async function goi(q) {
  let loi = '';
  for (let lan = 0; lan < 6; lan++) {
    const url = MAY[lan % MAY.length];
    try { const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'User-Agent': 'sprawl-quy-hoach/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(150000) }); if (r.ok) return (await r.json()).elements; loi = `${url} ${r.status}`; }
    catch (e) { loi = `${url} ${e.message}`; }
    console.warn('[quy-hoach] thử lại:', loi); await new Promise((ok) => setTimeout(ok, 3000 * (lan + 1)));
  }
  throw new Error('Overpass hỏng hết: ' + loi);
}
// hai câu nhẹ: đường/tàu/vườn lấy đủ hình; nhà chỉ lấy thẻ + khung bao (out tags bb), chia 4 ô — một câu "mọi nhà out geom" bị 504
const TEP_OSM = path.join(GOC, 'du-lieu-goc/osm-shinjuku.json');
if (!fs.existsSync(TEP_OSM) || process.argv.includes('--lai')) {
  const tuyen = await goi(`[out:json][timeout:120];(
    way["highway"~"^(motorway|trunk|primary|secondary|tertiary|pedestrian|residential|unclassified|living_street)$"](${bbox});
    way["railway"~"^(rail|subway|light_rail)$"]["tunnel"!="yes"](${bbox});
    way["leisure"~"^(park|garden)$"](${bbox}); way["landuse"~"^(grass|forest|recreation_ground)$"](${bbox}); );out geom;`);
  const [s0, w0, n0, e0] = bbox.split(',').map(Number), nha = [];
  for (const [s1, n1] of [[s0, (s0 + n0) / 2], [(s0 + n0) / 2, n0]]) for (const [w1, e1] of [[w0, (w0 + e0) / 2], [(w0 + e0) / 2, e0]]) {
    nha.push(...await goi(`[out:json][timeout:120];way["building"](${s1.toFixed(5)},${w1.toFixed(5)},${n1.toFixed(5)},${e1.toFixed(5)});out tags bb;`));
  }
  const thay = new Map(nha.map((e) => [e.id, e])); // nhà nằm vắt hai ô trả về hai lần
  fs.mkdirSync(path.dirname(TEP_OSM), { recursive: true });
  fs.writeFileSync(TEP_OSM, JSON.stringify({ tuyen, nha: [...thay.values()] }));
}
const { tuyen: osmTuyen, nha: osmNha } = JSON.parse(fs.readFileSync(TEP_OSM, 'utf8'));
const cao = (t) => { const h = parseFloat(t.height); if (h > 0) return h; const l = parseFloat(t['building:levels']); return l > 0 ? l * 3.6 : 0; };
const LOP_DUONG = { motorway: 'lon', trunk: 'lon', primary: 'lon', secondary: 'vua', tertiary: 'vua' };

const ql = { tam: TAM, nua: NUA, thap: [], daiLo: [], pho: [], vuon: [], tau: [], lanBay: [], khoiXa: [], nhaThap: 0 };
for (const e of osmNha) {
  const t = e.tags || {}, h = cao(t), bb = e.bounds; if (!bb) continue;
  if (h < 90) { ql.nhaThap++; continue; }
  const [x0, z0] = xz(bb.maxlat, bb.minlon), [x1, z1] = xz(bb.minlat, bb.maxlon);
  ql.thap.push({ o: [Math.round((x0 + x1) / 2), Math.round((z0 + z1) / 2)], cao: Math.round(h), banKinh: Math.round(Math.min(60, Math.max(18, Math.min(x1 - x0, z1 - z0) * 0.45))), ten: t.name || t['name:en'] || '' });
}
for (const e of osmTuyen) {
  const t = e.tags || {}; if (!e.geometry) continue; const g = e.geometry.map((p) => xz(p.lat, p.lon));
  if (t.highway) {
    const lop = LOP_DUONG[t.highway] || (t.highway === 'pedestrian' && t.name ? 'dibo' : 'nho');
    if (lop === 'lon' || lop === 'vua' || lop === 'dibo') ql.daiLo.push({ lop, ten: t.name || '', g });
    else ql.pho.push(g);
  } else if (t.railway) ql.tau.push(g);
  else ql.vuon.push({ ten: t.name || '', g });
}
// đặt tháp theo luật khớp (public/khop.js): cao trước, dấu chân = banKinh × vetDo hở mép đường ≥ viaHe và hở tháp khác ≥ khe,
// không chỗ thì dời ≤ 120 m, rồi thu bán kính tới rMin, vẫn không được thì bỏ (đếm). Thân mảnh: rộng ≤ cao / thon.
ql.thap.sort((a, b) => b.cao - a.cao);
const luoi = luoiTuyen(ql), daDat = [], gop = []; let boThap = 0, doiThap = 0;
for (const t of ql.thap) {
  const caoSpire = Math.round(t.cao * 1.35 + 30); // tháp đỏ cao hơn nhà thật, chóp vòm + ăng-ten
  const p = datThap(luoi, daDat, t.o[0], t.o[1], banKinhThon(t.banKinh, caoSpire, TL.vetDo), TL.vetDo);
  if (!p) { boThap++; continue; }
  if (Math.hypot(p.x - t.o[0], p.z - t.o[1]) > 1) doiThap++;
  daDat.push({ x: p.x, z: p.z, r: p.banKinh * TL.vetDo });
  gop.push({ ...t, goc: t.o, o: [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10], banKinh: Math.round(p.banKinh * 10) / 10, caoSpire });
}
ql.thap = gop.map((t, i) => ({ ...t, id: i }));
// làn xe bay: chạy trên đại lộ lớn, độ cao 140–220 m
ql.lanBay = ql.daiLo.filter((d) => d.lop === 'lon' && d.g.length > 3).map((d, i) => ({ cao: 140 + (i % 4) * 25, g: d.g.filter((_, k) => k % 3 === 0 || k === d.g.length - 1) }));
// vành khối khổng lồ mờ xa (nền ảnh mẫu): 18 khối ngoài vùng, 2,2–4 km
for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.11, r = 2200 + ((i * 577) % 1800); ql.khoiXa.push({ o: [Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)], cao: 350 + ((i * 331) % 450), rong: 90 + ((i * 97) % 120) }); }

fs.mkdirSync(path.join(GOC, 'public/du-lieu'), { recursive: true });
fs.writeFileSync(path.join(GOC, 'public/du-lieu/quy-hoach.json'), JSON.stringify(ql));

// ---------- bản vẽ duyệt (SVG, nhìn từ trên, bắc lên trên) ----------
const S = 1100 / (NUA * 2), P = (p) => `${((p[0] + NUA) * S).toFixed(1)},${((p[1] + NUA) * S).toFixed(1)}`;
const duong = (g) => 'M' + g.map(P).join('L');
const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1100" font-family="Helvetica,Arial" font-size="15">`,
  `<defs><clipPath id="vung"><rect width="1100" height="1100"/></clipPath></defs><rect width="1500" height="1100" fill="#fff"/><g clip-path="url(#vung)"><rect width="1100" height="1100" fill="#7f93a3"/>`,
  ...ql.vuon.map((v) => `<path d="${duong(v.g)}Z" fill="#6f9a5e" opacity=".85"/>`),
  ...ql.pho.map((g) => `<path d="${duong(g)}" stroke="#9fb0bd" stroke-width="1.2" fill="none"/>`),
  ...ql.tau.map((g) => `<path d="${duong(g)}" stroke="#2d3540" stroke-width="3" stroke-dasharray="8 4" fill="none"/>`),
  ...ql.daiLo.map((d) => `<path d="${duong(d.g)}" stroke="#efe9dc" stroke-width="${d.lop === 'lon' ? 9 : d.lop === 'vua' ? 5 : 4}" stroke-linecap="round" fill="none"/>`),
  ...ql.lanBay.map((l) => `<path d="${duong(l.g)}" stroke="#38d6ff" stroke-width="1.5" stroke-dasharray="3 6" fill="none" opacity=".9"/>`),
  ...ql.thap.map((t) => `<circle cx="${P(t.o).split(',')[0]}" cy="${P(t.o).split(',')[1]}" r="${(t.banKinh * S * 1.6).toFixed(1)}" fill="#d9483a" stroke="#5a120c" stroke-width="1.5"/>`),
  `<circle cx="550" cy="550" r="5" fill="#fff" stroke="#000"/>`, `</g>`,
  `<g transform="translate(1120,30)"><text font-size="22" font-weight="700" y="0">Quy hoạch Red Spires</text><text y="24" fill="#555">Shinjuku · 3 × 3 km · OSM thật</text>`,
  ...[['#d9483a', `Tháp đỏ: ${ql.thap.length} tháp (nhà thật ≥ 90 m)`], ['#efe9dc', `Đại lộ đi bộ lát đá: ${ql.daiLo.length} đoạn`], ['#7f93a3', `Phố thấp xanh xám: ${ql.nhaThap.toLocaleString('vi')} nhà`], ['#6f9a5e', `Vườn / vườn mái: ${ql.vuon.length} khu`], ['#2d3540', `Tuyến tàu trên cao: ${ql.tau.length} đoạn`], ['#38d6ff', `Làn xe bay 140-220 m: ${ql.lanBay.length} làn`]]
    .map(([c, s], i) => `<rect x="0" y="${50 + i * 30}" width="20" height="20" fill="${c}" stroke="#333"/><text x="30" y="${65 + i * 30}">${s}</text>`),
  `<text y="250" fill="#555">Ngoài vùng: ${ql.khoiXa.length} khối khổng lồ mờ trong sương</text>`,
  `<text y="275" fill="#555">Chấm trắng = tâm (35.6900, 139.6975)</text>`,
  `<text y="310" font-weight="700">Tháp cao nhất</text>`,
  ...ql.thap.slice(0, 10).map((t, i) => `<text y="${334 + i * 22}" fill="#333">${t.caoSpire} m ← ${t.cao} m ${t.ten ? '· ' + t.ten.slice(0, 26) : ''}</text>`),
  `</g></svg>`].join('\n');
fs.writeFileSync(path.join(GOC, 'quy-hoach.svg'), svg);
console.log(inKiem('tháp đỏ', kiem(luoi, { thap: ql.thap.map((t) => ({ x: t.o[0], z: t.o[1], r: t.banKinh * TL.vetDo, cao: t.caoSpire, rong: 2 * t.banKinh * TL.vetDo })) })) + ` · dời ${doiThap} · bỏ ${boThap}`);
console.log(`tháp ${ql.thap.length} · đại lộ ${ql.daiLo.length} · phố ${ql.pho.length} · nhà thấp ${ql.nhaThap} · vườn ${ql.vuon.length} · tàu ${ql.tau.length} · làn bay ${ql.lanBay.length}`);
