#!/usr/bin/env node
// SO LỆCH ẢNH THẬT ↔ MÔ HÌNH ở một góc camera (báo từ nút 🔍 trên castle.on.tc, hoặc camera tự đưa): dựng lại ĐÚNG camera (vị trí, hướng, góc nhìn, zoom, khổ),
// chụp hai bản (window.__ns.chupHaiBan — cùng hàm nút trên trang dùng), so viền trời + đường nét (scripts/so-lech.py), dò mỗi vùng lệch ra MẶT TƯỜNG OSM
// ("khối#cạnh", window.__ns.diemTaiAnh) → bảng + ảnh báo cáo khung đỏ đánh số.
//   node apps/castle/scripts/so-lech.mjs --the <id góp ý>            (đọc LECH-JSON / VUNG-JSON trong card hòm góp ý castle qua scripts/gop-y.sh trên box3)
//   node apps/castle/scripts/so-lech.mjs --the <id> --tu-xu   — TỰ XỬ trọn thẻ: đo khối trong vùng đánh dấu trên ảnh 3D, sửa độ cao (sua.json), thử lại giữ
//     phần khớp hơn, kiểm kê không lùi, đẩy lên + chờ deploy, trả lời / nộp thẻ, nút 🔍 nháy xanh + báo cáo
//   node apps/castle/scripts/so-lech.mjs --xong <id> "<đã sửa gì>" [link]   (sửa + deploy xong → nút 🔍 nháy xanh + hiện báo cáo)
//   node apps/castle/scripts/so-lech.mjs --cam '{"p":[x,y,z],"d":[dx,dy,dz],"fov":50,"zoom":60,"w":1280,"h":800}' [--vung '[[[u,v],…]]']
// Ra: apps/castle/.bao-lech/<id | giờ>/ (mo-hinh.png, anh-that.png, lech.json, bao-cao.png)
// tra-repo-ok: keo nội bộ (Playwright qua chung.mjs + so ảnh PIL), dữ liệu riêng của cảnh.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GOC, moTrang } from './chung.mjs';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
// TRẠNG THÁI cho nút 🔍 trên trang (castle-kenh /mp/lech, chỉ nhận từ máy chủ): đang xử → nút nhún; --xong → nháy xanh + hiện báo cáo cho người báo
const baoTT = (o) => { try { execFileSync('ssh', ['root@167.233.241.16', 'curl -s -X POST --data-binary @- http://127.0.0.1:3891/mp/lech'], { input: JSON.stringify(o), encoding: 'utf8', timeout: 20000 }); } catch (e) { console.warn('(không báo được trạng thái nút 🔍:', e.message.split('\n')[0] + ')'); } };
//   node apps/castle/scripts/so-lech.mjs --xong <id> "<đã sửa gì>" [link]   — sau khi sửa + deploy: báo xong cho trang
if (arg('--xong')) { baoTT({ id: arg('--xong'), tt: 'xong', tom: process.argv[process.argv.indexOf('--xong') + 2] || 'Đã sửa xong.', link: process.argv[process.argv.indexOf('--xong') + 3] || '' }); console.log('đã báo xong #' + arg('--xong')); process.exit(0); }
let cam = arg('--cam') ? JSON.parse(arg('--cam')) : null, vung = arg('--vung') ? JSON.parse(arg('--vung')) : [], nhan = arg('--the');
if (nhan) {
  // ngữ cảnh (LECH-JSON) nằm trong instructions + tin gốc trao_doi[0].nguCanh — `gop-y.sh show` không in ngữ cảnh, đọc thẳng (đọc khoá DB trên máy chủ, không in ra)
  if (!/^\d+$/.test(nhan)) { console.error('id thẻ phải là số'); process.exit(1); }
  const txt = execFileSync('ssh', ['root@167.233.241.16', `cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -tAc "SELECT instructions || ' ' || COALESCE(prep_payload->'trao_doi'->0->>'nguCanh','') || ' ' || COALESCE(prep_payload->'trao_doi'->0->>'noiDung','') FROM human_tasks WHERE id = ${nhan}"`], { encoding: 'utf8' });
  const m = txt.match(/LECH-JSON:(\{.*?\})(?:\s|$)/s), v = txt.match(/VUNG-JSON:(\[.*?\]\])(?:\s|$)/s);
  if (!m) { console.error('card #' + nhan + ' không có LECH-JSON (không phải báo lệch từ nút 🔍)'); process.exit(1); }
  cam = JSON.parse(m[1]); if (v) vung = JSON.parse(v[1]);
}
if (!cam) { console.error('cần --the <id> hoặc --cam <json>'); process.exit(1); }
if (nhan) baoTT({ id: nhan, tt: 'dang', viec: 'Đang so lại góc báo lệch' });
const ra = join(GOC, '.bao-lech', nhan || new Date().toISOString().replace(/[:.]/g, '-')); mkdirSync(ra, { recursive: true });
const k = Math.min(1, 1280 / (cam.w || 1280)), khung = { width: Math.round((cam.w || 1280) * k), height: Math.round((cam.h || 800) * k) };
const hopTo = vung.map((n) => { const us = n.map((p) => p[0]), vs = n.map((p) => p[1]); return [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)]; });

// MỘT LƯỢT SO: mở trang, chụp hai bản ở camera, so (so-lech.py), dò mặt tường; doKhoi = true thì đo thêm đỉnh các khối trong vùng trên ảnh 3D
async function luotSo(thu, doKhoi = false) {
  mkdirSync(thu, { recursive: true });
  const { pg, dong } = await moTrang({ anh3d: true, khung });
  const hai = await pg.evaluate((c) => window.__ns.chupHaiBan(c), cam);
  for (const [ten, du] of [['mo-hinh.png', hai.moHinh], ['anh-that.png', hai.anhThat]]) if (du) writeFileSync(join(thu, ten), Buffer.from(du.split(',')[1], 'base64'));
  if (!hai.anhThat) { await dong(); throw new Error('ảnh thật 3D không nạp được (token Cesium chỉ nhận cổng 18777 / castle.on.tc)'); }
  writeFileSync(join(thu, 'vung.json'), JSON.stringify(vung));
  writeFileSync(join(thu, 'nen.json'), JSON.stringify(await pg.evaluate(() => { const c = window.__ns.scene.background; return c?.isColor ? [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)] : null; }) || [169, 196, 221]));
  execFileSync('python3', [join(GOC, 'scripts', 'so-lech.py'), thu, join(thu, 'vung.json')], { stdio: 'pipe' });
  const L = JSON.parse(readFileSync(join(thu, 'lech.json'), 'utf8'));
  for (const r of L.vung) { // tâm vùng → điểm trúng trên mô hình → mặt tường OSM; thử thêm 4 điểm quanh tâm nếu tâm rơi vào trời
    for (const [du, dv] of [[0.5, 0.5], [0.5, 0.75], [0.3, 0.5], [0.7, 0.5], [0.5, 0.25]]) { const t = await pg.evaluate(([u, v]) => window.__ns.diemTaiAnh(u, v), [r.u0 + (r.u1 - r.u0) * du, r.v0 + (r.v1 - r.v0) * dv]); if (t) { r.trung = t; break; } }
    if (r.trung && r.lech_px) { const p = hai.cam.p, kc = Math.hypot(r.trung.diem[0] - p[0], r.trung.diem[1] - p[1], r.trung.diem[2] - p[2]); r.lech_m = +(Math.abs(r.lech_px) * 2 * kc * Math.tan(hai.cam.fov * Math.PI / 360) / khung.height).toFixed(1); }
  }
  writeFileSync(join(thu, 'lech.json'), JSON.stringify(L, null, 1));
  let khoi = [];
  if (doKhoi) { // khối trong vùng tô (không tô: 3 vùng lệch nặng nhất) → đo đỉnh trên ảnh 3D ở góc này
    const hop = hopTo.length ? hopTo : L.vung.slice(0, 3).map((r) => [r.u0, r.v0, r.u1, r.v1]);
    khoi = await pg.evaluate(async (hop) => { const n = window.__ns, ds = n.khoiTrongVung(hop); await n.batAnh3dTam(true); const ra = ds.map((x) => ({ ...x, do: n.doKhoiAnh3d(x.id) })); await n.batAnh3dTam(false); return ra; }, hop);
  }
  await dong();
  execFileSync('python3', [join(GOC, 'scripts', 'so-lech.py'), thu, '--ve'], { stdio: 'pipe' });
  // điểm lệch: tổng điểm các vùng trong vùng tô (không tô: mọi vùng) — thấp hơn là khớp ảnh hơn
  const diem = L.vung.filter((r) => !hopTo.length || r.trong_vung_to).reduce((t, r) => t + r.diem, 0);
  return { L, hai, khoi, diem };
}
const inVung = (L) => L.vung.forEach((r, i) => console.log(`#${i + 1}${r.trong_vung_to ? ' [vùng tô]' : ''} điểm ${r.diem} · ${r.huong}${r.lech_m ? ` ~${r.lech_m} m` : ''} · ô ảnh u ${r.u0}–${r.u1} v ${r.v0}–${r.v1} · ${r.trung?.mat ? `mặt ${r.trung.mat}${r.trung.ten ? ' (' + r.trung.ten + ')' : ''}` : 'không trúng tường (địa hình / trời)'}${r.trung ? ` tại (${r.trung.diem.join(', ')})` : ''}`));

const tuXu = process.argv.includes('--tu-xu');
let goc;
try { goc = await luotSo(join(ra, 'truoc'), tuXu); } catch (e) { console.error('✗', e.message); if (nhan) baoTT({ id: nhan, tt: 'dang', viec: 'Lỗi khi so: ' + e.message }); process.exit(1); }
console.log(`Camera: (${goc.hai.cam.p.join(', ')}) hướng (${goc.hai.cam.d.join(', ')}) · góc nhìn ${goc.hai.cam.fov}° · zoom ${cam.zoom ?? goc.hai.cam.zoom} m · khổ ${khung.width}×${khung.height}${vung.length ? ` · ${vung.length} nét đánh dấu` : ''}`);
inVung(goc.L); console.log(`điểm lệch vùng đánh dấu: ${goc.diem.toFixed(2)} · ảnh: ${join(ra, 'truoc', 'bao-cao.png')}`);
if (!tuXu) {
  if (nhan) { const r = goc.L.vung[0]; baoTT({ id: nhan, tt: 'dang', viec: `Đã so: ${goc.L.vung.length} vùng lệch${r ? `, chính: ${r.huong}${r.trung?.mat ? ' ở mặt ' + r.trung.mat : ''}` : ''}` }); }
  process.exit(0);
}

// ===== TỰ XỬ (--tu-xu): sửa độ cao khối theo ảnh 3D, thử lại, giữ phần làm vùng đánh dấu khớp hơn, đẩy lên, trả lời thẻ, báo xong =====
const SUA = join(GOC, 'public', 'du-lieu', 'neuschwanstein-sua.json'), suaGoc = readFileSync(SUA, 'utf8');
const NGUONG = 1.5; // lệch đỉnh ≥ 1,5 m mới sửa (ảnh 3D sai số ~0,5–1 m)
const de = goc.khoi.filter((x) => x.do && x.do.so >= 15 && Number.isFinite(x.do.h) && Math.abs(x.do.dinhAnh - x.do.dinhMoHinh) >= NGUONG)
  .map((x) => { const d = x.do.dinhAnh - x.do.dinhMoHinh, hMoi = Math.max(2, +(x.do.h + d).toFixed(1)); return { id: x.id, ten: x.ten, h: x.do.h, hMoi, d: +d.toFixed(1), dinhAnh: x.do.dinhAnh, dinhMoHinh: x.do.dinhMoHinh }; });
console.log(`
Khối trong vùng: ${goc.khoi.length} · đo được trên ảnh 3D: ${goc.khoi.filter((x) => x.do).length} · lệch đỉnh ≥ ${NGUONG} m: ${de.length}`);
for (const x of goc.khoi) console.log(`  ${x.id} ${x.ten} phủ ${x.phu}${x.do ? ` · đỉnh ảnh ${x.do.dinhAnh} · mô hình ${x.do.dinhMoHinh} · lệch ${(x.do.dinhAnh - x.do.dinhMoHinh).toFixed(1)} m (${x.do.so} điểm)` : ' · không đo được'}`);
const apDung = (ds) => { const S = JSON.parse(suaGoc); for (const x of ds) { S[x.id] = { ...(S[x.id] || {}), height: String(x.hMoi), ly_do_tu_xu: `tự xử thẻ báo lệch #${nhan}: đỉnh ảnh 3D ${x.dinhAnh} m, mô hình ${x.dinhMoHinh} m → height ${x.h} → ${x.hMoi}` }; } writeFileSync(SUA, JSON.stringify(S, null, 1) + '\n'); };
let giu = [], sau = goc;
if (de.length) {
  apDung(de); const thu = await luotSo(join(ra, 'sau-ca'));
  console.log(`thử sửa cả ${de.length} khối: điểm lệch ${goc.diem.toFixed(2)} → ${thu.diem.toFixed(2)}`);
  if (thu.diem < goc.diem * 0.9) { giu = de; sau = thu; }
  else for (const x of de) { apDung([...giu, x]); const t = await luotSo(join(ra, 'sau-' + x.id.replace('/', '_'))); console.log(`  thử riêng ${x.id}: ${sau.diem.toFixed(2)} → ${t.diem.toFixed(2)}`); if (t.diem < sau.diem * 0.95) { giu.push(x); sau = t; } }
  apDung(giu); if (!giu.length) writeFileSync(SUA, suaGoc);
}
let ket = '', kiemKe = 'không chạy';
if (giu.length) { // không lùi: kiểm kê mặt đã chuẩn hoá vẫn sạch thì mới giữ
  try { execFileSync('node', [join(GOC, 'scripts', 'kiem-ke.mjs'), '--lau', 'neuschwanstein'], { stdio: 'pipe' }); kiemKe = 'sạch'; } catch (e) { kiemKe = 'HỎNG — bỏ sửa: ' + String(e.stdout || '').split('\n').filter((l) => /THIẾU|SAI|CHỒNG/.test(l)).slice(0, 3).join(' | '); writeFileSync(SUA, suaGoc); giu = []; }
}
const tomSua = giu.map((x) => `${x.ten || x.id} ${x.d > 0 ? 'cao thêm' : 'hạ'} ${Math.abs(x.d)} m (height ${x.h} → ${x.hMoi})`).join('; ');
const conLai = sau.L.vung.filter((r) => !hopTo.length || r.trong_vung_to).slice(0, 4).map((r) => `${r.huong}${r.trung?.mat ? ' ở ' + r.trung.mat : ''}`);
if (giu.length) {
  const tin = `castle: tự xử thẻ báo lệch #${nhan} — ${tomSua} (điểm lệch ${goc.diem.toFixed(1)} → ${sau.diem.toFixed(1)})\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  const g = (a) => execFileSync('git', a, { cwd: join(GOC, '..', '..'), encoding: 'utf8', stdio: 'pipe' });
  try { g(['add', SUA]); g(['commit', '-q', '-m', tin]); g(['pull', '--rebase', '--autostash', '-q', 'origin', 'main']); g(['push', '-q', 'origin', 'main']);
    const ma = g(['rev-parse', '--short', 'HEAD']).trim(); console.log('đã đẩy', ma, '— chờ deploy…');
    if (nhan) baoTT({ id: nhan, tt: 'dang', viec: `Đã sửa (${tomSua}), đang đưa lên máy chủ…` });
    try { execFileSync(join(process.env.HOME, 'bin', 'gh-watch'), ['deploy.yml'], { stdio: 'pipe', timeout: 900000 }); } catch { /* gh-watch báo lỗi: vẫn kiểm mã băm dưới */ }
    const md5Tai = execFileSync('md5', ['-q', SUA], { encoding: 'utf8' }).trim(), md5May = execFileSync('ssh', ['root@167.233.241.16', 'md5sum /opt/earns-marketing-os-v2/apps/castle/public/du-lieu/neuschwanstein-sua.json'], { encoding: 'utf8' }).slice(0, 32);
    ket = md5Tai === md5May ? `đã lên castle.on.tc (bản ${ma})` : `đã đẩy bản ${ma} nhưng máy chủ CHƯA khớp — cần kiểm deploy`;
  } catch (e) { ket = 'đẩy lên LỖI: ' + String(e.stderr || e.message).split('\n')[0]; }
}
const bao = giu.length ? `Đã tự sửa: ${tomSua}. Điểm lệch vùng đánh dấu ${goc.diem.toFixed(1)} → ${sau.diem.toFixed(1)}; ${ket}; kiểm kê mặt đã chuẩn: ${kiemKe}.${conLai.length ? ` Còn lệch (cần sửa tay theo quy trình): ${conLai.join('; ')}.` : ''}`
  : `Chưa tự sửa được: ${de.length ? 'thử chỉnh độ cao khối không làm vùng khớp hơn' : 'không có khối lệch đỉnh ≥ ' + NGUONG + ' m trong vùng đánh dấu'}${kiemKe.startsWith('HỎNG') ? ' (' + kiemKe + ')' : ''}. Lệch còn: ${conLai.join('; ') || '—'}. Thẻ để lại hàng chờ.`;
console.log('\n' + bao + '\nẢnh trước / sau: ' + join(ra, 'truoc', 'bao-cao.png') + (giu.length ? ' · ' + join(ra, sau === goc ? 'truoc' : '', 'bao-cao.png') : ''));
if (nhan) {
  baoTT({ id: nhan, tt: 'xong', tom: bao, link: `https://castle.on.tc/neuschwanstein.html#g=t,${goc.hai.cam.p.join(',')},${goc.hai.cam.p.map((v, i) => +(v + goc.hai.cam.d[i] * (cam.zoom || 40)).toFixed(2)).join(',')},${goc.hai.cam.fov}` }); // máy chủ gửi Telegram nhóm MINE kèm link mở đúng góc
  const gy = (lenh, chu) => { try { execFileSync('ssh', ['root@167.233.241.16', `GOPY_TRANG=castle.on.tc /opt/earns-marketing-os-v2/scripts/gop-y.sh ${lenh} ${nhan} "$(cat)"`], { input: chu, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { console.warn('(trả lời thẻ lỗi:', String(e.stderr || e.message).split('\n')[0] + ')'); } };
  gy(giu.length && ket.startsWith('đã lên') ? 'submit' : 'reply', '[so-lech tự xử] ' + bao);
}
