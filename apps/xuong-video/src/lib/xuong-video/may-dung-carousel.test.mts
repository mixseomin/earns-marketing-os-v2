// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-carousel.test.mts
import assert from 'node:assert';
import { anhCarousel, assCarousel, kichBanCarousel, lenhCarousel, trangCarousel, truyVanThemCarousel, type DeCarousel } from './may-dung-carousel';

const de: DeCarousel = { moc: '4 things the hotel desk will not tell you', truy: 'hotel lobby reception', nhan: 'ratesbyroom.com', ket: 'Save this before your next booking',
  trang: [{ tieu_de: 'The rate on their site is not the floor', chu: 'Call and ask for the direct rate', truy: 'phone call hotel' }, { tieu_de: 'Resort fees are negotiable', truy: 'resort pool' }, { tieu_de: 'Late checkout is free if you ask early', chu: 'Ask at check-in, not at 11am', truy: 'hotel room key' }, { tieu_de: 'Upgrades go to direct bookings first', truy: 'hotel suite' }] };
const T = trangCarousel(de); assert.strictEqual(T.n, 6); assert.strictEqual(trangCarousel({ ...de, trang: [...de.trang, ...de.trang] }).n, 7, 'tối đa 5 ý');
assert.strictEqual(anhCarousel(de).length, 6); assert.deepStrictEqual(truyVanThemCarousel(de), ['phone call hotel', 'resort pool', 'hotel room key', 'hotel suite']);
const a = assCarousel(de); for (const s of ['4 things the hotel', 'Swipe', '1/6', '6/6', 'not the floor', 'negotiable', 'Save this before', 'ratesbyroom.com', '}4']) assert.ok(a.includes(s), s);
// khung → ảnh đúng trang: trang 1 và cuối dùng nen, trang 3 dùng nenThem[1]
const anh = (k: number) => { const l = lenhCarousel({ de, ass: 'a', nen: '/n0.jpg', nenThem: ['/n1.jpg', '/n2.jpg', '/n3.jpg', '/n4.jpg'], fontsDir: '/f', ra: 'r.jpg', khung: k }); return l[l.indexOf('-i') + 1]; };
assert.strictEqual(anh(0.5), '/n0.jpg'); assert.strictEqual(anh(2.5), '/n2.jpg'); assert.strictEqual(anh(5.5), '/n0.jpg');
assert.strictEqual(lenhCarousel({ de, ass: 'a', nen: '/n0.jpg', fontsDir: '/f', ra: 'r.jpg', khung: 3.5 }).includes('/n0.jpg'), true, 'thiếu ảnh thêm thì dùng ảnh trang 1');
assert.throws(() => lenhCarousel({ de, ass: 'a', nen: null, fontsDir: '/f', ra: 'r.jpg' }), /ảnh nền thật/);
assert.strictEqual(kichBanCarousel(de).shots.length, 6);
console.log('may-dung-carousel: đạt (6 trang)');
