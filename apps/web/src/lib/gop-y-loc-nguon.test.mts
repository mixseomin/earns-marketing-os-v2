import assert from 'node:assert';
import { boLocNguon, laTrangTinh, trangRieng, noiNhungGopY } from './gop-y-loc-nguon';

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
// studio2: hòm nhúng mos2.on.tc/nhung/gop-y?trang=studio2 → chỉ card studio2; mos2 / castle / etp không thấy card studio2
const S2 = 'https://studio2.on.tc/?phim=7999&tap=8007', refS = 'https://mos2.on.tc/nhung/gop-y?trang=' + encodeURIComponent(S2);
assert.equal(hien('mos2.on.tc', refS, S2), true);
assert.equal(hien('mos2.on.tc', refS, M), false);
assert.equal(hien('mos2.on.tc', refS, C), false);
assert.equal(hien('mos2.on.tc', null, S2), false);
assert.equal(hien('mos2.on.tc', refC, S2), false);
assert.equal(hien('etp2.on.tc', null, S2), false);
// dantranh: hòm khách nhúng → chỉ card dantranh; mos2 không thấy card dantranh
const D = 'https://dantranh.on.tc/', refD = 'https://mos2.on.tc/nhung/gop-y?trang=' + encodeURIComponent(D);
assert.equal(hien('mos2.on.tc', refD, D), true);
assert.equal(hien('mos2.on.tc', refD, 'https://dantranh2.on.tc/x'), true);
assert.equal(hien('mos2.on.tc', refD, M), false);
assert.equal(hien('mos2.on.tc', refD, C), false);
assert.equal(hien('mos2.on.tc', null, D), false);
// worlds / sprawl (23/11/2026: thiếu dòng trong sổ → hòm nhúng hiện cả 63 card mos2)
const W = 'https://worlds.on.tc/#thanh-ri/chuoi', refW = 'https://mos2.on.tc/nhung/gop-y?trang=' + encodeURIComponent(W);
assert.equal(hien('mos2.on.tc', refW, W), true);
assert.equal(hien('mos2.on.tc', refW, M), false);
assert.equal(hien('mos2.on.tc', refW, C), false);
assert.equal(hien('mos2.on.tc', refW, ''), false);
assert.equal(hien('mos2.on.tc', null, W), false);
const SP = 'https://sprawl.on.tc/', refSP = 'https://mos2.on.tc/nhung/gop-y?trang=' + encodeURIComponent(SP);
assert.equal(hien('mos2.on.tc', refSP, SP), true);
assert.equal(hien('mos2.on.tc', refSP, W), false);
assert.equal(hien('mos2.on.tc', null, SP), false);
// tên giả không lọt: worlds.on.tc.evil / xworlds.on.tc
assert.equal(trangRieng('worlds.on.tc.evil.com'), null);
assert.equal(trangRieng('xworlds.on.tc'), null);
assert.equal(trangRieng('worlds.on.tc:443')?.ten, 'Sổ Thế Giới');
assert.equal(laTrangTinh('worlds.on.tc'), true);
assert.equal(laTrangTinh('studio2.on.tc'), false);
assert.equal(laTrangTinh('mos2.on.tc'), false);
assert.equal(trangRieng('worlds.on.tc')?.kySu, 'giang');
assert.equal(trangRieng('castle.on.tc')?.kySu, 'thang');
assert.equal(trangRieng('mos2.on.tc')?.kySu, undefined);
// hòm nhúng: lượt nạp khung từ studio2 · action trong khung · bấm link (document) không tính · referer giả cùng host ngoài /nhung không tính
const S2N = 'https://studio2.on.tc/?phim=8180', refS2 = 'https://mos2.on.tc/nhung/gop-y?trang=' + encodeURIComponent(S2N);
assert.equal(noiNhungGopY('mos2.on.tc', 'https://studio2.on.tc/', 'iframe'), 'studio2.on.tc');
assert.equal(noiNhungGopY('mos2.on.tc', 'https://studio2.on.tc/', 'document'), null);
assert.equal(noiNhungGopY('mos2.on.tc:443', refS2, 'empty'), 'studio2.on.tc');
assert.equal(noiNhungGopY('mos2.on.tc', 'https://mos2.on.tc/p/x/board?trang=' + encodeURIComponent(S2), 'empty'), null);
assert.equal(noiNhungGopY('mos2.on.tc', null, 'iframe'), null);
assert.equal(noiNhungGopY('mos2.on.tc', 'https://mos2.on.tc/nhung/gop-y', 'empty'), null);
console.log('gop-y-loc-nguon: đạt');
