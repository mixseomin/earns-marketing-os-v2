// Tự kiểm phép biến đổi phối cảnh: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/dong-phang.test.mts
import assert from 'node:assert';
import { dongPhang, apDongPhang } from './dong-phang';
// tứ giác phối cảnh trên khung → ảnh 100×50: 4 góc phải ra đúng 4 góc ảnh, điểm giữa ra gần giữa
const goc = [{ x: 10, y: 20, u: 0, v: 0 }, { x: 110, y: 30, u: 100, v: 0 }, { x: 120, y: 90, u: 100, v: 50 }, { x: 5, y: 80, u: 0, v: 50 }];
const H = dongPhang(goc)!; assert.ok(H);
for (const g of goc) { const [u, v] = apDongPhang(H, g.x, g.y); assert.ok(Math.abs(u - g.u) < 1e-6 && Math.abs(v - g.v) < 1e-6); }
// 4 điểm thẳng hàng → suy biến
assert.equal(dongPhang([{ x: 0, y: 0, u: 0, v: 0 }, { x: 1, y: 1, u: 1, v: 0 }, { x: 2, y: 2, u: 1, v: 1 }, { x: 3, y: 3, u: 0, v: 1 }]), null);
console.log('dong-phang: ok');
