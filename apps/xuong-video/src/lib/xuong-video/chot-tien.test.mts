// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/chot-tien.test.mts
import assert from 'node:assert';
import { chotTien, laScript, LOAI_JOB_TON_TIEN, NGUONG_TU_CHAY_CENTS, _datLaiTuChay } from './chot-tien';

assert.ok(laScript('/opt/earns-marketing-os-v2/apps/xuong-video/scripts/kiem-nguoi-xem.mts'));
assert.ok(!laScript('/opt/earns-marketing-os-v2/node_modules/.bin/next'), 'máy chủ Next không phải script');
assert.ok(!laScript(undefined));
assert.throws(() => chotTien('thử', { argv1: '/x/scripts/sinh-anh-phim.mts', duyet: '' }), /TỐN TIỀN/, 'script thiếu duyệt → chặn');
assert.doesNotThrow(() => chotTien('thử', { argv1: '/x/scripts/sinh-anh-phim.mts', duyet: '1' }), 'script có duyệt → qua');
assert.doesNotThrow(() => chotTien('thử', { argv1: '/x/node_modules/next/dist/bin/next', duyet: '' }), 'studio → qua');
assert.ok(LOAI_JOB_TON_TIEN.has('anh') && !LOAI_JOB_TON_TIEN.has('xuat'), 'xuất (ffmpeg) không bị chặn');
// Luật tự chạy dưới 5.000₫ (31/10/2026, trước là 1¢): tự chạy khi cộng dồn < ~19,2¢; vượt là hỏi; không biết giá là hỏi
assert.equal(NGUONG_TU_CHAY_CENTS, 19.23, '5.000₫ / 26.000₫ = 19,23¢');
const sc = { argv1: '/x/scripts/sinh-anh-phim.mts', duyet: '' };
_datLaiTuChay();
assert.doesNotThrow(() => chotTien('đề rẻ', { ...sc, cents: 8 }), '8¢ (~2.080₫) → tự chạy');
assert.doesNotThrow(() => chotTien('đề rẻ', { ...sc, cents: 8 }), 'cộng dồn 16¢ (~4.160₫) → tự chạy');
assert.throws(() => chotTien('đề rẻ', { ...sc, cents: 8 }), /vượt ngưỡng/, 'cộng dồn 24¢ (~6.240₫) → hỏi');
_datLaiTuChay();
assert.throws(() => chotTien('ảnh', { ...sc, cents: 20 }), /TỐN TIỀN/, '20¢ một lượt (> 5.000₫) → hỏi');
assert.throws(() => chotTien('video', sc), /không ước được giá/, 'không biết giá → hỏi');
console.log('chot-tien.test: ok');
