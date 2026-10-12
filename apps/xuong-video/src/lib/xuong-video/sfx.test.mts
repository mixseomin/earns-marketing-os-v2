// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/sfx.test.mts
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { lichSfx, SFX, dbSfx, LUFS_GIONG } from './sfx';

const l = lichSfx([{ am: ['vut', 'mua'], tu: 0, phat: 2 }, { am: ['dap', 'cuon_len', 'pho'], tu: 2, phat: 3 }, { am: ['vut'], tu: 5, phat: 1.5 }]);
// vút ở shot đầu: không có chỗ trước điểm cắt → bỏ 0,42s đầu tệp; vút ở shot 3 bắt đầu 0,42s TRƯỚC điểm cắt
assert.deepStrictEqual(l.find((x) => x.key === 'vut' && x.tu === 0), { key: 'vut', tu: 0, bo: 0.42, dai: 0.28, lap: false, db: dbSfx(SFX.vut!) });
assert.ok(l.some((x) => x.key === 'vut' && x.tu === 4.58 && x.bo === 0));
assert.ok(l.some((x) => x.key === 'mua' && x.lap && x.dai === 2), 'mưa lặp suốt shot');
assert.ok(l.some((x) => x.key === 'cuon_len' && Math.abs(x.tu + x.dai - 5) < 1e-9), 'tiếng dâng kết đúng điểm cắt');
assert.ok(!l.some((x) => x.key === 'pho'), 'key không có tệp → không vào lịch');
assert.deepStrictEqual(l.map((x) => x.tu), [...l.map((x) => x.tu)].sort((a, b) => a - b));
// mọi tiếng trong bảng phải có tệp thật (scripts/dung-sfx.mjs)
for (const k of Object.keys(SFX)) assert.ok(existsSync(new URL(`../../../public/sfx/${k}.mp3`, import.meta.url)), `thiếu public/sfx/${k}.mp3`);
// Lời thoại trên hết (12/10/2026 phim #9 mất giọng): tiếng ngắn ≥ 9 dB dưới giọng, nền lặp ≥ 14 dB; vút ra đúng -28 LUFS.
for (const [k, x] of Object.entries(SFX)) assert.ok(x.duoi >= (x.neo === 'ca' ? 14 : 9), `${k} quá sát giọng`);
assert.strictEqual(LUFS_GIONG - SFX.vut!.duoi, -28); assert.strictEqual(dbSfx(SFX.vut!), -18.2);
// lufs khai trong bảng phải khớp tệp thật ±1 dB (dựng lại tệp mà quên đo lại → mức trộn sai, bài này đỏ)
let doTep = 0;
for (const [k, x] of Object.entries(SFX)) {
  const r = spawnSync('ffmpeg', ['-nostats', '-i', new URL(`../../../public/sfx/${k}.mp3`, import.meta.url).pathname, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...String(r.stderr ?? '').matchAll(/I:\s+(-?[0-9.]+) LUFS/g)].at(-1); if (!m) continue;
  assert.ok(Math.abs(Number(m[1]) - x.lufs) <= 1, `${k}: tệp đo ${m[1]} LUFS, bảng ghi ${x.lufs}`); doTep++;
}
if (!doTep) console.log('sfx.test: máy không có ffmpeg — chưa đo lại tệp');
console.log(`sfx.test: ok (đo ${doTep} tệp)`);
