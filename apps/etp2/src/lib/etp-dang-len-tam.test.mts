// #1770: dấu "đang lên" tạm ở trình duyệt — chạy: node_modules/.bin/tsx apps/etp2/src/lib/etp-dang-len-tam.test.mts
import assert from 'node:assert';
import { danhDauDangLen, dangLenTam } from './etp-dang-len-tam';

const gui = new Date(Date.now() - 5_000).toISOString();
assert.equal(dangLenTam(1, null), null, 'chưa bấm thì không có dấu');
danhDauDangLen(1, gui);
assert.equal(dangLenTam(1, new Date(Date.now() - 60_000).toISOString()), gui, 'bộ số dựng trước lúc gửi → hiện đang lên ngay');
assert.equal(dangLenTam(1, null), gui, 'chưa biết giờ bộ số → vẫn hiện dấu');
assert.equal(dangLenTam(1, new Date().toISOString()), null, 'bộ số dựng sau lúc gửi → số thật thắng (hỏng nhanh thì về chờ duyệt)');
danhDauDangLen(2, new Date(Date.now() - 2 * 3600_000 - 1).toISOString());
assert.equal(dangLenTam(2, null), null, 'quá 2 giờ thì bỏ dấu');
console.log('✓ etp-dang-len-tam: 5 bài');
