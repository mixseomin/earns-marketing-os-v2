// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/goc-spy.test.mts
import assert from 'node:assert';
import { docGocSpy, linkGocSpy, linkSpSpy, loaiGocSpy, xepGocSpy } from './goc-spy';

assert.strictEqual(linkGocSpy({ id: 24965, sp: 311 }), 'https://spy.on.tc/#/goc?sp=311&ngan=goc:24965');
assert.strictEqual(linkSpSpy(325), 'https://spy.on.tc/#/goc?sp=325');
const ds = [
  { id: 3, sp: 1, loai: 'ai_phan_doi', ten: 'P' }, { id: 1, sp: 1, loai: 'ai_chan_dung', ten: 'C1' }, { id: 9, sp: 1, loai: 'la', ten: 'L' },
  { id: 2, sp: 2, loai: 'ai_chan_dung', ten: 'C2' }, { id: 1, sp: 1, loai: 'ai_chan_dung', ten: 'C1 trùng' },
];
assert.deepStrictEqual(xepGocSpy(ds).map((g) => g.id), [1, 2, 3, 9], 'chân dung trước, phản đối sau, loại lạ cuối, bỏ trùng');
assert.deepStrictEqual(docGocSpy([...ds, null, { id: 'x' }, { id: 5, sp: 1 }, 'a']).map((g) => g.id), [1, 2, 3, 9], 'bỏ phần tử hỏng');
assert.deepStrictEqual(docGocSpy({}), []);
assert.strictEqual(loaiGocSpy('ai_tinh_huong').ten, 'Tình huống');
assert.strictEqual(loaiGocSpy('ai_khac').ten, 'khac');
console.log('goc-spy ok');
