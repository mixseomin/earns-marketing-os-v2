#!/usr/bin/env node
// Tự kiểm hồ sơ công ty: mọi nhân sự có phòng tồn tại, bao_cao_cho tồn tại, so_do trỏ file có thật, heartbeat đợt tham quan
// phải là off, kind hợp lệ, có HEARTBEAT.md. Chạy trong GHA trước build (như check-canon). Exit 1 khi lệch.
import fs from 'node:fs';
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
  if (f.heartbeat !== 'off' && String(phong[f.phong]?.thu_nghiem) !== 'true') loi.push(`${id}: heartbeat phải là off trong đợt tham quan (đang: ${f.heartbeat}); chỉ phòng thu_nghiem: true được khác`);
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
// Mọi màn phải gắn chồng ngăn kéo (chuẩn ngan-keo): thiếu thì `?ngan=` trên màn đó không mở được ngăn, F5 mất ngăn.
const APP = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'app');
const trang = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'api' ? [] : trang(path.join(d, e.name))) : e.name === 'page.tsx' ? [path.join(d, e.name)] : []);
for (const f of trang(APP)) if (!fs.readFileSync(f, 'utf8').includes('<ChongNgan')) loi.push(`${path.relative(APP, f)}: thiếu <ChongNgan ngan={searchParams.ngan} /> (chuẩn ngan-keo)`);
if (loi.length) { console.error('✗ tu-kiem cty:\n  ' + loi.join('\n  ')); process.exit(1); }
console.log(`✓ tu-kiem cty: ${Object.keys(ns).length} nhân sự, ${Object.keys(phong).length} phòng, hồ sơ nhất quán`);
