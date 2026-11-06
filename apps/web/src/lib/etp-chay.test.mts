import assert from 'node:assert';
import { choGio, dangChay, chuHen } from './etp-chay';
const now = Date.UTC(2026, 10, 5, 17, 8), lich = '2026-11-06T00:00:00Z';   // 00:08 VN 06/11, hẹn 07:00 VN
assert.strictEqual(choGio({ trang_thai: 'ACTIVE', lich, dong_bo: 'done' }, { now }), true);
assert.strictEqual(dangChay({ trang_thai: 'ACTIVE', lich, dong_bo: 'done' }, { now }), false, 'ACTIVE hẹn giờ chưa tới = chưa chạy');
assert.strictEqual(dangChay({ trang_thai: 'ACTIVE', lich, dong_bo: 'done' }, { now: Date.UTC(2026, 10, 6, 1) }), true);
assert.strictEqual(dangChay({ trang_thai: 'ACTIVE', lich: null, dong_bo: 'done' }, { now }), true);
assert.strictEqual(chuHen(lich, { now }), 'hẹn 07:00'); assert.strictEqual(chuHen(lich, { now: now - 2 * 86_400_000 }), 'hẹn 07:00 06/11');
// gọi qua Array.filter / map (số thứ tự lọt vào tham số thứ hai) phải ra theo giờ THẬT — camp hẹn từ hôm qua là đang chạy (06/11/2026)
const cu = [{ trang_thai: 'ACTIVE', lich: new Date(Date.now() - 86_400_000).toISOString(), dong_bo: 'done' }, { trang_thai: 'ACTIVE', lich: new Date(Date.now() - 3_600_000).toISOString(), dong_bo: 'done' }];
assert.strictEqual(cu.filter(dangChay).length, 2, 'filter(dangChay) đọc giờ thật'); assert.strictEqual(cu.filter(choGio).length, 0, 'filter(choGio) đọc giờ thật');
console.log('etp-chay: đạt');
