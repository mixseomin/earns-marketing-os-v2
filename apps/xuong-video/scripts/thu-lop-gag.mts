// THỬ LỐI NỀN CỐ ĐỊNH + LỚP NHÂN VẬT cho một gag (anh 01/11/2026: "mỗi gag là 1 khung có nền cố định, nhân vật độc lập và cử động khác"):
//   1. nền: ảnh phố trống người từ ảnh thật bối cảnh (đứng yên suốt shot)
//   2. lớp: nhân vật + vật của gag trên nền xanh phẳng → clip ảnh→video (PlenX veo3-lite)
//   3. ghép: ffmpeg chromakey lớp → overlay lên nền → MP4 lên R2
// Chạy trên box3:  DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-lop-gag.mts --phim=1156 --nen=749 --nv=736,741 --nhip='…' --nen-mo-ta='…' --lop-mo-ta='…' [--giay=6]
// Tốn ~2 ảnh (220₫) + 1 clip (~800₫). Ghép 0đ.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../src/lib/r2';
import { sinhAnhQuaCong, guiVideoCong, docVideoCong } from '../src/lib/xuong-video/cong-ai';
import '../src/lib/xuong-video/cong-plenxai';
import { docKinhThanh, phongCachHinh, type KinhThanh } from '../src/lib/xuong-video/kieu';
import { MAU_XANH_NEN } from '../src/lib/xuong-video/cat-nen';
import { nenH264 } from '../src/lib/xuong-video/nen-video.mjs';

const run = promisify(execFile);
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const phimId = Number(arg('phim')), nenId = Number(arg('nen')), nvIds = arg('nv').split(',').map(Number).filter(Boolean);
const nhip = arg('nhip'), nenMoTa = arg('nen-mo-ta'), lopMoTa = arg('lop-mo-ta'), giay = Number(arg('giay') || 6);
if (!phimId || !nenId || !nvIds.length || !nhip || !lopMoTa) { console.error('thiếu --phim --nen --nv --nhip --lop-mo-ta'); process.exit(1); }
if (process.env.DUYET_SINH_1_LAN !== '1') { console.error('tốn tiền (~1.000₫): chạy kèm DUYET_SINH_1_LAN=1 ngay sau khi anh bảo'); process.exit(1); }

const db = getDb();
const kt = docKinhThanh(((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as { kinh_thanh: KinhThanh }[])[0]!.kinh_thanh);
const anchors = (await db.execute(sql`SELECT id, mo_ta, anh_ref, anh_that FROM xv_nhan_vat WHERE id IN (${sql.raw([nenId, ...nvIds].map(Number).join(','))})`)) as unknown as { id: number; mo_ta: string; anh_ref: string[]; anh_that: string[] | null }[];
const nen = anchors.find((a) => a.id === nenId)!;
const nv = nvIds.map((id) => anchors.find((a) => a.id === id)!).filter(Boolean);
const style = phongCachHinh(kt.phong_cach).replace(/[.\s]+$/, '');
const thu = await mkdtemp(join(tmpdir(), 'lop-gag-'));
const ma = randomUUID().slice(0, 8);

async function anh(ten: string, prompt: string, refs: string[]): Promise<string> {
  const k = await sinhAnhQuaCong(kt.mo_hinh_anh, { prompt, thamChieuUrl: refs.slice(0, 3), tiLe: '16:9' });
  if (!k.anh) throw new Error(`${ten}: không sinh được ảnh (${k.thu.map((t) => `${t.cong}: ${t.loi ?? ''}`).join(' · ')})`);
  const url = await uploadToR2(`xuong-video/thu-lop/${ma}-${ten}.png`, k.anh.data, k.anh.mimeType);
  await writeFile(join(thu, `${ten}.img`), k.anh.data);
  console.log(`  ${ten}: ${url}`);
  return url!;
}

console.log('1. nền cố định');
const refNen = [...(nen.anh_that ?? []).slice(0, 1), ...nen.anh_ref.slice(0, 1)];
await anh('nen', `Visual style: ${style}. A single still background plate for a 2D animated film, eye-level medium wide shot, locked-off camera: ${nenMoTa || nen.mo_ta}. The street is completely EMPTY — no people, no animals, no vehicles. Keep the lower third of the frame as open ground where characters will walk. No text, no letters, no signs.`, refNen);

console.log('2. lớp nhân vật trên nền xanh');
const refNv = nv.map((v) => v.anh_ref[0]!).filter(Boolean);
const urlLop = await anh('lop', `Visual style: ${style} — characters only. ${lopMoTa} Full bodies visible, feet on an invisible ground line in the lower third, same scale and eye-level camera as a medium wide street shot. The entire background is a flat pure chroma green (${MAU_XANH_NEN}) with no floor, no scenery, no shadows, no gradient; nothing green on the characters or objects. Reference images show the characters — keep their exact designs.`, refNv);

console.log(`3. clip lớp ${giay}s`);
const pVideo = `Visual style: ${style}. Classic 2D cartoon acting, fast snappy comedic timing. ${nhip.split('|').map((x) => x.trim()).join('; ')}. The background stays a perfectly flat pure chroma green for the whole clip — no floor, no scenery, no shadows ever appear. Static locked-off camera, no zoom, no pan. The characters keep their exact designs. Nobody speaks. No text.`;
const g = await guiVideoCong('plenxai', 'veo3-lite', { tiLe: '16:9', prompt: pVideo, anhDau: urlLop, giay, doPhanGiai: '720p' });
if (!g.ok) throw new Error(`gửi video: ${g.loi}`);
const tao = new Date().toISOString(); let uri = '';
for (let i = 0; i < 90 && !uri; i++) {
  await new Promise((r) => setTimeout(r, 10_000));
  const d = await docVideoCong('plenxai', g.taskId, tao);
  if (d.done) { if (!d.ok) throw new Error(`video: ${d.loi}`); uri = d.uri; }
}
if (!uri) throw new Error('video quá 15 phút');
const lopMp4 = join(thu, 'lop.mp4');
await writeFile(lopMp4, Buffer.from(await (await fetch(uri)).arrayBuffer()));
console.log(`  lớp: ${await uploadToR2(`xuong-video/thu-lop/${ma}-lop.mp4`, await readFile(lopMp4), 'video/mp4')}`);

console.log('4. ghép (0đ)');
const ra = join(thu, 'ghep.mp4');
await run('ffmpeg', ['-y', '-loop', '1', '-i', join(thu, 'nen.img'), '-i', lopMp4, '-filter_complex',
  `[0:v]scale=1280:720,setsar=1[n];[1:v]scale=1280:720,chromakey=0x00FF00:0.16:0.08,despill=type=green[l];[n][l]overlay=0:0:shortest=1,format=yuv420p[v]`,
  '-map', '[v]', ...nenH264({ crf: 18 }), '-t', String(giay), ra]);
console.log(`  ghép: ${await uploadToR2(`xuong-video/thu-lop/${ma}-ghep.mp4`, await readFile(ra), 'video/mp4')}`);
process.exit(0);
