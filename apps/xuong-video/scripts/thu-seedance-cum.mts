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
import { promptCumMoi, thamChieuCum, vaoTuCatThat, cauNgoaiCua } from '../src/lib/xuong-video/cum-shot';
import { catThat } from '../src/lib/xuong-video/cat-that';
import { giayPhat, chatLieuPhim } from '../src/lib/xuong-video/kieu';
import { chonCachKhopMoi } from '../src/lib/xuong-video/khop-moi-cach';
import { nhanNhin } from '../src/lib/xuong-video/prompt-khoi';
import { uploadToR2 } from '../src/lib/r2';
import { loiPromptGui, loiClipThamChieu } from '../src/lib/xuong-video/chan-gui-video';
import { dangChongBau } from '../src/lib/xuong-video/bo-set-3d';

const arg = (k: string, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const ids = arg('canh').split(',').map(Number).filter(Boolean); const fileVideo = arg('video-file'); const dpg = arg('dpg', '480p') as '480p' | '720p';
const model = arg('model', 'bytedance/seedance-2-fast'); const xem = process.argv.includes('--xem');
const key = process.env.KIE_API_KEY; if (!key) { console.error('thiếu KIE_API_KEY'); process.exit(1); }
if (!ids.length) { console.error('cần --canh=<id,…> (shot liền nhau, một shot cũng được) và --video-file=<clip 3D nối của cụm>'); process.exit(1); }
const db = getDb()!;
const bcs = await Promise.all(ids.map((id) => boiCanhCanh(db, id))); if (bcs.some((b) => !b?.canh.keyframe_url)) { console.error('có shot thiếu keyframe'); process.exit(1); }
const cum = bcs.map((b) => ({ canh: b!.canh, nhanVat: b!.nhanVat, look: b!.look }));
const tong = cum.reduce((a, x) => a + giayPhat(x.canh), 0);
if (tong > 15) { console.error(`cụm dài ${tong.toFixed(1)} s > 15 s (trần Seedance)`); process.exit(1); }
const giayRa = Math.max(4, Math.ceil(tong));
// MỘT SHOT NGẮN HƠN 4 s (sàn thời lượng Seedance, anh 15/11/2026): gửi NGUYÊN clip 3D của shot (có đoạn dư đầu / cuối clip.vao / clip.ra) — clip ra có phần đệm hai
// đầu để cắt, điểm vào = clip.vao. Không cần clip nối từ iMac. Nhiều shot → clip 3D nối của cụm (--video-file, cum-seedance-tap.sh).
const clip1 = cum.length === 1 && tong < 4 && cum[0]!.canh.khung_xam?.clip?.ma === cum[0]!.canh.khung_xam?.ma ? cum[0]!.canh.khung_xam!.clip! : null;
if (!clip1 && !fileVideo) { console.error('cần --video-file=<clip 3D nối của cụm> (cụm nhiều shot / shot ≥ 4 s)'); process.exit(1); }
// KHỚP MÔI KHI SINH (khop-moi-cach.ts): cách 'seedance_audio' → gửi file giọng làm Audio 1, câu thoại đặt đúng mốc trong clip ra (mốc shot + trễ câu), kèm nguyên văn câu
const nguoiNoi = [...new Set(cum.flatMap((x) => (x.canh.thoai ?? []).filter((d) => d.url && d.loi?.trim()).map((d) => d.nhan_vat)))];
const cachKhop = nguoiNoi.length ? chonCachKhopMoi({ chatLieu: chatLieuPhim(bcs[0]!.kt), ngonNgu: bcs[0]!.kt.ngon_ngu, soNguoiNoi: nguoiNoi.length }) : null;
const nhanNoi = new Map(nhanNhin(nguoiNoi.map((t) => ({ ten: t, moTaNv: cum.flatMap((x) => x.nhanVat).find((v) => v.ten === t)?.mo_ta }))).map((x) => [x.ten, x.gon]));
let mocShot = clip1 ? clip1.vao : 0; const cauAm: { url: string; t: number; ai: string; loi: string; so: number }[] = [];
for (const [i, x] of cum.entries()) { for (const d of x.canh.thoai ?? []) if (d.url && d.loi?.trim()) cauAm.push({ url: d.url, t: mocShot + (d.tre ?? 0), ai: d.nhan_vat, loi: d.loi.trim(), so: i + 1 }); mocShot += giayPhat(x.canh); }
const guiGiong = cachKhop?.cach === 'seedance_audio' && cauAm.length > 0;

// ảnh: người + bối cảnh (thamChieuCum, ≤ 5) rồi keyframe từng shot (đúng nét vẽ / khung từng góc) — tổng ≤ 9
const tc = thamChieuCum(cum, 5);
const kf = cum.map((x) => x.canh.keyframe_url!).slice(0, 9 - tc.anh.length);
const anh = [...tc.anh, ...kf];
const goiKf = kf.map((_, i) => `Reference image ${tc.anh.length + i + 1} is the exact look of shot ${i + 1} (its framing, drawing style and the people's clothes).`).join(' ');
const than = promptCumMoi(cum, { tag: tc.tag, them: tc.them, giay: giayRa, tiLe: bcs[0]!.kt.ti_le });
const cauGiong = guiGiong ? ` Audio 1 is the dialogue track — lip-sync to Audio 1: while Audio 1 has speech the speaker clearly opens the mouth and the lips visibly form every syllable, loud and expressive; the mouth is closed when Audio 1 is silent. ${cauAm.map((c) => `In shot ${c.so}, ${nhanNoi.get(c.ai) ?? 'the speaker'} speaks out loud and says: ${c.loi.replace(/["“”]/g, '')}.`).join(' ')}` : '';
const prompt = `${tc.goi}. ${goiKf} Reference video 1 is a rough grey 3D blockout of this whole ${cum.length}-shot sequence with hard cuts: copy ONLY its cuts, camera angles, timing, where everyone stands and how they move — never its grey mannequin look; every shot must look like its reference image. ${than} ${cauNgoaiCua(cum.map((x) => x.canh))}${cauGiong}`.trim();
console.log(`cụm ${cum.map((x) => `#${x.canh.thu_tu}`).join(' ')} · ${tong.toFixed(1)} s → clip ${giayRa} s · ${model} ${dpg} · ${anh.length} ảnh · prompt ${prompt.length} ký tự`);
// LUẬT CHẤM TRƯỚC KHI GỬI (chan-gui-video.ts — anh 14/11/2026): lỗi nào cũng chặn, không tốn tiền
const loiGui = [...loiPromptGui(prompt, { tiLe: bcs[0]!.kt.ti_le, tenNhanVat: [...new Set(cum.flatMap((x) => x.nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten)))] }),
  ...loiClipThamChieu(cum.map((x) => ({ so: x.canh.thu_tu, clip: x.canh.khung_xam?.clip }))),
  ...Object.entries(dangChongBau(cum.map((x) => x.canh))).flatMap(([id, l]) => l.map((y) => `#${cum.find((x) => x.canh.id === Number(id))?.canh.thu_tu}: ${y}`))];
if (loiGui.length) { console.error(`✗ CHẶN trước khi gửi (${loiGui.length} lỗi):\n  - ${loiGui.join('\n  - ')}`); process.exit(3); }
if (xem) { console.log(prompt); console.log(anh.join('\n')); process.exit(0); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1 ngay sau khi anh duyệt lượt này'); process.exit(2); }

const giaVao = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip1 ? clip1.url : fileVideo], { encoding: 'utf8' }).trim());
const cents = (dpg === '720p' ? 7.5 : 3.4) * (giaVao + giayRa);   // kie.ai/seedance-2-0 (14/11/2026): có video vào → tính giây vào + giây ra
const urlVideo = clip1 ? clip1.url : await uploadToR2(`xuong-video/khung-xam/cum-${ids.join('-')}-${randomUUID()}.mp4`, readFileSync(fileVideo), 'video/mp4');
// file giọng Audio 1 (chỉ ghép ÂM trên box — không mã hoá video): lặng + từng câu đúng mốc, dài bằng clip ra (Kie: 2–15 s)
let urlGiong: string | null = null;
// file giọng NGẮN (15/11/2026, shot #4 lần 1: giọng 4 s có 1,1 s lặng đầu + 2 s lặng cuối → miệng gần như không nhép): giữ lặng ĐẦU (mốc câu), cắt lặng đuôi —
// dài = hết câu cuối + 0,2 s, tối thiểu 2 s (sàn Kie). Độ dài từng câu đọc bằng ffprobe.
const daiCau = (u: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', u], { encoding: 'utf8' }).trim());
const daiGiong = guiGiong ? Math.min(15, Math.max(2, ...cauAm.map((c) => c.t + daiCau(c.url) + 0.2))) : 0;
if (guiGiong) { const f = `/tmp/seedance-giong-${ids.join('-')}.mp3`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...cauAm.flatMap((c) => ['-i', c.url]), '-filter_complex', `${cauAm.map((c, i) => `[${i}:a]aresample=48000,adelay=${Math.round(c.t * 1000)}|${Math.round(c.t * 1000)}[a${i}]`).join(';')};${cauAm.map((_, i) => `[a${i}]`).join('')}amix=inputs=${cauAm.length}:normalize=0,apad=whole_dur=${daiGiong.toFixed(2)},atrim=0:${daiGiong.toFixed(2)}[o]`, '-map', '[o]', '-ac', '2', '-b:a', '192k', f]);
  urlGiong = await uploadToR2(`xuong-video/am/thoai/seedance-${ids.join('-')}-${randomUUID()}.mp3`, readFileSync(f), 'audio/mpeg'); if (!urlGiong) { console.error('đẩy file giọng hỏng'); process.exit(1); } }
if (!urlVideo) { console.error('đẩy clip 3D nối lên kho hỏng'); process.exit(1); }
const job = await taoJob(db, { canh_id: ids[0], loai: 'video', provider: 'kie', model: `kie:${model}`, request: { thu: 'seedance-cum', cum: ids, prompt, anh, video: urlVideo, giong: urlGiong, dpg }, cents });
const r = await fetch('https://api.kie.ai/api/v1/jobs/createTask', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model, input: { prompt, reference_image_urls: anh, reference_video_urls: [urlVideo], ...(urlGiong ? { reference_audio_urls: [urlGiong] } : {}), resolution: dpg, aspect_ratio: cum[0]!.canh && bcs[0]!.kt.ti_le === '9:16' ? '9:16' : '16:9', duration: giayRa, generate_audio: !!urlGiong } }) });
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
  const cat = clip1 ? [] : catThat(f, cum.length, dai); const v = clip1 ? { vao: [clip1.vao], theoDo: true, ngan: [] as number[] } : vaoTuCatThat(cum.map((x) => x.canh), cat, dai);
  const url = await uploadToR2(`xuong-video/clip/cum-${ids.join('-')}-${randomUUID()}.mp4`, buf, 'video/mp4');
  if (!url) { await xongJob(db, job, { loi: 'đẩy kho hỏng' }); process.exit(1); }
  await xongJob(db, job, { output_url: url, chi_phi_cents: cents });
  // LUẬT CHẤM SAU KHI SINH (anh 14/11/2026 — phát sinh nào cũng vào luật): model chia giờ sai (cụm #2–7 lần 2: #3 giữ 2,3 s, #4 còn 0,84 s < 2 s phát) → đoạn
  // của shot ngắn hơn giây phát thì phát lố sang shot kế. Shot thiếu giờ (vaoTuCatThat › ngan) hoặc clip không đo đủ cú cắt → KHÔNG gắn, gỡ clip cũ của shot
  // đó (video_url NULL) để kế hoạch cụm lần sau tự đưa vào sinh lại (cum-seedance.mts).
  const hong = new Set(v.theoDo ? v.ngan : cum.map((x) => x.canh.thu_tu));
  for (const [i, x] of cum.entries()) {
    if (hong.has(x.canh.thu_tu)) { await db.execute(sql`UPDATE xv_canh SET video_url = NULL, loi = ${v.theoDo ? `cụm Seedance job ${job}: đoạn của shot ngắn hơn giây phát — sinh lại` : `cụm Seedance job ${job}: không đo đủ cú cắt`}, updated_at = now() WHERE id = ${x.canh.id}`); continue; }
    await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, nguon_video = ${JSON.stringify({ model: `kie:${model}`, prompt, job, cum: ids, khung_dau: x.canh.keyframe_url, ...(urlGiong && cauAm.some((c) => c.so === i + 1) ? { khop_moi: { cach: 'seedance_audio', giong: urlGiong } } : {}) })}::jsonb, trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${x.canh.id}`);
    await db.execute(sql`UPDATE xv_canh SET ky_thuat = jsonb_set(coalesce(ky_thuat, '{}'::jsonb), '{vao_s}', ${JSON.stringify(v.vao[i])}::jsonb) WHERE id = ${x.canh.id}`);
  }
  if (hong.size) console.log(`✗ KHÔNG GẮN (thiếu giờ / không đo đủ cú cắt): #${[...hong].join(' #')} — vào lượt sinh sau`);
  console.log(`xong ${Math.round((Date.now() - t0) / 1000)}s · ${url} · dài ${dai.toFixed(2)} s · cú cắt đo ${cat.map((c) => c.toFixed(2)).join(', ') || 'không thấy'} · ${v.theoDo ? 'điểm vào theo cú cắt đo' : 'điểm vào theo lịch (không đo đủ cú cắt)'} · vào ${v.vao.map((x) => x.toFixed(2)).join(', ')} · ~${cents.toFixed(1)}¢`);
  process.exit(0);
}
