// ÂM THANH CHO MỘT CLIP DỰNG XONG (anh 02/11/2026 "chưa có âm thanh" — clip giấy cắt / VideoExpress ghép lại mất tiếng): tiếng hiệu ứng NGHE HÌNH mà sinh
// (Mirelo SFX video-to-audio: bước chân, ghế va, tiếng hất khớp đúng khung) + nhạc nền không lời (CassetteAI) → trộn (hiệu ứng trên, nhạc dưới) → MP4 có tiếng.
// Chạy trên box3: DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/am-cho-clip.mts --video=/tmp/x.mp4 --nhac='playful pizzicato…' [--to-nhac=0.35]
// Tiền: Mirelo ~0,7¢/giây + CassetteAI ~2¢/phút (am-thanh.ts › MO_HINH_AM).
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { uploadToR2 } from '../src/lib/r2';
import { guiFal, khoaFal } from '../src/lib/xuong-video/fal';
import { giaAm } from '../src/lib/xuong-video/am-thanh';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const video = arg('video'), nhac = arg('nhac'), toNhac = Number(arg('to-nhac') || 0.35);
if (!video) { console.error('thiếu --video'); process.exit(1); }
const giay = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' }).trim());
const uoc = giaAm('mirelo-ai/sfx-v1/video-to-audio', giay) + (nhac ? giaAm('cassetteai/music-generator', Math.ceil(giay)) : 0);
console.log(`clip ${giay.toFixed(2)}s · ước ${uoc.toFixed(2)}¢`);
if (process.env.DUYET_SINH_1_LAN !== '1') { console.error('tốn tiền: chạy kèm DUYET_SINH_1_LAN=1 ngay sau khi anh bảo'); process.exit(1); }

const url = await uploadToR2(`xuong-video/am-clip/${randomUUID()}.mp4`, readFileSync(video), 'video/mp4');
/** đợi một job fal xong, trả url tệp đầu tiên trong kết quả (âm / video) */
async function cho(id: string, input: Record<string, unknown>): Promise<string> {
  const g = await guiFal(id, input); if (!g.ok) throw new Error(`${id}: ${g.loi}`);
  const t = JSON.parse(g.taskId) as { s: string; r: string }; const h = { Authorization: `Key ${khoaFal()}` };
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = (await (await fetch(t.s, { headers: h })).json().catch(() => ({}))) as { status?: string };
    if (st.status !== 'COMPLETED') continue;
    const kq = JSON.stringify(await (await fetch(t.r, { headers: h })).json());
    const u = /"url":"(https:[^"]+\.(?:wav|mp3|m4a|aac|mp4|ogg|flac)[^"]*)"/.exec(kq)?.[1];
    if (!u) throw new Error(`${id}: xong nhưng không thấy tệp (${kq.slice(0, 300)})`);
    return u;
  }
  throw new Error(`${id}: quá 6 phút`);
}
const [sfx, nen] = await Promise.all([
  cho('mirelo-ai/sfx-v1/video-to-audio', { video_url: url }),
  nhac ? cho('cassetteai/music-generator', { prompt: `${nhac}, instrumental, no vocals`, duration: Math.ceil(giay) }) : Promise.resolve(''),
]);
console.log(`hiệu ứng: ${sfx}${nen ? `\nnhạc: ${nen}` : ''}`);
const thu = mkdtempSync(join(tmpdir(), 'am-clip-')); const ra = join(thu, 'ra.mp4');
const vao = ['-i', video, '-i', sfx, ...(nen ? ['-i', nen] : [])];
const loc = nen ? `[1:a]volume=1.0[a1];[2:a]volume=${toNhac},afade=t=out:st=${Math.max(0, giay - 0.8).toFixed(2)}:d=0.8[a2];[a1][a2]amix=inputs=2:duration=first:normalize=0[a]` : '[1:a]anull[a]';
execFileSync('ffmpeg', ['-v', 'error', '-y', ...vao, '-filter_complex', loc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', giay.toFixed(3), ra]);
console.log(`có tiếng: ${await uploadToR2(`xuong-video/am-clip/${randomUUID()}-co-tieng.mp4`, readFileSync(ra), 'video/mp4')}`);
process.exit(0);
