// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/toc-do.test.mts  (CLIP=<mp4> để thử thật bằng ffmpeg)
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { bieuThucToc, keHoachToc, nguonTai } from './toc-do';

assert.strictEqual(keHoachToc(undefined, 2, 2, 8), null);
assert.strictEqual(keHoachToc('khong_co', 2, 2, 8), null);
const r = keHoachToc('ramp', 2, 2.4, 8)!;            // 2s phát + 0,4s đuôi chuyển cảnh
assert.strictEqual(r.doan.length, 3);
assert.strictEqual(r.doan[2]!.denRa, 2.4, 'đoạn cuối gánh phần đuôi');
assert.strictEqual(r.canVao, Math.round((0.6 * 1.5 + 0.8 * 0.3 + 1.0 * 1.6) * 1000) / 1000);
const c = keHoachToc('nhanh', 4, 4, 3.5)!;           // nguồn thiếu (cần 6,4s, còn 3,5s) → giảm đều tốc cho vừa
assert.ok(Math.abs(c.canVao - 3.5) < 0.01 && c.doan[0]!.toc < 1.6);
// xem trước khớp biểu thức: tại giây ra giữa đoạn chậm
const n = nguonTai(r, 1.0);
assert.strictEqual(n.toc, 0.3); assert.ok(Math.abs(n.vao - (0.9 + 0.4 * 0.3)) < 1e-9);
assert.match(bieuThucToc(r), /^if\(lt\(T,0\.9\),0\+\(T-0\)\/1\.5,if\(lt\(T,1\.14\),0\.6\+/);
if (process.env.CLIP) {                               // ffmpeg thật: độ dài ra phải đúng dai
  const kh = keHoachToc('ramp', 2, 2.4, 3.5)!;
  const out = execFileSync('ffmpeg', ['-v', 'error', '-i', process.env.CLIP, '-filter_complex', `[0:v]trim=0.3:${0.3 + kh.canVao},setpts=PTS-STARTPTS,setpts='(${bieuThucToc(kh)})/TB',fps=24[v]`, '-map', '[v]', '-f', 'null', '-', '-progress', 'pipe:1'], { encoding: 'utf8' });
  const giay = Number(/out_time_us=(\d+)/g.exec(out.split('progress=end')[0]!.split('out_time_us=').slice(-1).map((x) => `out_time_us=${x}`)[0]!)?.[1]) / 1e6;
  assert.ok(Math.abs(giay - 2.4) < 0.1, `ffmpeg ra ${giay}s, cần 2,4s`);
  console.log(`toc-do.test: ffmpeg thật ${giay.toFixed(2)}s ok`);
}
console.log('toc-do.test: ok');
