// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/am-hieu.test.mts
import assert from 'node:assert';
import { amHieuKhop, moTaAmHieu, giayAmHieu } from './am-hieu';
const tango = { ten: 'Tango', giong: 'a tiny squeaky clay creature voice', am_hieu: [{ ten: 'Đặc trưng · Hup!', mo_ta: '', url: 'u-hup' }, { ten: 'Vui', mo_ta: '', url: 'u-vui' }] };
assert.strictEqual(amHieuKhop(tango, 'Hup!')?.url, 'u-hup', 'đúng âm đặc trưng → dùng lại file');
assert.strictEqual(amHieuKhop(tango, '[gasps] Hup!')?.url, 'u-hup', 'bỏ thẻ diễn xuất trước khi khớp');
assert.strictEqual(amHieuKhop(tango, 'Hup! Hup!'), null, 'câu khác → sinh mới');
assert.strictEqual(amHieuKhop(null, 'Hup!'), null);
const m = moTaAmHieu(tango, { loi: '[gasps] Mmf! Hup?!', dien_xuat: 'face pressed into the desk' });
assert.ok(m.startsWith('a tiny squeaky clay creature voice') && m.includes('"Mmf! Hup?!"') && m.includes('face pressed') && !m.includes('[gasps]'), m);
assert.ok(moTaAmHieu(null, { loi: 'Pff' }).includes('tiny cartoon creature'));
assert.strictEqual(giayAmHieu('Hup!'), 0.8); assert.ok(giayAmHieu('Pff-pff-pff! Pff-pff!') > 1.5); assert.strictEqual(giayAmHieu('x'.repeat(200)), 3);
console.log('am-hieu.test: ok');
