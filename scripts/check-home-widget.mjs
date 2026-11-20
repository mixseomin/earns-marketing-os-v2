#!/usr/bin/env node
// LƯỚI /home (anh 20/11/2026: /home phải "cover các thông tin hiển thị đang có trong toàn bộ" trang chủ cũ).
// Đối chiếu ba sổ bằng chữ trong tệp nguồn (không cần build):
//   1. mọi tab của trang chủ cũ (lib/tab-trang.ts, khoá '/') có ít nhất MỘT widget nhận thay (trường `tab` trong lib/home/so.ts) — thêm tab mới mà quên widget là đỏ;
//   2. mọi widget trong sổ có hàm vẽ trong components/home/ve.tsx và ngược lại;
//   3. bố cục dựng sẵn của từng màn: mã widget có thật, không lặp trong một màn (kể cả trong tab), nằm trong lưới 48 × 72, không đè nhau; mọi widget nằm trên ít nhất một màn;
//   4. widget BẢNG RỘNG (rong: true) chỉ được nằm trong ô rộng ≥ RONG_BANG cột — bảng nhiều cột nhét vào ô hẹp là "bị kẹp kích thước" (anh 20/11/2026).
//   5. mỗi widget khai đúng một trong hai: `tab` (thay tab nào của trang chủ cũ) hoặc `nguon` (mảnh nhúng từ app khác, vd nhóm M của cty.on.tc).
// Chạy: node scripts/check-home-widget.mjs   ·   node scripts/check-home-widget.mjs --tu-kiem (tự phá năm chỗ, phải đỏ cả năm)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps/web/src');
const doc = (p) => fs.readFileSync(path.join(GOC, p), 'utf8');

export function kiem(so, ve, tabTrang) {
  const loi = [];
  const khoiTab = tabTrang.slice(tabTrang.indexOf("'/': {"), tabTrang.indexOf("'/shop'"));
  const tabs = [...khoiTab.matchAll(/\{ key: '([a-z0-9_]+)'/g)].map((m) => m[1]);
  const khoiW = so.slice(so.indexOf('export const WIDGET = {'), so.indexOf('} as const satisfies'));
  // mỗi widget khai đúng một trong hai: tab (thay tab nào của trang chủ cũ) hoặc nguon (mảnh nhúng từ app khác — hiện chỉ 'cty')
  const NGUON = ['cty'];
  const moi = [...khoiW.matchAll(/^\s+([A-Z]\d+): \{(.*)$/gm)].map((m) => ({ ma: m[1], tab: (m[2].match(/\btab: '([a-z0-9_]+)'/) || [])[1], nguon: (m[2].match(/\bnguon: '([a-z0-9_]+)'/) || [])[1] }));
  for (const w of moi) {
    if (!w.tab === !w.nguon) loi.push(`widget ${w.ma} phải khai đúng một trong hai: tab hoặc nguon`);
    if (w.nguon && !NGUON.includes(w.nguon)) loi.push(`widget ${w.ma} khai nguon "${w.nguon}" lạ (đang có: ${NGUON.join(', ')})`);
  }
  const widget = new Map(moi.map((w) => [w.ma, w.tab ?? '']));
  const rong = new Set([...khoiW.matchAll(/^\s+([A-Z]\d+): \{.*?rong: true/gm)].map((m) => m[1]));
  const RONG = Number((so.match(/RONG_BANG = (\d+)/) || [])[1] || 32);
  if (!tabs.length) loi.push('không đọc được danh sách tab của trang chủ trong lib/tab-trang.ts');
  if (!widget.size) loi.push('không đọc được sổ widget trong lib/home/so.ts');
  const nhan = new Set(widget.values());
  for (const t of tabs) if (!nhan.has(t)) loi.push(`tab "${t}" của trang chủ cũ chưa có widget nào nhận thay — thêm widget (trường tab: '${t}') vào lib/home/so.ts`);
  for (const [ma, t] of widget) if (t && !tabs.includes(t)) loi.push(`widget ${ma} khai tab "${t}" không có trong sổ tab trang chủ`);
  const coVe = new Set([...ve.slice(ve.indexOf('export const VE')).matchAll(/^\s+([A-Z]\d+): \(/gm)].map((m) => m[1]));
  for (const ma of widget.keys()) if (!coVe.has(ma)) loi.push(`widget ${ma} có trong sổ nhưng thiếu hàm vẽ trong components/home/ve.tsx`);
  for (const ma of coVe) if (!widget.has(ma)) loi.push(`components/home/ve.tsx vẽ ${ma} nhưng sổ không có widget này`);
  const trenMan = new Set();
  for (const m of so.matchAll(/\{ id: '([a-z0-9]+)', ten: '([^']+)'.*?o: o\(\[(.*?)\]\) \}/g)) {
    const o = [...m[3].matchAll(/\['([A-Z]\d+)', (\d+), (\d+), (\d+), (\d+)(?:, \[([^\]]*)\])?\]/g)].map((x) => ({ ma: x[1], x: +x[2], y: +x[3], w: +x[4], h: +x[5], tabs: [x[1], ...[...(x[6] ?? '').matchAll(/'([A-Z]\d+)'/g)].map((t) => t[1])] }));
    const moiMa = o.flatMap((a) => a.tabs);
    if (!o.length) loi.push(`màn "${m[2]}" không có ô nào`);
    o.forEach((a, i) => {
      for (const t of a.tabs) {
        trenMan.add(t);
        if (!widget.has(t)) loi.push(`màn "${m[2]}": widget ${t} không có trong sổ`);
        if (moiMa.indexOf(t) !== moiMa.lastIndexOf(t)) loi.push(`màn "${m[2]}": widget ${t} lặp`);
        if (rong.has(t) && a.w < RONG) loi.push(`màn "${m[2]}": ${t} là bảng rộng mà nằm trong ô chỉ ${a.w}/48 cột (cần ≥ ${RONG}) — cho trọn bề ngang, bảng đi kèm xếp thành tab cùng ô`);
      }
      if (a.x + a.w > 48 || a.y + a.h > 72 || a.w < 4 || a.h < 3) loi.push(`màn "${m[2]}": ô ${a.ma} vượt lưới 48 × 72 hoặc nhỏ hơn cỡ tối thiểu`);
      for (const b of o.slice(i + 1)) if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) loi.push(`màn "${m[2]}": ô ${a.ma} đè lên ô ${b.ma}`);
    });
  }
  for (const ma of widget.keys()) if (!trenMan.has(ma)) loi.push(`widget ${ma} không nằm trên màn dựng sẵn nào`);
  return { loi, soTab: tabs.length, soWidget: widget.size };
}

const so = doc('lib/home/so.ts'), ve = doc('components/home/ve.tsx'), tabTrang = doc('lib/tab-trang.ts');
if (process.argv.includes('--tu-kiem')) {
  const pha = [
    ['bỏ widget duy nhất của tab luat', kiem(so.replace(/^\s+L2: \{.*$/m, ''), ve, tabTrang)],
    ['bỏ hàm vẽ A1', kiem(so, ve.replace(/^\s+A1: \(.*$/m, ''), tabTrang)],
    ['cho hai ô đè nhau', kiem(so.replace("['A2', 0, 10, 10, 62]", "['A2', 0, 0, 10, 62]"), ve, tabTrang)],
    ['widget không khai tab lẫn nguon', kiem(so.replace("nguon: 'cty' },\n  M2", "},\n  M2"), ve, tabTrang)],
    ['nhét bảng rộng vào ô hẹp', kiem(so.replace("['B1', 10, 10, 38, 62]", "['B1', 10, 10, 20, 62]"), ve, tabTrang)],
  ];
  let hong = 0;
  for (const [ten, r] of pha) { if (r.loi.length) console.log(`✓ tự kiểm: ${ten} → đỏ (${r.loi[0]})`); else { hong++; console.error(`✗ tự kiểm: ${ten} mà lưới KHÔNG đỏ`); } }
  if (kiem(so, ve, tabTrang).loi.length) { hong++; console.error('✗ tự kiểm: bản thật đang đỏ'); }
  process.exit(hong ? 1 : 0);
}
const r = kiem(so, ve, tabTrang);
if (r.loi.length) { console.error(`✗ check-home-widget: ${r.loi.length} chỗ lệch\n  - ${r.loi.join('\n  - ')}`); process.exit(1); }
console.log(`✓ check-home-widget: ${r.soTab} tab trang chủ đều có widget nhận thay · ${r.soWidget} widget có hàm vẽ + nằm trên màn dựng sẵn, không ô nào đè nhau`);
