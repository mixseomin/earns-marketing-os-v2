#!/usr/bin/env node
// MÁY LÀM TẬP KÊNH LỊCH SỬ — MỘT LỆNH TỪ CHỦ ĐỀ TỚI VIDEO (02/11/2026, S08 bước 3). Chạy trên iMac:
//   node scripts/lich-su/lam-tap.mjs --id alaska-a --nn en --chu-de "Why is Alaska part of the United States?" [--nguon "Alaska Purchase|Russian America"]
//     [--viet-lai] [--chi-viet] [--khung 1,20,40]
// 1. VIẾT (box3 viet-tap.mts, Claude qua ckey ~vài nghìn đồng): kịch bản dạng A + ý cảnh + tài sản còn thiếu, từ Wikipedia đúng ngôn ngữ.
// 2. KIỂM (0đ, máy): số câu / số từ, chữ dấu vết AI, mọi sự thật trích nguyên văn có trong nguồn, chữ gọi dáng / dấu / tranh có trong câu, đích bản đồ có
//    thật (nước / thành phố Natural Earth), đồ đúng thời, cờ mới có tệp Commons thật. Sai → gửi lỗi về máy viết sửa (tối đa 3 lượt), vẫn sai thì DỪNG.
// 3. KHO (chỉ món còn thiếu, dùng lại mãi): cờ tải Commons; nhân vật vẽ gốc + 9 dáng (box3 kho-sinh.mts ~1.100₫) → nền trong (nen-trong.swift) → R2 +
//    Studio phim #1186 (kho-day.mts) → kho.json. Tranh cảnh: box3 tranh-sinh.mts (~110₫) + tách lớp trước (tach-lop.swift) cho chiều sâu.
// 4. DỰNG: dung-tap.mjs (giọng box3 ~2.500₫ một lần, bản đồ, hiệu ứng, tiếng động) → <id>.mp4 + <id>-xem.mp4 (720p gửi xem) ở /Users/htuan/.cache/lich-su/<id>/.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KHO, geo, TP, chuan, boDau, dichCua } from './dia-ly.mjs';

const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const co = (k) => process.argv.includes(`--${k}`);
const DIR = dirname(fileURLToPath(import.meta.url)), BOX = 'root@167.233.241.16', GOC_BOX = '/opt/earns-marketing-os-v2/apps/xuong-video';
const id = arg('id'), nn = arg('nn', 'en'), chuDe = arg('chu-de');
if (!id) { console.error('node lam-tap.mjs --id <id> --nn en|es --chu-de "…"'); process.exit(2); }
const tepTap = join(DIR, 'tap', `${id}.json`), RA = join(KHO, id), tepKho = join(DIR, 'kho.json');
mkdirSync(RA, { recursive: true });
const box = (lenh) => execFileSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx ${lenh}`], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
const len = (f, dich) => execFileSync('scp', ['-q', f, `${BOX}:${dich}`]);
const ve = (nguon, dich) => execFileSync('scp', ['-q', '-r', `${BOX}:${nguon}`, dich]);
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const docKho = () => JSON.parse(readFileSync(tepKho, 'utf8'));

// ---------- 2. KIỂM ----------
const ISO = new Set(geo.features.map((f) => f.properties.ADM0_A3));
const kiemDich = (d) => { if (Array.isArray(d)) return null; if (typeof d !== 'string') return `đích không đọc được ${JSON.stringify(d)}`;
  if (d.startsWith('@')) return TP.has(chuan(d.slice(1))) ? null : `không có thành phố "${d.slice(1)}" trong Natural Earth — dùng toạ độ "lon,lat"`;
  if (/^-?\d/.test(d)) { const [a, b] = d.split(',').map(Number); return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 180 && Math.abs(b) <= 90 ? null : `toạ độ sai "${d}"`; }
  const [iso, vg] = d.split('@'); if (!ISO.has(iso)) return `mã nước "${iso}" không có trong Natural Earth`;
  if (vg && ![2, 4].includes(vg.split(',').map(Number).filter(Number.isFinite).length)) return `"${d}" sai cú pháp — viết "ISO@lon0,lat0,lon1,lat1" (khung) hoặc "ISO@lon,lat" (điểm)`;
  try { dichCua(d); } catch { return `"${d}": nước ${iso} không có mảnh đất nào trong khung ${vg} — chọn khung có đất của đúng nước đó hôm nay (chủ thời xưa ghi ở to.chu)`; } return null; };
const phang = (t) => boDau(t).toLowerCase().replace(/[‘’´`]/g, "'").replace(/[“”«»]/g, '"').replace(/\s+/g, ' ').trim();
const commons = async (ten) => { const r = await (await fetch(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', titles: ten, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '640', format: 'json', formatversion: '2' })}`, { headers: { 'User-Agent': 'studio-lich-su/1.0' } })).json();
  const p = r.query?.pages?.[0]; return p && !p.missing && p.imageinfo?.[0] ? { thumb: p.imageinfo[0].thumburl, trang: p.imageinfo[0].descriptionurl } : null; };
// tệp Commons đoán sai tên → máy tìm tệp có thật gần nhất để máy viết chọn (không tự chọn: cờ sai thời còn tệ hơn không có cờ)
const timCommons = async (ten) => { const r = await (await fetch(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', list: 'search', srnamespace: '6', srlimit: '10', srsearch: ten.replace(/^File:|\.svg$|\.png$/gi, '').replace(/[()_-]/g, ' '), format: 'json', formatversion: '2' })}`, { headers: { 'User-Agent': 'studio-lich-su/1.0' } })).json();
  return (r.query?.search ?? []).map((x) => x.title).filter((t) => /^File:Flag/i.test(t)); };
async function kiem(tap, nguonChu) {
  const loi = [], kho = docKho().tai_san, moi = Object.fromEntries((tap.tai_san_moi || []).map((t) => [t.id, t])), nguonP = phang(nguonChu);
  const ds = tap.cau, tu = ds.map((c) => c.chu).join(' ').split(/\s+/).length, [t0, t1] = nn === 'es' ? [130, 200] : [120, 185];
  if (ds.length < 8 || ds.length > 12) loi.push(`có ${ds.length} câu — khuôn là 9–11 câu`);
  if (tu < t0 || tu > t1) loi.push(`tổng ${tu} từ — khuôn ${nn === 'es' ? '140–185' : '130–170'} từ`);
  let nam = null; const namNguon = new Set((ds.flatMap((c) => (c.su_that || []).map((x) => `${x.gia_tri} ${x.trich}`)).join(' ').match(/\b\d{3,4}\b/g) || []).map(Number));
  const nhanVat = new Set(ds.flatMap((c) => (c.canh.nguoi || []).map((n) => n.anh))); if (nhanVat.size < 2) loi.push(`cả tập chỉ có ${nhanVat.size} nhân vật — cần ≥ 2 (người có tên đang hành động phải đứng trong cảnh)`);
  ds.forEach((c, k) => { const K = `câu ${k + 1}`, cv = c.canh, ws = new Set(c.chu.split(/\s+/).map(chuan));
    if (k < ds.length - 1 && !(c.su_that || []).length) loi.push(`${K}: không có su_that nào — mọi câu kể (cả hook) phải có nguồn`);
    for (const n of [cv.nam, cv.nam_sau?.nam]) if (n != null && !namNguon.has(n)) loi.push(`${K}: ô năm ${n} không có trong su_that nào của tập — ghi năm có nguồn hoặc null`);
    if (/[—–→…]|\.\.\./.test(c.chu)) loi.push(`${K}: còn dấu vết AI (— – → …) trong "${c.chu}"`);
    for (const s of c.su_that || []) { const tr = phang(s.trich).replace(/^["']|["']$/g, ''); if (nguonP.includes(tr)) continue;
      const w = tr.split(' '), sh = []; for (let i = 0; i + 6 <= w.length; i++) sh.push(w.slice(i, i + 6).join(' ')); const trung = sh.filter((x) => nguonP.includes(x)).length;
      if (!sh.length || trung / sh.length < 0.6) loi.push(`${K}: sự thật "${s.gia_tri}" — đoạn trích không có NGUYÊN VĂN trong nguồn: "${s.trich.slice(0, 120)}"`); }
    const theoChu = [...(cv.nguoi || []).flatMap((n) => (n.dang || []).map((d) => d.chu)), ...(cv.dau || []).map((d) => d.chu), ...(cv.tranh ? [cv.tranh.tu_chu, cv.tranh.den_chu] : []), ...(cv.nam_sau ? [cv.nam_sau.chu] : [])];
    for (const w of theoChu) if (!ws.has(chuan(w))) loi.push(`${K}: chữ "${w}" (gọi dáng / dấu / tranh / năm) không có trong câu "${c.chu}"`);
    for (const n of cv.nguoi || []) for (const d of n.dang || []) if (!docKho().dang_chuan.includes(d.dang)) loi.push(`${K}: dáng "${d.dang}" không có trong danh mục`);
    const dichs = [...(cv.nhin || []), ...(cv.to || []).map((t) => t.noi ?? t), ...(cv.nhan || []).map((n) => n.o), ...(cv.vong || []), ...(cv.nhay || []), ...(cv.ten || []).flatMap((m) => [m.tu, m.den]), ...(cv.xe || []).flatMap((m) => [m.tu, m.den]), ...(cv.co || []).map((m) => m.o)];
    for (const d of dichs) { const e = kiemDich(d); if (e) loi.push(`${K}: ${e}`); }
    if (!(cv.nhin || []).length && !cv.tam) loi.push(`${K}: thiếu nhin (camera không biết nhìn đâu)`);
    nam = cv.nam ?? nam; const namCuoi = cv.nam_sau?.nam ?? nam;
    if ([...(cv.nguoi || []), ...(cv.xe || []), ...(cv.co || [])].length && cv.nam == null && namCuoi == null) loi.push(`${K}: có cờ / nhân vật / phương tiện mà cảnh chưa có nam — khai năm sự việc để máy kiểm đúng thời`);
    for (const [m, loai] of [...(cv.nguoi || []).map((m) => [m, 'nhan_vat']), ...(cv.xe || []).map((m) => [m, 'phuong_tien']), ...(cv.co || []).map((m) => [m, 'co'])]) {
      const ts = kho[m.anh] ?? moi[m.anh]; if (!ts) { loi.push(`${K}: "${m.anh}" không có trong KHO và không khai trong tai_san_moi`); continue; }
      if (ts.loai !== loai) loi.push(`${K}: "${m.anh}" là ${ts.loai}, không dùng được làm ${loai}`);
      const hop = [nam, namCuoi].filter((v) => v != null).some((v) => v >= ts.tu && v <= ts.den); if ((nam != null || namCuoi != null) && !hop) loi.push(`${K} (năm ${nam}${namCuoi !== nam ? `→${namCuoi}` : ''}): "${m.anh}" chỉ đúng ${ts.tu}–${ts.den} — ở câu này thay bằng ${loai === 'co' ? 'cờ ĐÚNG năm đó (khai tai_san_moi một cờ mới với tệp Commons của thời đó)' : 'món đúng thời (khai tai_san_moi mới)'} hoặc bỏ ${loai === 'co' ? 'cờ' : 'món'} khỏi câu`); }
    for (const r of cv.tranh?.ref || []) if (!kho[r] && !moi[r]) loi.push(`${K}: tranh tham chiếu "${r}" không có`); });
  if (!ds[0]?.canh?.mo || !ds[0]?.canh?.chu_to) loi.push('câu 1: thiếu hook (mo + chu_to)');
  if (!ds.at(-1)?.canh?.ket) loi.push('câu cuối: thiếu thẻ kết ket');
  for (const t of tap.tai_san_moi || []) { if (kho[t.id]) continue;
    if (t.loai === 'co') { if (!t.commons) loi.push(`cờ mới "${t.id}" thiếu tên tệp Commons`); else if (!(await commons(t.commons))) { const g = await timCommons(t.commons); loi.push(`cờ mới "${t.id}": tệp Commons "${t.commons}" không tồn tại${g.length ? ` — tệp CÓ THẬT gần nhất (chọn cái đúng thời, hoặc bỏ cờ): ${g.map((x) => `"${x}"`).join(', ')}` : ' — bỏ cờ này'}`); } }
    else if (!t.mo_ta_en?.trim()) loi.push(`tài sản mới "${t.id}" thiếu mo_ta_en`);
    if (t.que) { const e = kiemDich(t.que); if (e) loi.push(`tài sản mới "${t.id}": quê ${e}`); } }
  return loi;
}

// ---------- 1. VIẾT ----------
if (!existsSync(tepTap) || co('viet-lai')) {
  if (!chuDe) { console.error('chưa có tập — cần --chu-de'); process.exit(2); }
  const tmp = `/tmp/lich-su-${id}`; execFileSync('ssh', [BOX, `mkdir -p ${tmp}`]); len(tepKho, `${tmp}/kho.json`);
  let loi = [];
  for (let lan = 1; lan <= 4; lan++) {
    const them = loi.length ? ` --loi ${tmp}/loi.txt --cu ${tmp}/tap.json` : '';
    if (loi.length) { writeFileSync(join(RA, 'loi.txt'), loi.map((x) => `- ${x}`).join('\n')); len(join(RA, 'loi.txt'), `${tmp}/loi.txt`); len(tepTap, `${tmp}/tap.json`); }
    console.log(box(`scripts/lich-su/viet-tap.mts ${tmp}/tap.json --chu-de ${q(chuDe)} --nn ${nn} --id ${id} --kho ${tmp}/kho.json${arg('nguon') ? ` --nguon ${q(arg('nguon'))}` : ''}${them}`));
    ve(`${tmp}/tap.json`, tepTap); ve(`${tmp}/tap.json.nguon.txt`, join(RA, 'nguon.txt'));
    loi = await kiem(JSON.parse(readFileSync(tepTap, 'utf8')), readFileSync(join(RA, 'nguon.txt'), 'utf8'));
    console.log(loi.length ? `✗ lượt viết ${lan}: ${loi.length} lỗi\n  ${loi.join('\n  ')}` : `✓ lượt viết ${lan}: kiểm sạch`);
    if (!loi.length) break;
  }
  execFileSync('ssh', [BOX, `rm -rf ${tmp}`]);
  if (loi.length) { console.error('✗ máy viết 4 lượt vẫn lỗi — dừng, không tốn tiền giọng / ảnh'); process.exit(4); }
} else { const loi = existsSync(join(RA, 'nguon.txt')) ? await kiem(JSON.parse(readFileSync(tepTap, 'utf8')), readFileSync(join(RA, 'nguon.txt'), 'utf8')) : [];
  if (loi.length) { console.error(`✗ tập có lỗi:\n  ${loi.join('\n  ')}`); process.exit(4); } }
if (co('chi-viet')) process.exit(0);

// ---------- 3. KHO + TRANH ----------
const tap = JSON.parse(readFileSync(tepTap, 'utf8'));
let tien = 0;
for (const t of tap.tai_san_moi || []) {
  if (docKho().tai_san[t.id]) continue;
  const tam = join(KHO, 'kho', t.id), png = join(tam, 'png'); mkdirSync(png, { recursive: true });
  let nguonGhi = t.loai === 'co' ? null : `AI vẽ (ckey Nano Banana 2) + tách nền Vision, ${new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;
  if (t.loai === 'co') { const c = await commons(t.commons); writeFileSync(join(png, 'goc.png'), Buffer.from(await (await fetch(c.thumb, { headers: { 'User-Agent': 'studio-lich-su/1.0' } })).arrayBuffer())); nguonGhi = c.trang; }
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
for (const [k, c] of tap.cau.entries()) { const tr = c.canh.tranh; if (!tr || tr.anh) continue;
  const ten = `tranh/${id}-${k + 1}`, f = join(KHO, `${ten}.jpg`); mkdirSync(join(KHO, 'tranh'), { recursive: true });
  if (!existsSync(f)) { const ref = (tr.ref || []).map((r) => khoNay[r]?.dang?.goc).filter(Boolean), bt = `/tmp/${id}-tranh-${k + 1}.jpg`;
    const out = box(`scripts/lich-su/tranh-sinh.mts ${bt} ${q(tr.mo_ta)} ${ref.map(q).join(' ')}`); console.log(out); tien += Number(out.match(/~(\d+)₫/)?.[1] ?? 0);
    ve(bt, f); execFileSync('ssh', [BOX, `rm -f ${bt}`]); }
  const lopDir = join(KHO, `${ten}-lop`); spawnSync('swift', [join(DIR, '../shot-code/tach-lop.swift'), f, lopDir], { stdio: 'ignore' });
  const lop = existsSync(join(lopDir, 'lop.json')) ? JSON.parse(readFileSync(join(lopDir, 'lop.json'), 'utf8')) : [];
  tr.anh = `${ten}.jpg`; tr.lia ??= k % 2 ? 20 : -24;
  if (lop[0]) { copyFileSync(join(lopDir, 'lop-0.png'), join(KHO, `${ten}-lop.png`)); writeFileSync(join(KHO, `${ten}-lop.json`), JSON.stringify(lop[0])); tr.lop = `${ten}-lop.png`; tr.lop_hop_tep = `${ten}-lop.json`; } }
writeFileSync(tepTap, JSON.stringify(tap, null, 1) + '\n');
if (tien) console.log(`tiền kho + tranh lượt này ~${tien}₫`);

// ---------- 4. DỰNG ----------
const dung = spawnSync(process.execPath, [join(DIR, 'dung-tap.mjs'), tepTap, ...(arg('khung') ? ['--khung', arg('khung'), '--khung-ra', join(RA, 'khung.jpg')] : [])], { stdio: 'inherit' });
if (dung.status) process.exit(dung.status);
if (arg('khung')) process.exit(0);
const mp4 = join(RA, `${id}.mp4`), xem = join(RA, `${id}-xem.mp4`);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', 'scale=720:-2', '-c:v', 'libx264', '-crf', '27', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', xem]);
console.log(`✓ ${mp4}\n✓ ${xem}`);
