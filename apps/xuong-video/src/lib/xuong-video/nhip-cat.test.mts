import assert from 'node:assert';
import { nhipCat } from './nhip-cat';

const t = (thu_tu: number, phat_s: number, thoai = true) => ({ id: thu_tu, thu_tu, phat_s, thoai: thoai ? [{}] : [] });
// không phải phim dọc: chỉ đo, không cảnh báo
assert.deepEqual(nhipCat([t(1, 6), t(2, 6)], 'chinh_kich').canhBao, []);
const r = nhipCat([t(1, 2), t(2, 2.5), t(3, 4, false), t(4, 4), t(5, 3.5), t(6, 6)], 'phim_doc');
assert.equal(r.asl, 3.7); assert.equal(r.asl_thoai, 3.6);
assert.deepEqual(r.canhBao.map((x) => [x.tu, x.den]), [[6, 6], [4, 6]], 'shot lẻ 6 s + đoạn #4–#6 tb 4,5 s; đoạn #1–#2 nhanh: không báo');
assert.deepEqual(nhipCat([t(1, 2.5), t(2, 2.5)], 'phim_doc').canhBao, [], 'đúng trần: không báo');
assert.equal(nhipCat([t(1, 3), t(2, 3)], 'phim_doc').canhBao.length, 1, 'trần 2,5 s (đo 14 phim AI 26/10/2026): đoạn tb 3 s phải báo');
assert.deepEqual(nhipCat([], 'phim_doc'), { asl: 0, asl_thoai: null, canhBao: [] });
console.log('nhip-cat.test: ok');
