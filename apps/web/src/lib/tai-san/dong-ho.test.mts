import assert from 'node:assert';
import { nutTuanTu } from '../../components/ui/dong-ho';
// bước 3/8 đang chạy: 2 xong, 1 đang, 5 chờ · hỏng ở bước 3 → nút 3 đỏ
assert.deepStrictEqual(nutTuanTu(8, 3).map((n) => n.tt), ['xong', 'xong', 'dang', 'cho', 'cho', 'cho', 'cho', 'cho']);
assert.strictEqual(nutTuanTu(8, 3, true)[2]!.tt, 'loi');
assert.deepStrictEqual(nutTuanTu(3, 0).map((n) => n.tt), ['cho', 'cho', 'cho']);
console.log('dong-ho: đạt');
