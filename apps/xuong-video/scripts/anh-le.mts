// ẢNH LẺ không gắn phim (nền cho clip dựng bằng code — vu-tru/, nền tĩnh, thử phong cách): một prompt → một ảnh qua cổng rẻ (sinhAnhQuaCong: ckey trước)
// → tệp cục bộ trên box + R2, in đường dẫn + giá thật. ~110₫/ảnh.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/anh-le.mts --prompt='…' --ti-le=9:16 --ra=/tmp/x.png [--ref=url,url]
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { uploadToR2 } from '../src/lib/r2';
import { sinhAnhQuaCong } from '../src/lib/xuong-video/cong-ai';
import type { TiLeAnh } from '../src/lib/xuong-video/kieu';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const prompt = arg('prompt'), ra = arg('ra'), tiLe = (arg('ti-le') || '9:16') as TiLeAnh, ref = arg('ref').split(',').filter(Boolean);
if (!prompt || !ra) { console.error('thiếu --prompt --ra'); process.exit(1); }
const k = await sinhAnhQuaCong('gemini-nano-banana-2.1', { prompt, thamChieuUrl: ref, tiLe });
if (!k.anh) { console.error('hỏng:', JSON.stringify(k.thu)); process.exit(1); }
writeFileSync(ra, k.anh.data);
const url = await uploadToR2(`xuong-video/anh-le/${randomUUID()}.${k.anh.mimeType.includes('png') ? 'png' : 'jpg'}`, k.anh.data, k.anh.mimeType);
console.log(`${ra} · ${url} · ${k.nguon?.cong}:${k.nguon?.model} · ${k.nguon?.vnd ?? '?'}₫`);
process.exit(0);
