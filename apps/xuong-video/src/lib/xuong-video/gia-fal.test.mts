// Tự kiểm bộ đọc giá fal (#1193). Chạy: node_modules/.bin/tsx src/lib/xuong-video/gia-fal.test.mts [file-danh-muc.json]
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { tomGia } from './gia-fal';

const g = (t: string) => tomGia(t);
// Kling v3 pro: 0.112 không tiếng / 0.168 có tiếng / 0.196 voice — câu "For example" bị bỏ.
let x = g('For every second of video you generated, you will be charged **$0.112** (audio off) or **$0.168** (audio on), if voice control is used while generating audio you will be charged **$0.196**. For example, a 5s video with audio on and voice control will cost **$0.98**');
assert.deepStrictEqual(x.giay['720p'], [11.2, 19.6]);
// Veo 3.1 lite: theo độ phân giải + tiếng.
x = g('For every second of video you generate you will be charged **$0.05** for 720p with audio, **$0.03** for 720p without audio, **$0.08** for 1080p with audio or **$0.05** for 1080p without audio. For example, a **4 second video** at **720p with audio** will cost **$0.20**.');
assert.deepStrictEqual(x.giay['720p'], [3, 5]); assert.deepStrictEqual(x.giay['1080p'], [5, 8]); assert.strictEqual(x.chinh['720p'], 5);
// Kling 2.5 turbo: 5s giá 0.35 + mỗi giây thêm 0.07 → 0.07/giây.
x = g('For **5s** video your request will cost **$0.35**. For every additional second you will be charged **$0.07.**');
assert.deepStrictEqual(x.giay['720p'], [7, 7]);
// Hailuo 2.3: giá theo clip 6s/10s → quy ra giây.
x = g('Your request will cost **$0.28** per **6 second** video generation, and a **$0.56** per **10 second** video generation.');
assert.ok(x.giay['720p'] && Math.abs(x.giay['720p'][0] - 4.667) < 0.01 && x.giay['720p'][1] === 5.6);
// Giá cố định mỗi video.
x = g('Your request will cost **$0.49** per video generation.');
assert.deepStrictEqual(x.clip['720p'], [49, 49]);
// "0.17 $ per second".
x = g('Your request will be charged at **0.17** $ per second of generated video at 720p, and **0.29** $ per second at 1080p.');
assert.deepStrictEqual(x.giay['720p'], [17, 17]); assert.deepStrictEqual(x.giay['1080p'], [29, 29]);
// Khuyến mãi: bỏ câu "after which".
x = g('Video costs **$0.03** per second at **480p**, **$0.048** per second at **768p**, and **$0.096** per second at **1080p**.  Note: these are promotional rates, **40%** off for a limited time. The discount ends **October 15**, after which **480p** is **$0.05**/second');
assert.deepStrictEqual(x.giay['1080p'], [9.6, 9.6]);
// Seedance 2.5: "For 480p, … $0.2205 …, for 720p, … $0.4730" — độ phân giải đứng trước con số.
x = g('For 480p, your request will cost roughly **$0.2205** per second of generated video, for 720p, you will be charged roughly **$0.4730** per second of generated video, and for 1080p, roughly **$1.164** per second of generated video.');
assert.deepStrictEqual(x.giay['720p'], [47.3, 47.3]);
// Grok lite: câu có "per input image" vẫn đọc được giá/giây; vế ảnh đầu vào bị bỏ.
x = g('Priced per second of output video and per input image, by resolution: **480p** at **$0.02**/sec, **720p** at **$0.03**/sec, **1080p** at **$0.14**/sec. Each input image costs **$0.01**.');
assert.deepStrictEqual(x.giay['720p'], [3, 3]);
// Trống → không có giá, mô tả nói rõ.
assert.strictEqual(g('').giay['720p'], null); assert.match(g('').moTa, /chưa công bố/);

// Chạy trên danh mục thật: đếm còn bao nhiêu model không ra giá.
const f = process.argv[2];
if (f) {
  const items = (JSON.parse(readFileSync(f, 'utf8')).items ?? []) as Array<{ id: string; pricingInfoOverride?: string }>;
  const ds = items.filter((m) => /image-to-video|first-last-frame/.test(m.id) && !/avatar|lip-sync|omnihuman|heygen|fabric/.test(m.id));
  const khong = ds.filter((m) => { const t = tomGia(m.pricingInfoOverride ?? ''); return !t.giay['720p'] && !t.clip['720p']; });
  console.log(`danh mục thật: ${ds.length - khong.length}/${ds.length} model có giá 720p`);
  for (const m of khong) console.log('  không ra giá:', m.id, '|', (m.pricingInfoOverride ?? '').slice(0, 120));
  for (const m of ds.slice(0, 12)) { const t = tomGia(m.pricingInfoOverride ?? ''); console.log(' ', m.id, JSON.stringify(t.giay['720p']), JSON.stringify(t.clip['720p']), 'chinh', t.chinh['720p']); }
}
console.log('gia-fal: mọi bài tự kiểm qua');
