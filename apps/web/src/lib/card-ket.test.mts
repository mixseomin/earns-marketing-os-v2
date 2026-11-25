import assert from 'node:assert';
import { nguoiGiu } from './card-ket';
assert.deepEqual(nguoiGiu(['[Giang · kẹt] x', '[máy · Hà giao bù · chờ kỹ sư thang]']), { cho: ['thang'], ten: 'Giang' });
assert.deepEqual(nguoiGiu(['[Giang · kẹt] x', 'CHUYỂN: dat · y', '[Đạt · vận hành] z']), { cho: [], ten: 'Đạt' });
assert.deepEqual(nguoiGiu(['[máy · mở lại] a']), { cho: [], ten: null });
assert.deepEqual(nguoiGiu(['[x · chờ kỹ sư dat, thang]']).cho, ['dat', 'thang']);
assert.deepEqual(nguoiGiu([]), { cho: [], ten: null });
console.log('card-ket ok');
