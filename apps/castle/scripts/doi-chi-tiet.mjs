#!/usr/bin/env node
// DỜI CHI TIẾT MẶT TIỀN THEO KHỐI (20/11/2026): khối vừa được dời chiều cao theo DOM20 (sua.json y_tren ↔ y_tren_truoc_dom20) thì mọi số đo ĐỘ CAO TUYỆT ĐỐI
// của các mặt khối đó trong <lâu>-cua-so.json phải dời theo đúng bằng ấy — các số đó đo theo mốc ĐỈNH TƯỜNG cũ ("mốc chân răng cưa = 25,0"), không theo mặt đất.
// Trường dời: hang[].y0 / y1 · o_vuong[][1] · o_tron[][1] · neo_y · go_y[] · thap_canh[][1..2] · cua_thap[][1]. Mỗi mặt ghi "doi_dom20" = tổng đã dời → chạy lại không dời hai lần.
//   node apps/castle/scripts/doi-chi-tiet.mjs [--ghi]      (ghi lại tệp bằng JSON.stringify thụt 1 — tệp bị dàn lại định dạng một lần)
// tra-repo-ok: chuyển hệ quy chiếu cho tệp dữ liệu riêng của cảnh.
import { readFileSync, writeFileSync } from 'node:fs';
import { du, doiSo } from './chung.mjs';
const S = JSON.parse(readFileSync(du('sua'), 'utf8')), C = JSON.parse(readFileSync(du('cua-so'), 'utf8')), r2 = (v) => +(+v).toFixed(2); let n = 0;
for (const [mat, e] of Object.entries(C)) { const id = mat.split('#')[0], k = S[id]; if (k?.y_tren_truoc_dom20 == null) continue;
  const tong = r2(+k.y_tren - +k.y_tren_truoc_dom20), d = r2(tong - (e.doi_dom20 || 0)); if (Math.abs(d) < 0.01) continue;
  for (const h of e.hang || []) { h.y0 = r2(h.y0 + d); h.y1 = r2(h.y1 + d); }
  for (const f of ['o_vuong', 'o_tron', 'cua_thap']) for (const o of e[f] || []) o[1] = r2(o[1] + d);
  for (const o of e.thap_canh || []) { o[1] = r2(o[1] + d); o[2] = r2(o[2] + d); }
  if (typeof e.neo_y === 'number') e.neo_y = r2(e.neo_y + d); if (Array.isArray(e.go_y)) e.go_y = e.go_y.map((y) => r2(y + d));
  e.doi_dom20 = tong; n++; console.log(`  ${mat}: dời ${d > 0 ? '+' : ''}${d} m (tổng ${tong})`); }
// SỔ KIỂM KÊ (<lâu>-kiem-ke.json): dải độ cao "tu" / "den" của từng vùng cũng là số tuyệt đối theo đỉnh cũ → dời theo khối đầu của nhóm (20/11/2026: không dời thì
// cổng vòm, cánh cửa, neo, cửa sổ rơi sang dải khác — kiểm kê tụt từ 23 khớp xuống 15 khớp dù mô hình không mất chi tiết nào)
const KK = JSON.parse(readFileSync(du('kiem-ke'), 'utf8')); let m = 0;
for (const mat of KK.mat || []) { const k = S[(mat.nhom?.[0] || '').split('#')[0]]; if (k?.y_tren_truoc_dom20 == null) continue;
  const tong = r2(+k.y_tren - +k.y_tren_truoc_dom20), d = r2(tong - (mat.doi_dom20 || 0)); if (Math.abs(d) < 0.01) continue;
  for (const v of Object.values(mat.vung || {})) for (const f of ['tu', 'den']) if (typeof v[f] === 'number') v[f] = r2(v[f] + d);
  mat.doi_dom20 = tong; m++; console.log(`  kiểm kê "${mat.ten}": dời dải ${d > 0 ? '+' : ''}${d} m`); }
console.log(`${n} mặt cần dời chi tiết · ${m} vùng kiểm kê cần dời dải`);
if (doiSo.includes('--ghi') && m) { writeFileSync(du('kiem-ke'), JSON.stringify(KK, null, 1) + '\n'); console.log('đã ghi', du('kiem-ke')); }
if (doiSo.includes('--ghi') && n) { writeFileSync(du('cua-so'), JSON.stringify(C, null, 1) + '\n'); console.log('đã ghi', du('cua-so')); }
