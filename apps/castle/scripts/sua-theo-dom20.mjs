#!/usr/bin/env node
// CHIỀU CAO KHỐI THEO SỐ ĐO CHÍNH THỨC (20/11/2026, anh: "hoàn thiện lâu đài đúng với thiết kế chuẩn, đúng tỉ lệ") — DOM20 của Bayerische Vermessungsverwaltung
// (mặt trên thật, lưới 20 cm, ảnh hàng không; geodaten.bayern.de/opengeodata, CC BY 4.0; tải: scripts/tai-bayern.sh). Trước đó chiều cao lấy theo ảnh 3D Google,
// mà lưới Google bẹp ở khối nhỏ (đo 20/11: tháp tròn Torbau Google thấp hơn DOM20 20 m, cánh Torbau 12 m) → cả cụm cổng thấp hơn thật 5–9 m so với Palas.
// Cách đo (không AI): lưới 1 m trong mặt bằng mỗi khối (dời +7 m đông, +1 m nam: OSM lệch dữ liệu chính thức đúng bằng độ dời đã áp cho ảnh 3D);
//   chỉ lấy điểm nằm SÂU trong mặt bằng ≥ 1,5 m (mép khối dính mái khối bên cạnh: cánh Torbau đo cả mép ra +9,5 m, đo phần trong ra +4,6 m);
//   tại mỗi điểm: DOM20 − mặt trên MÔ HÌNH (tia từ trên xuống). Mốc độ cao cảnh ↔ DHHN2016 = trung vị của các khối mà mô hình đang trùng ảnh 3D Google (≤ 1,5 m).
//   Khối lệch ĐỀU (trung vị lệch ≥ 1,5 m sau khi trừ mốc, độ trải ≤ 2 m) → dời y_tren đúng bằng độ lệch, giữ nguyên dáng mái.
//   Khối lệch KHÔNG đều (độ trải > 2 m: chân mái đúng mà nóc sai, hoặc dáng mái khác) → KHÔNG dời, ghi vào danh sách "dựng lại mái theo LoD2".
// Chỉ khối nằm trong mặt bằng LoD2 của toà "Schloss Neuschwanstein" (nhà phụ ngoài lâu đài dính tán cây trên DOM20 — không đụng).
//   node apps/castle/scripts/sua-theo-dom20.mjs            in bảng (không ghi)
//   node apps/castle/scripts/sua-theo-dom20.mjs --ghi      ghi y_tren vào <lâu>-sua.json (kèm ly_do_dom20 + y_tren_truoc_dom20)
//   node apps/castle/scripts/sua-theo-dom20.mjs --kiem     mã thoát 1 nếu còn khối lệch ≥ 1,5 m (dùng làm bài kiểm)
//   node apps/castle/scripts/sua-theo-dom20.mjs --tu-kiem  bài kiểm thuần của phần tính mốc + độ dời + ghi tệp
// tra-repo-ok: so mô hình riêng của cảnh với raster chính thức; phần đọc GeoTIFF dùng tifffile (venv đo ảnh), không có thư viện nào làm sẵn phép so này.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { GOC, PUB, LAU, du, doiSo, moTrang } from './chung.mjs';
import { chenTruong } from './chen-json.mjs';
const BY = join(GOC, 'du-lieu-goc/bayern'), PY = join(homedir(), '.venvs/castle-khop/bin/python'), DOI = [7, 1], NGUONG = 1.5;
const tv = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; };
/** thuần: [{ id, mh (đỉnh mô hình, m biển), dom (đỉnh DOM20), gg (đỉnh Google | null), n }] → { moc, ds: [{ …, lech }] } — mốc = trung vị (dom − mh) của khối mô hình trùng Google */
export function tinh(ds) {
  const tin = ds.filter((k) => k.n >= 15 && k.gg != null && Math.abs(k.mh - k.gg) <= 1.5 && k.trai <= 2), moc = tv((tin.length >= 5 ? tin : ds).map((k) => k.giua));
  const ra = { moc, soTin: tin.length, ds: ds.map((k) => { const lech = +(k.giua - moc).toFixed(2); return { ...k, lech, viec: Math.abs(lech) < NGUONG && k.trai <= 2 ? null : /^(cone|pyramidal)$/.test(k.mai || '') ? 'chop' : k.trai <= 2 ? 'doi' : 'mai' }; }) }; // chóp nhọn: ảnh hàng không làm cùn mũi → DOM20 luôn thấp hơn chóp thật, không dời theo nó
  // CỤM cùng tên (20/11/2026, Torbau): ≥ 3 khối cùng tên cùng lệch một phía, chênh nhau ≤ 2 m → cả cụm dời MỘT độ lệch (trung vị), kể cả tháp chóp của cụm.
  // Dời từng khối theo số riêng (5,0 … 6,7 m) làm lệch tương quan đã chỉnh giữa các khối (tháp canh đè cửa, huy hiệu rơi) và bỏ lại hai tháp tròn thấp hơn tường.
  const cum = new Map(); for (const k of ra.ds) if (k.ten) (cum.get(k.ten) ?? cum.set(k.ten, []).get(k.ten)).push(k);
  for (const ds_ of cum.values()) { const d = ds_.filter((k) => k.viec === 'doi'), l = d.map((k) => k.lech); if (d.length < 3 || Math.max(...l) - Math.min(...l) > 2 || Math.sign(Math.max(...l)) !== Math.sign(Math.min(...l))) continue;
    const c = +tv(l).toFixed(2); for (const k of ds_) if (k.viec !== 'mai') { k.lechRieng = k.lech; k.lech = c; k.viec = 'doi'; k.cum = true; } }
  return ra;
}
if (doiSo.includes('--tu-kiem')) { let hong = 0; const ok = (d, t) => { console.log(`${d ? '✓' : '✗'} ${t}`); hong += !d; };
  const mau = [...Array(8)].map((_, i) => ({ id: 'k' + i, mh: 1000 + i, gg: 1000 + i, giua: -4 + (i % 2 ? 0.3 : -0.3), trai: 0.6, n: 50 }));
  const r = tinh([...mau, { id: 'cong', mh: 975, gg: 968.5, giua: 0.6, trai: 0.9, n: 40 }, { id: 'palas', mh: 1025.3, gg: 1025.8, giua: -10.4, trai: 3.2, n: 300 }, { id: 'palas2', mh: 1010, gg: 1010.2, giua: -5.2, trai: 2.6, n: 200 }]);
  const tim = (id) => r.ds.find((k) => k.id === id);
  ok(Math.abs(r.moc + 4) < 0.31, 'mốc độ cao ≈ −4 (8 khối chuẩn; khối cổng lệch Google và khối mái lệch hình không được tính vào mốc)');
  ok(tim('cong').viec === 'doi' && Math.abs(tim('cong').lech - (0.6 - r.moc)) < 0.01, 'khối cổng lệch đều +4,6 m → DỜI y_tren');
  ok(tim('palas').viec === 'mai' && tim('palas2').viec === 'mai', 'khối lệch không đều (độ trải 3,2 / 2,6 m) → KHÔNG dời, xếp vào dựng lại mái (kể cả khi trung vị lệch nhỏ)');
  ok(r.ds.filter((k) => k.id.startsWith('k')).every((k) => k.viec === null), 'khối chuẩn (lệch ±0,3 m): không đụng');
  const rc = tinh([...mau, ...[5.0, 5.4, 6.1, 6.2, 6.7].map((v, i) => ({ id: 'tb' + i, ten: 'Torbau', mh: 980, gg: 975, giua: -4 + v, trai: 0.6, n: 30 })), { id: 'tbThap', ten: 'Torbau', mai: 'cone', mh: 980, gg: 960, giua: -4 + 0.3, trai: 0.9, n: 14 }]);
  ok(rc.ds.filter((k) => k.ten === 'Torbau').every((k) => k.viec === 'doi' && Math.abs(k.lech - rc.ds.find((q) => q.id === 'tb0').lech) < 1e-9) && Math.abs(rc.ds.find((k) => k.id === 'tbThap').lech - (6.1 + (-4 - rc.moc))) < 0.35, 'cụm Torbau: 5 khối lệch 5,0–6,7 m + tháp chóp → cả cụm dời cùng một độ lệch (trung vị)');
  ok(tinh([...mau, { id: 'thap', mai: 'cone', mh: 1037.6, gg: 1037.6, giua: -5.9, trai: 1.5, n: 14 }]).ds.at(-1).viec === 'chop', 'tháp chóp nhọn lệch −1,9 m → KHÔNG dời (DOM20 làm cùn mũi chóp)');
  const T = '{\n "a": {\n  "y_tren": "24.0",\n  "ly_do": "x"\n },\n "b": {\n  "ly_do": "y",\n  "y_tren": 5\n }\n}\n', t1 = chenTruong(T, 'a', { y_tren: 29.4, y_tren_truoc_dom20: 24 }), t2 = chenTruong(t1, 'b', { y_tren: 7 }), t3 = chenTruong(t2, 'c', { y_tren: 1 });
  ok(JSON.parse(t1).a.y_tren === 29.4 && JSON.parse(t1).a.ly_do === 'x' && (t1.match(/"y_tren":/g) || []).length === 2, 'ghi đè y_tren ở đầu khối, giữ ly_do');
  ok(JSON.parse(t2).b.y_tren === 7 && JSON.parse(t2).b.ly_do === 'y', 'ghi đè y_tren nằm CUỐI khối (dấu phẩy không hỏng)');
  ok(JSON.parse(t3).c.y_tren === 1, 'khoá mới ở cuối tệp');
  console.log(hong ? `sua-theo-dom20 tự kiểm: HỎNG ${hong}` : 'sua-theo-dom20 tự kiểm: ĐẠT'); process.exit(hong ? 1 : 0); }
for (const f of ['dom20-32631_5268.tif', 'lod2-lau-dai.json']) if (!existsSync(join(BY, f))) { console.error(`thiếu ${join(BY, f)} — chạy scripts/tai-bayern.sh`); process.exit(2); }

const { pg, dong } = await moTrang({ anh3d: false });
const K = await pg.evaluate(() => { const n = window.__ns, T = n.THREE, rc = new T.Raycaster(), xuong = new T.Vector3(0, -1, 0), lop = n.LOP_OSM.filter((o) => o.visible !== false);
  const trong = (x, z, v) => { let t = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) t = !t; } return t; };
  return { goc: n.GOC_Y, ds: n.TUONG_MT.filter((t) => t.k?.id).map((t) => { const xs = t.v.map((p) => p[0]), zs = t.v.map((p) => p[1]), d = [];
    for (let x = Math.ceil(Math.min(...xs)) + 0.5; x < Math.max(...xs); x += 1) for (let z = Math.ceil(Math.min(...zs)) + 0.5; z < Math.max(...zs); z += 1) { if (!trong(x, z, t.v)) continue; rc.set(new T.Vector3(x, 400, z), xuong); const h = rc.intersectObjects(lop, true)[0]; if (h) d.push([x, z, +h.point.y.toFixed(2)]); }
    return { id: t.k.id, ten: t.ten, yTren: t.k.yTren, mai: t.k.tags['roof:shape'] || '', v: t.v, tam: [xs.reduce((a, b) => a + b, 0) / xs.length, zs.reduce((a, b) => a + b, 0) / zs.length], d }; }) }; });
await dong();
const TEP = join(BY, 'diem-mo-hinh.json'); writeFileSync(TEP, JSON.stringify(K));
const py = `
import json, math, sys, numpy as np, tifffile
dom = tifffile.imread(sys.argv[1]); K = json.load(open(sys.argv[2])); dx, dz = float(sys.argv[3]), float(sys.argv[4])
E0, N0, g = 631637.44, 5268614.78, math.radians(1.7498 * math.sin(math.radians(47.5576))); c, s = math.cos(g), math.sin(g)
def cao(x, z):
    n = -z; E = E0 + (c * x - s * n) * 0.99981; N = N0 + (s * x + c * n) * 0.99981; i, j = int((5269000 - N) / 0.2), int((E - 631000) / 0.2)
    return float(dom[i, j]) if 0 <= i < 5000 and 0 <= j < 5000 and dom[i, j] > -1000 else float('nan')
def sau(x, z, v):   # khoảng cách từ điểm tới mép mặt bằng
    m = 1e9
    for a, b in zip(v, v[1:] + v[:1]):
        ux, uz = b[0] - a[0], b[1] - a[1]; L2 = ux * ux + uz * uz or 1e-9; t = max(0, min(1, ((x - a[0]) * ux + (z - a[1]) * uz) / L2)); m = min(m, math.hypot(x - a[0] - t * ux, z - a[1] - t * uz))
    return m
ra = {}
for k in K['ds']:
    for lui in (1.5, 0.75):
        P = [p for p in k['d'] if sau(p[0], p[1], k['v']) >= lui]
        if len(P) >= 8: break
    if len(P) < 8: continue
    m = np.array([p[2] for p in P]) + K['goc']; d = np.array([cao(p[0] + dx, p[1] + dz) for p in P]); ok = np.isfinite(d)
    if ok.sum() < 8: continue
    l = d[ok] - m[ok]; ra[k['id']] = {'mh': float(np.percentile(m[ok], 95)), 'dom': float(np.percentile(d[ok], 95)), 'giua': float(np.median(l)), 'trai': float(np.median(np.abs(l - np.median(l)))), 'n': int(ok.sum()), 'lui': lui}
print(json.dumps(ra))
`;
const r = spawnSync(PY, ['-W', 'ignore', '-c', py, join(BY, 'dom20-32631_5268.tif'), TEP, ...DOI.map(String)], { encoding: 'utf8', maxBuffer: 64e6 }); if (r.status) { console.error(r.stderr); process.exit(1); }
const DOM = JSON.parse(r.stdout.trim().split('\n').pop()), NK = JSON.parse(readFileSync(du('nen'), 'utf8')).khoi || {};
const lauDai = JSON.parse(readFileSync(join(BY, 'lod2-lau-dai.json'), 'utf8')).find((b) => b.ten === 'Schloss Neuschwanstein').day;
const trong = (x, z, v) => { let t = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const [xi, zi] = v[i], [xj, zj] = v[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) t = !t; } return t; };
const vao = K.ds.filter((k) => DOM[k.id] && trong(k.tam[0] + DOI[0], k.tam[1] + DOI[1], lauDai)).map((k) => ({ id: k.id, ten: k.ten, yTren: k.yTren, mai: k.mai, ...DOM[k.id], gg: NK[k.id] ? NK[k.id][2] + K.goc : null }));
const T = tinh(vao);
// khối cùng tên với một cụm vừa dời mà KHÔNG đo được (mặt bằng nhỏ hơn 8 điểm lưới — hai tháp tròn Torbau): dời theo cụm, không để lại thấp hơn tường
for (const k of K.ds) { const c = T.ds.find((q) => q.cum && q.ten === k.ten); if (c && k.ten && !T.ds.some((q) => q.id === k.id)) T.ds.push({ id: k.id, ten: k.ten, yTren: k.yTren, mai: k.mai, mh: k.yTren + K.goc, dom: NaN, gg: null, giua: NaN, trai: 0, n: 0, lui: 0, lech: c.lech, lechRieng: NaN, viec: 'doi', cum: true }); }
const lech = T.ds.filter((k) => k.viec === 'doi').sort((a, b) => Math.abs(b.lech) - Math.abs(a.lech)), mai = T.ds.filter((k) => k.viec === 'mai');
console.log(`${vao.length} khối trong mặt bằng LoD2 của lâu đài · mốc độ cao cảnh ↔ DHHN2016: ${T.moc.toFixed(2)} m (trung vị ${T.soTin} khối mô hình trùng Google) · DỜI chiều cao: ${lech.length} khối · dựng lại MÁI (lệch không đều): ${mai.length} khối`);
console.log('khối'.padEnd(26), 'tên'.padEnd(13), 'điểm', 'đỉnh mô hình', 'đỉnh Google', ' lệch giữa', 'độ trải', ' việc');
for (const k of [...T.ds].sort((a, b) => Math.abs(b.lech) - Math.abs(a.lech))) console.log(k.id.padEnd(26), String(k.ten || '').slice(0, 12).padEnd(13), String(k.n).padStart(4), k.mh.toFixed(1).padStart(12), (k.gg == null ? '—' : k.gg.toFixed(1)).padStart(11), `${k.lech > 0 ? '+' : ''}${k.lech.toFixed(1)}`.padStart(10), k.trai.toFixed(1).padStart(7), k.viec === 'doi' ? (k.lech > 0 ? '  DỜI LÊN' : '  DỜI XUỐNG') + (k.cum ? ` (cả cụm ${k.ten}; riêng khối ${Number.isFinite(k.lechRieng) ? (k.lechRieng > 0 ? '+' : '') + k.lechRieng.toFixed(1) : 'không đo được'})` : '') : k.viec === 'mai' ? '  mái lệch hình → LoD2' : k.viec === 'chop' ? '  chóp nhọn — không dời' : '');
writeFileSync(join(BY, 'so-chieu-cao.json'), JSON.stringify({ luc: new Date().toISOString(), moc: T.moc, doi: DOI, ds: T.ds }, null, 1));
if (doiSo.includes('--ghi') && lech.length) { let txt = readFileSync(du('sua'), 'utf8'); const ngay = new Date().toISOString().slice(0, 10), S0 = JSON.parse(txt);
  for (const k of lech) txt = chenTruong(txt, k.id, { y_tren: +(k.yTren + k.lech).toFixed(2), y_tren_truoc_dom20: S0[k.id]?.y_tren_truoc_dom20 ?? +k.yTren.toFixed(2), /* giữ mốc TRƯỚC lần dời đầu tiên: chạy lại nhiều lượt vẫn biết tổng độ dời (doi-chi-tiet.mjs) */
    ly_do_dom20: !k.n ? `máy đo ${ngay} (scripts/sua-theo-dom20.mjs, không AI): dời theo CỤM ${k.ten} ${k.lech > 0 ? '+' : ''}${k.lech.toFixed(1)} m (khối nhỏ không đủ điểm đo riêng; cả cụm đo trên DOM20 chính thức Bavaria)` : `máy đo ${ngay} (scripts/sua-theo-dom20.mjs, không AI)${k.cum ? `, dời theo CỤM ${k.ten} ${k.lech > 0 ? '+' : ''}${k.lech.toFixed(1)} m` : ''}: DOM20 chính thức Bavaria (mặt trên 20 cm, CC BY 4.0) − mặt trên mô hình = ${(k.lechRieng ?? k.lech) > 0 ? '+' : ''}${(k.lechRieng ?? k.lech).toFixed(1)} m (trung vị ${k.n} điểm lưới 1 m nằm sâu ≥ ${k.lui} m trong mặt bằng, độ trải ${k.trai.toFixed(1)} m, đã trừ mốc cảnh ↔ DHHN2016 ${T.moc.toFixed(2)} m); đỉnh ảnh 3D Google ${k.gg == null ? 'không đo' : k.gg.toFixed(1) + ' m'}, đỉnh mô hình trước ${k.mh.toFixed(1)} m` });
  JSON.parse(txt); writeFileSync(du('sua'), txt); console.log(`đã ghi y_tren cho ${lech.length} khối vào ${du('sua')} — chạy lại không --ghi để xem còn lệch, rồi kiem-ke + trong-tai`); }
if (mai.length) console.log(`chưa dời (mái lệch hình, cần dựng mái theo 214 mặt mái LoD2): ${mai.map((k) => `${k.id}${k.ten ? ' ' + k.ten : ''} (giữa ${k.lech > 0 ? '+' : ''}${k.lech.toFixed(1)}, trải ${k.trai.toFixed(1)})`).join(' · ')}`);
if (doiSo.includes('--kiem')) process.exit(lech.length ? 1 : 0);
