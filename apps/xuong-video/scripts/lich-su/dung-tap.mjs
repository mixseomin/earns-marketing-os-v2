#!/usr/bin/env node
// DỰNG MỘT TẬP KÊNH LỊCH SỬ (02/11/2026, S08 bước 2) trên iMac: tệp tập (tap/<id>.json) → giọng có mốc từng chữ (giong.mts trên box3, chỉ sinh khi
// chưa có — tốn ~$0,10/1.000 ký tự) → chia cảnh theo chữ đầu mỗi câu → trang ban-do.html quay bằng shot-code/dung.mjs → trộn giọng + nhạc nền.
//   node scripts/lich-su/dung-tap.mjs tap/kaliningrad-a.json [--khung 1,8,20 --khung-ra to.jpg] [--giong-lai]
// Tài nguyên ở /Users/htuan/.cache/lich-su/: ne_50m.geojson + ảnh địa hình dia-hinh-*.jpg (Natural Earth, cắt bằng sips từ NE1_HR_LC_SR_W.tif),
// ảnh nền giấy, nv/<nhân vật>.png (AI vẽ + tach-lop.swift), <id>/giong.mp3 + moc-tho.json, <id>/<id>.mp4.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const DIR = dirname(fileURLToPath(import.meta.url)), KHO = `${process.env.HOME}/.cache/lich-su`, BOX = 'root@167.233.241.16';
const tepTap = resolve(DIR, process.argv[2]), tap = JSON.parse(readFileSync(tepTap, 'utf8')), RA = join(KHO, tap.id);
mkdirSync(RA, { recursive: true });

// ---------- giọng (box3, một lần) ----------
if (!existsSync(join(RA, 'moc-tho.json')) || process.argv.includes('--giong-lai')) {
  execFileSync('scp', ['-q', tepTap, `${BOX}:/tmp/tap-${tap.id}.json`]);
  console.log(execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && ../../node_modules/.bin/tsx scripts/lich-su/giong.mts /tmp/tap-${tap.id}.json /tmp/ra-${tap.id} && rm -f /tmp/tap-${tap.id}.json`], { encoding: 'utf8' }).trim());
  execFileSync('scp', ['-q', `${BOX}:/tmp/ra-${tap.id}/*`, RA]); execFileSync('ssh', [BOX, `rm -rf /tmp/ra-${tap.id}`]);
}
// mốc ký tự → chữ {chu, a, b}
const tho = JSON.parse(readFileSync(join(RA, 'moc-tho.json'), 'utf8'));
const kt = tho.flatMap((o) => o.characters.map((ch, i) => ({ ch, a: o.character_start_times_seconds[i], b: o.character_end_times_seconds[i] })));
const tu = []; let cur = null;
for (const k of kt) { if (/\s/.test(k.ch)) { if (cur) tu.push(cur); cur = null; continue; } cur ? (cur.chu += k.ch, cur.b = k.b) : (cur = { chu: k.ch, a: k.a, b: k.b }); }
if (cur) tu.push(cur);
// gán chữ vào câu theo số chữ của từng câu trong tệp tập
let i = 0; const canh = tap.cau.map((c, k) => { const n = c.chu.trim().split(/\s+/).length; const ds = tu.slice(i, i + n); ds.forEach((w) => (w.cau = k)); i += n; return { bd: k ? ds[0]?.a ?? 0 : 0, c: c.canh }; });
if (i !== tu.length) console.warn(`⚠ số chữ giọng (${tu.length}) lệch số chữ kịch bản (${i}) — phụ đề có thể lệch câu`);
const giay = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(RA, 'giong.mp3')], { encoding: 'utf8' }));
const DAI = Math.round((giay + 1.2) * 100) / 100;
canh.forEach((s, k) => (s.kt = canh[k + 1]?.bd ?? DAI));

// ---------- bản đồ: chỉ nước nằm trong vùng các cảnh nhìn tới (nhẹ trang) ----------
const geo = JSON.parse(readFileSync(join(KHO, 'ne_50m.geojson'), 'utf8'));
// ĐÍCH THEO VÙNG (anh 02/11/2026: "mũi tên phải vào giữa đối tượng"): tu / den / o của mũi tên, phương tiện, cờ, ghim khai {iso, vung?} thì máy thay
// bằng TÂM DIỆN TÍCH của các mảnh nước đó (vung = khung lon/lat lọc mảnh, vd Kaliningrad trong Nga) — không ai phải đoán toạ độ tay.
const tamVung = ({ iso, vung }) => { let A = 0, X = 0, Y = 0;
  for (const f of geo.features) { if (f.properties.ADM0_A3 !== iso) continue; const ps = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of ps) { const r = p[0]; const xs = r.map((q) => q[0]), ys = r.map((q) => q[1]);
      if (vung && (Math.max(...xs) < vung[0] || Math.min(...xs) > vung[2] || Math.max(...ys) < vung[1] || Math.min(...ys) > vung[3])) continue;
      for (let i = 0; i < r.length - 1; i++) { const c = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; A += c; X += (r[i][0] + r[i + 1][0]) * c; Y += (r[i][1] + r[i + 1][1]) * c; } } }
  if (!A) throw new Error(`không tìm thấy vùng ${iso} ${vung ?? ''}`); return [Math.round((X / (3 * A)) * 1000) / 1000, Math.round((Y / (3 * A)) * 1000) / 1000]; };
const diem = (v) => (Array.isArray(v) ? v : tamVung(v));
for (const s of canh) { for (const m of [...(s.c.ten || []), ...(s.c.xe || [])]) { m.tu = diem(m.tu); m.den = diem(m.den); }
  for (const m of [...(s.c.co || []), ...(s.c.nhan || [])]) m.o = diem(m.o); s.c.nhay = (s.c.nhay || []).map(diem); s.c.vong = (s.c.vong || []).map(diem); }
const chuan = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');
// NHẮC TÊN LÀ SÁNG (anh 02/11/2026: "đoạn nhắc đến quốc gia như Lithuania thì highlight quốc gia đó trên map"): dò lời đọc từng cảnh — tên nước
// (Natural Earth NAME / NAME_LONG / ADMIN / NAME_<ngôn ngữ tập> + cách gọi chung: Soviet Union, Russian…) → s.c.goi [{iso[], t, ten, o}] sáng đúng lúc chữ
// được đọc; tên thành phố (Natural Earth populated places, viết hoa trong lời) → s.c.tp [{ten, o, t}] chấm + sóng + tên. Không khai tay từng tập.
const NN = (tap.ngon_ngu || 'en').toUpperCase(), SU = ['RUS', 'UKR', 'BLR', 'LTU', 'LVA', 'EST', 'MDA', 'KAZ', 'GEO', 'ARM', 'AZE', 'UZB', 'TKM', 'KGZ', 'TJK'];
const TEN_NUOC = new Map();
for (const f of geo.features) { const p = f.properties; for (const t of [p.NAME, p.NAME_LONG, p.ADMIN, p.NAME_EN, p[`NAME_${NN}`]]) if (t) TEN_NUOC.set(chuan(t).replace(/-/g, ' '), { iso: [p.ADM0_A3], ten: p.NAME_EN || p.NAME }); }
for (const [t, iso, ten] of [['soviet union', SU, 'USSR'], ['ussr', SU, 'USSR'], ['union sovietica', SU, 'URSS'], ['russian', ['RUS'], 'Russia'], ['lithuanian', ['LTU'], 'Lithuania'], ['polish', ['POL'], 'Poland'],
  ['german', ['DEU'], 'Germany'], ['british', ['GBR'], 'United Kingdom'], ['french', ['FRA'], 'France'], ['american', ['USA'], 'United States'], ['chinese', ['CHN'], 'China'], ['japanese', ['JPN'], 'Japan']]) TEN_NUOC.set(t, { iso, ten });
const TP = new Map(); for (const f of JSON.parse(readFileSync(join(KHO, 'ne_50m_places.geojson'), 'utf8')).features) { const p = f.properties; for (const t of [p.name, p.nameascii, ...(p.namealt || '').split('|')]) if (t && t.length > 3) TP.set(chuan(t), { ten: p.name, o: f.geometry.coordinates }); }
// thành phố mà nhãn cảnh đã có tên thì không in trùng
canh.forEach((s, k) => { const ws = tu.filter((w) => w.cau === k); s.c.goi = []; s.c.tp = [];
  for (let i = 0; i < ws.length; i++) for (const n of [3, 2, 1]) { const cum = ws.slice(i, i + n); if (cum.length < n) continue; const key = cum.map((w) => chuan(w.chu)).join(' ');
    const nuoc = TEN_NUOC.get(key); if (nuoc && !s.c.goi.some((g) => g.ten === nuoc.ten)) { s.c.goi.push({ iso: nuoc.iso, ten: nuoc.ten, t: Math.max(0, cum[0].a - s.bd), o: nuoc.iso.length === 1 ? tamVung({ iso: nuoc.iso[0] }) : null }); i += n - 1; break; }
    const tp = n === 1 && /^\p{Lu}/u.test(cum[0].chu) ? TP.get(key) : null; if (tp && !TEN_NUOC.get(key) && !s.c.tp.some((g) => g.ten === tp.ten) && !(s.c.nhan || []).some((l) => chuan(l.chu).includes(chuan(tp.ten)))) { s.c.tp.push({ ten: tp.ten, o: tp.o, t: Math.max(0, cum[0].a - s.bd) }); break; } }
  for (const d of s.c.dau || []) { const w = ws.find((x) => chuan(x.chu) === chuan(d.chu)); if (!w) throw new Error(`cảnh ${k + 1}: dấu không thấy chữ "${d.chu}"`); d.t = Math.max(0, w.a - s.bd); d.o = d.o ? diem(d.o) : null; } });
console.log('nhắc tên:', canh.map((s, k) => [...s.c.goi.map((g) => g.ten), ...s.c.tp.map((g) => `◦${g.ten}`)].join(',') || '—').map((x, k) => `${k + 1}:${x}`).join(' '));
// HƯỚNG THEO ĐỊA LÝ (anh 02/11/2026: "Stalin phải ở bên phải rồi giơ tay về trái — hướng phải đồng nhất với vị trí câu chuyện"): mỗi người có quê (kho que)
// → máy đặt về phía quê so với ĐÍCH của cảnh (đầu mũi tên / chỗ xe tới / vòng / điểm nháy / tâm) và quay mặt về đích. Người không khai quê giữ ben khai tay.
const KHO_QUE = JSON.parse(readFileSync(join(DIR, 'kho.json'), 'utf8')).tai_san;
for (const s of canh) { const dich = s.c.ten?.[0]?.den ?? s.c.xe?.[0]?.den ?? s.c.vong?.[0] ?? s.c.nhay?.[0] ?? s.c.tam;
  for (const n of s.c.nguoi || []) { n.dich = dich; const q = KHO_QUE[n.anh]?.que; if (q) n.que = diem(q); } }
const lo = canh.map((s) => s.c.tam[0]), la = canh.map((s) => s.c.tam[1]), zmin = Math.min(...canh.map((s) => s.c.zoom));
const pad = 1080 / (12 * zmin); const hop = [Math.min(...lo) - pad, Math.min(...la) - pad, Math.max(...lo) + pad, Math.max(...la) + pad];
const G = {};
for (const f of geo.features) {
  const iso = f.properties.ADM0_A3; const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of polys) { const ring = p[0]; const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]);
    if (Math.max(...xs) < hop[0] || Math.min(...xs) > hop[2] || Math.max(...ys) < hop[1] || Math.min(...ys) > hop[3] || Math.max(...xs) - Math.min(...xs) > 300) continue;
    (G[iso] ||= []).push(ring.map(([a, b]) => [Math.round(a * 100) / 100, Math.round(b * 100) / 100])); }
}
// CHỮ TRÊN HÌNH SẠCH DẤU VẾT AI (anh 02/11/2026: "không được có dấu . ở cuối, xoá hết dấu vết AI"): phụ đề bỏ dấu câu cuối chữ (. , ; : …),
// nhãn / chữ to / thẻ kết bỏ mũi tên → … — – và dấu ba chấm — máy lọc lúc dựng nên kịch bản viết sót cũng không lên hình.
const sachChu = (t) => String(t).replace(/\s*[→⟶➜➔]\s*/g, ' ').replace(/…|\.{3}/g, ' ').replace(/\s*[—–]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
for (const w of tu) w.het = /[.?!…]$/u.test(w.chu);   // hết câu: phụ đề ngắt dòng ở đây (dấu bị bỏ khỏi hình)
for (const w of tu) w.chu = w.chu.replace(/[.,;:…]+$/u, '').replace(/^[“"']+|[”"']+$/gu, '');
for (const s of canh) { for (const n of s.c.nhan || []) n.chu = sachChu(n.chu); for (const n of s.c.nguoi || []) n.ten = sachChu(n.ten); if (s.c.chu_to) s.c.chu_to = sachChu(s.c.chu_to); if (s.c.ket) s.c.ket = sachChu(s.c.ket); }
// ĐẠO CỤ THEO THỜI (anh 02/11/2026: "vũ khí cũng phải theo thời, rồi cờ, huy hiệu"): mỗi nhân vật / phương tiện / cờ khai {tep, tu, den} = khoảng năm
// dùng được; cảnh đặt đồ lệch năm (xe tăng năm 1255, Kant năm 1701) thì DỪNG, không dựng. Năm của một món = năm cảnh lúc món đó xuất hiện (nam_sau).
// tài sản từ KHO chung (kho.json: R2 + Studio phim #1186) — tập chỉ gọi tên + dáng; tải về bộ đệm iMac một lần
const KHO_TS = JSON.parse(readFileSync(join(DIR, 'kho.json'), 'utf8')).tai_san;
const DC = { ...KHO_TS, ...Object.fromEntries(Object.entries(tap.nhan_vat || {}).map(([k, v]) => [k, typeof v === 'string' ? { tep: v } : v])) };
const tepDang = async (id, dang) => { const d = DC[id]; if (d.tep) return join(KHO, d.tep); const u = d.dang?.[dang] ?? d.dang?.goc; if (!u) throw new Error(`"${id}" không có dáng ${dang}`);
  const f = join(KHO, 'r2', id, `${dang in (d.dang || {}) ? dang : 'goc'}.png`); if (!existsSync(f)) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer())); } return f; };
// dáng theo CHỮ của giọng: {chu, dang} → [giây trong cảnh, dáng] (chữ đầu tiên trùng trong câu của cảnh, so không dấu câu)
// tranh cảnh: {anh, tu_chu, den_chu} → giây trong cảnh (chữ đầu khớp trong câu; den = hết chữ đó + 0,4 s)
canh.forEach((s, k) => { const t = s.c.tranh; if (!t) return; const tim = (c) => { const w = tu.find((x) => x.cau === k && chuan(x.chu) === chuan(c)); if (!w) throw new Error(`cảnh ${k + 1}: tranh không thấy chữ "${c}"`); return w; };
  t.tu = t.tu_chu ? Math.max(0, tim(t.tu_chu).a - s.bd - 0.2) : (t.tu ?? 0); t.den = t.den_chu ? tim(t.den_chu).b - s.bd + 0.4 : (t.den ?? (s.kt - s.bd));
  if (t.lop_hop_tep) t.lop_hop = JSON.parse(readFileSync(join(KHO, t.lop_hop_tep), 'utf8')); });
canh.forEach((s, k) => { for (const n of s.c.nguoi || []) if (Array.isArray(n.dang)) n.dang = n.dang.map((m) => { const w = tu.find((x) => x.cau === k && chuan(x.chu) === chuan(m.chu)); if (!w) throw new Error(`cảnh ${k + 1}: không thấy chữ "${m.chu}" để đổi dáng`); return [Math.max(0, w.a - s.bd - 0.15), m.dang]; }); });
{ const lech = []; let namTruoc = null;
  canh.forEach((s, k) => { const n0 = s.c.nam ?? namTruoc; namTruoc = s.c.nam_sau?.[1] ?? n0;
    for (const m of [...(s.c.nguoi || []), ...(s.c.xe || []), ...(s.c.co || [])]) { const d = DC[m.anh]; if (!d) { lech.push(`cảnh ${k + 1}: không có đạo cụ "${m.anh}"`); continue; }
      const nam = s.c.nam_sau && (m.tre ?? 0) >= s.c.nam_sau[0] ? s.c.nam_sau[1] : n0;
      if (d.tu == null || d.den == null) lech.push(`"${m.anh}" chưa khai khoảng năm (tu, den)`);
      else if (nam != null && (nam < d.tu || nam > d.den)) lech.push(`cảnh ${k + 1} năm ${nam}: "${m.anh}" chỉ đúng ${d.tu}–${d.den}`); } });
  if (lech.length) { console.error(`✗ đạo cụ lệch thời:\n  ${[...new Set(lech)].join('\n  ')}`); process.exit(3); } }
const cauTep = join(RA, 'cau.json');
let huong = {};
const cauObj = { DAI, nen: pathToFileURL(join(KHO, tap.nen.anh)).href, geo: G, tu, canh,
  dia_hinh: tap.dia_hinh ? { ...tap.dia_hinh, anh: pathToFileURL(join(KHO, tap.dia_hinh.anh)).href } : null,
  nv: await (async () => { const nv = {}; for (const s of canh) for (const m of [...(s.c.nguoi || []), ...(s.c.xe || []), ...(s.c.co || [])]) {
    const ds = ['goc', ...(Array.isArray(m.dang) ? m.dang.map((x) => x[1]) : [])]; for (const d of ds) nv[`${m.anh}:${d}`] ??= pathToFileURL(await tepDang(m.anh, d)).href; }
    // HƯỚNG MẶT từng dáng (huong-mat.swift, Vision yaw: dương = nhìn sang phải màn): đo dáng chưa có rồi ghi lại kho.json — máy dựng lật để mặt nhìn về MỤC TIÊU
    const khoTep = join(DIR, 'kho.json'), khoJ = JSON.parse(readFileSync(khoTep, 'utf8')); let ghiKho = false; huong = {};
    for (const [key, url] of Object.entries(nv)) { const [id, dang] = key.split(':'); const ts = khoJ.tai_san[id]; if (!ts || ts.loai !== 'nhan_vat') continue;
      ts.huong ||= {}; if (!(dang in ts.huong)) { const out = execFileSync('swift', [join(DIR, 'huong-mat.swift'), fileURLToPath(url)], { encoding: 'utf8' }).trim().split(' ').pop();
        const y = Number(out); ts.huong[dang] = Number.isFinite(y) ? (y > 0.08 ? 'phai' : y < -0.08 ? 'trai' : 'thang') : 'thang'; ghiKho = true; }
      huong[key] = ts.huong[dang]; }
    if (ghiKho) writeFileSync(khoTep, JSON.stringify(khoJ, null, 1) + '\n');
    for (const s of canh) if (s.c.tranh) { nv[s.c.tranh.anh] = pathToFileURL(join(KHO, s.c.tranh.anh)).href; if (s.c.tranh.lop) nv[s.c.tranh.lop] = pathToFileURL(join(KHO, s.c.tranh.lop)).href; }
    return nv; })() };
cauObj.huong = huong; writeFileSync(cauTep, JSON.stringify(cauObj));

// ---------- quay hình + tiếng ----------
const dung = (them) => { const r = spawnSync(process.execPath, [join(DIR, '../shot-code/dung.mjs'), '--trang', join(DIR, 'ban-do.html'), '--cau', cauTep, '--rong', '1080', '--cao', '1920', '--fps', '30', ...them], { stdio: 'inherit' }); if (r.status) process.exit(r.status); };
if (arg('khung')) { dung(['--ra', '/dev/null', '--khung', arg('khung'), '--khung-ra', resolve(arg('khung-ra'))]); process.exit(0); }
const hinh = join(RA, 'hinh.mp4'), ra = join(RA, `${tap.id}.mp4`);
dung(['--ra', hinh]);
// TIẾNG ĐỘNG KHỚP HÌNH (0đ, tổng hợp số học): vút khi camera nhảy xa · thịch khi đóng dấu / cắm cờ · giấy khi sang tranh · trống trầm khi đổi năm ·
// chuông nhẹ khi một nước được nhắc tên. Lịch theo giây tuyệt đối; trộn dưới giọng.
const SR = 48000, N = Math.ceil(DAI * SR), sfx = new Float32Array(N); let hat = 11; const rnd = () => ((hat = (hat * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
const dat = (t, len, f, vol) => { const o = Math.round(t * SR); for (let i = 0; i < len * SR && o + i < N; i++) if (o + i >= 0) sfx[o + i] += f(i / SR) * vol; };
const AMT = { vut: (t) => { const k = t / 0.6; return rnd() * Math.sin(Math.PI * k) * (0.3 + 0.7 * k) * 0.5; }, thich: (t) => Math.sin(2 * Math.PI * (90 - 40 * t) * t) * Math.exp(-t * 14) + (t < 0.01 ? rnd() * 0.5 : 0),
  giay: (t) => rnd() * (Math.sin(t * 90) > 0.3 ? 1 : 0.25) * Math.exp(-t * 3) * 0.35, trong: (t) => Math.sin(2 * Math.PI * 62 * t) * Math.exp(-t * 6) + Math.sin(2 * Math.PI * 124 * t) * Math.exp(-t * 12) * 0.3,
  ting: (t) => (Math.sin(2 * Math.PI * 1318 * t) + 0.4 * Math.sin(2 * Math.PI * 1976 * t)) * Math.exp(-t * 5) * 0.35 };
const LEN = { vut: 0.6, thich: 0.5, giay: 0.6, trong: 0.9, ting: 1.0 };
let namCu = null;
canh.forEach((s, k) => { const tr = canh[k - 1]; const a = tr ? tr.c : null; const xa = a ? Math.hypot((s.c.tam[0] - a.tam[0]) * 0.59, s.c.tam[1] - a.tam[1]) : 0;
  if (xa > 6 || (!tr && s.c.mo)) dat(s.bd, LEN.vut, AMT.vut, 0.9);
  const nam = s.c.nam ?? namCu; if (s.c.nam != null && s.c.nam !== namCu && namCu != null) dat(s.bd + 0.1, LEN.trong, AMT.trong, 0.8); if (s.c.nam_sau) dat(s.bd + s.c.nam_sau[0], LEN.trong, AMT.trong, 0.7); namCu = s.c.nam_sau?.[1] ?? nam;
  for (const f of s.c.co || []) dat(s.bd + (f.tre ?? 0.6) + 0.3, LEN.thich, AMT.thich, 0.6);
  for (const d of s.c.dau || []) dat(s.bd + d.t, LEN.thich, AMT.thich, 1.0);
  if (s.c.tranh) dat(s.bd + s.c.tranh.tu - 0.3, LEN.giay, AMT.giay, 0.8);
  for (const g of s.c.goi) dat(s.bd + g.t, LEN.ting, AMT.ting, 0.5); });
const wavSfx = join(RA, 'sfx.wav'); { let dinh = 0; for (const v of sfx) dinh = Math.max(dinh, Math.abs(v)); const g = dinh > 0.95 ? 0.95 / dinh : 1;
  const b = Buffer.alloc(44 + N * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + N * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 2, 40);
  for (let i = 0; i < N; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sfx[i] * g)) * 32767), 44 + i * 2); writeFileSync(wavSfx, b); }
// nhạc nền: hợp âm trầm thở chậm, nằm dưới giọng ~22 dB (0đ, không bản quyền)
const nhac = `0.05*sin(2*PI*98*t)*(0.6+0.4*sin(2*PI*0.08*t))+0.04*sin(2*PI*146.8*t)*(0.6+0.4*sin(2*PI*0.06*t+1))+0.03*sin(2*PI*196*t)*(0.5+0.5*sin(2*PI*0.05*t+2))`;
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', hinh, '-i', join(RA, 'giong.mp3'), '-f', 'lavfi', '-t', String(DAI), '-i', `aevalsrc='${nhac}':s=48000`, '-i', wavSfx,
  '-filter_complex', '[1:a]volume=1.0[g];[2:a]volume=0.5,afade=t=in:d=1.5,afade=t=out:st=' + (DAI - 1.5) + ':d=1.5[n];[3:a]volume=0.35[s];[g][n][s]amix=inputs=3:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5[a]',
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', String(DAI), '-movflags', '+faststart', ra], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
console.log(`${ra} · ${DAI}s · ${canh.length} cảnh · ${tu.length} chữ`);
