import assert from 'node:assert';
import { jsonChuan } from './may';
assert.strictEqual(jsonChuan({ b: 1, a: { d: 2, c: [{ y: 1, x: 2 }] } }), jsonChuan({ a: { c: [{ x: 2, y: 1 }], d: 2 }, b: 1 }), 'thứ tự khoá (jsonb xếp lại) không làm "đề đổi"');
assert.notStrictEqual(jsonChuan({ a: 1 }), jsonChuan({ a: 2 }), 'giá trị đổi vẫn là đổi');
assert.notStrictEqual(jsonChuan({ a: [1, 2] }), jsonChuan({ a: [2, 1] }), 'thứ tự mảng giữ nguyên nghĩa');
console.log('may-nap: 3 ca đạt');
