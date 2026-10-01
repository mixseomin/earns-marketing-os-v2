// node_modules/.bin/tsx packages/shop/src/gia.test.mts
import assert from 'node:assert';
import { tinhGio } from './gia';

const bac = [{ sl: 2, pt: 10 }, { sl: 3, pt: 15 }];
const mot = tinhGio([{ gia: 44.99, sl: 1 }], bac, { phi: 0 });
assert.equal(mot.tong, 44.99); assert.equal(mot.pt, 0); assert.deepEqual(mot.bac_tiep, { can: 1, pt: 10 });
const hai = tinhGio([{ gia: 44.99, sl: 1 }, { gia: 49.99, sl: 1 }], bac, { phi: 0 });
assert.equal(hai.pt, 10); assert.equal(hai.giam, 9.5); assert.equal(hai.tong, 85.48); assert.deepEqual(hai.bac_tiep, { can: 1, pt: 15 });
const ba = tinhGio([{ gia: 10, gia_goc: 20, sl: 3 }], bac, { phi: 6.99, mien_phi_tu: 50 });
assert.equal(ba.pt, 15); assert.equal(ba.giam, 4.5); assert.equal(ba.ship, 6.99); assert.equal(ba.tong, 32.49); assert.equal(ba.tiet_kiem, 34.5); assert.equal(ba.bac_tiep, null);
const rong = tinhGio([], bac, { phi: 6.99 });
assert.equal(rong.ship, 0); assert.equal(rong.tong, 0);
console.log('gia: ok');
