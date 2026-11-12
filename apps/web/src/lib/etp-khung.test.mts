import assert from 'node:assert';
import { khungLuc, hetKhung, gioVnNay, docHoan, chuLich, lucTang } from './etp-khung';
import { khungCua, congNap } from '../../../cty/worker/ethopex.mjs';   // kiểm chéo: worker đọc cùng sổ luật khung_doi

assert.deepStrictEqual([0, 6.9, 7, 14.9, 15, 20.9, 21, 22.5, 23, 23.9].map(khungLuc), ['tang', 'tang', 'sang', 'sang', 'giam', 'giam', 'tang', 'tang', 'tang', 'tang']);   // 05/11/2026 đảo khung: tăng 21–07 (qua nửa đêm) · giảm/tắt 15–21 · nạp sáng 07–15
assert.strictEqual(hetKhung(3), 7); assert.strictEqual(hetKhung(8), 15); assert.strictEqual(hetKhung(16), 21); assert.strictEqual(hetKhung(21.5), 7); assert.strictEqual(hetKhung(23.2), 7);
// KIỂM CHÉO worker ↔ trang: cùng khung cho từng nửa giờ của ngày (một luật hai tầng phải ra một kết quả)
for (let g = 0; g < 24; g += 0.5) assert.strictEqual(khungCua(g), khungLuc(g), `lệch khung lúc ${g}h`);
assert.deepStrictEqual(congNap('sang'), { tu: 0.5, den: 0.75, roi: 0 }); assert.strictEqual(congNap('tang'), null); assert.strictEqual(congNap('giam'), null); assert.strictEqual(congNap('bang'), null);   // nạp sáng 50–75% + ROI ≥ 0 (anh 12/11/2026)
assert.strictEqual(Math.floor(gioVnNay(Date.UTC(2026, 10, 4, 17, 30))), 0);   // 17:30 UTC = 00:30 VN
const now = Date.UTC(2026, 10, 5, 0, 0), luc = new Date(now - 20 * 60_000).toISOString();
const h = docHoan([{ khoa: 'khung_hoan', gia_tri: { luc, tang: [1, 2], giam: [3], tat: [2] } }], now);
assert.strictEqual(h.ds.get(1), 'tang'); assert.strictEqual(h.ds.get(2), 'tat'); assert.strictEqual(h.ds.get(3), 'giam'); assert.strictEqual(h.ds.size, 3);
assert.strictEqual(docHoan([{ khoa: 'khung_hoan', gia_tri: { luc: new Date(now - 3 * 3600_000).toISOString(), tang: [1] } }], now).ds.size, 0);   // sổ cũ (máy không chạy) → không hứa
assert.strictEqual(docHoan([], now).ds.size, 0);
// giờ chạy camp tạo lúc đó (khung len 07–12h VN): 08:00 VN chạy ngay · 05:00 VN sáng nay · 22:00 VN sáng mai
assert.strictEqual(chuLich(Date.UTC(2026, 10, 5, 1, 0)), 'chạy ngay'); assert.strictEqual(chuLich(Date.UTC(2026, 10, 4, 22, 0)), 'chạy 07:00 sáng nay'); assert.strictEqual(chuLich(Date.UTC(2026, 10, 5, 15, 0)), 'chạy 07:00 sáng mai');
// lucTang (anh 06/11/2026 "bao lâu nữa sẽ thực sự tăng"): trong khung tăng → nhịp kế (lần gần nhất + 30 phút); ngoài khung → nhịp đầu sau 21:00 VN; sổ cũ → null
{ const luc = new Date(Date.UTC(2026, 10, 5, 18, 0)).toISOString();   // nhịp 01:00 VN 06/11
  assert.strictEqual(lucTang(luc, false, Date.UTC(2026, 10, 5, 18, 10)), Date.UTC(2026, 10, 5, 18, 30), '01:10 VN trong khung tăng → nhịp 01:30');
  assert.strictEqual(lucTang(luc, false, Date.UTC(2026, 10, 6, 9, 5)), Date.UTC(2026, 10, 6, 14, 0), '16:05 VN ngoài khung → nhịp đầu từ 21:00');
  assert.strictEqual(lucTang(luc, true, Date.UTC(2026, 10, 5, 18, 10)), null, 'sổ cũ → không hứa'); }
// lucTang + mốc cổng nhịp (cho_toi của thẻ máy): chưa tới cổng → nhịp đầu trong khung tăng sau cổng; tiêu dồn → khung sáng cũng được
{ const luc = '2026-11-05T18:00:00Z', bay = Date.UTC(2026, 10, 5, 18, 10), cong = Date.UTC(2026, 10, 6, 14, 27);   // cổng 21:27 VN 06/11
  assert.strictEqual(lucTang(luc, false, bay, cong, false), Date.UTC(2026, 10, 6, 14, 30), 'cổng 21:27 → nhịp 21:30 VN');
  assert.strictEqual(lucTang(luc, false, bay, Date.UTC(2026, 10, 6, 1, 0), true), Date.UTC(2026, 10, 6, 1, 0), 'tiêu dồn, cổng 08:00 VN → nạp khung sáng 08:00');
  assert.strictEqual(lucTang(luc, false, bay, Date.UTC(2026, 10, 6, 1, 0), false), Date.UTC(2026, 10, 6, 14, 0), 'không dồn, cổng 08:00 VN → đợi khung tăng 21:00'); }
console.log('etp-khung: đạt');
