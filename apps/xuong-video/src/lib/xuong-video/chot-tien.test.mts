// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/chot-tien.test.mts
import assert from 'node:assert';
import { chotTien, laScript, LOAI_JOB_TON_TIEN } from './chot-tien';

assert.ok(laScript('/opt/earns-marketing-os-v2/apps/xuong-video/scripts/kiem-nguoi-xem.mts'));
assert.ok(!laScript('/opt/earns-marketing-os-v2/node_modules/.bin/next'), 'máy chủ Next không phải script');
assert.ok(!laScript(undefined));
assert.throws(() => chotTien('thử', { argv1: '/x/scripts/sinh-anh-phim.mts', duyet: '' }), /TỐN TIỀN/, 'script thiếu duyệt → chặn');
assert.doesNotThrow(() => chotTien('thử', { argv1: '/x/scripts/sinh-anh-phim.mts', duyet: '1' }), 'script có duyệt → qua');
assert.doesNotThrow(() => chotTien('thử', { argv1: '/x/node_modules/next/dist/bin/next', duyet: '' }), 'studio → qua');
assert.ok(LOAI_JOB_TON_TIEN.has('anh') && !LOAI_JOB_TON_TIEN.has('xuat'), 'xuất (ffmpeg) không bị chặn');
console.log('chot-tien.test: ok');
