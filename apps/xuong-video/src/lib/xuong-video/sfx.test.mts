// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/sfx.test.mts
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { lichSfx, SFX } from './sfx';

const l = lichSfx([{ am: ['vut', 'mua'], tu: 0, phat: 2 }, { am: ['dap', 'cuon_len', 'pho'], tu: 2, phat: 3 }, { am: ['vut'], tu: 5, phat: 1.5 }]);
// vút ở shot đầu: không có chỗ trước điểm cắt → bỏ 0,42s đầu tệp; vút ở shot 3 bắt đầu 0,42s TRƯỚC điểm cắt
assert.deepStrictEqual(l.find((x) => x.key === 'vut' && x.tu === 0), { key: 'vut', tu: 0, bo: 0.42, dai: 0.28, lap: false, db: -8 });
assert.ok(l.some((x) => x.key === 'vut' && x.tu === 4.58 && x.bo === 0));
assert.ok(l.some((x) => x.key === 'mua' && x.lap && x.dai === 2), 'mưa lặp suốt shot');
assert.ok(l.some((x) => x.key === 'cuon_len' && Math.abs(x.tu + x.dai - 5) < 1e-9), 'tiếng dâng kết đúng điểm cắt');
assert.ok(!l.some((x) => x.key === 'pho'), 'key không có tệp → không vào lịch');
assert.deepStrictEqual(l.map((x) => x.tu), [...l.map((x) => x.tu)].sort((a, b) => a - b));
// mọi tiếng trong bảng phải có tệp thật (scripts/dung-sfx.mjs)
for (const k of Object.keys(SFX)) assert.ok(existsSync(new URL(`../../../public/sfx/${k}.mp3`, import.meta.url)), `thiếu public/sfx/${k}.mp3`);
console.log('sfx.test: ok');
