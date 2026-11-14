// THỬ MỘT CỤM SHOT bằng Seedance 2.0 (Fast) REFERENCE-TO-VIDEO qua Kie.ai — một lần sinh nhiều shot liền nhau (≤ 15 s), anh 14/11/2026 "Seedance sinh 15s
// 1 lần thì gom các shot vào chung" (sổ so sánh docs/so-sanh-mo-hinh-3d-video.md). Khung cụm của studio: thamChieuCum (ảnh người + bối cảnh), promptCumMoi
// (prompt nhiều shot), catThat + vaoTuCatThat (đo cú cắt trên clip ra → điểm vào từng shot).
//   video tham chiếu = clip 3D NỐI của cả cụm (mỗi shot cắt đúng đoạn phát) — dựng trên iMac (cấm mã hoá trên box3), chép lên box rồi truyền --video-file.
//   ảnh tham chiếu = người + bối cảnh (thamChieuCum) + keyframe từng shot, ≤ 9 ảnh (trần Kie).
// Gắn: mọi shot trỏ cùng clip cụm, ky_thuat.vao_s = điểm vào đo được (câu lệnh riêng sau khi đổi clip — trigger 0328).
//   cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-seedance-cum.mts \
//     --canh=9213,9198,9199 --video-file=/tmp/cum-3d.mp4 [--dpg=480p] [--xem]
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boiCanhCanh, taoJob, xongJob } from '../src/lib/xuong-video/doc-db';
import { promptCumMoi, thamChieuCum, vaoTuCatThat } from '../src/lib/xuong-video/cum-shot';
import { catThat } from '../src/lib/xuong-video/cat-that';
import { giayPhat } from '../src/lib/xuong-video/kieu';
import { uploadToR2 } from '../src/lib/r2';

const arg = (k: string, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const ids = arg('canh').split(',').map(Number).filter(Boolean); const fileVideo = arg('video-file'); const dpg = arg('dpg', '480p') as '480p' | '720p';
const model = arg('model', 'bytedance/seedance-2-fast'); const xem = process.argv.includes('--xem');
const key = process.env.KIE_API_KEY; if (!key) { console.error('thiếu KIE_API_KEY'); process.exit(1); }
if (!ids.length || !fileVideo) { console.error('cần --canh=<id,…> (shot liền nhau, một shot cũng được) và --video-file=<clip 3D nối của cụm>'); process.exit(1); }
const db = getDb()!;
const bcs = await Promise.all(ids.map((id) => boiCanhCanh(db, id))); if (bcs.some((b) => !b?.canh.keyframe_url)) { console.error('có shot thiếu keyframe'); process.exit(1); }
const cum = bcs.map((b) => ({ canh: b!.canh, nhanVat: b!.nhanVat, look: b!.look }));
const tong = cum.reduce((a, x) => a + giayPhat(x.canh), 0);
if (tong > 15) { console.error(`cụm dài ${tong.toFixed(1)} s > 15 s (trần Seedance)`); process.exit(1); }
const giayRa = Math.max(4, Math.ceil(tong));

// ảnh: người + bối cảnh (thamChieuCum, ≤ 5) rồi keyframe từng shot (đúng nét vẽ / khung từng góc) — tổng ≤ 9
const tc = thamChieuCum(cum, 5);
const kf = cum.map((x) => x.canh.keyframe_url!).slice(0, 9 - tc.anh.length);
const anh = [...tc.anh, ...kf];
const goiKf = kf.map((_, i) => `Reference image ${tc.anh.length + i + 1} is the exact look of shot ${i + 1} (its framing, drawing style and the people's clothes).`).join(' ');
const than = promptCumMoi(cum, { tag: tc.tag, them: tc.them, giay: giayRa, tiLe: bcs[0]!.kt.ti_le });
const prompt = `${tc.goi}. ${goiKf} Reference video 1 is a rough grey 3D blockout of this whole ${cum.length}-shot sequence with hard cuts: copy ONLY its cuts, camera angles, timing, where everyone stands and how they move — never its grey mannequin look; every shot must look like its reference image. ${than}`;
console.log(`cụm ${cum.map((x) => `#${x.canh.thu_tu}`).join(' ')} · ${tong.toFixed(1)} s → clip ${giayRa} s · ${model} ${dpg} · ${anh.length} ảnh · prompt ${prompt.length} ký tự`);
if (xem) { console.log(prompt); console.log(anh.join('\n')); process.exit(0); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1 ngay sau khi anh duyệt lượt này'); process.exit(2); }

const giaVao = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fileVideo], { encoding: 'utf8' }).trim());
const cents = (dpg === '720p' ? 7.5 : 3.4) * (giaVao + giayRa);   // kie.ai/seedance-2-0 (14/11/2026): có video vào → tính giây vào + giây ra
const urlVideo = await uploadToR2(`xuong-video/khung-xam/cum-${ids.join('-')}-${randomUUID()}.mp4`, readFileSync(fileVideo), 'video/mp4');
if (!urlVideo) { console.error('đẩy clip 3D nối lên kho hỏng'); process.exit(1); }
const job = await taoJob(db, { canh_id: ids[0], loai: 'video', provider: 'kie', model: `kie:${model}`, request: { thu: 'seedance-cum', cum: ids, prompt, anh, video: urlVideo, dpg }, cents });
const r = await fetch('https://api.kie.ai/api/v1/jobs/createTask', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model, input: { prompt, reference_image_urls: anh, reference_video_urls: [urlVideo], resolution: dpg, aspect_ratio: cum[0]!.canh && bcs[0]!.kt.ti_le === '9:16' ? '9:16' : '16:9', duration: giayRa, generate_audio: false } }) });
const j = (await r.json().catch(() => ({}))) as { code?: number; msg?: string; data?: { taskId?: string } };
if (j.code !== 200 || !j.data?.taskId) { await xongJob(db, job, { loi: `Kie ${j.code}: ${j.msg}` }); console.error('Kie không nhận:', j.code, j.msg); process.exit(1); }
console.log('gửi Kie', j.data.taskId, '· job', job);
const t0 = Date.now();
for (;;) {
  await new Promise((o) => setTimeout(o, 15_000));
  const d = ((await (await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${j.data.taskId}`, { headers: { authorization: `Bearer ${key}` } })).json().catch(() => ({}))) as { data?: { state?: string; resultJson?: string; failMsg?: string } }).data ?? {};
  if (d.state === 'fail') { await xongJob(db, job, { loi: d.failMsg ?? 'Kie báo hỏng' }); console.error('hỏng:', d.failMsg); process.exit(1); }
  if (d.state !== 'success') { if (Date.now() - t0 > 25 * 60_000) { console.error('quá 25 phút'); process.exit(1); } continue; }
  const u = (JSON.parse(d.resultJson ?? '{}') as { resultUrls?: string[] }).resultUrls?.[0];
  if (!u) { await xongJob(db, job, { loi: 'không có resultUrls' }); process.exit(1); }
  const buf = Buffer.from(await (await fetch(u)).arrayBuffer()); const f = `/tmp/seedance-cum-${job}.mp4`; writeFileSync(f, buf);
  const dai = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());
  const cat = catThat(f, cum.length, dai); const v = vaoTuCatThat(cum.map((x) => x.canh), cat, dai);
  const url = await uploadToR2(`xuong-video/clip/cum-${ids.join('-')}-${randomUUID()}.mp4`, buf, 'video/mp4');
  if (!url) { await xongJob(db, job, { loi: 'đẩy kho hỏng' }); process.exit(1); }
  await xongJob(db, job, { output_url: url, chi_phi_cents: cents });
  for (const [i, x] of cum.entries()) {
    await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, nguon_video = ${JSON.stringify({ model: `kie:${model}`, prompt, job, cum: ids })}::jsonb, trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${x.canh.id}`);
    await db.execute(sql`UPDATE xv_canh SET ky_thuat = jsonb_set(coalesce(ky_thuat, '{}'::jsonb), '{vao_s}', ${JSON.stringify(v.vao[i])}::jsonb) WHERE id = ${x.canh.id}`);
  }
  console.log(`xong ${Math.round((Date.now() - t0) / 1000)}s · ${url} · dài ${dai.toFixed(2)} s · cú cắt đo ${cat.map((c) => c.toFixed(2)).join(', ') || 'không thấy'} · ${v.theoDo ? 'điểm vào theo cú cắt đo' : 'điểm vào theo lịch (không đo đủ cú cắt)'} · vào ${v.vao.map((x) => x.toFixed(2)).join(', ')} · ~${cents.toFixed(1)}¢`);
  process.exit(0);
}
