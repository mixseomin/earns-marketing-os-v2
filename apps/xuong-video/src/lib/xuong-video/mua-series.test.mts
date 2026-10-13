// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/mua-series.test.mts
import assert from 'node:assert';
import { muaSeries } from './kieu';
const s = { dong_co: 'x', khan_gia: '', dinh_dang: '', tap: [{ so: 2, ten: 'B', logline: '' }, { so: 1, ten: 'A', logline: '' }, { so: 11, ten: 'K', logline: '', mua: 2 }],
  mua: [{ so: 1, ten: 'Season 1' }, { so: 3, ten: 'Season 3', ghi_chu: 'đang lên ý' }] };
const m = muaSeries(s);
assert.deepStrictEqual(m.map((x) => [x.so, x.ten, x.tap.map((t) => t.so)]), [[1, 'Season 1', [1, 2]], [2, 'Mùa 2', [11]], [3, 'Season 3', []]], JSON.stringify(m));
assert.deepStrictEqual(muaSeries(null), []);
assert.deepStrictEqual(muaSeries({ dong_co: '', khan_gia: '', dinh_dang: '', tap: [] }), []);
console.log('mua-series.test: ok');
