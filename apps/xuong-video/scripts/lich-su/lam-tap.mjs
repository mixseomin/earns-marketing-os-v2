#!/usr/bin/env node
// MÁY LÀM TẬP KÊNH LỊCH SỬ — MỘT LỆNH TỪ CHỦ ĐỀ TỚI VIDEO (02/11/2026, S08 bước 3). Chạy trên iMac:
//   node scripts/lich-su/lam-tap.mjs --id alaska-a --nn en --chu-de "Why is Alaska part of the United States?" [--nguon "Alaska Purchase|Russian America"]
//     [--viet-lai] [--chi-viet] [--khung 1,20,40]
// 1. VIẾT (box3 viet-tap.mts, Claude qua ckey ~vài nghìn đồng): kịch bản dạng A + ý cảnh + tài sản còn thiếu, từ Wikipedia đúng ngôn ngữ.
// 2. KIỂM (0đ, máy): số câu / số từ, chữ dấu vết AI, mọi sự thật trích nguyên văn có trong nguồn, chữ gọi dáng / dấu / tranh có trong câu, đích bản đồ có
//    thật (nước / thành phố Natural Earth), đồ đúng thời, cờ mới có tệp Commons thật. Sai → gửi lỗi về máy viết sửa (tối đa 3 lượt), vẫn sai thì DỪNG.
// 3. KHO (chỉ món còn thiếu, dùng lại mãi): cờ tải Commons; nhân vật vẽ gốc + 9 dáng (box3 kho-sinh.mts ~1.100₫) → nền trong (nen-trong.swift) → R2 +
//    Studio phim #1186 (kho-day.mts) → kho.json. Tranh cảnh: box3 tranh-sinh.mts (~110₫) + tách lớp trước (tach-lop.swift) cho chiều sâu.
// 5. STUDIO: tap-day.mts (box3) → phim Studio của kênh + một tập (video R2, kịch bản).
// 4. DỰNG: dung-tap.mjs (giọng box3 ~2.500₫ một lần, bản đồ, hiệu ứng, tiếng động) → <id>.mp4 + <id>-xem.mp4 (540p gửi xem — dưới 30 MB kể cả tập 3 phút lá cải) ở /Users/htuan/.cache/lich-su/<id>/.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KHO, geo, TP, chuan, boDau, dichCua } from './dia-ly.mjs';
import { loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';
import { BOX, box, len, ve, q } from './box3.mjs';

const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const co = (k) => process.argv.includes(`--${k}`);
const DIR = dirname(fileURLToPath(import.meta.url));
const id = arg('id');
if (!id) { console.error('node lam-tap.mjs --id <id> --nn en|es --chu-de "…"'); process.exit(2); }
const tepTap = join(DIR, 'tap', `${id}.json`), RA = join(KHO, id), tepKho = join(DIR, 'kho.json');
// KÊNH (kenh.json): --kenh khi viết mới; tập đã có thì theo tap.kenh — khuôn kiểm (số câu / từ / câu cuối / tỉ lệ câu đùa không nguồn) đi theo kênh
// ngôn ngữ: --nn khi viết mới; tập đã có thì theo tap.ngon_ngu (kiểm tập ES không bị đòi câu móc tiếng Anh)
const chuDe = arg('chu-de') ?? (existsSync(tepTap) ? JSON.parse(readFileSync(tepTap, 'utf8')).chu_de : null);   // tập đã có: chủ đề lấy từ tệp tập
// bộ bài nguồn: --nguon khi viết mới; tập đã có thì GIỮ đúng bộ bài cũ (tap.nguon là URL wiki) — sửa / viết lại mà để máy tự tìm theo chủ đề là
// đổi nguồn ngầm, mọi trích dẫn cũ thành "không có trong nguồn" (dính 02/11/2026: alaska-parody --sua-canh lấy nhầm Anchorage + Alaska)
const nguonTua = (arg('nguon') ?? (existsSync(tepTap) ? (JSON.parse(readFileSync(tepTap, 'utf8')).nguon || []).map((u) => decodeURIComponent(u.split('/wiki/')[1] || '').replace(/_/g, ' ')).filter(Boolean).join('|') : '')) || null;
const nn = arg('nn') ?? (existsSync(tepTap) ? JSON.parse(readFileSync(tepTap, 'utf8')).ngon_ngu : null) ?? 'en';
const kenhId = arg('kenh') ?? (existsSync(tepTap) ? JSON.parse(readFileSync(tepTap, 'utf8')).kenh : null) ?? 'saga';
const KENH = JSON.parse(readFileSync(join(DIR, 'kenh.json'), 'utf8'))[kenhId];
if (!KENH) { console.error(`✗ không có kênh "${kenhId}" trong kenh.json`); process.exit(2); }
mkdirSync(RA, { recursive: true });
const docKho = () => JSON.parse(readFileSync(tepKho, 'utf8'));

// ---------- 2. KIỂM ----------
const ISO = new Set(geo.features.map((f) => f.properties.ADM0_A3));
const kiemDich = (d) => { if (Array.isArray(d)) return null; if (typeof d !== 'string') return `đích không đọc được ${JSON.stringify(d)}`;
  if (d.startsWith('@')) return TP.has(chuan(d.slice(1))) ? null : `không có thành phố "${d.slice(1)}" trong Natural Earth — dùng toạ độ "lon,lat"`;
  if (/^-?\d/.test(d)) { const [a, b] = d.split(',').map(Number); return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 180 && Math.abs(b) <= 90 ? null : `toạ độ sai "${d}"`; }
  const [iso, vg] = d.split('@'); if (!ISO.has(iso)) return `mã nước "${iso}" không có trong Natural Earth`;
  if (vg && ![2, 4].includes(vg.split(',').map(Number).filter(Number.isFinite).length)) return `"${d}" sai cú pháp — viết "ISO@lon0,lat0,lon1,lat1" (khung) hoặc "ISO@lon,lat" (điểm)`;
  try { dichCua(d); } catch { return `"${d}": nước ${iso} không có mảnh đất nào trong khung ${vg} — chọn khung có đất của đúng nước đó hôm nay (chủ thời xưa ghi ở to.chu)`; } return null; };
// gọi mạng có thử lại (Wikimedia hay cắt kết nối giữa chừng: EPIPE / 429)
const tai = async (url, lan = 4) => { for (let i = 1; ; i++) { try { const r = await fetch(url, { headers: { 'User-Agent': 'studio-lich-su/1.0 (studio.on.tc; admin@mixseo.net)' } }); if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`); return r; }
  catch (e) { if (i >= lan) throw e; await new Promise((ok) => setTimeout(ok, 1500 * i)); } } };
const phang = (t) => boDau(t).toLowerCase().replace(/[‘’´`]/g, "'").replace(/[“”«»]/g, '"').replace(/\s+/g, ' ').trim();
const commons = async (ten) => { const r = await (await tai(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', titles: ten, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '640', format: 'json', formatversion: '2' })}`)).json();
  const p = r.query?.pages?.[0]; return p && !p.missing && p.imageinfo?.[0] ? { thumb: p.imageinfo[0].thumburl, trang: p.imageinfo[0].descriptionurl } : null; };
// tệp Commons đoán sai tên → máy tìm tệp có thật gần nhất để máy viết chọn (không tự chọn: cờ sai thời còn tệ hơn không có cờ)
const timCommons = async (ten) => { const goc = ten.replace(/^File:|\.(svg|png)$/gi, ''), ds = new Set();
  for (const tim of [goc.replace(/[()_–-]/g, ' '), goc.split('(')[0].trim(), `intitle:"${goc.split('(')[0].trim()}"`]) {
    const r = await (await tai(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', list: 'search', srnamespace: '6', srlimit: '20', srsearch: tim, format: 'json', formatversion: '2' })}`)).json();
    for (const x of r.query?.search ?? []) if (/^File:Flag/i.test(x.title) && /\.svg$/i.test(x.title)) ds.add(x.title); }
  return [...ds].slice(0, 14); };
// MÁY TỰ SỬA món chắc chắn sửa được (không bắt máy viết đoán lại tên tệp — 4 lượt liền vẫn đoán sai): cờ có tên tệp Commons không tồn tại → lấy tệp
// có thật trong kết quả tìm mà năm ghi trên tên chạm khoảng năm của cờ; không có tệp nào đúng thời → bỏ cờ đó khỏi mọi cảnh (thà không cờ còn hơn cờ sai thời)
const SO_NN = { en: 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion half dozen point and',
  es: 'cero uno una dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte veintiuno veintidos veintitres veinticuatro veinticinco veintiseis veintisiete veintiocho veintinueve treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ciento doscientos trescientos cuatrocientos quinientos seiscientos setecientos ochocientos novecientos mil millon millones y punto' };
const SO = new Set((SO_NN[nn] ?? SO_NN.en).split(' '));
const NHAT = /^(biggest|largest|longest|oldest|smallest|first|only|richest|deadliest|tallest|highest|mayor|primero|primera|unico|unica)$/;
async function tuSua(tap) { const kho = docKho().tai_san, ghi = [];
  // MÃ VAI / NGƯỜI KHÔNG GẮN NĂM (kho dùng lại mọi tập): máy viết hay đặt "russian_soldier_1867" → bỏ đuôi năm ở mã + mọi chỗ gọi; cờ thì giữ năm (cờ đổi theo thời)
  for (const t of tap.tai_san_moi || []) { const moi = t.loai === 'co' ? t.id : t.id.replace(/_1[0-9]{3}$|_20[0-9]{2}$/, ''); if (moi === t.id) continue;
    const cu = t.id; t.id = moi; ghi.push(`mã ${cu} → ${moi}`);
    for (const c of tap.cau) { for (const m of [...(c.canh.nguoi || []), ...(c.canh.xe || [])]) if (m.anh === cu) m.anh = moi; if (c.canh.tranh?.ref) c.canh.tranh.ref = c.canh.tranh.ref.map((r) => (r === cu ? moi : r)); } }
  for (const t of [...(tap.tai_san_moi || [])]) { if (kho[t.id] || t.loai !== 'co' || !t.commons || (await commons(t.commons))) continue;
    const hop = (await timCommons(t.commons)).find((x) => { const n = (x.match(/\b1[0-9]{3}\b|\b20[0-9]{2}\b/g) || []).map(Number); if (!n.length) return false; const a = Math.min(...n), b = n.length > 1 ? Math.max(...n) : a; return a <= t.den && b >= t.tu; });
    if (hop) { ghi.push(`cờ ${t.id}: "${t.commons}" → "${hop}"`); t.commons = hop; continue; }
    tap.tai_san_moi = tap.tai_san_moi.filter((x) => x !== t); for (const c of tap.cau) c.canh.co = (c.canh.co || []).filter((m) => m.anh !== t.id); ghi.push(`cờ ${t.id}: không có tệp Commons đúng thời → bỏ khỏi tập`); }
  // cờ lệch thời ở một cảnh → gỡ cờ khỏi cảnh đó (cờ chỉ là phụ hoạ; người / xe lệch thời thì vẫn trả máy viết vì nó là chuyện)
  const tsAll = { ...docKho().tai_san, ...Object.fromEntries((tap.tai_san_moi || []).map((t) => [t.id, t])) }; let nam = null;
  tap.cau.forEach((c, k) => { nam = c.canh.nam ?? nam; const ns = [nam, c.canh.nam_sau?.nam ?? nam].filter((v) => v != null);
    c.canh.co = (c.canh.co || []).filter((m) => { const t = tsAll[m.anh]; const ok = !t || !ns.length || ns.some((v) => v >= t.tu && v <= t.den); if (!ok) ghi.push(`câu ${k + 1}: gỡ cờ ${m.anh} (${t.tu}–${t.den}) khỏi năm ${ns.join('→')}`); return ok; }); });
  if (ghi.length) { writeFileSync(tepTap, JSON.stringify(tap, null, 1) + '\n'); console.log(`máy tự sửa: ${ghi.join(' · ')}`); } return tap; }
async function kiem(tap, nguonChu) {
  const loi = [], kho = docKho().tai_san, moi = Object.fromEntries((tap.tai_san_moi || []).map((t) => [t.id, t])), nguonP = phang(nguonChu);
  const ds = tap.cau, tu = ds.map((c) => c.chu).join(' ').split(/\s+/).length, [t0, t1] = KENH.tu[nn] ?? KENH.tu.en, coMoc = !!KENH.cau_cuoi;
  if (ds.length < KENH.cau[0] || ds.length > KENH.cau[1]) loi.push(`có ${ds.length} câu — khuôn kênh ${kenhId} là ${KENH.cau_noi} câu`);
  if (tu < t0 || tu > t1) loi.push(`tổng ${tu} từ — khuôn kênh ${kenhId} ${KENH.tu_noi[nn] ?? KENH.tu_noi.en} từ`);
  // kênh có câu đùa (parody): câu không su_that được phép tới tỉ lệ khong_nguon_toi_da — vẫn cấm con số / so sánh nhất không nguồn trong câu đùa
  const khongNguon = ds.slice(0, coMoc ? -1 : undefined).filter((c) => !(c.su_that || []).length).length, choPhep = Math.floor(ds.length * (KENH.khong_nguon_toi_da || 0));
  if (khongNguon > choPhep) loi.push(`${khongNguon} câu không có su_that — kênh ${kenhId} cho tối đa ${choPhep}${choPhep ? ' câu đùa' : ''}; câu kể sự việc phải có nguồn`);
  let nam = null; const namNguon = new Set(([...ds.flatMap((c) => (c.su_that || []).map((x) => `${x.gia_tri} ${x.trich}`)), nguonChu].join(' ').match(/\b\d{3,4}\b/g) || []).map(Number));   // ô năm phải là năm CÓ trong nguồn
  const nhanVat = new Set(ds.flatMap((c) => (c.canh.nguoi || []).map((n) => n.anh))); if (nhanVat.size < 2) loi.push(`cả tập chỉ có ${nhanVat.size} nhân vật — cần ≥ 2 (người có tên đang hành động phải đứng trong cảnh)`);
  ds.forEach((c, k) => { const K = `câu ${k + 1}`, cv = c.canh, ws = new Set(c.chu.split(/\s+/).map(chuan));
    if (k === 0 && !(c.su_that || []).length) loi.push(`${K}: hook không có su_that — hook phải là sự thật có nguồn`);
    // năm TRƯỚC CÔNG NGUYÊN ghi số âm (-1472) — nguồn viết "1472 BC" → so theo trị tuyệt đối
    for (const n of [cv.nam, cv.nam_sau?.nam]) if (n != null && !namNguon.has(Math.abs(n))) loi.push(`${K}: ô năm ${n} không có trong nguồn — ghi năm có nguồn hoặc null`);
    for (const cm of KENH.cam_cum || []) if (` ${phang(c.chu).replace(/[^a-z' ]/g, ' ')} `.includes(` ${cm} `)) loi.push(`${K}: cụm hài kiểu AI "${cm}" — bỏ, để cú lật tự đứng (luật viết hài của kênh)`);
    if (/[—–→…]|\.\.\./.test(c.chu)) loi.push(`${K}: còn dấu vết AI (— – → …) trong "${c.chu}"`);
    for (const s of c.su_that || []) { const tr = phang(s.trich).replace(/^["']|["']$/g, ''); if (nguonP.includes(tr)) continue;
      const w = tr.split(' '), sh = []; for (let i = 0; i + 6 <= w.length; i++) sh.push(w.slice(i, i + 6).join(' ')); const trung = sh.filter((x) => nguonP.includes(x)).length;
      if (!sh.length || trung / sh.length < 0.6) loi.push(`${K}: sự thật "${s.gia_tri}" — đoạn trích không có NGUYÊN VĂN trong nguồn: "${s.trich.slice(0, 120)}"`); }
    // MỌI con số / so sánh nhất trong câu phải có su_that riêng (giá trị nhắc đúng nó) — hook "biggest island … three thousand miles" từng lọt vì chỉ có 1 su_that cho cả câu
    if (k < ds.length - 1 || !coMoc) { const gt = (c.su_that || []).map((x) => phang(`${x.gia_tri}`)).join(' | ');
      const cum = []; let cur = []; for (const w of c.chu.split(/\s+/)) { const x = chuan(w).replace(/-/g, ' '); if (x && x.split(' ').every((y) => SO.has(y)) && !(cur.length === 0 && /^(one|a|un|una|uno)$/.test(x))) cur.push(chuan(w)); else { if (cur.length) cum.push(cur); cur = []; } } if (cur.length) cum.push(cur);
      // đếm nhỏ ("two cities") không phải số liệu tranh cãi → bỏ qua; số lớn, năm, tiền thì mỗi số một dòng su_that
      const soDong = (c.su_that || []).filter((x) => /\d/.test(x.gia_tri)).length; let thieu = 0;
      for (const q of cum) { const nhoi = q.filter((y) => !/^(and|y|point|punto|a)$/.test(y)); if (nhoi.length === 1 && /^(two|three|four|five|six|seven|eight|nine|ten|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)$/.test(nhoi[0])) continue; if (!nhoi.length || nhoi.some((y) => gt.includes(y.split('-')[0]))) continue; if (++thieu > soDong) loi.push(`${K}: con số "${q.join(' ')}" chưa có su_that riêng (mỗi con số một dòng, gia_tri ghi số)`); }
      const tr = (c.su_that || []).map((x) => phang(`${x.gia_tri} ${x.trich}`)).join(' | ');
      const cw = c.chu.split(/\s+/).map(chuan); for (const [i, w] of cw.entries()) if (NHAT.test(w) && !(/^(first|primero|primera)$/.test(w) && (/^(of|de)$/.test(cw[i + 1] || '') || /^(january|february|march|april|may|june|july|august|september|october|november|december)$/.test(cw[i - 1] || ''))) && !tr.includes(w)) loi.push(`${K}: so sánh nhất "${w}" chưa có su_that riêng chứng minh`); }
    const theoChu = [...(cv.nguoi || []).flatMap((n) => (n.dang || []).map((d) => d.chu)), ...(cv.dau || []).map((d) => d.chu), ...(cv.tranh ? [cv.tranh.tu_chu, cv.tranh.den_chu] : []), ...(cv.nam_sau ? [cv.nam_sau.chu] : [])];
    const cauW = c.chu.split(/\s+/).map(chuan).filter(Boolean), coCum = (w) => { const q = String(w).split(/\s+/).map(chuan).filter(Boolean); return q.length > 0 && cauW.some((_, i) => q.every((x, j) => cauW[i + j] === x)); };
    for (const w of theoChu) if (!coCum(w)) loi.push(`${K}: chữ "${w}" (gọi dáng / dấu / tranh / năm) không có trong câu "${c.chu}"`);
    for (const n of cv.nguoi || []) for (const d of n.dang || []) if (!docKho().dang_chuan.includes(d.dang)) loi.push(`${K}: dáng "${d.dang}" không có trong danh mục`);
    const dichs = [...(cv.nhin || []), ...(cv.to || []).map((t) => t.noi ?? t), ...(cv.nhan || []).map((n) => n.o), ...(cv.vong || []), ...(cv.nhay || []), ...(cv.ten || []).flatMap((m) => [m.tu, m.den]), ...(cv.ke || []).flatMap((m) => [m.tu, m.den]), ...(cv.xe || []).flatMap((m) => [m.tu, m.den]), ...(cv.co || []).map((m) => m.o)];
    for (const d of dichs) { const e = kiemDich(d); if (e) loi.push(`${K}: ${e}`); }
    if (!(cv.nhin || []).length && !cv.tam) loi.push(`${K}: thiếu nhin (camera không biết nhìn đâu)`);
    nam = cv.nam ?? nam; const namCuoi = cv.nam_sau?.nam ?? nam;
    if ([...(cv.nguoi || []), ...(cv.xe || []), ...(cv.co || [])].length && cv.nam == null && namCuoi == null) loi.push(`${K}: có cờ / nhân vật / phương tiện mà cảnh chưa có nam — khai năm sự việc để máy kiểm đúng thời`);
    for (const [m, loai] of [...(cv.nguoi || []).map((m) => [m, 'nhan_vat']), ...(cv.xe || []).map((m) => [m, 'phuong_tien']), ...(cv.co || []).map((m) => [m, 'co'])]) {
      const ts = kho[m.anh] ?? moi[m.anh]; if (!ts) { loi.push(`${K}: "${m.anh}" không có trong KHO và không khai trong tai_san_moi`); continue; }
      if (ts.loai !== loai) loi.push(`${K}: "${m.anh}" là ${ts.loai}, không dùng được làm ${loai}`);
      const hop = [nam, namCuoi].filter((v) => v != null).some((v) => v >= ts.tu && v <= ts.den); if ((nam != null || namCuoi != null) && !hop) loi.push(`${K} (năm ${nam}${namCuoi !== nam ? `→${namCuoi}` : ''}): "${m.anh}" chỉ đúng ${ts.tu}–${ts.den} — ở câu này thay bằng ${loai === 'co' ? 'cờ ĐÚNG năm đó (khai tai_san_moi một cờ mới với tệp Commons của thời đó)' : 'món đúng thời (khai tai_san_moi mới)'} hoặc bỏ ${loai === 'co' ? 'cờ' : 'món'} khỏi câu`); }
    for (const r of cv.tranh?.ref || []) if (!kho[r] && !moi[r]) loi.push(`${K}: tranh tham chiếu "${r}" không có`); });
  // CẢNH SỐNG (kênh dài): câu nào chỉ có bản đồ trơn (không người / tranh / xe / mũi tên / cờ / dấu / đường kẻ) — tỉ lệ cảnh sống + không quá N câu trơn liền nhau
  if (KENH.canh_song) { const song = ds.map((c) => ['nguoi', 'xe', 'ten', 'co', 'dau', 'ke'].some((f) => (c.canh[f] || []).length) || !!c.canh.tranh);
    const tl = song.filter(Boolean).length / ds.length; if (tl < KENH.canh_song.ti_le) loi.push(`chỉ ${Math.round(tl * 100)}% câu có chuyển động ngoài camera — kênh ${kenhId} cần ≥ ${Math.round(KENH.canh_song.ti_le * 100)}% (thêm nhân vật đổi dáng / mũi tên / cờ / dấu vào câu trơn)`);
    let lien = 0; song.forEach((v, k) => { lien = v ? 0 : lien + 1; if (lien === KENH.canh_song.tron_lien_toi_da + 1) loi.push(`câu ${k + 1 - KENH.canh_song.tron_lien_toi_da}–${k + 1}: ${lien} câu liền chỉ có bản đồ trơn — thêm chuyển động vào ít nhất một câu`); }); }
  // HOOK + MÔ TẢ (kênh có máy đăng): tiêu đề qua đúng luật hook của Phòng Nội dung (hook-qc.mjs — giữ ≥ 35% chữ QC gốc, không thêm số); mô tả đăng có thật
  if (KENH.may) { if (!tap.hook?.goc) loi.push('tập chưa gắn hook QC spy (tap.hook) — máy đăng sẽ bị Phòng Nội dung chặn');
    else loi.push(...loiHook([tap.tieu_de], tap.hook.goc).map((x) => `tiêu đề: ${x}`));
    if (!tap.goc?.id) loi.push('tập chưa gắn góc spy (tap.goc)');
    if (!tap.mo_ta_dang || tap.mo_ta_dang.length < 80) loi.push('mô tả đăng (mo_ta_dang) thiếu hoặc dưới 80 ký tự'); }
  for (const [k, c] of ds.entries()) if (c.canh.tranh?.commons && !c.canh.tranh.anh && !(await commons(c.canh.tranh.commons))) loi.push(`câu ${k + 1}: tranh Commons "${c.canh.tranh.commons}" không tồn tại — tên tệp có thật hoặc null (AI vẽ)`);
  if (!ds[0]?.canh?.mo || !ds[0]?.canh?.chu_to) loi.push('câu 1: thiếu hook (mo + chu_to)');
  if (!ds.at(-1)?.canh?.ket) loi.push('câu cuối: thiếu thẻ kết ket');
  const cuoi = coMoc ? (KENH.cau_cuoi[nn] ?? KENH.cau_cuoi.en) : null;
  if (cuoi && !phang(ds.at(-1)?.chu || '').includes(phang(cuoi).replace(/[.!]$/, '').split(' ').slice(-2).join(' '))) loi.push(`câu cuối: phải kết bằng câu móc "${cuoi}"`);
  for (const t of tap.tai_san_moi || []) { if (kho[t.id]) continue;
    if (t.loai === 'co') { if (!t.commons) loi.push(`cờ mới "${t.id}" thiếu tên tệp Commons`); else if (!(await commons(t.commons))) { const g = await timCommons(t.commons); loi.push(`cờ mới "${t.id}": tệp Commons "${t.commons}" không tồn tại${g.length ? ` — tệp CÓ THẬT gần nhất (chọn cái đúng thời, hoặc bỏ cờ): ${g.map((x) => `"${x}"`).join(', ')}` : ' — bỏ cờ này'}`); } }
    else if (!t.mo_ta_en?.trim()) loi.push(`tài sản mới "${t.id}" thiếu mo_ta_en`);
    if (t.loai === 'nhan_vat' && !t.que) loi.push(`nhân vật mới "${t.id}" thiếu que (phe / quê) — máy cần để đặt người về đúng phía bản đồ`);
    if (t.que) { const e = kiemDich(t.que); if (e) loi.push(`tài sản mới "${t.id}": quê ${e}`); } }
  return loi;
}

// ---------- 0. GẮN HOOK cho tập đã có (--gan-hook): kênh có máy đăng mà tập chưa có góc / hook spy → máy viết chọn hook + tiêu đề + mô tả đăng, lời đọc giữ nguyên ----------
if (co('gan-hook') && KENH.may && existsSync(tepTap)) {
  const t0 = JSON.parse(readFileSync(tepTap, 'utf8'));
  if (t0.hook?.goc) console.log(`tập đã có hook "${t0.hook.goc}" — bỏ qua gắn hook`);
  else { const tmp = `/tmp/gan-hook-${id}`; execFileSync('ssh', [BOX, `mkdir -p ${tmp}`]);
    const f = join(RA, 'goc-hook.json'); writeFileSync(f, box(`scripts/may-dung.mts --may ${KENH.may} --goc-hook`).split('\n').pop()); len(f, `${tmp}/goc-hook.json`); len(tepTap, `${tmp}/tap.json`);
    console.log(box(`scripts/lich-su/viet-tap.mts ${tmp}/gan.json --id ${id} --nn ${nn} --kenh ${kenhId} --chi-hook --goc-hook ${tmp}/goc-hook.json --cu ${tmp}/tap.json`).split('\n').pop());
    ve(`${tmp}/gan.json`, join(RA, 'gan-hook.json')); execFileSync('ssh', [BOX, `rm -rf ${tmp}`]);
    Object.assign(t0, JSON.parse(readFileSync(join(RA, 'gan-hook.json'), 'utf8'))); writeFileSync(tepTap, JSON.stringify(t0, null, 1) + '\n'); }
}

// ---------- 1. VIẾT ----------
// --sua-canh: giọng đã đọc — máy viết chỉ sửa cảnh; lời đọc + sự thật khoá cứng (máy chép đè lại bản cũ sau mỗi lượt), không tốn tiền giọng lại
const suaCanh = co('sua-canh') && existsSync(tepTap), loiCu = suaCanh ? JSON.parse(readFileSync(tepTap, 'utf8')).cau.map((c) => ({ chu: c.chu, su_that: c.su_that })) : null;
const khoaLoi = () => { if (!loiCu) return; const t = JSON.parse(readFileSync(tepTap, 'utf8'));
  if (t.cau.length !== loiCu.length) { console.log(`⚠ máy viết đổi số câu ${loiCu.length} → ${t.cau.length} — bỏ bản này`); return false; }
  t.cau.forEach((c, i) => Object.assign(c, loiCu[i])); writeFileSync(tepTap, JSON.stringify(t, null, 1) + '\n'); return true; };
const sua = (co('sua') || suaCanh) && existsSync(tepTap) && existsSync(join(RA, 'nguon.txt'));   // --sua: không viết lại từ đầu, đưa lỗi của bản đang có cho máy viết sửa
if (!existsSync(tepTap) || co('viet-lai') || sua) {
  const tmp = `/tmp/lich-su-${id}`; execFileSync('ssh', [BOX, `mkdir -p ${tmp}`]); len(tepKho, `${tmp}/kho.json`);
  // GÓC + HOOK SPY: kênh có máy Studio (kenh.json may) mà chưa có chủ đề → lấy góc dùng ít nhất + hook QC của máy, máy viết tự chọn chuyện hợp góc
  let ghArg = '';
  if (!chuDe && KENH.may) { const f = join(RA, 'goc-hook.json'); writeFileSync(f, box(`scripts/may-dung.mts --may ${KENH.may} --goc-hook`).split('\n').pop()); len(f, `${tmp}/goc-hook.json`); ghArg = ` --goc-hook ${tmp}/goc-hook.json`;
    const g = JSON.parse(readFileSync(f, 'utf8')); console.log(`góc spy #${g.goc.id} ${g.goc.ten} · ${g.hooks.length} hook QC`); }
  if (!chuDe && !ghArg) { console.error('chưa có tập — cần --chu-de (hoặc kênh có máy Studio để chọn đề theo góc)'); process.exit(2); }
  let loi = sua ? await kiem(await tuSua(JSON.parse(readFileSync(tepTap, 'utf8'))), readFileSync(join(RA, 'nguon.txt'), 'utf8')) : [];
  for (let lan = 1; lan <= 4 && !(sua && !loi.length && lan === 1); lan++) {
    const them = loi.length ? ` --loi ${tmp}/loi.txt --cu ${tmp}/tap.json` : '';
    if (loi.length) { writeFileSync(join(RA, 'loi.txt'), loi.map((x) => `- ${x}`).join('\n')); len(join(RA, 'loi.txt'), `${tmp}/loi.txt`); len(tepTap, `${tmp}/tap.json`); }
    try { console.log(box(`scripts/lich-su/viet-tap.mts ${tmp}/tap.json${chuDe ? ` --chu-de ${q(chuDe)}` : ''}${ghArg} --nn ${nn} --id ${id} --kenh ${kenhId}${suaCanh ? ' --chi-canh' : ''} --kho ${tmp}/kho.json${nguonTua ? ` --nguon ${q(nguonTua)}` : ''}${them}`)); }
    catch (e) { console.log(`✗ lượt viết ${lan}: máy viết hỏng — ${String(e.stderr || e.message).trim().split('\n').slice(-3).join(' · ').slice(0, 400)}`); if (!existsSync(tepTap)) continue; loi = loi.length ? loi : ['(lượt trước hỏng, viết lại)']; continue; }
    const truoc = suaCanh ? readFileSync(tepTap, 'utf8') : null;
    ve(`${tmp}/tap.json`, tepTap); ve(`${tmp}/tap.json.nguon.txt`, join(RA, 'nguon.txt'));
    if (suaCanh && khoaLoi() === false) writeFileSync(tepTap, truoc);
    loi = await kiem(await tuSua(JSON.parse(readFileSync(tepTap, 'utf8'))), readFileSync(join(RA, 'nguon.txt'), 'utf8'));
    console.log(loi.length ? `✗ lượt viết ${lan}: ${loi.length} lỗi\n  ${loi.join('\n  ')}` : `✓ lượt viết ${lan}: kiểm sạch`);
    if (!loi.length) break;
  }
  execFileSync('ssh', [BOX, `rm -rf ${tmp}`]);
  if (loi.length) { console.error('✗ máy viết 4 lượt vẫn lỗi — dừng, không tốn tiền giọng / ảnh'); process.exit(4); }
} else { const loi = existsSync(join(RA, 'nguon.txt')) ? await kiem(await tuSua(JSON.parse(readFileSync(tepTap, 'utf8'))), readFileSync(join(RA, 'nguon.txt'), 'utf8')) : [];
  // --chi-day chỉ đẩy lại bản đã dựng lên Studio (không viết, không tốn tiền) → lỗi kiểm chỉ cảnh báo; máy đăng vẫn do Phòng Nội dung chặn
  if (loi.length) { console.error(`${co('chi-day') ? '⚠' : '✗'} tập có lỗi:\n  ${loi.join('\n  ')}`); if (!co('chi-day')) process.exit(4); } }
if (co('chi-viet')) process.exit(0);

// ---------- 3. KHO + TRANH ----------
const tap = JSON.parse(readFileSync(tepTap, 'utf8'));
let tien = 0;
const dungToi = new Set(tap.cau.flatMap((c) => [...(c.canh.nguoi || []), ...(c.canh.xe || []), ...(c.canh.co || [])].map((m) => m.anh).concat(c.canh.tranh?.ref || [])));
for (const t of tap.tai_san_moi || []) {
  if (docKho().tai_san[t.id] || !dungToi.has(t.id)) continue;   // món khai mà không cảnh nào dùng (cờ máy đã gỡ) → không tốn tiền sinh
  const tam = join(KHO, 'kho', t.id), png = join(tam, 'png'); mkdirSync(png, { recursive: true });
  let nguonGhi = t.loai === 'co' ? null : `AI vẽ (ckey Nano Banana 2) + tách nền Vision, ${new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;
  if (t.loai === 'co') { const c = await commons(t.commons); writeFileSync(join(png, 'goc.png'), Buffer.from(await (await tai(c.thumb)).arrayBuffer())); nguonGhi = c.trang; }
  else {
    const dang = t.loai === 'nhan_vat' ? docKho().dang_chuan.join(',') : 'goc', bt = `/tmp/kho-${t.id}`;
    const out = box(`scripts/lich-su/kho-sinh.mts ${bt} ${q(`mota:${t.loai}:${t.mo_ta_en}`)} ${dang}`); console.log(out); tien += Number(out.match(/~(\d+)₫/)?.[1] ?? 0);
    ve(`${bt}/.`, tam); execFileSync('ssh', [BOX, `rm -rf ${bt}`]);
    for (const f of readdirSync(tam).filter((x) => x.endsWith('.jpg'))) console.log(execFileSync('swift', [join(DIR, 'nen-trong.swift'), join(tam, f), join(png, f.replace(/\.jpg$/, '.png'))], { encoding: 'utf8' }).trim());
  }
  const bt = `/tmp/kho-day-${t.id}`; execFileSync('ssh', [BOX, `rm -rf ${bt} && mkdir -p ${bt}`]); execFileSync('scp', ['-q', ...readdirSync(png).map((f) => join(png, f)), `${BOX}:${bt}/`]);
  const kq = JSON.parse(box(`scripts/lich-su/kho-day.mts ${bt} ${t.id} ${t.loai} ${q(t.ten)} ${q(t.mo_ta_en || t.ten)} ${t.tu} ${t.den}`).split('\n').pop()); execFileSync('ssh', [BOX, `rm -rf ${bt}`]);
  const k = docKho(); k.tai_san[t.id] = { loai: t.loai, ten: t.ten, tu: t.tu, den: t.den, ghi: t.mo_ta_en || '', nguon: nguonGhi, studio_thanh_phan: kq.thanh_phan, dang: kq.dang, ...(t.que ? { que: t.que } : {}), tap_dau: id };
  writeFileSync(tepKho, JSON.stringify(k, null, 1) + '\n'); console.log(`✓ kho + ${t.id} (${t.loai}) · Studio thành phần #${kq.thanh_phan}`);
}
const khoNay = docKho().tai_san;
// ẢNH LỊCH SỬ THẬT BẮT BUỘC cho kênh có máy đăng (Phòng Nội dung chặn bài không ảnh thật — 02/11/2026 tập Hatshepsut SỬA LẠI vì cả 3 tranh là AI vẽ dù
// prompt dặn ưu tiên Commons): tranh chưa có tệp Commons → máy tự tìm theo tên nhân vật trong tranh rồi theo cụm danh từ riêng nhiều chữ của mô tả
// ("Deir el-Bahari"), chỉ nhận ảnh chụp / tranh (jpg / png, bỏ bản đồ / sơ đồ / logo). Tìm một lần mỗi tranh (tim_that) — không thấy thì giữ tranh AI.
const timAnhThat = async (cum) => { for (const q1 of cum) {
    const r = await (await tai(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', list: 'search', srnamespace: '6', srlimit: '10', srsearch: `${q1} filetype:bitmap`, format: 'json', formatversion: '2' })}`)).json();
    const t = (r.query?.search ?? []).map((x) => x.title).find((x) => /\.(jpe?g|png)$/i.test(x) && !/\b(map|karte|carte|mapa|diagram|logo|flag|coat of arms|chart)\b/i.test(x));
    if (t) return t; } return null; };
const cumTranh = (tr) => [...new Set([...(tr.ref || []).map((r) => r.replace(/_/g, ' ')), ...((tr.mo_ta || '').match(/\b[A-Z][a-z]+(?:[ -](?:el|al|de|of|the|[A-Z][a-z]+))+/g) || [])])].slice(0, 5);
if (KENH.may) for (const c of tap.cau) { const tr = c.canh.tranh; if (!tr || tr.commons || tr.tim_that) continue; tr.tim_that = true;
  const t = await timAnhThat(cumTranh(tr)); if (t) { console.log(`✓ ảnh thật cho tranh "${(tr.mo_ta || '').slice(0, 50)}…": ${t}`); tr.commons = t; delete tr.anh; delete tr.lop; delete tr.lop_hop_tep; } }
if (KENH.may && !tap.cau.some((c) => c.canh.tranh?.commons)) console.log('⚠ tập không có ảnh lịch sử thật nào — Phòng Nội dung sẽ chặn (nen_url trống)');
// đã có ảnh chỉ khi TỆP còn thật (tệp ghi trong tập mà đã mất / hỏng thì tải lại — không tin dòng ghi)
for (const [k, c] of tap.cau.entries()) { const tr = c.canh.tranh; if (!tr || (tr.anh && existsSync(join(KHO, tr.anh)))) continue;
  const ten = `tranh/${id}-${k + 1}${tr.commons ? '-c' : ''}`, f = join(KHO, `${ten}.jpg`); mkdirSync(join(KHO, 'tranh'), { recursive: true });
  // ẢNH LỊCH SỬ THẬT trước (Wikimedia Commons, public domain — luật ảnh thật của Phòng Nội dung); không có tệp thì AI vẽ theo mo_ta
  // ẢNH TẢI VỀ PHẢI LÀ ẢNH THẬT (02/11/2026: xin bản 1600px của ảnh gốc nhỏ hơn → Commons trả trang HTML lỗi, máy dựng chết "cannot be decoded"):
  // thử 1600px rồi bản thu nhỏ API trả; nhận khi content-type là image; không bản nào được thì bỏ tệp Commons, tranh quay về AI vẽ
  if (!existsSync(f) && tr.commons) { const c = await commons(tr.commons);
    for (const u of c ? [c.thumb.replace(/\/\d+px-/, '/1600px-'), c.thumb] : []) { const r = await tai(u);
      if (r.ok && /^image\//.test(r.headers.get('content-type') || '')) { writeFileSync(f, Buffer.from(await r.arrayBuffer())); tr.commons_url = c.thumb; tr.commons_trang = c.trang; console.log(`✓ tranh ${k + 1}: Commons ${tr.commons}`); break; } }
    if (!existsSync(f)) { console.log(`⚠ tranh ${k + 1}: tải Commons ${tr.commons} không ra ảnh — AI vẽ`); delete tr.commons; } }
  if (!existsSync(f)) { const ref = (tr.ref || []).map((r) => khoNay[r]?.dang?.goc).filter(Boolean), bt = `/tmp/${id}-tranh-${k + 1}.jpg`;
    // tranh là PHỤ HOẠ: cổng ảnh hỏng / hết giờ thì thử lại một lần, vẫn hỏng thì bỏ tranh khỏi cảnh (bản đồ + nhân vật vẫn kể được) — không sập cả tập
    // (02/11/2026: tập Hatshepsut đã viết xong, sinh xong 4 nhân vật, chết ở TimeoutError của một tranh)
    for (let lan = 1; lan <= 2 && !existsSync(f); lan++) {
      try { const out = box(`scripts/lich-su/tranh-sinh.mts ${bt} ${q(tr.mo_ta)} ${ref.map(q).join(' ')}`); console.log(out); tien += Number(out.match(/~(\d+)₫/)?.[1] ?? 0);
        ve(bt, f); execFileSync('ssh', [BOX, `rm -f ${bt}`]); }
      catch (e) { console.log(`⚠ tranh ${k + 1} lượt ${lan} hỏng: ${String(e.stderr || e.message).trim().split('\n').pop().slice(0, 160)}`); } }
    if (!existsSync(f)) { console.log(`⚠ bỏ tranh câu ${k + 1} (cổng ảnh không trả) — cảnh giữ bản đồ + nhân vật`); delete c.canh.tranh; continue; } }
  const lopDir = join(KHO, `${ten}-lop`); spawnSync('swift', [join(DIR, '../shot-code/tach-lop.swift'), f, lopDir], { stdio: 'ignore' });
  const lop = existsSync(join(lopDir, 'lop.json')) ? JSON.parse(readFileSync(join(lopDir, 'lop.json'), 'utf8')) : [];
  tr.anh = `${ten}.jpg`; tr.lia ??= k % 2 ? 20 : -24;
  if (lop[0]) { copyFileSync(join(lopDir, 'lop-0.png'), join(KHO, `${ten}-lop.png`)); writeFileSync(join(KHO, `${ten}-lop.json`), JSON.stringify(lop[0])); tr.lop = `${ten}-lop.png`; tr.lop_hop_tep = `${ten}-lop.json`; } }
writeFileSync(tepTap, JSON.stringify(tap, null, 1) + '\n');
if (tien) console.log(`tiền kho + tranh lượt này ~${tien}₫`);

// ---------- 4. DỰNG ----------
// --chi-day: video đã dựng, chỉ đẩy lại Studio (không quay lại 5.900 khung)
const dung = co('chi-day') && existsSync(join(RA, `${id}.mp4`)) ? { status: 0 } : spawnSync(process.execPath, [join(DIR, 'dung-tap.mjs'), tepTap, ...(arg('khung') ? ['--khung', arg('khung'), '--khung-ra', join(RA, 'khung.jpg')] : [])], { stdio: 'inherit' });
if (dung.status) process.exit(dung.status);
if (arg('khung')) process.exit(0);
const mp4 = join(RA, `${id}.mp4`), xem = join(RA, `${id}-xem.mp4`);
if (!co('chi-day')) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', 'scale=540:-2', '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', xem]);
console.log(`✓ ${mp4}\n✓ ${xem}`);
// 5. STUDIO: mỗi kênh một phim, tập này thành một tập trong phim đó — anh quản / duyệt trong studio.on.tc. Gửi BẢN PHÁT HÀNH nén (1080p H.264 crf 23 trần 6 Mbps — lớp chấm in lá cải khó nén,
// bản gốc máy quay ~350 MB/3 phút) qua /var/tmp (đĩa; /tmp box3 là ổ RAM 512 MB) — hỏng ở bất kỳ khâu nào chỉ báo, không làm mất video đã dựng
{ const ban = join(RA, `${id}-ban.mp4`), bt = `/var/tmp/tap-day-${id}`; let kq = null, giay = 0;
  try { execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-c:v', 'libx264', '-crf', '23', '-maxrate', '6M', '-bufsize', '12M', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', ban]);
    execFileSync('ssh', [BOX, `mkdir -p ${bt}`]); len(tepTap, `${bt}/tap.json`); len(ban, `${bt}/tap.mp4`);
    // 3 khung (12 % · 50 % · 85 %) cho Studio + Phòng Nội dung chấm hình
    giay = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }));
    const khung = [0.12, 0.5, 0.85].map((x, i) => { const f = join(RA, `khung-${i}.jpg`); execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(giay * x), '-i', mp4, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4', f]); len(f, `${bt}/khung-${i}.jpg`); return `${bt}/khung-${i}.jpg`; });
    // STORYBOARD: keyframe giữa mỗi cảnh (cau.json của máy dựng: bd / kt từng câu) + kho.json → tap-day ghi cảnh + thành phần vào phim Studio của kênh
    const cauJ = JSON.parse(readFileSync(join(RA, 'cau.json'), 'utf8')), canhDs = cauJ.canh.map((c, k) => { const f = join(RA, `canh-${k + 1}.jpg`);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String((c.bd + c.kt) / 2), '-i', mp4, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4', f]); return { k, bd: c.bd, kt: c.kt, f }; });
    execFileSync('scp', ['-q', ...canhDs.map((x) => x.f), tepKho, `${BOX}:${bt}/`]);
    writeFileSync(join(RA, 'canh.json'), JSON.stringify(canhDs.map((x) => ({ k: x.k, bd: x.bd, kt: x.kt, anh: `${bt}/canh-${x.k + 1}.jpg` })))); len(join(RA, 'canh.json'), `${bt}/canh.json`);
    kq = JSON.parse(box(`scripts/lich-su/tap-day.mts ${bt}/tap.json ${bt}/tap.mp4 ${khung.join(' ')} --canh ${bt}/canh.json --kho ${bt}/kho.json`).split('\n').pop()); console.log(`✓ Studio phim #${kq.phim} · tập #${kq.tap} · ${kq.canh} cảnh storyboard · ${kq.thanh_phan} thành phần · https://studio.on.tc/?m=phim&mId=${kq.phim} · ${kq.url}`); }
  catch (e) { console.log(`⚠ đẩy Studio hỏng: ${String(e.stderr || e.message).trim().split('\n').slice(-2).join(' · ')}`); }
  // 6. MÁY ĐĂNG: kênh có máy Studio → tập thành một video của máy (mẫu video-ngoai: URL R2 + 3 khung), Phòng Nội dung chấm rồi máy đăng chung tự đăng theo nhịp
  if (KENH.may && kq) try {
    const anhThat = tap.cau.map((c) => c.canh.tranh?.commons_url).filter(Boolean);
    const moTa = `${tap.mo_ta_dang}${anhThat.length ? '\n\nImages: Wikimedia Commons (public domain). Maps: Natural Earth.' : ''}`;
    const nap = [{ slug: id, chu_de: tap.chu_de, mau: 'video-ngoai', nen_url: anhThat[0] ?? null,
      de: { loai: 'video-ngoai', video_url: kq.url, giay: Math.round(giay * 100) / 100, khung: kq.khung ?? [], soat: kq.soat ?? [], tom_tat: tap.chu_de },
      dang: { title: tap.tieu_de, description: moTa, link: null, loai: 'thuong', goc: tap.goc, hook: tap.hook } }];
    writeFileSync(join(RA, 'nap.json'), JSON.stringify(nap)); len(join(RA, 'nap.json'), `${bt}/nap.json`);
    console.log(box(`scripts/may-dung.mts --may ${KENH.may} --nap < ${bt}/nap.json`)); console.log(box(`scripts/may-dung.mts --may ${KENH.may} --xuat ${id}`).split('\n').slice(-2).join(' · '));
    console.log(`✓ nạp máy ${KENH.may} · https://studio.on.tc (Máy › ${KENH.may}) · Phòng Nội dung chấm ở lượt kế`);
  } catch (e) { console.log(`⚠ nạp máy đăng hỏng: ${String(e.stderr || e.message).trim().split('\n').slice(-2).join(' · ')}`); }
  try { execFileSync('ssh', [BOX, `rm -rf ${bt}`]); } catch {} }
