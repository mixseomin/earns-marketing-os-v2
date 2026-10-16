// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/chot-tien.test.mts
import assert from 'node:assert';
import { chotTien, laScript, LOAI_JOB_TON_TIEN, _datLaiTuChay } from './chot-tien';

assert.ok(laScript('/opt/earns-marketing-os-v2/apps/xuong-video/scripts/kiem-nguoi-xem.mts'));
assert.ok(!laScript('/opt/earns-marketing-os-v2/node_modules/.bin/next'), 'máy chủ Next không phải script');
assert.ok(!laScript(undefined));
assert.throws(() => chotTien('thử', { argv1: '/x/scripts/sinh-anh-phim.mts', duyet: '' }), /TỐN TIỀN/, 'script thiếu duyệt → chặn');
assert.doesNotThrow(() => chotTien('thử', { argv1: '/x/scripts/sinh-anh-phim.mts', duyet: '1' }), 'script có duyệt → qua');
assert.doesNotThrow(() => chotTien('thử', { argv1: '/x/node_modules/next/dist/bin/next', duyet: '' }), 'studio → qua');
assert.ok(LOAI_JOB_TON_TIEN.has('anh') && !LOAI_JOB_TON_TIEN.has('xuat'), 'xuất (ffmpeg) không bị chặn');
// Luật dưới $0,01: tự chạy khi cộng dồn < 1¢; vượt là hỏi; không biết giá là hỏi
const sc = { argv1: '/x/scripts/sinh-anh-phim.mts', duyet: '' };
_datLaiTuChay();
assert.doesNotThrow(() => chotTien('ảnh rẻ', { ...sc, cents: 0.4 }), '0,4¢ → tự chạy');
assert.doesNotThrow(() => chotTien('ảnh rẻ', { ...sc, cents: 0.4 }), 'cộng dồn 0,8¢ → tự chạy');
assert.throws(() => chotTien('ảnh rẻ', { ...sc, cents: 0.4 }), /vượt ngưỡng/, 'cộng dồn 1,2¢ → hỏi');
_datLaiTuChay();
assert.throws(() => chotTien('ảnh', { ...sc, cents: 3.36 }), /TỐN TIỀN/, '3,36¢ một lượt → hỏi');
assert.throws(() => chotTien('video', sc), /không ước được giá/, 'không biết giá → hỏi');
console.log('chot-tien.test: ok');
