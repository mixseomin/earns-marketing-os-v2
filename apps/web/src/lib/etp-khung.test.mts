import assert from 'node:assert';
import { khungLuc, hetKhung, choKhung, datNap, gioVnNay } from './etp-khung';

assert.deepStrictEqual([0, 7, 14.9, 15, 20.9, 21, 22.5, 23, 23.9].map(khungLuc), ['bang', 'bang', 'bang', 'doi', 'doi', 'nap', 'nap', 'bang', 'bang']);
assert.strictEqual(hetKhung(3), 15); assert.strictEqual(hetKhung(16), 21); assert.strictEqual(hetKhung(21.5), 23); assert.strictEqual(hetKhung(23.2), 15);
assert.strictEqual(choKhung('tat', 16), null); assert.strictEqual(choKhung('tat', 2), '15h'); assert.strictEqual(choKhung('tat', 22), '15h');
assert.strictEqual(choKhung('tang', 22, true), null); assert.strictEqual(choKhung('tang', 22, false), '15h'); assert.strictEqual(choKhung('giam', 22, true), '15h');
assert.strictEqual(datNap({ chi: 0.96, thu: 1.3 }, 1), true); assert.strictEqual(datNap({ chi: 0.9, thu: 2 }, 1), false); assert.strictEqual(datNap({ chi: 1, thu: 1.2 }, 1), false);
assert.strictEqual(Math.floor(gioVnNay(Date.UTC(2026, 10, 4, 17, 30))), 0);   // 17:30 UTC = 00:30 VN
console.log('etp-khung: đạt');
