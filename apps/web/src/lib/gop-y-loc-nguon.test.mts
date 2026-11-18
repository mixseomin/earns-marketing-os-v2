import assert from 'node:assert';
import { boLocNguon } from './gop-y-loc-nguon';

const hien = (host: string, ref: string | null, src: string) => { const l = boLocNguon(host, ref); return new RegExp(l.mau).test(src) === l.khop; };
const C = 'https://castle.on.tc/neuschwanstein.html', E = 'https://etp.on.tc/x', E2 = 'https://etp2.on.tc/', M = 'https://mos2.on.tc/?tab=taisan';

// mos2: chỉ card mos2
assert.equal(hien('mos2.on.tc', 'https://mos2.on.tc/?tab=taisan', C), false);
assert.equal(hien('mos2.on.tc', null, E), false);
assert.equal(hien('mos2.on.tc', null, E2), false);
assert.equal(hien('mos2.on.tc', null, M), true);
assert.equal(hien('mos2.on.tc:443', null, ''), true);
// etp / etp2: chỉ card etp
for (const h of ['etp.on.tc', 'etp2.on.tc']) {
  assert.equal(hien(h, null, E), true); assert.equal(hien(h, null, E2), true);
  assert.equal(hien(h, null, C), false); assert.equal(hien(h, null, M), false);
}
// castle: hòm nhúng mos2.on.tc/nhung/gop-y?trang=castle → chỉ card castle
const refC = 'https://mos2.on.tc/nhung/gop-y?trang=' + encodeURIComponent(C);
assert.equal(hien('mos2.on.tc', refC, C), true);
assert.equal(hien('mos2.on.tc', refC, M), false);
assert.equal(hien('mos2.on.tc', refC, E), false);
assert.equal(hien('castle.on.tc', null, C), true);
console.log('gop-y-loc-nguon: đạt');
