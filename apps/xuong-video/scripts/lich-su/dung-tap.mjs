#!/usr/bin/env node
// DỰNG MỘT TẬP KÊNH LỊCH SỬ (02/11/2026, S08 bước 2) trên iMac: tệp tập (tap/<id>.json) → giọng có mốc từng chữ (giong.mts trên box3, chỉ sinh khi
// chưa có — tốn ~$0,10/1.000 ký tự) → chia cảnh theo chữ đầu mỗi câu → trang ban-do.html quay bằng shot-code/dung.mjs → trộn giọng + nhạc nền.
//   node scripts/lich-su/dung-tap.mjs tap/kaliningrad-a.json [--khung 1,8,20 --khung-ra to.jpg] [--giong-lai]
// Tài nguyên ở /Users/htuan/.cache/lich-su/: ne_50m.geojson + ảnh địa hình dia-hinh-*.jpg (Natural Earth, cắt bằng sips từ NE1_HR_LC_SR_W.tif),
// ảnh nền giấy, nv/<nhân vật>.png (AI vẽ + tach-lop.swift), <id>/giong.mp3 + moc-tho.json, <id>/<id>.mp4.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BOX, box, len } from './box3.mjs';
import { geo, tamVung, chuan, TP_NHAC, dichCua, diem, isoVung, datThaiBinh, kinh, vong, khungDoi } from './dia-ly.mjs';
import { hoSoTap, playlistCuaTap } from './playlist.mjs';
import { soHinhCau } from './so-hinh.mjs';

const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const DIR = dirname(fileURLToPath(import.meta.url)), KHO = `${process.env.HOME}/.cache/lich-su`;
const tepTap = resolve(DIR, process.argv[2]), tap = JSON.parse(readFileSync(tepTap, 'utf8')), RA = join(KHO, tap.id);
mkdirSync(RA, { recursive: true });
// KÊNH (kenh.json, tap.kenh — thiếu = saga): theme hình ban-do.html, bảng màu đất, nhạc nền, bộ tiếng động
const KENH0 = JSON.parse(readFileSync(join(DIR, 'kenh.json'), 'utf8'))[tap.kenh ?? 'saga'];
if (!KENH0) throw new Error(`không có kênh "${tap.kenh}" trong kenh.json`);
const KENH = hoSoTap(KENH0, { playlist: playlistCuaTap(KENH0, tap.playlist ?? null), mau: tap.mau ?? null });   // playlist (series) + mẫu (khuôn video: trần thời lượng…) đè kênh (playlist.mjs › hoSoTap)

// ---------- giọng (box3, một lần) ----------
// giọng gắn với ĐÚNG lời đọc: lời trong tệp tập đổi (máy viết lại) thì đọc lại, không dùng giọng cũ lệch chữ
const loiDoc = tap.cau.map((c) => c.chu.trim()).join(' '), tepLoi = join(RA, 'giong.txt');
if (!existsSync(join(RA, 'moc-tho.json')) || process.argv.includes('--giong-lai') || (existsSync(tepLoi) && readFileSync(tepLoi, 'utf8') !== loiDoc)) {
  len(tepTap, `/tmp/tap-${tap.id}.json`);
  console.log(box(`scripts/lich-su/giong.mts /tmp/tap-${tap.id}.json /tmp/ra-${tap.id}`));
  execFileSync('scp', ['-q', `${BOX}:/tmp/ra-${tap.id}/*`, RA]); execFileSync('ssh', [BOX, `rm -rf /tmp/ra-${tap.id} /tmp/tap-${tap.id}.json`]);
}
// mốc ký tự → chữ {chu, a, b}
writeFileSync(tepLoi, loiDoc);
const tho = JSON.parse(readFileSync(join(RA, 'moc-tho.json'), 'utf8'));
// TRẦN THỜI LƯỢNG của kênh (kenh.json toi_da_giay — YouTube Shorts ≤ 180 s): giọng dài hơn trần thì TĂNG TỐC giọng (atempo, ≤ 1,15×, giữ cao độ) và co mốc
// từng chữ theo cùng hệ số — không đọc lại, 0đ. Quá 1,15× vẫn không vừa thì báo, không ép giọng nhanh tới mức nghe lạ.
let GIONG = join(RA, 'giong.mp3');
{ const goc = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', GIONG], { encoding: 'utf8' })), tran = KENH.toi_da_giay;
  if (tran && goc + (KENH.duoi ?? 1.2) > tran) { const f = Math.round(((goc + (KENH.duoi ?? 1.2)) / tran) * 1000) / 1000;
    if (f > 1.18) console.warn(`⚠ giọng ${goc.toFixed(1)}s quá trần ${tran}s cần ${f}× — chỉ tăng 1,18×, phần dư rút ở đuôi kết`);
    const he = Math.min(1.18, f), ra = join(RA, 'giong-phat.mp3'); execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', GIONG, '-filter:a', `atempo=${he}`, '-b:a', '192k', ra]); GIONG = ra;
    for (const o of tho) { o.character_start_times_seconds = o.character_start_times_seconds.map((v) => v / he); o.character_end_times_seconds = o.character_end_times_seconds.map((v) => v / he); }
    console.log(`giọng ${goc.toFixed(1)}s → ${(goc / he).toFixed(1)}s (×${he}, trần kênh ${tran}s)`); } }
const kt = tho.flatMap((o) => o.characters.map((ch, i) => ({ ch, a: o.character_start_times_seconds[i], b: o.character_end_times_seconds[i] })));
const tu = []; let cur = null;
for (const k of kt) { if (/\s/.test(k.ch)) { if (cur) tu.push(cur); cur = null; continue; } cur ? (cur.chu += k.ch, cur.b = k.b) : (cur = { chu: k.ch, a: k.a, b: k.b }); }
if (cur) tu.push(cur);
// gán chữ vào câu theo số chữ của từng câu trong tệp tập
// SỐ THÀNH HÌNH (Full Story 2.0): hồ sơ tập bật hinh_so → mỗi cảnh mang _so = số của chính câu + mốc giây giọng đọc tới số (so-hinh.mjs, chỉ từ su_that)
let i = 0; const canh = tap.cau.map((c, k) => { const n = c.chu.trim().split(/\s+/).length; const ds = tu.slice(i, i + n); ds.forEach((w) => (w.cau = k)); i += n; return { bd: k ? ds[0]?.a ?? 0 : 0, c: Object.assign(c.canh, { _dua: !(c.su_that || []).length, _so: KENH.hinh_so ? soHinhCau(c, ds) : [] }) }; });
if (i !== tu.length) console.warn(`⚠ số chữ giọng (${tu.length}) lệch số chữ kịch bản (${i}) — phụ đề có thể lệch câu`);
const giay = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', GIONG], { encoding: 'utf8' }));
// VIDEO KHÔNG BAO GIỜ VƯỢT TRẦN KÊNH (03/11/2026: giọng 204 s, tăng tốc chỉ tới 1,15× → video 181 s > 180 s Shorts): thiếu chỗ thì rút đuôi kết (≥ 1,2 s);
// vẫn quá trần thì DỪNG có lỗi, không xuất video quá trần (kịch bản phải ngắn lại)
const DUOI = KENH.toi_da_giay ? Math.min(KENH.duoi ?? 1.2, Math.max(1.2, KENH.toi_da_giay - giay - 0.1)) : (KENH.duoi ?? 1.2);
if (KENH.toi_da_giay && giay + DUOI > KENH.toi_da_giay) { console.error(`✗ video ${(giay + DUOI).toFixed(1)}s vượt trần kênh ${KENH.toi_da_giay}s kể cả khi tăng tốc giọng 1,18× + rút đuôi — kịch bản phải ngắn lại`); process.exit(5); }
const DAI = Math.round((giay + DUOI) * 100) / 100;   // đuôi sau chữ cuối: thẻ kết (lá cải: vòng khép + THE END)
canh.forEach((s, k) => (s.kt = canh[k + 1]?.bd ?? DAI));

// ---------- bản đồ: chỉ nước nằm trong vùng các cảnh nhìn tới (nhẹ trang) ----------
// ĐÍCH THEO VÙNG (anh 02/11/2026: "mũi tên phải vào giữa đối tượng"): tu / den / o của mũi tên, phương tiện, cờ, ghim khai {iso, vung?} thì máy thay
// bằng TÂM DIỆN TÍCH của các mảnh nước đó (vung = khung lon/lat lọc mảnh, vd Kaliningrad trong Nga) — không ai phải đoán toạ độ tay.
// TỰ ĐIỀN CẢNH (02/11/2026, S08 bước 3 — máy viết tập lam-tap.mjs chỉ khai Ý cảnh): cảnh thiếu tam/zoom → máy tính từ nhin (khung bao các đích, chừa
// chỗ người + phụ đề); vĩ tuyến chuẩn theo vùng tập; tô thiếu màu → bảng màu đất theo thứ tự nước xuất hiện (một nước một màu cả tập); mo:true = lao
// từ trên cao xuống; ảnh địa hình cắt tự động đúng vùng tập từ Natural Earth (bộ đệm theo khung).
{ const ds = canh.flatMap((s) => [...(s.c.nhin || []), ...(s.c.to || []).map((t) => (typeof t === 'string' ? t : t.noi))]).filter((d) => typeof d === 'string').map((d) => { try { const h = dichCua(d).h; return (h[0] + h[2]) / 2; } catch { return 0; } });
  if (tap.thai_binh ?? (ds.some((x) => x > 120) && ds.some((x) => x < -120))) datThaiBinh(true); }
const MAU = KENH.mau_dat, mauNuoc = new Map();
const mauCua = (iso) => { const k = Array.isArray(iso) ? iso.join() : iso; if (!mauNuoc.has(k)) mauNuoc.set(k, MAU[mauNuoc.size % MAU.length]); return mauNuoc.get(k); };
const hopCanh = (c) => (c.nhin?.length ? c.nhin : (c.to || []).map((t) => (typeof t === 'string' ? t : t.noi ?? (t.iso && !Array.isArray(t.iso) ? (t.vung ? `${t.iso}@${t.vung}` : t.iso) : null))).filter(Boolean))
  .map((d) => dichCua(d).h).reduce((h, b) => (h ? [Math.min(h[0], b[0]), Math.min(h[1], b[1]), Math.max(h[2], b[2]), Math.max(h[3], b[3])] : b), null);
const VT = tap.vi_tuyen ?? (() => { const ls = canh.map((s) => { if (s.c.tam) return s.c.tam[1]; const h = hopCanh(s.c); return h ? (h[1] + h[3]) / 2 : null; }).filter((v) => v != null);
  return Math.round(Math.max(-60, Math.min(62, ls.reduce((a, b) => a + b, 0) / ls.length))); })();
const COS = Math.cos((VT * Math.PI) / 180);
let truoc = null;
for (const s of canh) { const c = s.c;
  s.c._tamKhai = !!(c.tam && c.zoom);
  if (!c.tam || !c.zoom) { const h = hopCanh(c) ?? truoc; if (!h) throw new Error('cảnh không có tam/zoom và không có nhin để máy tự tính');
    const dl = Math.max(4, h[2] - h[0]), db = Math.max(2.5, h[3] - h[1]), coNguoi = (c.nguoi || []).length > 0;
    c.tam ||= [Math.round(((h[0] + h[2]) / 2) * 100) / 100, Math.round(((h[1] + h[3]) / 2 - (coNguoi ? db * 0.08 : 0)) * 100) / 100];
    c.zoom ||= Math.round(Math.max(1.2, Math.min(14, 0.78 * 1080 / (dl * 12 * COS), (coNguoi ? 0.46 : 0.62) * 1920 / (db * 12))) * 100) / 100; }
    // cảnh có chữ hook to ở đầu khung: đẩy đích xuống ~0,12 khung để vòng đỏ không đè chữ
    if (c.chu_to && !s.c._tamKhai) c.tam[1] = Math.round((c.tam[1] + (0.12 * 1920) / (12 * c.zoom)) * 100) / 100;
  truoc = [c.tam[0] - 2, c.tam[1] - 1, c.tam[0] + 2, c.tam[1] + 1];
  if (c.mo === true) c.mo = { tu_tam: c.tam, tu_zoom: Math.max(1.2, c.zoom / 3) };
  c.to = (c.to || []).map((t) => { const o = typeof t === 'string' ? isoVung(t) : { ...t, ...(typeof t.noi === 'string' ? isoVung(t.noi) : {}) }; delete o.noi; if (o.vung) o.vung = khungDoi(o.vung); o.mau ||= mauCua(o.chu ?? o.iso); return o; });
  for (const m of c.ten || []) m.mau ||= '#9e2b25';
  for (const m of c.xe || []) { m.tre ??= 0.4; m.giay ??= 2.6; } }
if (!tap.dia_hinh) { let h = null;
  for (const s of canh) for (const [t, z] of [[s.c.tam, s.c.zoom], ...(s.c.mo ? [[s.c.mo.tu_tam, s.c.mo.tu_zoom]] : [])]) { const nl = 540 / (12 * z * COS), nb = 1150 / (12 * z);
    const b = [t[0] - nl, t[1] - nb, t[0] + nl, t[1] + nb]; h = h ? [Math.min(h[0], b[0]), Math.min(h[1], b[1]), Math.max(h[2], b[2]), Math.max(h[3], b[3])] : b; }
  const l0 = Math.max(-180, Math.floor(h[0] - 3)), b0 = Math.max(-84, Math.floor(h[1] - 3)), l1 = Math.min(l0 + 360, Math.ceil(h[2] + 3)), b1 = Math.min(84, Math.ceil(h[3] + 3));
  const ten = `dia-hinh-${l0}_${b0}_${l1}_${b1}.jpg`, f = join(KHO, ten);
  if (!existsSync(f)) { const tif = join(KHO, 'ne_hr', 'NE1_HR_LC_SR_W.tif'), hh = (b1 - b0) * 60;
    const cat = (a, b, ra) => execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-c', String(hh), String((b - a) * 60), '--cropOffset', String((90 - b1) * 60), String((a + 180) * 60), tif, '--out', ra], { stdio: 'ignore' });
    // vắt qua kinh tuyến 180: cắt hai mảnh (l0..180 và -180..l1-360) rồi ghép ngang
    if (l1 <= 180) cat(l0, l1, f); else { const a = `${f}.a.jpg`, b = `${f}.b.jpg`; cat(l0, 180, a); cat(-180, l1 - 360, b);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', a, '-i', b, '-filter_complex', 'hstack', '-q:v', '3', f]); execFileSync('rm', ['-f', a, b]); }
    if ((l1 - l0) * 60 > 12000) execFileSync('sips', ['-Z', '12000', f], { stdio: 'ignore' }); }
  tap.dia_hinh = { anh: ten, lon: [l0, l1], lat: [b0, b1], nguon: 'Natural Earth NE1_HR_LC_SR_W (public domain), máy tự cắt theo vùng tập' }; }
tap.nen ||= { anh: 'giay.jpg', nguon: 'https://www.pexels.com/photo/close-up-of-a-piece-of-paper-7952505/' };
for (const s of canh) { for (const m of [...(s.c.ten || []), ...(s.c.xe || [])]) { m.tu = diem(m.tu); m.den = diem(m.den); }
  for (const m of [...(s.c.co || []), ...(s.c.nhan || [])]) m.o = diem(m.o); for (const m of s.c.ke || []) { m.tu = diem(m.tu); m.den = diem(m.den); } s.c.nhay = (s.c.nhay || []).map(diem); s.c.vong = (s.c.vong || []).map(diem); }
// NHẮC TÊN LÀ SÁNG (anh 02/11/2026: "đoạn nhắc đến quốc gia như Lithuania thì highlight quốc gia đó trên map"): dò lời đọc từng cảnh — tên nước
// (Natural Earth NAME / NAME_LONG / ADMIN / NAME_<ngôn ngữ tập> + cách gọi chung: Soviet Union, Russian…) → s.c.goi [{iso[], t, ten, o}] sáng đúng lúc chữ
// được đọc; tên thành phố (Natural Earth populated places, viết hoa trong lời) → s.c.tp [{ten, o, t}] chấm + sóng + tên. Không khai tay từng tập.
// CHỮ GỌI (dáng / dấu / tranh / năm đổi): một chữ hoặc CỤM chữ liền nhau trong câu của cảnh (máy viết hay ghi cụm) → {a: giây đầu cụm, b: giây cuối cụm}
const timChu = (k, cum) => { const ws = tu.filter((x) => x.cau === k), q = String(cum).split(/\s+/).map(chuan).filter(Boolean);
  for (let i = 0; q.length && i + q.length <= ws.length; i++) if (q.every((c, j) => chuan(ws[i + j].chu) === c)) return { a: ws[i].a, b: ws[i + q.length - 1].b };
  return null; };
const NN = (tap.ngon_ngu || 'en').toUpperCase(), SU = ['RUS', 'UKR', 'BLR', 'LTU', 'LVA', 'EST', 'MDA', 'KAZ', 'GEO', 'ARM', 'AZE', 'UZB', 'TKM', 'KGZ', 'TJK'];
const TEN_NUOC = new Map();
for (const f of geo.features) { const p = f.properties; for (const t of [p.NAME, p.NAME_LONG, p.ADMIN, p.NAME_EN, p[`NAME_${NN}`]]) if (t) TEN_NUOC.set(t.split(/[\s-]+/).map(chuan).filter(Boolean).join(' '), { iso: [p.ADM0_A3], ten: (NN === 'EN' ? null : p[`NAME_${NN}`]) || p.NAME_EN || p.NAME }); }
for (const [t, iso, ten] of [['soviet union', SU, 'USSR'], ['ussr', SU, 'USSR'], ['union sovietica', SU, 'URSS'], ['russian', ['RUS'], 'Russia'], ['lithuanian', ['LTU'], 'Lithuania'], ['polish', ['POL'], 'Poland'],
  ['german', ['DEU'], 'Germany'], ['british', ['GBR'], 'United Kingdom'], ['french', ['FRA'], 'France'], ['american', ['USA'], 'United States'], ['chinese', ['CHN'], 'China'], ['japanese', ['JPN'], 'Japan'],
  ['spanish', ['ESP'], 'Spain'], ['portuguese', ['PRT'], 'Portugal'], ['moroccan', ['MAR'], 'Morocco'], ['danish', ['DNK'], 'Denmark'], ['norwegian', ['NOR'], 'Norway'], ['mexican', ['MEX'], 'Mexico'],
  ['britain', ['GBR'], 'United Kingdom'], ['england', ['GBR'], 'United Kingdom'], ['urss', SU, 'URSS'], ['eeuu', ['USA'], 'Estados Unidos'], ['ee uu', ['USA'], 'Estados Unidos'],
  ['espanol', ['ESP'], 'España'], ['espanoles', ['ESP'], 'España'], ['portugues', ['PRT'], 'Portugal'], ['portugueses', ['PRT'], 'Portugal'], ['boliviano', ['BOL'], 'Bolivia'], ['bolivianos', ['BOL'], 'Bolivia'],
  ['chileno', ['CHL'], 'Chile'], ['chilenos', ['CHL'], 'Chile'], ['peruano', ['PER'], 'Perú'], ['peruanos', ['PER'], 'Perú'], ['ruso', ['RUS'], 'Rusia'], ['rusos', ['RUS'], 'Rusia'],
  ['estadounidense', ['USA'], 'Estados Unidos'], ['brasileno', ['BRA'], 'Brasil'], ['brasilenos', ['BRA'], 'Brasil'], ['frances', ['FRA'], 'Francia'], ['britanico', ['GBR'], 'Reino Unido'], ['aleman', ['DEU'], 'Alemania'],
  ['marroqui', ['MAR'], 'Marruecos'], ['argentino', ['ARG'], 'Argentina'], ['mexicano', ['MEX'], 'México']]) TEN_NUOC.set(t, { iso, ten });
// "America" chỉ là nước Mỹ trong tiếng Anh; tiếng Tây Ban Nha "América" là châu lục
if (NN === 'EN') TEN_NUOC.set('america', { iso: ['USA'], ten: 'United States' });
// thành phố mà nhãn cảnh đã có tên thì không in trùng
// thành phố chỉ chấm khi nằm trong nước có mặt trong tập (Colón ở Panama không hiện khi lời đọc nhắc Colón = Columbus)
const NUOC_TAP = new Set(canh.flatMap((s) => [...(s.c.to || []).flatMap((t) => [t.iso, t.chu].flat()), ...(s.c.nhin || []).filter((d) => typeof d === 'string' && !d.startsWith('@') && !/^-?\d/.test(d)).map((d) => d.split('@')[0])]).filter(Boolean));
canh.forEach((s, k) => { const ws = tu.filter((w) => w.cau === k); s.c.goi = []; s.c.tp = [];
  for (let i = 0; i < ws.length; i++) for (const n of [3, 2, 1]) { const cum = ws.slice(i, i + n); if (cum.length < n) continue; const key = cum.map((w) => chuan(w.chu)).join(' ');
    const nuoc = TEN_NUOC.get(key); if (nuoc && !s.c.goi.some((g) => g.ten === nuoc.ten)) { s.c.goi.push({ iso: nuoc.iso, ten: nuoc.ten, t: Math.max(0, cum[0].a - s.bd), o: nuoc.iso.length === 1 ? tamVung({ iso: nuoc.iso[0] }) : null }); i += n - 1; break; }
    const tp = n === 1 && /^\p{Lu}/u.test(cum[0].chu) ? TP_NHAC.get(key) : null; if (tp && NUOC_TAP.has(tp.iso) && !TEN_NUOC.get(key) && !s.c.tp.some((g) => g.ten === tp.ten) && !(s.c.nhan || []).some((l) => chuan(l.chu).includes(chuan(tp.ten)))) { s.c.tp.push({ ten: tp.ten, o: kinh(tp.o), t: Math.max(0, cum[0].a - s.bd) }); break; } }
  for (const d of s.c.dau || []) { const w = timChu(k, d.chu); if (!w) throw new Error(`cảnh ${k + 1}: dấu không thấy chữ "${d.chu}"`); d.t = Math.max(0, w.a - s.bd); d.o = d.o ? diem(d.o) : null; } });
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
  for (const p of polys) { const ring = vong(p[0]); const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]);
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
canh.forEach((s, k) => { const t = s.c.tranh; if (!t) return; const tim = (c) => { const w = timChu(k, c); if (!w) throw new Error(`cảnh ${k + 1}: tranh không thấy chữ "${c}"`); return w; };
  t.tu = t.tu_chu ? Math.max(0, tim(t.tu_chu).a - s.bd - 0.2) : (t.tu ?? 0); t.den = t.den_chu ? tim(t.den_chu).b - s.bd + 0.4 : (t.den ?? (s.kt - s.bd));
  if (t.lop_hop_tep) t.lop_hop = JSON.parse(readFileSync(join(KHO, t.lop_hop_tep), 'utf8')); });
canh.forEach((s, k) => { for (const n of s.c.nguoi || []) if (Array.isArray(n.dang)) n.dang = n.dang.map((m) => { const w = timChu(k, m.chu); if (!w) throw new Error(`cảnh ${k + 1}: không thấy chữ "${m.chu}" để đổi dáng`); return [Math.max(0, w.a - s.bd - 0.15), m.dang]; }); });
// người chưa khai tre → bước vào ngay trước chữ gọi dáng đầu tiên; năm đổi giữa cảnh khai {chu, nam} → [giây, năm]
canh.forEach((s, k) => { for (const n of s.c.nguoi || []) if (n.tre == null && Array.isArray(n.dang) && n.dang.length) n.tre = Math.max(0.2, n.dang[0][0] - 0.45);
  const ns = s.c.nam_sau; if (ns && !Array.isArray(ns)) { const w = timChu(k, ns.chu); if (!w) throw new Error(`cảnh ${k + 1}: nam_sau không thấy chữ "${ns.chu}"`); s.c.nam_sau = [Math.max(0, w.a - s.bd - 0.1), ns.nam]; } });
{ const lech = []; let namTruoc = null;
  canh.forEach((s, k) => { const n0 = s.c.nam ?? namTruoc; namTruoc = s.c.nam_sau?.[1] ?? n0;
    for (const m of [...(s.c.nguoi || []), ...(s.c.xe || []), ...(s.c.co || [])]) { const d = DC[m.anh]; if (!d) { lech.push(`cảnh ${k + 1}: không có đạo cụ "${m.anh}"`); continue; }
      const nam = s.c.nam_sau && (m.tre ?? 0) >= s.c.nam_sau[0] ? s.c.nam_sau[1] : n0;
      if (d.tu == null || d.den == null) lech.push(`"${m.anh}" chưa khai khoảng năm (tu, den)`);
      else if (nam != null && (nam < d.tu || nam > d.den)) lech.push(`cảnh ${k + 1} năm ${nam}: "${m.anh}" chỉ đúng ${d.tu}–${d.den}`); } });
  if (lech.length) { console.error(`✗ đạo cụ lệch thời:\n  ${[...new Set(lech)].join('\n  ')}`); process.exit(3); } }
const cauTep = join(RA, 'cau.json');
let huong = {};
const cauObj = { DAI, theme: KENH.theme, nhan_dien: KENH.nhan_dien ?? null, hinh_so: !!KENH.hinh_so, ket_mau: KENH.ket, tcn: (tap.ngon_ngu || 'en') === 'es' ? 'a. C.' : 'BC', vi_tuyen: VT, nen: pathToFileURL(join(KHO, tap.nen.anh)).href, geo: G, tu, canh,
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
// --soat <thư mục>: 8 khung GIỮA CẢNH rải đều (đúng cách tap-day chọn khung soát cho Ngọc) — lam-tap cho Ngọc xem trước khi dựng cả tập
if (arg('soat')) { const ds = canh.length <= 8 ? canh : Array.from({ length: 8 }, (_, i) => canh[Math.round((i * (canh.length - 1)) / 7)]);
  dung(['--ra', '/dev/null', '--khung', ds.map((s) => ((s.bd + s.kt) / 2).toFixed(2)).join(','), '--khung-ra', `${resolve(arg('soat'))}/`]); process.exit(0); }
const hinh = join(RA, 'hinh.mp4'), ra = join(RA, `${tap.id}.mp4`);
// ĐOẠN = CẢNH, khoá = nội dung cảnh + cảnh trước (camera bay từ đó) + chữ phụ đề trong cảnh + phần chung của tập + mã trang dựng + dấu tệp ảnh.
// Lượt sau chỉ đổi vài cảnh (gắn hook, sửa một cảnh) → các cảnh khác dùng lại từ kho, dung.mjs còn so khung đầu + cuối từng byte trước khi dùng.
{ const { createHash } = await import('node:crypto'), h = (o) => createHash('sha1').update(typeof o === 'string' ? o : JSON.stringify(o)).digest('hex').slice(0, 16);
  const { canh: _c, tu: _t, ...chung } = cauObj, dauTep = Object.values(cauObj.nv || {}).map((u) => { try { const st = statSync(fileURLToPath(u)); return `${u}:${st.size}:${st.mtimeMs}`; } catch { return u; } });
  const goc = h([chung, dauTep, readFileSync(join(DIR, 'ban-do.html'), 'utf8')]);
  const doan = canh.map((s, k) => ({ bd: k ? s.bd : 0, khoa: h([goc, canh[k - 1] ?? null, s, tu.filter((w) => w.a >= s.bd - 1 && w.a < s.kt + 1)]) }));
  const doanTep = join(RA, 'doan.json'); writeFileSync(doanTep, JSON.stringify(doan));
  dung(['--ra', hinh, '--doan', doanTep, '--kho', join(homedir(), '.cache', 'lich-su', '_doan')]); }
// TIẾNG ĐỘNG KHỚP HÌNH (0đ, tổng hợp số học): vút khi camera nhảy xa · thịch khi đóng dấu / cắm cờ · giấy khi sang tranh · trống trầm khi đổi năm ·
// chuông nhẹ khi một nước được nhắc tên. Lịch theo giây tuyệt đối; trộn dưới giọng.
const SR = 48000, N = Math.ceil(DAI * SR), sfx = new Float32Array(N); let hat = 11; const rnd = () => ((hat = (hat * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
const dat = (t, len, f, vol) => { const o = Math.round(t * SR); for (let i = 0; i < len * SR && o + i < N; i++) { const v = f(i / SR); if (o + i >= 0) sfx[o + i] += v * vol; } };
const AMT = { vut: (t) => { const k = t / 0.6; return rnd() * Math.sin(Math.PI * k) * (0.3 + 0.7 * k) * 0.5; }, thich: (t) => Math.sin(2 * Math.PI * (90 - 40 * t) * t) * Math.exp(-t * 14) + (t < 0.01 ? rnd() * 0.5 : 0),
  giay: (t) => rnd() * (Math.sin(t * 90) > 0.3 ? 1 : 0.25) * Math.exp(-t * 3) * 0.35, trong: (t) => Math.sin(2 * Math.PI * 62 * t) * Math.exp(-t * 6) + Math.sin(2 * Math.PI * 124 * t) * Math.exp(-t * 12) * 0.3,
  ting: (t) => (Math.sin(2 * Math.PI * 1318 * t) + 0.4 * Math.sin(2 * Math.PI * 1976 * t)) * Math.exp(-t * 5) * 0.35 };
const LEN = { vut: 0.6, thich: 0.5, giay: 0.6, trong: 0.9, ting: 1.0 };
// bộ tiếng HÀI (kênh parody): vút = còi trượt lên · con dấu = boing lò xo · nhắc tên = pốp · tranh = tách máy ảnh · đổi năm = trống dồn ngắn
if (KENH.sfx === 'hai') { const pha = (f) => { let ph = 0, t0 = 0; return (t) => { ph += 2 * Math.PI * f(t) * (t - t0); t0 = t; return Math.sin(ph); }; };
  AMT.vut = (t) => { if (t === 0) AMT._v = pha((u) => 420 + 1500 * (u / 0.6) ** 1.6); return AMT._v(t) * Math.sin(Math.PI * Math.min(1, t / 0.6)) * 0.35; };
  AMT.thich = (t) => { if (t === 0) AMT._b = pha((u) => 180 + 260 * Math.exp(-u * 3) * (1 + 0.35 * Math.sin(u * 55))); return AMT._b(t) * Math.exp(-t * 3.2) * 0.6 + (t < 0.012 ? rnd() * 0.4 : 0); };
  AMT.ting = (t) => Math.sin(2 * Math.PI * (700 - 300 * Math.min(1, t / 0.06)) * t) * Math.exp(-t * 28) * 0.7;
  AMT.giay = (t) => (t < 0.02 || (t > 0.09 && t < 0.11) ? rnd() * 0.9 : 0) * Math.exp(-(t % 0.09) * 60);
  AMT.trong = (t) => rnd() * (Math.sin(2 * Math.PI * 22 * t) > 0 ? 1 : 0.2) * Math.exp(-((t - 0.45) ** 2) * 12) * 0.35 + (t > 0.62 ? Math.sin(2 * Math.PI * 70 * t) * Math.exp(-(t - 0.62) * 9) : 0);
  Object.assign(LEN, { thich: 1.0, ting: 0.25, giay: 0.3, trong: 1.1 }); }
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
const ghiWav = (f, mau) => { let dinh = 0; for (const v of mau) dinh = Math.max(dinh, Math.abs(v)); const g = dinh > 0.95 ? 0.95 / dinh : 1, n = mau.length;
  const b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mau[i] * g)) * 32767), 44 + i * 2); writeFileSync(f, b); };
// nhạc nền (0đ, không bản quyền): tram = hợp âm trầm thở chậm; nhay = nhạc nảy kiểu bản tin hài (gảy rải hợp âm C–G–Am–F 112 bpm + bass + hi-hat nhẹ)
const nhac = `0.05*sin(2*PI*98*t)*(0.6+0.4*sin(2*PI*0.08*t))+0.04*sin(2*PI*146.8*t)*(0.6+0.4*sin(2*PI*0.06*t+1))+0.03*sin(2*PI*196*t)*(0.5+0.5*sin(2*PI*0.05*t+2))`;
let vaoNhac = ['-f', 'lavfi', '-t', String(DAI), '-i', `aevalsrc='${nhac}':s=48000`];
if (KENH.nhac === 'nhay') { const m = new Float32Array(N), BUOC = 60 / 112 / 2, HOP = [[261.6, 329.6, 392, 523.3], [196, 246.9, 293.7, 392], [220, 261.6, 329.6, 440], [174.6, 220, 261.6, 349.2]], MAU_R = [0, 2, 1, 3, 2, 1, 3, 2];
  for (let b = 0; b * BUOC < DAI; b++) { const h = HOP[Math.floor(b / 8) % 4], f = h[MAU_R[b % 8]], o = Math.round(b * BUOC * SR);
    for (let i = 0; i < 0.5 * SR && o + i < N; i++) { const t = i / SR; m[o + i] += (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t)) * Math.exp(-t * 9) * 0.22; }
    if (b % 4 === 0 || b % 4 === 3) for (let i = 0; i < 0.45 * SR && o + i < N; i++) { const t = i / SR; m[o + i] += Math.sin(2 * Math.PI * (h[0] / 2) * t) * Math.exp(-t * 5) * 0.32; }
    if (b % 2 === 1) for (let i = 0; i < 0.05 * SR && o + i < N; i++) m[o + i] += rnd() * Math.exp(-(i / SR) * 90) * 0.08; }
  const f = join(RA, 'nhac.wav'); ghiWav(f, m.map((v) => v * 0.25)); vaoNhac = ['-i', f]; }
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', hinh, '-i', GIONG, ...vaoNhac, '-i', wavSfx,
  '-filter_complex', '[1:a]volume=1.0[g];[2:a]volume=0.5,afade=t=in:d=1.5,afade=t=out:st=' + (DAI - 1.5) + ':d=1.5[n];[3:a]volume=0.35[s];[g][n][s]amix=inputs=3:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5[a]',
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', String(DAI), '-movflags', '+faststart', ra], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
console.log(`${ra} · ${DAI}s · ${canh.length} cảnh · ${tu.length} chữ`);
