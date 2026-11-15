// THỬ MỘT CỤM SHOT bằng Seedance 2.0 (Fast) REFERENCE-TO-VIDEO qua Kie.ai — một lần sinh nhiều shot liền nhau (≤ 15 s), anh 14/11/2026 "Seedance sinh 15s
// 1 lần thì gom các shot vào chung" (sổ so sánh docs/so-sanh-mo-hinh-3d-video.md). Khung cụm của studio: thamChieuCum (ảnh người + bối cảnh), promptCumMoi
// (prompt nhiều shot), catThat + vaoTuCatThat (đo cú cắt trên clip ra → điểm vào từng shot).
//   video tham chiếu = clip 3D NỐI của cả cụm (mỗi shot cắt đúng đoạn phát) — dựng trên iMac (cấm mã hoá trên box3), chép lên box rồi truyền --video-file.
//   ảnh tham chiếu = người + bối cảnh (thamChieuCum) + keyframe từng shot, ≤ 9 ảnh (trần Kie).
// Gắn: mọi shot trỏ cùng clip cụm, ky_thuat.vao_s = điểm vào đo được (câu lệnh riêng sau khi đổi clip — trigger 0328).
//   cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-seedance-cum.mts \
//     --canh=9213,9198,9199 --video-file=/tmp/cum-3d.mp4 [--dpg=480p] [--xem]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boiCanhCanh, taoJob, xongJob } from '../src/lib/xuong-video/doc-db';
import { promptCumMoi, thamChieuCum, vaoTuCatThat, cauNgoaiCua, giayClipSeedance, kepVaoDoan } from '../src/lib/xuong-video/cum-shot';
import { catThat } from '../src/lib/xuong-video/cat-that';
import { giayPhat, chatLieuPhim, clip3dMoi } from '../src/lib/xuong-video/kieu';
import { chonCachKhopMoi } from '../src/lib/xuong-video/khop-moi-cach';
import { nhanNhin } from '../src/lib/xuong-video/prompt-khoi';
import { duongAmLuong, khopTheoTiengClip, doanShot } from '../src/lib/xuong-video/can-giong';
import { uploadToR2 } from '../src/lib/r2';
import { loiPromptGui, loiClipThamChieu, loiThoaiPrompt, loiShotPrompt, loiAnhCum, loiThoaiCuoiCum, loiVideoThamChieu } from '../src/lib/xuong-video/chan-gui-video';
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
// MỘT SHOT NGẮN HƠN 4 s (sàn thời lượng Seedance, anh 15/11/2026): gửi NGUYÊN clip 3D của shot (có đoạn dư đầu / cuối clip.vao / clip.ra) — clip ra có phần đệm hai
// đầu để cắt, điểm vào = clip.vao. Không cần clip nối từ iMac. Nhiều shot → clip 3D nối của cụm (--video-file, cum-seedance-tap.sh).
// LUẬT 15/11/2026 (#6 phim #3071): có --video-file thì LUÔN dùng clip đã cắt đúng đoạn phát (shot bắt đầu ở giây 0). Clip nguyên có đoạn dư đầu 1,65 s im lặng
// + đuôi trống → Seedance dồn câu thoại vào đuôi (tiếng ở 3,7–4,9 s, đoạn shot im). clip1 chỉ còn là đường dự phòng khi chạy tay không có tệp.
const clip1 = !fileVideo && cum.length === 1 && tong < 4 && clip3dMoi(cum[0]!.canh) ? cum[0]!.canh.khung_xam!.clip! : null;
if (!clip1 && !fileVideo) { console.error('cần --video-file=<clip 3D nối của cụm> (cụm nhiều shot / shot ≥ 4 s)'); process.exit(1); }
// KHỚP MÔI KHI SINH (khop-moi-cach.ts): cách 'seedance_audio' → gửi file giọng làm Audio 1, câu thoại đặt đúng mốc trong clip ra (mốc shot + trễ câu), kèm nguyên văn câu
const nguoiNoi = [...new Set(cum.flatMap((x) => (x.canh.thoai ?? []).filter((d) => d.url && d.loi?.trim()).map((d) => d.nhan_vat)))];
const cachKhop = nguoiNoi.length ? chonCachKhopMoi({ chatLieu: chatLieuPhim(bcs[0]!.kt), ngonNgu: bcs[0]!.kt.ngon_ngu, soNguoiNoi: nguoiNoi.length }) : null;
const nhanNoi = new Map(nhanNhin(nguoiNoi.map((t) => ({ ten: t, moTaNv: cum.flatMap((x) => x.nhanVat).find((v) => v.ten === t)?.mo_ta }))).map((x) => [x.ten, x.gon]));
let mocShot = clip1 ? clip1.vao : 0; const cauAm: { url: string; t: number; tre: number; ai: string; loi: string; so: number }[] = [];
for (const [i, x] of cum.entries()) { for (const d of x.canh.thoai ?? []) if (d.url && d.loi?.trim()) cauAm.push({ url: d.url, t: mocShot + (d.tre ?? 0), tre: d.tre ?? 0, ai: d.nhan_vat, loi: d.loi.trim(), so: i + 1 }); mocShot += giayPhat(x.canh); }
const guiGiong = cachKhop?.cach === 'seedance_audio' && cauAm.length > 0;
// ĐUÔI BÙ GIỜ NÓI (luật 15/11/2026): Seedance tự chọn lúc nói, thường trễ 0,4–0,8 s và đọc chậm hơn giọng (đo #4, #6) — cụm có thoại sinh thêm 2 s cuối để
// khớp thoại (khopTheoTiengClip) dời điểm vào trong đoạn của shot mà không lấn shot kế / hết clip. +2 s × $0,034.
// Đuôi tính từ CUỐI shot cuối TRONG clip (mocShot), không từ tổng giây phát: shot lẻ < 4 s lấy clip 3D đầy đủ, shot bắt đầu ở clip.vao (#6: vào 1,65 + 2 s = 3,65 —
// tính theo tổng 2 s ra clip 4 s, chỉ còn 0,45 s đuôi, miệng trễ 1,21 s không bù được; 15/11/2026).
// giây clip = cum-shot.ts › giayClipSeedance (MỘT nguồn với báo giá kế hoạch cụm); đuôi chỉ khi shot CUỐI có thoại gửi giọng
const giayRaGiong = giayClipSeedance(cum.map((x) => giayPhat(x.canh)), { vaoDau: clip1 ? clip1.vao : 0, cuoiCoThoai: guiGiong && cauAm.some((c) => c.so === cum.length) });

// ảnh: người + bối cảnh (thamChieuCum, ≤ 5) rồi keyframe từng shot (đúng nét vẽ / khung từng góc) — tổng ≤ 9
// ảnh khung MỌI shot vào trước, ảnh người + bối cảnh lấy phần còn lại (cụm C 5 shot: trước đây 5 + 4 khung, shot 5 có thoại mất khung — chan-gui-video.ts › loiAnhCum)
const tc = thamChieuCum(cum, Math.max(2, Math.min(5, 9 - cum.length)));
const kf = cum.map((x) => x.canh.keyframe_url!).slice(0, 9 - tc.anh.length);
const anh = [...tc.anh, ...kf];
const goiKf = kf.map((_, i) => `Reference image ${tc.anh.length + i + 1} is the exact look of shot ${i + 1} (its framing, drawing style and the people's clothes).`).join(' ');
// THỜI LƯỢNG NÓI THẬT (15/11/2026 #3071 #6): shot 2 s, clip 3D + giọng gửi đi 2 s mà câu lệnh ghi "Shot 1 (about 4 s)" (giãn cho đầy sàn 4 s của Seedance) —
// model rải diễn xuất + câu thoại ra 4 s, bản dựng chỉ cắt 2 s. Câu lệnh ghi giây phát thật; phần clip dư (sàn 4 s / đuôi bù miệng) = giữ dáng cuối, im.
// câu lệnh ghi giây phát THẬT (làm tròn 0,5 như promptCumMoi), không làm tròn lên số nguyên: #8 3,3 s trước ghi "about 4 s"
const giayNoi = Math.max(0.5, Math.round(tong * 2) / 2); const giayGui = giayRaGiong;
const cauDu = giayGui - giayNoi >= 1 ? ` The clip runs ${giayGui} s but the action above ends at about ${giayNoi} s: for the remaining time everyone just holds the final pose in the same framing — silent, mouths closed, no new action, no new line, no cut.` : '';
const than = promptCumMoi(cum, { tag: tc.tag, them: tc.them, tiLe: bcs[0]!.kt.ti_le });
// Câu thoại nói MỘT lần trong câu lệnh: câu shot (promptCumMoi) đã có "<người> says: <câu>" thì ở đây không nhắc lại — nhắc hai lần model nói hai lần (#6: tiếng
// ở 1,2 s và 2,6 s). Chỉ câu nào chưa có nguyên văn trong câu shot mới ghi thêm. Luật chặn: chan-gui-video.ts › loiThoaiPrompt.
const cauThieu = cauAm.filter((c) => !than.includes(c.loi.replace(/["“”]/g, '').replace(/[.\s]+$/, '')));
const cauGiong = guiGiong ? ` Audio 1 is the dialogue track: every spoken line above is exactly Audio 1, said once, at the moment Audio 1 has speech — lip-sync to Audio 1: while Audio 1 has speech the speaker clearly opens the mouth and the lips visibly form every syllable, loud and expressive; the mouth is closed when Audio 1 is silent.${cauThieu.map((c) => ` In shot ${c.so}, ${nhanNoi.get(c.ai) ?? 'the speaker'} speaks out loud and says: ${c.loi.replace(/["“”]/g, '')}.`).join('')}` : '';
const prompt = `${tc.goi}. ${goiKf} Reference video 1 is a rough grey 3D blockout of this whole ${cum.length}-shot sequence with hard cuts: copy ONLY its cuts, camera angles, timing, where everyone stands and how they move — never its grey mannequin look; every shot must look like its reference image. ${than} ${cauNgoaiCua(cum.map((x) => x.canh))}${cauDu}${cauGiong}`.trim();
console.log(`cụm ${cum.map((x) => `#${x.canh.thu_tu}`).join(' ')} · ${tong.toFixed(1)} s → clip ${giayGui} s · ${model} ${dpg} · ${anh.length} ảnh · prompt ${prompt.length} ký tự`);
// LUẬT CHẤM TRƯỚC KHI GỬI (chan-gui-video.ts — anh 14/11/2026): lỗi nào cũng chặn, không tốn tiền
const loiGui = [...loiPromptGui(prompt, { tiLe: bcs[0]!.kt.ti_le, tenNhanVat: [...new Set(cum.flatMap((x) => x.nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten)))] }),
  ...loiThoaiPrompt(prompt, cauAm.map((c) => c.loi)), ...loiShotPrompt(prompt), ...loiAnhCum(cum.length, kf.length), ...(guiGiong ? loiThoaiCuoiCum(cauAm.map((c) => c.so), cum.length) : []),
  ...loiClipThamChieu(cum.map((x) => ({ so: x.canh.thu_tu, clip: x.canh.khung_xam?.clip }))),
  ...Object.entries(dangChongBau(cum.map((x) => x.canh))).flatMap(([id, l]) => l.map((y) => `#${cum.find((x) => x.canh.id === Number(id))?.canh.thu_tu}: ${y}`))];
// THIẾU GIỌNG (luật 15/11/2026: #6 sinh không kèm giọng → miệng không theo câu): shot có câu thoại có file giọng mà lượt này không gửi giọng → chặn
if (cauAm.length && !guiGiong) loiGui.push(`cụm có thoại (${cauAm.map((c) => `#${cum[c.so - 1]!.canh.thu_tu}`).join(' ')}) mà không gửi giọng (cách khớp môi: ${cachKhop?.cach ?? '?'} — ${cachKhop?.vi ?? ''}) — tách cụm mỗi lần một người nói`);
// clip 3D gửi đi đo thật (tệp có sẵn): dưới sàn Seedance thì chặn, không gửi
const tepVao = clip1 ? clip1.url : fileVideo; if (tepVao && (clip1 || existsSync(fileVideo))) loiGui.push(...loiVideoThamChieu(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', tepVao], { encoding: 'utf8' }).trim())));
if (loiGui.length) { console.error(`✗ CHẶN trước khi gửi (${loiGui.length} lỗi):\n  - ${loiGui.join('\n  - ')}`); process.exit(3); }
// KHỚP THOẠI THEO TIẾNG CLIP (can-giong.ts › khopTheoTiengClip — luật chuẩn 15/11/2026, thay tương quan âm lượng + đo miệng bằng hình): điểm vào shot = lúc clip
// bắt đầu nói trong đoạn của shot − lúc câu bắt đầu nghe thấy trong shot. Clip không nói / nói lặp / không bù được → lỗi (shot không gắn, vào lượt sinh lại).
// PCM chỉ GIẢI MÃ âm (ffmpeg trên box, không mã hoá video).
// clip KHÔNG có rãnh tiếng (sinh trước luật gửi giọng, vd cụm #8–#10 phim #3071) → mảng rỗng → khớp thoại báo "không có tiếng nói", vào lượt sinh lại (trước: ffmpeg văng lỗi)
const coTieng = (u: string) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', u], { encoding: 'utf8' }).trim() !== '';
const pcm = (u: string) => { if (!coTieng(u)) return new Float32Array(0); const b = execFileSync('ffmpeg', ['-v', 'error', '-i', u, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { maxBuffer: 64 << 20 }); return duongAmLuong(new Int16Array(b.buffer, b.byteOffset, Math.floor(b.length / 2)), 8000); };
function khopThoai(fClip: string, vao: number[], doan: [number, number][]): { vao: number[]; toc: number[]; loi: (string | null)[]; bao: string } {
  if (!cauAm.length) return { vao, toc: vao.map(() => 1), loi: vao.map(() => null), bao: '' };
  const tieng = pcm(fClip); const kq = cum.map((x, i) => {
    const cau = cauAm.filter((c) => c.so === i + 1); if (!cau.length) return { vao: vao[i]!, toc: 1, loi: null, noi: null };
    return khopTheoTiengClip({ clip: tieng, doan: doan[i]!, phat: giayPhat(x.canh), cau: cau.map((c) => ({ giong: pcm(c.url), tre: c.tre })) });
  });
  return { vao: kq.map((r) => r.vao), toc: kq.map((r) => r.toc), loi: kq.map((r) => r.loi), bao: kq.map((r, i) => (cauAm.some((c) => c.so === i + 1) ? `#${cum[i]!.canh.thu_tu}: clip nói ${r.noi ? `${r.noi.bd}–${r.noi.kt} s` : '—'} → vào ${r.vao}${r.toc !== 1 ? ` · tốc ×${r.toc}` : ''}${r.loi ? ` ✗ ${r.loi}` : ''}` : '')).filter(Boolean).join(' · ') };
}
/** ky_thuat sau khớp thoại: điểm vào + tốc khớp (1 = bỏ khoá) — một câu UPDATE riêng sau khi gắn clip (trigger 0328 xoá vao_s khi đổi video_url). */
const ghiVaoToc = (id: number, vao: number, toc: number) => getDb()!.execute(sql`UPDATE xv_canh SET ky_thuat = (jsonb_set(coalesce(ky_thuat, '{}'::jsonb), '{vao_s}', ${JSON.stringify(vao)}::jsonb) - 'toc_khop') || ${JSON.stringify(toc !== 1 ? { toc_khop: toc } : {})}::jsonb WHERE id = ${id}`);

/** Bản ghi khớp thoại trong nguon_video.mieng (kế hoạch cụm cum-seedance.mts đọc dat). */
const ghiMieng = (dat: boolean, ly: string) => ({ mieng: { dat, ly, cach: 'tieng_clip', luc: new Date().toISOString() } });
// --chinh-giong: canh lại clip ĐANG gắn của cụm một shot (0đ, không sinh)
if (process.argv.includes('--chinh-giong')) {
  const x = cum[0]!.canh; if (cum.length !== 1 || !x.video_url) { console.error('--chinh-giong: một shot đã có clip'); process.exit(1); }
  const daiC = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', x.video_url], { encoding: 'utf8' }).trim());
  const c = khopThoai(x.video_url, [Number(x.ky_thuat?.vao_s ?? 0)], [(x.nguon_video as { doan?: [number, number] } | null)?.doan ?? [0, +(daiC - 0.45).toFixed(2)]]); console.log(c.bao || 'shot không có thoại');
  if (!c.bao) process.exit(0);
  await db.execute(sql`UPDATE xv_canh SET nguon_video = coalesce(nguon_video, '{}'::jsonb) || ${JSON.stringify(ghiMieng(!c.loi[0], c.bao))}::jsonb, loi = ${c.loi[0] ? `khớp thoại: ${c.loi[0]} — sinh lại` : ''} WHERE id = ${x.id}`);
  if (c.loi[0]) { console.error(`✗ ${c.loi[0]}`); process.exit(4); }
  await ghiVaoToc(x.id, c.vao[0]!, c.toc[0]!);
  process.exit(0);
}
if (xem) { console.log(prompt); console.log(anh.join('\n')); process.exit(0); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1 ngay sau khi anh duyệt lượt này'); process.exit(2); }

const giaVao = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip1 ? clip1.url : fileVideo], { encoding: 'utf8' }).trim());
const cents = (dpg === '720p' ? 7.5 : 3.4) * (giaVao + giayRaGiong);   // kie.ai/seedance-2-0 (14/11/2026): có video vào → tính giây vào + giây ra
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
  body: JSON.stringify({ model, input: { prompt, reference_image_urls: anh, reference_video_urls: [urlVideo], ...(urlGiong ? { reference_audio_urls: [urlGiong] } : {}), resolution: dpg, aspect_ratio: cum[0]!.canh && bcs[0]!.kt.ti_le === '9:16' ? '9:16' : '16:9', duration: giayRaGiong, generate_audio: !!urlGiong } }) });
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
  const doan = doanShot(v.vao, dai);   // đoạn theo cú cắt, lấy TRƯỚC khi canh giọng dời điểm vào
  const hong = new Map<number, string>((v.theoDo ? v.ngan : cum.map((x) => x.canh.thu_tu)).map((so) => [so, v.theoDo ? 'đoạn của shot ngắn hơn giây phát' : 'không đo đủ cú cắt']));
  let cg: ReturnType<typeof khopThoai> | null = null;
  if (urlGiong && v.theoDo) { cg = khopThoai(f, v.vao, doan); v.vao.splice(0, v.vao.length, ...cg.vao); console.log(`khớp thoại: ${cg.bao}`);
    cg.loi.forEach((l, i) => { if (l && !hong.has(cum[i]!.canh.thu_tu)) hong.set(cum[i]!.canh.thu_tu, l); }); }
  // MỌI shot (cả shot câm): điểm vào kẹp trong đoạn của nó, không lố sang hình shot kế (cum-shot.ts › kepVaoDoan, ca #2 phim #3071 16/11/2026)
  if (v.theoDo) cum.forEach((x, i) => { const k = kepVaoDoan(v.vao[i]!, doan[i]!, giayPhat(x.canh) * (cg?.toc[i] ?? 1));
    if (k == null) { if (!hong.has(x.canh.thu_tu)) hong.set(x.canh.thu_tu, `đoạn của shot ${doan[i]![0]}–${doan[i]![1]} s ngắn hơn giây dùng`); } else v.vao[i] = k; });
  for (const [i, x] of cum.entries()) {
    if (hong.has(x.canh.thu_tu)) { await db.execute(sql`UPDATE xv_canh SET video_url = NULL, loi = ${`cụm Seedance job ${job}: ${hong.get(x.canh.thu_tu)} — sinh lại`}, updated_at = now() WHERE id = ${x.canh.id}`); continue; }
    await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, nguon_video = ${JSON.stringify({ model: `kie:${model}`, prompt, job, cum: ids, khung_dau: x.canh.keyframe_url, doan: doan[i],   // đoạn của shot trong clip (cú cắt đo) — canh miệng không dời lấn sang shot kế
         ...(urlGiong && cauAm.some((c) => c.so === i + 1) ? { khop_moi: { cach: 'seedance_audio', giong: urlGiong }, ...ghiMieng(true, cg?.bao.split(' · ').find((b) => b.startsWith(`#${x.canh.thu_tu}:`)) ?? '') } : {}) })}::jsonb, trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${x.canh.id}`);
    await ghiVaoToc(x.canh.id, v.vao[i]!, cg?.toc[i] ?? 1);
  }
  if (hong.size) console.log(`✗ KHÔNG GẮN: ${[...hong].map(([so, l]) => `#${so} ${l}`).join(' · ')} — vào lượt sinh sau`);
  console.log(`xong ${Math.round((Date.now() - t0) / 1000)}s · ${url} · dài ${dai.toFixed(2)} s · cú cắt đo ${cat.map((c) => c.toFixed(2)).join(', ') || 'không thấy'} · ${v.theoDo ? 'điểm vào theo cú cắt đo' : 'điểm vào theo lịch (không đo đủ cú cắt)'} · vào ${v.vao.map((x) => x.toFixed(2)).join(', ')} · ~${cents.toFixed(1)}¢`);
  process.exit(0);
}
