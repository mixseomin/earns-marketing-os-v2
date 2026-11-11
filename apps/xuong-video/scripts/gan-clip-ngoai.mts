// GẮN CLIP DỰNG NGOÀI về đúng shot trong studio (luật: video luôn qua studio — công cụ ngoài làm hộ một khâu rồi gắn về). Dùng cho đường giấy cắt →
// ảnh mốc → VideoExpress (giay-cat/, vx-noi-moc.mts) + âm thanh (am-cho-clip.mts):
//   · hình: bỏ tiếng, đưa lên R2 → xv_canh.video_url (+ video_phien_ban); bản xuất ghép tiếng riêng như mọi shot
//   · hiệu ứng: chép từ fal (link tạm, hết hạn) sang R2 → xv_canh.am_thanh_url
//   · số giây shot → thoi_luong_s / phat_s; nguồn dựng (cảnh code, ảnh mốc, đoạn VideoExpress, lớp tàu, nhạc) → nguon_video
// Chụp giá trị cũ trước khi ghi (hoan-tac.ts › chupTruoc — ↶ Hoàn tác được). Không tốn tiền.
// Chạy trên box3: NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/gan-clip-ngoai.mts --canh=4132 --video=/tmp/x.mp4 --am=<url|tệp> --nguon=/tmp/nguon.json [--dan-dung=/tmp/dd.json] [--giu-nhip]
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../src/lib/r2';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const canhId = Number(arg('canh')), video = arg('video'), am = arg('am'), nguonTep = arg('nguon'), ddTep = arg('dan-dung');
// --giu-nhip: clip ngoài dài hơn nhịp shot (VideoExpress tối thiểu ~4 s) → GIỮ thoi_luong_s / phat_s của shot, bản xuất tự cắt theo phat_s
const giuNhip = process.argv.includes('--giu-nhip');
if (!canhId || !video) { console.error('thiếu --canh --video'); process.exit(1); }
const db = getDb();
const thu = mkdtempSync(join(tmpdir(), 'gan-clip-'));
/** tệp cục bộ hoặc url → Buffer */
const doc = async (u: string) => (/^https?:/.test(u) ? Buffer.from(await (await fetch(u)).arrayBuffer()) : readFileSync(u));

const cam = join(thu, 'cam.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-an', '-c:v', 'copy', cam]);
const giay = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', cam], { encoding: 'utf8' }).trim());
const urlVideo = await uploadToR2(`xuong-video/clip/${canhId}-${randomUUID()}.mp4`, readFileSync(cam), 'video/mp4');
let urlAm: string | null = null;
if (am) { const b = await doc(am); const p = join(thu, 'am.wav'); writeFileSync(p, b); urlAm = await uploadToR2(`xuong-video/am/${canhId}-${randomUUID()}.wav`, readFileSync(p), 'audio/wav'); }
if (!urlVideo || (am && !urlAm)) { console.error('đưa lên R2 hỏng'); process.exit(1); }

// nguồn dựng: tệp âm thanh / nhạc có link fal tạm → chép sang R2 để còn mãi
const nguon = (nguonTep ? JSON.parse(readFileSync(nguonTep, 'utf8')) : {}) as Record<string, unknown>;
for (const k of ['nhac', 'hieu_ung_goc']) if (typeof nguon[k] === 'string' && /fal\.media/.test(nguon[k] as string)) nguon[k] = await uploadToR2(`xuong-video/am/${canhId}-${k}-${randomUUID()}.wav`, await doc(nguon[k] as string), 'audio/wav');
const dd = ddTep ? JSON.parse(readFileSync(ddTep, 'utf8')) as Record<string, unknown> : null;

await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['video_url', 'am_thanh_url', 'thoi_luong_s', 'phat_s', 'nguon_video', 'trang_thai', 'dan_dung'], moTa: 'gắn clip dựng ngoài (giấy cắt → VideoExpress)', nguoi: 'claude' });
const pb = JSON.stringify([{ url: urlVideo, ban: 'nhap', model: String(nguon.model ?? 'giay-cat+videoexpress'), luc: new Date().toISOString() }]);
const g = Math.round(giay * 100) / 100;
await db.execute(sql`UPDATE xv_canh SET video_url = ${urlVideo}, video_phien_ban = video_phien_ban || ${pb}::jsonb, am_thanh_url = coalesce(${urlAm}, am_thanh_url),
  thoi_luong_s = CASE WHEN ${giuNhip} THEN thoi_luong_s ELSE ${Math.ceil(g)} END, phat_s = CASE WHEN ${giuNhip} THEN phat_s ELSE ${g} END, nguon_video = ${JSON.stringify({ ...nguon, giay: g, gan_luc: new Date().toISOString() })}::jsonb,
  dan_dung = CASE WHEN ${dd ? JSON.stringify(dd) : null}::jsonb IS NULL THEN dan_dung ELSE coalesce(dan_dung, '{}'::jsonb) || ${dd ? JSON.stringify(dd) : null}::jsonb END,
  trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${canhId}`);
console.log(`#${canhId}: video ${urlVideo} · ${g}s${urlAm ? ` · hiệu ứng ${urlAm}` : ''}`);
process.exit(0);
