import assert from 'node:assert';
import { matchColFilter as m, khoangGhep } from './col-filter';
assert.equal(m(5, 'KHOẢNG', '2..7'), true); assert.equal(m(2, 'KHOẢNG', '2..7'), true); assert.equal(m(7.1, 'KHOẢNG', '2..7'), false);
assert.equal(m(100, 'KHOẢNG', '50..'), true); assert.equal(m(-3, 'KHOẢNG', '..0'), true); assert.equal(m(3, 'KHOẢNG', '..0'), false);
assert.equal(m(null, 'KHOẢNG', '1..2'), false); assert.equal(m('abc', 'KHOẢNG', '1..2'), false); assert.equal(m(-30, 'KHOẢNG', '-50..-10'), true);
assert.equal(khoangGhep('', ''), ''); assert.equal(khoangGhep('1', ''), '1..');
console.log('ok');
