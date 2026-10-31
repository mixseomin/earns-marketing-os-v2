// Tự kiểm khung-tuyen.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/khung-tuyen.test.mts
import assert from 'node:assert';
import { doiKhung, khungTheoTheLoai, vanKhung, KHUNG_TUYEN } from './khung-tuyen';
import type { Series } from './kieu';

const k = khungTheoTheLoai('phim_doc')!;
assert.equal(k.ca_bo[1], 5);
const s = (n: number, vai: string[] = []): Series => ({ dong_co: '', khan_gia: '', dinh_dang: '', tap: [], tuyen: Array.from({ length: n }, (_, i) => ({ ma: 'ABCDEFG'[i]!, ten: '', vai: vai[i] })) });
// 3 làn đã gắn vai A/B/C → thiếu D, E; không vượt
const d = doiKhung(s(3, ['quan_he', 'than_phan', 'phan_dien']), k)!;
assert.deepEqual(d.thieu.map((v) => v.ma), ['D', 'E']); assert.equal(d.vuot, null);
// 6 làn → vượt trần 5 thì báo
assert.match(doiKhung(s(6), k)!.vuot!, /vượt khung ngành 4–5/);
// thể loại chưa có khung → null; khung nào cũng có vai trùng mã không
assert.equal(khungTheoTheLoai('qc_ugc'), null); assert.equal(doiKhung(s(2), null), null);
for (const x of KHUNG_TUYEN) assert.equal(new Set(x.tuyen.map((v) => v.ma)).size, x.tuyen.length, x.key);
assert.match(vanKhung(k), /thường mở tập 10–20/);
console.log('khung-tuyen tu-kiem ok');
