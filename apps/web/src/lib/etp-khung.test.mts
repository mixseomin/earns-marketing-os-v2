import assert from 'node:assert';
import { khungLuc, hetKhung, gioVnNay, docHoan } from './etp-khung';
import { khungCua, roiNap } from '../../../cty/worker/ethopex.mjs';   // kiểm chéo: worker đọc cùng sổ luật khung_doi

assert.deepStrictEqual([0, 6.9, 7, 14.9, 15, 20.9, 21, 22.5, 23, 23.9].map(khungLuc), ['bang', 'bang', 'sang', 'sang', 'doi', 'doi', 'nap', 'nap', 'bang', 'bang']);
assert.strictEqual(hetKhung(3), 7); assert.strictEqual(hetKhung(8), 15); assert.strictEqual(hetKhung(16), 21); assert.strictEqual(hetKhung(21.5), 23); assert.strictEqual(hetKhung(23.2), 7);
// KIỂM CHÉO worker ↔ trang: cùng khung cho từng nửa giờ của ngày (một luật hai tầng phải ra một kết quả)
for (let g = 0; g < 24; g += 0.5) assert.strictEqual(khungCua(g), khungLuc(g), `lệch khung lúc ${g}h`);
assert.strictEqual(roiNap('sang'), 100); assert.strictEqual(roiNap('nap'), 30); assert.strictEqual(roiNap('doi'), null); assert.strictEqual(roiNap('bang'), null);
assert.strictEqual(Math.floor(gioVnNay(Date.UTC(2026, 10, 4, 17, 30))), 0);   // 17:30 UTC = 00:30 VN
const now = Date.UTC(2026, 10, 5, 0, 0), luc = new Date(now - 20 * 60_000).toISOString();
const h = docHoan([{ khoa: 'khung_hoan', gia_tri: { luc, tang: [1, 2], giam: [3], tat: [2] } }], now);
assert.strictEqual(h.ds.get(1), 'tang'); assert.strictEqual(h.ds.get(2), 'tat'); assert.strictEqual(h.ds.get(3), 'giam'); assert.strictEqual(h.ds.size, 3);
assert.strictEqual(docHoan([{ khoa: 'khung_hoan', gia_tri: { luc: new Date(now - 3 * 3600_000).toISOString(), tang: [1] } }], now).ds.size, 0);   // sổ cũ (máy không chạy) → không hứa
assert.strictEqual(docHoan([], now).ds.size, 0);
console.log('etp-khung: đạt');
