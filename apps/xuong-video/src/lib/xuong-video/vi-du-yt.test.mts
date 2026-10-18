import assert from 'node:assert';
import { VI_DU_YT, linkYt, nhungYt } from './vi-du-yt';
import { THU_VIEN } from './dien-anh';
import { LUAT_DUNG_CANH } from './luat-dung';
// Mọi khoá ví dụ phải trỏ vào kỹ thuật / luật CÓ THẬT (đổi tên trong thư viện là đỏ); mọi mốc giây hợp lệ.
const co = new Set([...THU_VIEN.map((x) => `${x.nhom}.${x.key}`), ...LUAT_DUNG_CANH.map((l) => `luat.${l.key}`)]);
const ma = Object.keys(VI_DU_YT).filter((k) => !co.has(k));
assert.deepStrictEqual(ma, [], `ví dụ trỏ vào kỹ thuật không có: ${ma.join(', ')}`);
for (const [k, ds] of Object.entries(VI_DU_YT)) for (const v of ds) {
  assert.match(v.yt, /^[\w-]{11}$/, k); assert.ok(v.tu >= 0 && (v.den == null || v.den > v.tu), `${k}: mốc giây lệch`);
}
assert.strictEqual(linkYt({ yt: 'IiyBo-qLDeM', tu: 427 }), 'https://www.youtube.com/watch?v=IiyBo-qLDeM&t=427s');
assert.ok(nhungYt({ yt: 'IiyBo-qLDeM', tu: 427, den: 545 }).includes('start=427&end=545'));
console.log(`✓ vi-du-yt (${Object.keys(VI_DU_YT).length} kỹ thuật có ví dụ)`);
