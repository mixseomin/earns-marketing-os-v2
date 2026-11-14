// KHỚP MÔI MỘT SHOT, CANH ĐÚNG GIỜ (anh 15/11/2026: "shot 4 có voice nhưng không thấy mồm nói"): clip Seedance câm (generate_audio false) → miệng không nhép.
// Bước ngành: clip diễn trước, khớp môi sau bằng model chỉ sửa vùng miệng (fal Sync Lipsync v2, $3/phút). Khác khopMiengCanh (actions.ts — giọng đặt từ giây 0):
// giọng ĐỆM LẶNG = điểm vào clip (ky_thuat.vao_s) + độ trễ câu (thoai[].tre) → miệng nhép đúng lúc câu vang lên trên timeline / bản xuất. Ghép tiếng chỉ là ÂM
// (ffmpeg tạo mp3 trên box — không mã hoá video). Clip ra thay video_url của RIÊNG shot này (clip cụm của shot khác giữ nguyên), vao_s giữ.
//   cd apps/xuong-video && [DUYET_SINH_1_LAN=1] NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/khop-moi-shot.mts --canh=9210 [--xem]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boiCanhCanh, taoJob, xongJob } from '../src/lib/xuong-video/doc-db';
import { dongThoai } from '../src/lib/xuong-video/am-thanh';
import { guiFal, docFal } from '../src/lib/xuong-video/fal';
import { KHOP_MIENG } from '../src/lib/xuong-video/kieu';
import { uploadToR2 } from '../src/lib/r2';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const canhId = Number(arg('canh')); const xem = process.argv.includes('--xem');
const db = getDb()!; const bc = await boiCanhCanh(db, canhId); if (!bc) { console.error('không thấy shot'); process.exit(1); }
const video = bc.canh.video_url; if (!video) { console.error('shot chưa có clip'); process.exit(1); }
const dong = dongThoai(bc.canh, bc.nhanVat).filter((d) => d.url && d.loi.trim());
if (!dong.length) { console.error('shot không có dòng thoại có file giọng'); process.exit(1); }
const vao = Number(bc.canh.ky_thuat?.vao_s ?? 0);
const daiClip = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' }).trim());
const cents = (300 / 60) * daiClip;   // $3 / phút clip (trang fal 15/11/2026)
// giọng: mỗi dòng đặt ở (vao + tre), cả file dài bằng clip
const tm = `/tmp/khop-moi-${canhId}-${randomUUID().slice(0, 8)}`; execFileSync('mkdir', ['-p', tm]);
const vaoAm = dong.flatMap((d) => ['-i', d.url!]);
const loc = dong.map((d, i) => `[${i}:a]aresample=48000,adelay=${Math.round((vao + (d.tre ?? 0)) * 1000)}|${Math.round((vao + (d.tre ?? 0)) * 1000)}[a${i}]`).join(';');
const am = `${tm}/giong.mp3`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...vaoAm, '-filter_complex', `${loc};${dong.map((_, i) => `[a${i}]`).join('')}amix=inputs=${dong.length}:normalize=0,apad=whole_dur=${daiClip.toFixed(2)},atrim=0:${daiClip.toFixed(2)}[o]`, '-map', '[o]', '-ac', '2', '-b:a', '192k', am]);
console.log(`shot #${bc.canh.thu_tu} · clip ${daiClip.toFixed(2)} s · điểm vào ${vao} s · ${dong.map((d) => `"${d.loi}" lúc ${(vao + (d.tre ?? 0)).toFixed(2)} s`).join(' · ')} · ~${cents.toFixed(1)}¢`);
if (xem) process.exit(0);
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1 ngay sau khi anh duyệt lượt này'); process.exit(2); }
const urlAm = await uploadToR2(`xuong-video/am/thoai/${canhId}-khop-${randomUUID()}.mp3`, readFileSync(am), 'audio/mpeg');
if (!urlAm) { console.error('đẩy giọng hỏng'); process.exit(1); }
const job = await taoJob(db, { canh_id: canhId, loai: 'video', provider: 'fal', model: KHOP_MIENG.model, request: { khopMieng: true, tu: video, audio: urlAm, vao }, cents });
const g = await guiFal(KHOP_MIENG.model, { video_url: video, audio_url: urlAm, sync_mode: 'cut_off' });
if (!g.ok) { await xongJob(db, job, { loi: g.loi }); console.error('fal không nhận:', g.loi); process.exit(1); }
const t0 = Date.now();
for (;;) {
  await new Promise((o) => setTimeout(o, 10_000));
  const d = await docFal(g.taskId); if (!d.done) { if (Date.now() - t0 > 20 * 60_000) { console.error('quá 20 phút'); process.exit(1); } continue; }
  if (!d.ok) { await xongJob(db, job, { loi: d.loi }); console.error('hỏng:', d.loi); process.exit(1); }
  const buf = Buffer.from(await (await fetch(d.uri)).arrayBuffer());
  const url = await uploadToR2(`xuong-video/clip/${canhId}-khop-${randomUUID()}.mp4`, buf, 'video/mp4'); if (!url) { await xongJob(db, job, { loi: 'đẩy kho hỏng' }); process.exit(1); }
  await xongJob(db, job, { output_url: url, chi_phi_cents: cents });
  await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, nguon_video = coalesce(nguon_video, '{}'::jsonb) || ${JSON.stringify({ khop_moi: { job, tu: video, audio: urlAm } })}::jsonb, updated_at = now() WHERE id = ${canhId}`);
  await db.execute(sql`UPDATE xv_canh SET ky_thuat = jsonb_set(coalesce(ky_thuat, '{}'::jsonb), '{vao_s}', ${JSON.stringify(vao)}::jsonb) WHERE id = ${canhId}`);   // trigger 0328 xoá vao_s khi đổi clip
  console.log(`xong ${Math.round((Date.now() - t0) / 1000)}s · ${url} · ~${cents.toFixed(1)}¢`);
  process.exit(0);
}
