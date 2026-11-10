// tự kiểm lucLam (giờ máy làm theo hướng luật): node_modules/.bin/tsx apps/etp2/src/lib/etp-khung.test.mts
import assert from 'node:assert';
import { lucLam, KD } from './etp-khung';
const vn = (h: number, m = 0) => Date.UTC(2026, 10, 10, h - 7, m);   // giờ VN ngày 10/11
const gio = (t: number | null) => (t == null ? null : new Date(t + 7 * 3600_000).toISOString().slice(11, 16));
const luc = new Date(vn(16, 2)).toISOString();
assert.equal(gio(lucLam('tang', luc, false, vn(16, 10))), `${String(KD.tang[0]).padStart(2, '0')}:02`, 'tăng 16h → nhịp đầu trong khung tăng');
assert.equal(gio(lucLam('giam', luc, false, vn(16, 10))), '16:32', 'giảm đang trong khung giảm → nhịp kế');
assert.equal(gio(lucLam('tat', luc, false, vn(16, 10))), '16:32', 'tắt theo khung giảm');
assert.equal(lucLam('tang', luc, true, vn(16, 10)), null, 'sổ hoãn cũ → không hứa giờ');
assert.equal(lucLam('tang', null, false, vn(16, 10)), null, 'chưa có nhịp → không hứa giờ');
assert.equal(gio(lucLam('tang', luc, false, vn(16, 10), vn(23, 40))), '00:02', 'cổng nhịp (som) đẩy qua nửa đêm');
console.log('✓ etp-khung lucLam');
