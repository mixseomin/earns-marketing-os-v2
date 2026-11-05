import assert from 'node:assert';
import { khungLuc, hetKhung, gioVnNay, docHoan, chuLich, lucTang, somTang } from './etp-khung';
import { khungCua, roiNap } from '../../../cty/worker/ethopex.mjs';   // kiểm chéo: worker đọc cùng sổ luật khung_doi

assert.deepStrictEqual([0, 6.9, 7, 14.9, 15, 20.9, 21, 22.5, 23, 23.9].map(khungLuc), ['tang', 'tang', 'sang', 'sang', 'giam', 'giam', 'tang', 'tang', 'tang', 'tang']);   // 05/11/2026 đảo khung: tăng 21–07 (qua nửa đêm) · giảm/tắt 15–21 · nạp sáng 07–15
assert.strictEqual(hetKhung(3), 7); assert.strictEqual(hetKhung(8), 15); assert.strictEqual(hetKhung(16), 21); assert.strictEqual(hetKhung(21.5), 7); assert.strictEqual(hetKhung(23.2), 7);
// KIỂM CHÉO worker ↔ trang: cùng khung cho từng nửa giờ của ngày (một luật hai tầng phải ra một kết quả)
for (let g = 0; g < 24; g += 0.5) assert.strictEqual(khungCua(g), khungLuc(g), `lệch khung lúc ${g}h`);
assert.strictEqual(roiNap('sang'), 100); assert.strictEqual(roiNap('tang'), null); assert.strictEqual(roiNap('giam'), null); assert.strictEqual(roiNap('bang'), null);
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
// somTang (cổng nhịp tăng, đúng nhip_tang.chan_tang): vừa tăng 14:44 VN 05/11 → không dồn: chờ tới 14:44 06/11 rồi khung tăng 21:00 · dồn: 17:44 → khung tăng 21:00; vừa giảm → khoá 6 giờ
{ const bac = [{ luc: '2026-11-05T07:44:00Z', truoc: '1', sau: '2' }], luc = '2026-11-05T18:00:00Z', bay = Date.UTC(2026, 10, 5, 18, 10);
  const k = somTang(bac, false); assert.strictEqual(k.som, Date.UTC(2026, 10, 6, 7, 44)); assert.ok(k.ly?.startsWith('vừa tăng lúc 14:44'));
  assert.strictEqual(lucTang(luc, false, bay, k.som, false), Date.UTC(2026, 10, 6, 14, 0), 'vừa tăng chưa đủ 24 giờ → nhịp đầu từ 21:00 06/11');
  assert.strictEqual(lucTang(luc, false, bay, somTang(bac, true).som, true), Date.UTC(2026, 10, 5, 18, 30), 'tiêu dồn: đã quá 3 giờ → nhịp kế 01:30');
  assert.strictEqual(somTang([{ luc: '2026-11-05T17:00:00Z', truoc: '3', sau: '2' }], true).som, Date.UTC(2026, 10, 5, 23, 0), 'vừa giảm → khoá 6 giờ'); }
console.log('etp-khung: đạt');
