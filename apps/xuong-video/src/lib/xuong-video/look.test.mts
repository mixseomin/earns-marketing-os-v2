// Tự kiểm look: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/look.test.mts — mọi tông của thư viện có chuỗi lọc, chuỗi chạy được trên ffmpeg.
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { LOOK, lookShot, lookPhim } from './look';
import { THU_VIEN } from './dien-anh';
const mau = THU_VIEN.filter((k) => k.nhom === 'mau').map((k) => k.key);
assert.deepEqual(mau.filter((k) => !LOOK[k]), [], 'tông nào trong thư viện cũng có chuỗi lọc');
assert.equal(lookShot('teal_cam', null), LOOK.teal_cam); assert.equal(lookShot('teal_cam', 'den_trang'), LOOK.den_trang, 'tông riêng của shot thắng');
assert.equal(lookShot('', ''), ''); assert.equal(lookShot('khong_co', null), '', 'tông lạ → không áp');
for (const [k, f] of Object.entries(LOOK)) execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=64x64:duration=0.1', '-vf', f, '-f', 'null', '-'], { stdio: 'pipe' }) && k;
assert.equal(lookPhim({ look: 'am', phong_cach: 'cool steel-blue' }), 'am', 'khai tay thắng');
assert.equal(lookPhim({ the_loai: 'phim_doc', phong_cach: 'glossy luxury corporate look, cool steel-blue daylight with warm practical lamps' }), 'teal_cam', 'tổng tài: thép xanh + đèn ấm → teal–cam');
assert.equal(lookPhim({ the_loai: 'qc_ugc', phong_cach: 'warm golden UGC' }), '', 'quảng cáo không tự suy — giữ màu bản xuất cũ');
assert.equal(lookPhim({ phong_cach: 'warm' }), '', 'chưa có thể loại → không tự suy');
assert.equal(lookPhim({ the_loai: 'tinh_cam', phong_cach: 'warm golden afternoon' }), 'am'); assert.equal(lookPhim({ the_loai: 'tinh_cam', phong_cach: '' }), '', 'không có phong cách → không áp');
console.log('look: ok', Object.keys(LOOK).length);
