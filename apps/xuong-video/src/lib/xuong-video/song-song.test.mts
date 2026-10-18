// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/song-song.test.mts
import assert from 'node:assert';
import { songSong } from './song-song';

const ngu = (ms: number) => new Promise((o) => setTimeout(o, ms));
// trần 3: không bao giờ quá 3 lượt cùng lúc, thứ tự kết quả giữ nguyên dù xong lệch
let dang = 0, dinh = 0;
const kq = await songSong([50, 10, 30, 5, 20, 40], async (ms, i) => { dang++; dinh = Math.max(dinh, dang); await ngu(ms); dang--; return i * 10; }, 3);
assert.equal(dinh, 3); assert.deepEqual(kq.map((x) => x.ok && x.data), [0, 10, 20, 30, 40, 50]);
// một lượt ném lỗi → chỉ lượt đó hỏng, các lượt sau vẫn chạy
const k2 = await songSong([1, 2, 3], async (x) => { if (x === 2) throw new Error('hỏng'); return x; }, 2);
assert.deepEqual(k2, [{ ok: true, data: 1 }, { ok: false, loi: 'hỏng' }, { ok: true, data: 3 }]);
// song song thật: 4 lượt 100ms với trần 4 xong dưới 200ms
const t = Date.now(); await songSong([1, 2, 3, 4], () => ngu(100), 4); assert.ok(Date.now() - t < 200);
assert.deepEqual(await songSong([], async () => 1), []);
console.log('song-song: ok');
