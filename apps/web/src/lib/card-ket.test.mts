import assert from 'node:assert';
import { nguoiGiu } from './card-ket';
assert.deepEqual(nguoiGiu(['[Giang · kẹt] x', '[máy · Hà giao bù · chờ kỹ sư thang]']), { cho: ['thang'], ten: 'Giang' });
assert.deepEqual(nguoiGiu(['[Giang · kẹt] x', 'CHUYỂN: dat · y', '[Đạt · vận hành] z']), { cho: [], ten: 'Đạt' });
assert.deepEqual(nguoiGiu(['[máy · mở lại] a']), { cho: [], ten: null });
assert.deepEqual(nguoiGiu(['[x · chờ kỹ sư dat, thang]']).cho, ['dat', 'thang']);
assert.deepEqual(nguoiGiu([]), { cho: [], ten: null });
console.log('card-ket ok');

// choKySu (gói gop-y): thẻ "chờ kỹ sư" → mã kỹ sư; không có thẻ → []
import { choKySu } from '../../../../packages/gop-y/src/dem';
assert.deepStrictEqual(choKySu('[máy · Hà giao bù · chờ kỹ sư thang] Phần ngoài quyền'), ['thang']);
assert.deepStrictEqual(choKySu('[máy · chờ kỹ sư dat, vinh] x'), ['dat', 'vinh']);
assert.deepStrictEqual(choKySu('[Giang · sửa xong] ok'), []);
assert.deepStrictEqual(choKySu(null), []);
console.log('choKySu ok');
