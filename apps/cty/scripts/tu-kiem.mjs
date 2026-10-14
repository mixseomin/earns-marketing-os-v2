#!/usr/bin/env node
// Tự kiểm hồ sơ công ty: mọi nhân sự có phòng tồn tại, bao_cao_cho tồn tại, so_do trỏ file có thật, heartbeat đợt tham quan
// phải là off, kind hợp lệ, có HEARTBEAT.md. Chạy trong GHA trước build (như check-canon). Exit 1 khi lệch.
import fs from 'node:fs';
const { NHIP, NHIP_MAY } = await import('../worker/nhip.mjs');
import path from 'node:path';
import { parseFm } from './fm.mjs';
const R = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'cong-ty');
const fm = (f) => parseFm(fs.readFileSync(f, 'utf8')).fm;
const phong = Object.fromEntries(fs.readdirSync(path.join(R, 'phong')).filter((f) => f.endsWith('.md')).map((f) => [f.replace(/\.md$/, ''), fm(path.join(R, 'phong', f))]));
const ns = Object.fromEntries(fs.readdirSync(path.join(R, 'nhan-su')).filter((d) => fs.existsSync(path.join(R, 'nhan-su', d, 'SOUL.md'))).map((d) => [d, fm(path.join(R, 'nhan-su', d, 'SOUL.md'))]));
const loi = [];
for (const [id, f] of Object.entries(ns)) {
  if (!phong[f.phong]) loi.push(`${id}: phòng "${f.phong}" không tồn tại`);
  if (f.bao_cao_cho && !ns[f.bao_cao_cho]) loi.push(`${id}: bao_cao_cho "${f.bao_cao_cho}" không tồn tại`);
  // heartbeat được bật khi MỌI việc khai là nhịp máy có trong worker/nhip.mjs NHIP (0 tiền mô hình); nhịp gọi mô hình vẫn khoá trừ phòng thu_nghiem
  if (f.heartbeat !== 'off' && String(phong[f.phong]?.thu_nghiem) !== 'true' && !String(f.heartbeat).split(',').every((v) => v.trim() in NHIP || v.trim() in NHIP_MAY)) loi.push(`${id}: heartbeat "${f.heartbeat}" không phải nhịp máy trong worker/nhip.mjs NHIP — nhịp gọi mô hình chỉ bật khi anh bảo (đặt off)`);
  if (!['ai', 'human', 'vendor'].includes(f.kind)) loi.push(`${id}: kind lạ "${f.kind}"`);
  if (!['nam', 'nu'].includes(f.gioi_tinh)) loi.push(`${id}: gioi_tinh phải là nam|nu (chọn nhân vật pixel), đang "${f.gioi_tinh}"`);
  if (!fs.existsSync(path.join(R, 'nhan-su', id, 'HEARTBEAT.md'))) loi.push(`${id}: thiếu HEARTBEAT.md`);
}
for (const [id, f] of Object.entries(phong)) {
  if (f.so_do && !fs.existsSync(path.join(R, 'so-do', `${f.so_do}.svg`))) loi.push(`phong ${id}: so_do "${f.so_do}" không có file`);
  if (!Object.values(ns).some((n) => n.phong === id)) loi.push(`phong ${id}: không có nhân sự nào`);
}
if (!fs.existsSync(path.join(R, 'AGENTS.md'))) loi.push('thiếu AGENTS.md');
const chF = path.join(R, 'cau-hinh.md');
if (!fs.existsSync(chF)) loi.push('thiếu cau-hinh.md');
else {
  const ch = fm(chF); const tong = Number(ch.tran_tong_usd_thang || 0);
  const nguoi = Object.values(ns).reduce((s, f) => s + Number(f.tran_usd_thang || 0), 0);
  if (!(tong > 0)) loi.push('cau-hinh: tran_tong_usd_thang phải > 0');
  if (nguoi > tong) loi.push(`tổng trần người $${nguoi} > trần tổng $${tong}`);
}
// Module worker có thể bị Next đóng gói → import.meta.url thành đường dẫn LÚC BUILD (máy GHA), sai trên box → 500 (11/10/2026).
// Chỉ worker/goc.mjs được tự tìm đường bằng import.meta.url (có lối về process.cwd()); mọi tệp khác dùng GOC.
const WK = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'worker');
for (const f of fs.readdirSync(WK).filter((x) => x.endsWith('.mjs') && x !== 'goc.mjs')) if (/new URL\(import\.meta\.url\)\.pathname/.test(fs.readFileSync(path.join(WK, f), 'utf8'))) loi.push(`worker/${f}: dùng import.meta.url để tìm đường — dùng GOC từ worker/goc.mjs`);
// Mọi màn phải gắn chồng ngăn kéo (chuẩn ngan-keo): thiếu thì `?ngan=` trên màn đó không mở được ngăn, F5 mất ngăn.
const APP = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'app');
const trang = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'api' ? [] : trang(path.join(d, e.name))) : e.name === 'page.tsx' ? [path.join(d, e.name)] : []);
for (const f of trang(APP)) if (!fs.readFileSync(f, 'utf8').includes('<ChongNgan')) loi.push(`${path.relative(APP, f)}: thiếu <ChongNgan ngan={searchParams.ngan} /> (chuẩn ngan-keo)`);
// Ô SƠ ĐỒ (#1326 "các thành phần cần click và xem được data thực"): phòng đã khai dây chuyền thì MỌI ô của sơ đồ (rect, trừ khung ngoài cùng)
// phải có data-href; mọi data-href (mọi sơ đồ) phải là link ngăn hợp lệ (khoaTuHref) — ô trỏ bậy thì bấm ra trang trắng.
const { khoaTuHref } = await import('../src/lib/ngan.ts');
for (const [id, f] of Object.entries(phong)) {
  if (!f.so_do) continue;
  const svg = fs.readFileSync(path.join(R, 'so-do', `${f.so_do}.svg`), 'utf8');
  for (const [, h] of svg.matchAll(/data-href="([^"]+)"/g)) if (!khoaTuHref(h)) loi.push(`so-do/${f.so_do}.svg: data-href "${h}" không mở được ngăn nào`);
  const dsl = path.join(R, 'quy-trinh', id, 'danh-sach.json');
  if (fs.existsSync(dsl) && JSON.parse(fs.readFileSync(dsl, 'utf8')).day_chuyen?.length) {
    const rect = [...svg.matchAll(/<rect\b[^>]*>/g)].map((m) => m[0]).filter((r) => !/x="20" y="20"/.test(r));   // khung ngoài cùng của mọi sơ đồ phòng
    const thieu = rect.filter((r) => !/data-href=/.test(r));
    if (thieu.length) loi.push(`so-do/${f.so_do}.svg: ${thieu.length} ô chưa trỏ tới số liệu (thiếu data-href): ${thieu.slice(0, 3).join(' ')}`);
  }
}
// VIỆC NỀN → MỘT NGƯỜI (anh 13/10/2026: "mọi hoạt động trong phòng (cron, tự động…) đều phải gắn với 1 nhân sự cụ thể để tính trách nhiệm,
// chi phí"). Quy trình khai `lich` = việc nền thật (LaunchAgent / unit systemd). Phòng đã khai lich thì MỌI quy trình máy chạy phải khai (kể cả []);
// việc nền thuộc đúng một quy trình; người chủ trì giải ra MỘT nhân sự có hồ sơ (không 'may', không vai bỏ trống); có chi_phi.
const { dsQuyTrinh, giaiNguoi } = await import('../worker/quy-trinh.mjs');
const nenCua = {};
for (const q of dsQuyTrinh().filter((x) => x.nguon === 'phong')) {
  const coLich = dsQuyTrinh().some((x) => x.phong === q.phong && Array.isArray(x.lich));
  if (!coLich) continue;
  if (q.so_hoa === 'co-dinh' && !Array.isArray(q.lich)) loi.push(`${q.khoa}: quy trình máy chạy chưa khai lich (việc nền thật, [] nếu chạy tay)`);
  if (!Array.isArray(q.lich) || !q.lich.length) continue;
  let nguoi = null; try { nguoi = giaiNguoi(q.phong, q.chu_tri)?.nguoi; } catch (e) { loi.push(`${q.khoa}: ${e.message}`); }
  if (!nguoi || !ns[nguoi]) loi.push(`${q.khoa}: việc nền ${q.lich.join(', ')} không ra một nhân sự cụ thể (chu_tri "${q.chu_tri}" → "${nguoi}")`);
  if (!q.chi_phi) loi.push(`${q.khoa}: việc nền chưa khai chi_phi ('chưa đo' nếu chưa có số)`);
  for (const l of q.lich) {
    if (!/^(iMac|MacBook|box\d):\S+$/.test(l)) loi.push(`${q.khoa}: lich "${l}" phải dạng <iMac|MacBook|boxN>:<nhãn việc nền>`);
    if (nenCua[l]) loi.push(`việc nền ${l} khai ở hai quy trình (${nenCua[l]} · ${q.khoa}) — mỗi việc nền thuộc đúng một người`);
    nenCua[l] = q.khoa;
  }
}
if (loi.length) { console.error('✗ tu-kiem cty:\n  ' + loi.join('\n  ')); process.exit(1); }
console.log(`✓ tu-kiem cty: ${Object.keys(ns).length} nhân sự, ${Object.keys(phong).length} phòng, hồ sơ nhất quán`);
