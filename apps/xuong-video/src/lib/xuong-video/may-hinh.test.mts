// hinhBiChan: bài viết lại cùng dòng (sinh-bai --lai) phải đổi ảnh bìa khi lần chấm trước chặn ảnh (19/11/2026 quora-40712 logo Apple)
import assert from 'node:assert';
import { hinhBiChan } from './may';
assert.ok(hinhBiChan({ chan_cung: ['Phòng Nội dung (kiem-bai) chưa DUYỆT bản này: SUA_LAI', 'hình: logo / watermark lạ trên hình (Ngọc: Frame 1 thấy rõ logo Apple trên laptop.)'] }));
assert.ok(!hinhBiChan({ chan_cung: ['Phòng Nội dung (kiem-bai) chưa DUYỆT bản này: SUA_LAI'] }), 'chặn chữ không đổi ảnh');
assert.ok(!hinhBiChan(null) && !hinhBiChan({}) && !hinhBiChan({ chan_cung: [] }));
console.log('hinhBiChan: 3/3');
process.exit(0);
