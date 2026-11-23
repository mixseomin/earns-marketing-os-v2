#!/usr/bin/env node
// TÌM + TẢI ẢNH THẬT TRÊN MẠNG cho một chỗ trên lâu đài (anh 17/11/2026) — lệnh của kỹ sư (Thắng) khi sửa theo ảnh thật:
//   node apps/castle/scripts/tim-anh.mjs --the <id>                 tải các ảnh người báo đã chọn ở nút 📷 (ANH-THAT-JSON trong thẻ)
//   node apps/castle/scripts/tim-anh.mjs --khoi way/221599096 [--r 100]   tìm quanh tâm một khối OSM (Commons + Mapillary nhìn vào khối)
//   node apps/castle/scripts/tim-anh.mjs --xz 37,-13 [--r 100]       tìm quanh một toạ độ cảnh (x đông, z nam, mét)
//   node apps/castle/scripts/tim-anh.mjs --ghi-cong              ảnh đã nằm trong anh/web mà sổ ghi công thiếu → tra lại nguồn theo tên tệp, ghi bổ sung
//   … thêm --tai 1,3,5  → tải đúng các ảnh số đó trong danh sách IN LẦN TRƯỚC (ghi .kho-goc/<lâu>-tim-anh-cuoi.json, 1 ngày; --tai het = tìm mới + tải hết)
//   … ảnh tải hỏng (Commons 429 sau 6 lần thử) ghi vào .kho-goc/<lâu>-anh-web-hong.json, lượt sau bỏ qua 6 giờ; thêm --lai-hong để thử lại
// Ảnh tải về: apps/castle/public/du-lieu/anh/web/<nguồn>-<id>.jpg; tác giả / giấy phép / toạ độ / hướng ghi vào public/du-lieu/<lâu>-anh-web.json (bắt buộc ghi công
// khi dùng). Đo mặt tiền trên ảnh thì theo QUY-TRINH.md (đo điểm ảnh → du-lieu/<lâu>-mat-*.json). Khoá Mapillary: MLY_TOKEN hoặc vault acct #689 (~/bin/acct).
// Tìm ảnh dùng chung máy chủ kênh: server/anh-quanh.mjs.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { PUB, du, LAU, doiSo } from './chung.mjs';
import { timAnhQuanh, chiTietAnh } from '../server/anh-quanh.mjs';
import { taiMang } from '../server/tai-mang.mjs';

const arg = (k) => { const i = doiSo.indexOf(k); return i >= 0 ? doiSo[i + 1] : null; };
const D = JSON.parse(readFileSync(join(PUB, 'du-lieu', `${LAU}.json`), 'utf8')), [la0, lo0] = D.tam, MX = 111320 * Math.cos((la0 * Math.PI) / 180);
const raLatLng = (x, z) => [la0 - z / 111320, lo0 + x / MX];
const THU = join(PUB, 'du-lieu', 'anh', 'web'), SO = du('anh-web');
// sổ ảnh tải hỏng (ngoài public, không lên trang): .kho-goc/<lâu>-anh-web-hong.json — lượt sau bỏ qua trong 6 giờ, --lai-hong thử lại
const HONG = join(PUB, '..', '.kho-goc', `${LAU}-anh-web-hong.json`), hong = existsSync(HONG) ? JSON.parse(readFileSync(HONG, 'utf8')) : {};
const ghiHong = () => { mkdirSync(join(PUB, '..', '.kho-goc'), { recursive: true }); writeFileSync(HONG, JSON.stringify(hong, null, 1) + '\n'); };

// đọc ANH-THAT-JSON:{…} trong chữ (ngoặc cân bằng — JSON lồng mảng / object)
function docJsonSau(txt, nhan) {
  const i = txt.indexOf(nhan); if (i < 0) return null;
  let k = i + nhan.length, sau = 0, trongChuoi = false;
  for (let j = k; j < txt.length; j++) { const c = txt[j];
    if (trongChuoi) { if (c === '\\') j++; else if (c === '"') trongChuoi = false; continue; }
    if (c === '"') trongChuoi = true; else if (c === '{' || c === '[') sau++; else if (c === '}' || c === ']') { sau--; if (!sau) return JSON.parse(txt.slice(k, j + 1)); } }
  return null;
}
async function taiVe(ds, the = null) {
  mkdirSync(THU, { recursive: true });
  const so = existsSync(SO) ? JSON.parse(readFileSync(SO, 'utf8')) : [];
  for (const a of ds) {
    const tep = tenTep(a.nguon, a.id), duong = join(THU, tep);
    if (!existsSync(duong)) {
      // ảnh vừa hỏng (đã thử đủ 6 lần) trong 6 giờ qua → bỏ qua, không đốt thêm ~12 phút mỗi lần khối khác tìm trúng nó; --lai-hong thử lại hết
      if (hong[tep] && Date.now() - hong[tep].luc < 6 * 3600e3 && !doiSo.includes('--lai-hong')) { console.error(`✗ ${a.nguon} ${a.id}: bỏ qua, tải hỏng lúc ${new Date(hong[tep].luc + 7 * 3600e3).toISOString().slice(11, 16)} (GMT+7) — chạy lại với --lai-hong`); continue; }
      const r = await taiMang(a.url || a.lon); // giãn nhịp + thử lại khi 429 / 5xx: server/tai-mang.mjs
      if (!r.ok) { console.error(`✗ ${a.nguon} ${a.id}: tải lỗi ${r.status} (đã thử lại)`); hong[tep] = { luc: Date.now(), ma: r.status, url: a.url || a.lon }; ghiHong(); continue; }
      writeFileSync(duong, Buffer.from(await r.arrayBuffer()));
      if (hong[tep]) { delete hong[tep]; ghiHong(); }
    }
    const ghi = { tep: `anh/web/${tep}`, nguon: a.nguon, id: a.id, trang: a.trang, tacGia: a.tacGia, giayPhep: a.giayPhep, lat: a.lat, lng: a.lng, huong: a.huong ?? null, luc: a.luc ?? null,
      ...(a.ongKinh ? { ongKinh: a.ongKinh } : {}), ...(the ? { the: +the } : {}) };
    // ảnh đã nắn thẳng (khu-meo.py đổi tep → …-thang.jpg, giữ tepGoc) → vẫn là dòng cũ, giữ tep đã nắn
    const i = so.findIndex((x) => x.tep === ghi.tep || x.tepGoc === ghi.tep); if (i >= 0) so[i] = { ...so[i], ...ghi, tep: so[i].tep }; else so.push(ghi);
    console.log(`✓ ${duong}  (${a.tacGia} · ${a.giayPhep} · cách ${a.kc ?? '?'} m${a.huong != null ? ` · hướng ${a.huong}°` : ''})`);
  }
  // ảnh Mapillary tải trước khi sổ ghi ống kính (trước 24/11/2026) → tra bổ sung, không thì khu-meo không biết ảnh méo
  const mly = layKhoaMly();
  for (const x of so) if (x.nguon === 'mapillary' && !x.ongKinh && !x.khuMeo && mly) try { const c = await chiTietAnh('m:' + x.id, mly); if (c.ongKinh) x.ongKinh = c.ongKinh; } catch (e) { console.error(`✗ ống kính ${x.id}: ${e.message}`); }
  writeFileSync(SO, JSON.stringify(so, null, 1) + '\n');
  console.log(`ghi công: ${SO}`);
  // nắn méo ống kính ngay khi tải (ảnh góc rộng → lỗ kim cùng tiêu cự) — do-anh.mjs / khop-lg.py coi mọi ảnh là lỗ kim
  execFileSync('python3', [join(PUB, '..', 'scripts', 'khu-meo.py'), '--lau', LAU], { stdio: 'inherit' });
}

function layKhoaMly() { // khoá Mapillary: biến môi trường hoặc vault (không in ra)
  if (process.env.MLY_TOKEN) return process.env.MLY_TOKEN;
  try { return execFileSync(join(homedir(), 'bin', 'acct'), ['reveal', '689', 'api', 'client_token', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop() || null; } catch { return null; }
}
// --ghi-cong: ảnh trong anh/web chưa có dòng ghi công (tải bằng đường khác / sổ bị ghi đè) → tra lại nguồn từ chính tên tệp, ghi bổ sung (do-anh.mjs chỉ thấy ảnh có trong sổ)
const tenTep = (nguon, id) => `${nguon}-${String(id).replace(/\.[a-z]+$/i, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80)}.jpg`;
if (doiSo.includes('--ghi-cong')) {
  const { readdirSync } = await import('node:fs'), so = existsSync(SO) ? JSON.parse(readFileSync(SO, 'utf8')) : [], co = new Set(so.map((a) => a.tep)), mly = layKhoaMly();
  let them = 0; const sot = [], cho = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const layJson = async (u) => { for (let lan = 0; ; lan++) { const t = await (await taiMang(u)).text(); try { return JSON.parse(t); } catch { if (lan > 4) throw new Error('Commons từ chối: ' + t.slice(0, 60)); await cho(5000 * (lan + 1)); } } }; // Commons chặn khi gọi dồn
  for (const f of readdirSync(THU).filter((f) => /\.jpg$/i.test(f) && !co.has(`anh/web/${f}`))) {
    const [, ng, ten] = f.match(/^([a-z]+)-(.*)\.jpg$/i) || [];
    try {
      let a = null;
      if (ng === 'mapillary') a = await chiTietAnh('m:' + ten, mly);
      else if (ng === 'commons' || ng === 'c') { // tên đã bị làm gọn → tìm trên Commons rồi so lại đúng cách làm gọn
        const u = new URL('https://commons.wikimedia.org/w/api.php');
        for (const [k, v] of Object.entries({ action: 'query', format: 'json', list: 'search', srnamespace: '6', srlimit: '20', srsearch: ten.replace(/-+/g, ' ').trim() })) u.searchParams.set(k, v);
        const kq = (await layJson(u)).query?.search || [], t = kq.find((x) => tenTep(ng, x.title.replace(/^File:/, '')) === f);
        if (t) { await cho(800); a = await chiTietAnh('c:' + t.title.replace(/^File:/, '')).catch(async () => (await cho(8000), chiTietAnh('c:' + t.title.replace(/^File:/, '')))); }
        await cho(800);
      }
      if (!a) { sot.push(f); continue; }
      so.push({ tep: `anh/web/${f}`, nguon: a.nguon, id: a.id, trang: a.trang, tacGia: a.tacGia, giayPhep: a.giayPhep, lat: a.lat, lng: a.lng, huong: a.huong ?? null, luc: a.luc ?? null }); them++;
    } catch (e) { sot.push(`${f} (${e.message})`); }
  }
  writeFileSync(SO, JSON.stringify(so, null, 1) + '\n');
  console.log(`ghi công bổ sung ${them} ảnh · sổ ${so.length} dòng${sot.length ? ` · KHÔNG tra được ${sot.length}:\n  ` + sot.join('\n  ') : ''}`);
  process.exit(sot.length ? 1 : 0);
}
const the = arg('--the');
if (the) {
  if (!/^\d+$/.test(the)) { console.error('id thẻ phải là số'); process.exit(1); }
  const txt = execFileSync('ssh', ['root@167.233.241.16', `cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -tAc "SELECT instructions || ' ' || COALESCE(prep_payload->'trao_doi'->0->>'nguCanh','') FROM human_tasks WHERE id=${the}"`], { encoding: 'utf8' });
  let j = null; try { j = docJsonSau(txt, 'ANH-THAT-JSON:'); } catch { /* mã bị cắt dở */ }
  if (!j?.a?.length) { // không có mã ảnh (ngữ cảnh bị cắt / thẻ cũ): tải ảnh ĐÍNH KÈM của thẻ (ảnh thật đã chọn ở 📷 lên R2 cùng ảnh chụp trang)
    const urls = JSON.parse(execFileSync('ssh', ['root@167.233.241.16', `cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -tAc "SELECT COALESCE(prep_payload->'trao_doi'->0->'anh','[]'::jsonb) FROM human_tasks WHERE id=${the}"`], { encoding: 'utf8' }).trim() || '[]');
    if (!urls.length) { console.error(`thẻ #${the} không đính ảnh nào — tự tìm: --khoi <way/…> hoặc --xz x,z`); process.exit(1); }
    console.log(`thẻ #${the}: không có mã ảnh thật — tải ${urls.length} ảnh đính kèm (ảnh đầu thường là ảnh chụp màn hình mô hình; không có ghi công nguồn)`);
    await taiVe(urls.map((u, i) => ({ nguon: 'the', id: `${the}-${i + 1}`, url: u, trang: u, tacGia: '?', giayPhep: '?' })), the); process.exit(0);
  }
  console.log(`thẻ #${the}: ${j.a.length} ảnh người báo chọn quanh ${j.d?.ten || '?'} (x ${j.d?.x}, z ${j.d?.z})`);
  const mly = layKhoaMly(), ds = [];
  for (const ma of j.a) try { ds.push(await chiTietAnh(ma, mly)); } catch (e) { console.error('✗', e.message); }
  await taiVe(ds, the); process.exit(0);
}
let x, z, ten;
if (arg('--khoi')) {
  const k = D.khoi.find((b) => b.id === arg('--khoi')); if (!k) { console.error('không có khối ' + arg('--khoi')); process.exit(1); }
  const v = k.ngoai[0]; x = v.reduce((s, p) => s + p[0], 0) / v.length; z = v.reduce((s, p) => s + p[1], 0) / v.length; ten = `${k.id}${k.tags?.name ? ' (' + k.tags.name + ')' : ''}`;
} else if (arg('--xz')) { [x, z] = arg('--xz').split(',').map(Number); ten = `(${x}, ${z})`; }
else { console.error('cần --the <id> | --khoi <way/…> | --xz x,z'); process.exit(1); }
const mly = layKhoaMly();
const [lat, lng] = raLatLng(x, z), r = +(arg('--r') || 100);
// --tai <số> trỏ vào DANH SÁCH ĐÃ IN lần trước (Commons / Mapillary trả tập khác nhau mỗi lần gọi: 40 → 43 ảnh, số 28 thành ảnh khác — 24/11/2026).
// Danh sách mỗi lượt ghi .kho-goc/<lâu>-tim-anh-cuoi.json; lượt có --tai số dùng lại đúng danh sách đó nếu cùng chỗ + bán kính và chưa quá 1 ngày.
const CUOI = join(PUB, '..', '.kho-goc', `${LAU}-tim-anh-cuoi.json`), khoaTim = `${ten}|${r}`, taiSo = arg('--tai') && arg('--tai') !== 'het';
const cu = taiSo && existsSync(CUOI) ? JSON.parse(readFileSync(CUOI, 'utf8')) : null;
const dungLai = cu && cu.khoa === khoaTim && Date.now() - cu.luc < 864e5;
const kq = dungLai ? cu.kq : await timAnhQuanh({ lat, lng, r, mly });
if (dungLai) console.log(`(dùng lại danh sách đã in lúc ${new Date(cu.luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} — số thứ tự khớp lần in đó)`);
else { mkdirSync(join(PUB, '..', '.kho-goc'), { recursive: true }); writeFileSync(CUOI, JSON.stringify({ khoa: khoaTim, luc: Date.now(), kq })); }
if (taiSo && !dungLai) console.log('⚠ chưa có danh sách in trước cho đúng chỗ + bán kính này — số thứ tự dưới đây là của lần tìm MỚI');
console.log(`ảnh thật quanh ${ten} — ${lat.toFixed(6)}, ${lng.toFixed(6)}, bán kính ${r} m: ${kq.anh.length} ảnh${kq.coMapillary ? '' : ' (không có khoá Mapillary: chỉ Commons)'}${kq.loi.length ? ' · lỗi: ' + kq.loi.join('; ') : ''}`);
kq.anh.forEach((a, i) => console.log(`${String(i + 1).padStart(3)}. ${a.nguon.padEnd(9)} ${String(a.kc).padStart(4)} m ${a.huong != null ? `hướng ${String(a.huong).padStart(3)}°` : '          '} ${a.luc || '          '} ${a.giayPhep.padEnd(13)} ${a.id}\n      ${a.trang}`));
const tai = arg('--tai');
if (tai) await taiVe(tai === 'het' ? kq.anh : tai.split(',').map((n) => kq.anh[+n - 1]).filter(Boolean));
else if (kq.anh.length) console.log('→ tải: thêm --tai 1,3,5 (số trong danh sách) hoặc --tai het');
