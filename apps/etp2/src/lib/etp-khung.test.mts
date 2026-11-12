// tự kiểm lucLam (giờ máy làm theo hướng luật): node_modules/.bin/tsx apps/etp2/src/lib/etp-khung.test.mts
import assert from 'node:assert';
import { lucLam, KD, congTang, quaCong } from './etp-khung';
import { congNap } from '../../../cty/worker/ethopex.mjs';   // kiểm chéo cổng nạp sáng: worker ↔ trang
const vn = (h: number, m = 0) => Date.UTC(2026, 10, 10, h - 7, m);   // giờ VN ngày 10/11
const gio = (t: number | null) => (t == null ? null : new Date(t + 7 * 3600_000).toISOString().slice(11, 16));
const luc = new Date(vn(16, 2)).toISOString();
assert.equal(gio(lucLam('tang', luc, false, vn(16, 10))), `${String(KD.tang[0]).padStart(2, '0')}:02`, 'tăng 16h → nhịp đầu trong khung tăng');
assert.equal(gio(lucLam('giam', luc, false, vn(16, 10))), '16:32', 'giảm đang trong khung giảm → nhịp kế');
assert.equal(gio(lucLam('tat', luc, false, vn(16, 10))), '16:32', 'tắt theo khung giảm');
assert.equal(lucLam('tang', luc, true, vn(16, 10)), null, 'sổ hoãn cũ → không hứa giờ');
assert.equal(lucLam('tang', null, false, vn(16, 10)), null, 'chưa có nhịp → không hứa giờ');
assert.equal(gio(lucLam('tang', luc, false, vn(16, 10), vn(23, 40))), '00:02', 'cổng nhịp (som) đẩy qua nửa đêm');
assert.equal(gio(lucLam('tao', luc, false, vn(16, 10))), '16:32', 'nhân bản: nhịp kế ở mọi khung');
// CỔNG THEO GIỜ (anh 12/11/2026): trang = máy (nhip_tang.cong) = worker (congNap) — sáng 50–75% + ROI ≥ 0, đêm ≥ nap_chi + ROI ≥ sang_roi
{ const c = congNap('sang')!; assert.deepStrictEqual(congTang(9), { tu: c.tu, den: c.den, roi: c.roi }, 'trang và worker cùng cổng sáng');
  assert.ok(quaCong(0.6, 0.6, 1, 9) && !quaCong(0.8, 3, 1, 9) && !quaCong(0.4, 2, 1, 9), 'sáng: 50–75% + ROI ≥ 0, tiêu ≥ 75% không');
  assert.ok(quaCong(0.9, 1.8, 1, 23) && !quaCong(0.9, 1.7, 1, 23), 'đêm: ROI ≥ 100%, không trần chi'); }
console.log('✓ etp-khung lucLam + cổng theo giờ');
