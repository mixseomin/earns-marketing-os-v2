#!/usr/bin/env node
// TÌM + TẢI ẢNH THẬT TRÊN MẠNG cho một chỗ trên lâu đài (anh 17/11/2026) — lệnh của kỹ sư (Thắng) khi sửa theo ảnh thật:
//   node apps/castle/scripts/tim-anh.mjs --the <id>                 tải các ảnh người báo đã chọn ở nút 📷 (ANH-THAT-JSON trong thẻ)
//   node apps/castle/scripts/tim-anh.mjs --khoi way/221599096 [--r 100]   tìm quanh tâm một khối OSM (Commons + Mapillary nhìn vào khối)
//   node apps/castle/scripts/tim-anh.mjs --xz 37,-13 [--r 100]       tìm quanh một toạ độ cảnh (x đông, z nam, mét)
//   … thêm --tai 1,3,5  → tải đúng các ảnh số đó trong danh sách vừa in (--tai het = tải hết)
// Ảnh tải về: apps/castle/public/du-lieu/anh/web/<nguồn>-<id>.jpg; tác giả / giấy phép / toạ độ / hướng ghi vào public/du-lieu/<lâu>-anh-web.json (bắt buộc ghi công
// khi dùng). Đo mặt tiền trên ảnh thì theo QUY-TRINH.md (đo điểm ảnh → du-lieu/<lâu>-mat-*.json). Khoá Mapillary: MLY_TOKEN hoặc vault acct #689 (~/bin/acct).
// Tìm ảnh dùng chung máy chủ kênh: server/anh-quanh.mjs.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { PUB, du, LAU, doiSo } from './chung.mjs';
import { timAnhQuanh, chiTietAnh } from '../server/anh-quanh.mjs';

const arg = (k) => { const i = doiSo.indexOf(k); return i >= 0 ? doiSo[i + 1] : null; };
const D = JSON.parse(readFileSync(join(PUB, 'du-lieu', `${LAU}.json`), 'utf8')), [la0, lo0] = D.tam, MX = 111320 * Math.cos((la0 * Math.PI) / 180);
const raLatLng = (x, z) => [la0 - z / 111320, lo0 + x / MX];
const THU = join(PUB, 'du-lieu', 'anh', 'web'), SO = du('anh-web');

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
    const tep = `${a.nguon}-${String(a.id).replace(/\.[a-z]+$/i, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80)}.jpg`, duong = join(THU, tep);
    if (!existsSync(duong)) {
      const r = await fetch(a.url || a.lon, { headers: { 'User-Agent': 'castle-lau-dai-that/1.0 (tim-anh)' } });
      if (!r.ok) { console.error(`✗ ${a.nguon} ${a.id}: tải lỗi ${r.status}`); continue; }
      writeFileSync(duong, Buffer.from(await r.arrayBuffer()));
    }
    const ghi = { tep: `anh/web/${tep}`, nguon: a.nguon, id: a.id, trang: a.trang, tacGia: a.tacGia, giayPhep: a.giayPhep, lat: a.lat, lng: a.lng, huong: a.huong ?? null, luc: a.luc ?? null, ...(the ? { the: +the } : {}) };
    const i = so.findIndex((x) => x.tep === ghi.tep); if (i >= 0) so[i] = { ...so[i], ...ghi }; else so.push(ghi);
    console.log(`✓ ${duong}  (${a.tacGia} · ${a.giayPhep} · cách ${a.kc ?? '?'} m${a.huong != null ? ` · hướng ${a.huong}°` : ''})`);
  }
  writeFileSync(SO, JSON.stringify(so, null, 1) + '\n');
  console.log(`ghi công: ${SO}`);
}

function layKhoaMly() { // khoá Mapillary: biến môi trường hoặc vault (không in ra)
  if (process.env.MLY_TOKEN) return process.env.MLY_TOKEN;
  try { return execFileSync(join(homedir(), 'bin', 'acct'), ['reveal', '689', 'api', 'client_token', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop() || null; } catch { return null; }
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
const kq = await timAnhQuanh({ lat, lng, r, mly });
console.log(`ảnh thật quanh ${ten} — ${lat.toFixed(6)}, ${lng.toFixed(6)}, bán kính ${r} m: ${kq.anh.length} ảnh${kq.coMapillary ? '' : ' (không có khoá Mapillary: chỉ Commons)'}${kq.loi.length ? ' · lỗi: ' + kq.loi.join('; ') : ''}`);
kq.anh.forEach((a, i) => console.log(`${String(i + 1).padStart(3)}. ${a.nguon.padEnd(9)} ${String(a.kc).padStart(4)} m ${a.huong != null ? `hướng ${String(a.huong).padStart(3)}°` : '          '} ${a.luc || '          '} ${a.giayPhep.padEnd(13)} ${a.id}\n      ${a.trang}`));
const tai = arg('--tai');
if (tai) await taiVe(tai === 'het' ? kq.anh : tai.split(',').map((n) => kq.anh[+n - 1]).filter(Boolean));
else if (kq.anh.length) console.log('→ tải: thêm --tai 1,3,5 (số trong danh sách) hoặc --tai het');
