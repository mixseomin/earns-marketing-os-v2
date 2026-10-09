// Tự kiểm phần thuần của hoàn tác: sổ cột cho phép lọc được cột lạ (an toàn cho sql.raw). Phần DB kiểm tay trên studio.
import assert from 'node:assert';
import { locCot, COT_CHO_PHEP } from './hoan-tac';
assert.deepEqual(locCot('xv_canh', ['chu_man', 'id; DROP TABLE x', 'thoai', 'chu_man']), ['chu_man', 'thoai']);
assert.deepEqual(locCot('xv_phim', ['kinh_thanh', 'updated_at']), ['kinh_thanh']);
assert.deepEqual(locCot('xv_bien_the', []), []);
for (const cs of Object.values(COT_CHO_PHEP)) for (const c of cs) assert.match(c, /^[a-z_]+$/, c);
console.log('hoan-tac.test: ok');
