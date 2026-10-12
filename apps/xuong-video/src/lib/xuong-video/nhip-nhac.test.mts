// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nhip-nhac.test.mts  (NHAC=<mp3> để thử trên bài thật)
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { doPhach, khopNhip, luoiPhach, doiLopTheoCat, SR_PHACH } from './nhip-nhac';
import type { Lop } from './kieu';

// Nhịp giả 128 BPM lệch pha 0,2s, có nhiễu nền: dò ra đúng BPM (±1) và phách rơi đúng tiếng gõ (±30 ms).
const giay = 12, ck = 60 / 128, pcm = new Float32Array(SR_PHACH * giay);
for (let i = 0; i < pcm.length; i++) pcm[i] = (Math.random() * 2 - 1) * 0.02;
for (let t = 0.2; t < giay; t += ck) for (let j = 0; j < 400; j++) { const k = Math.round(t * SR_PHACH) + j; if (k < pcm.length) pcm[k] = pcm[k]! + Math.sin(j * 0.3) * Math.exp(-j / 80); }
const d = doPhach(pcm)!;
assert.ok(Math.abs(d.bpm - 128) <= 1, `bpm ${d.bpm}`);
assert.ok(d.phach.slice(0, 8).every((p) => Math.abs(((p - 0.2) / ck) - Math.round((p - 0.2) / ck)) * ck < 0.03), d.phach.slice(0, 8).join(','));
assert.strictEqual(doPhach(new Float32Array(100)), null);
// lưới kéo dài tới hết phim
assert.ok(luoiPhach([0.5, 1, 1.5], 120, 4).at(-1)! >= 3.5);
// khớp: cắt 2,0 → phách 2,1 (dời về sau, shot sau dời theo nên cắt kế ở 4,1 = trúng phách) · cắt 6,6 không phách trong khoảng → giữ · shot cuối gánh phần dư
const k = khopNhip([2, 2, 2.5, 1], [2.1, 4.1, 5.2, 7.9]);
assert.deepStrictEqual(k.phat, [2.1, 2, 2.5, 0.9]);
assert.strictEqual(k.khop, 2);
assert.ok(Math.abs(k.phat.reduce((a, b) => a + b, 0) - 7.5) < 1e-9, 'tổng giữ nguyên nhờ shot cuối gánh');
// lớp dời theo shot chứa nó
const l = (tu: number) => ({ id: String(tu), loai: 'hieu_ung', tu, den: tu + 0.3 } as Lop);
const dl = doiLopTheoCat([l(0.5), l(1.97), l(2.0), l(4.5)], [0, 2, 4], [0, 2.1, 4.1]);
assert.deepStrictEqual(dl.map((x) => x.tu), [0.5, 2.07, 2.1, 4.6]);
if (process.env.NHAC) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', process.env.NHAC, '-ac', '1', '-ar', String(SR_PHACH), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const r = doPhach(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
  console.log(`nhip-nhac.test: bài thật ${r?.bpm} BPM, ${r?.phach.length} phách, đầu ${r?.phach.slice(0, 4).join(', ')}`);
}
console.log('nhip-nhac.test: ok');
