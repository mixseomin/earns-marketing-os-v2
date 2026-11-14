// THỬ MỘT SHOT bằng Seedance 2.0 (Fast) REFERENCE-TO-VIDEO qua Kie.ai — đường ngành phim ngắn AI dùng (14/11/2026, sổ so sánh docs/so-sanh-mo-hinh-3d-video.md):
//   ảnh tham chiếu = keyframe đã duyệt (@Image1) + tờ chân dung từng nhân vật có trong shot (anh_ref[0]) · video tham chiếu = clip 3D three.js của shot (@Video1,
//   chỉ lấy chuyển động / máy / chỗ đứng) · prompt = các khối prompt video chuẩn của studio, bỏ khối vị trí (clip đã mang).
// Kie: POST /api/v1/jobs/createTask {model:'bytedance/seedance-2-fast'} · GET /api/v1/jobs/recordInfo · có video vào thì tính tiền (giây vào + giây ra).
// Gắn clip vào shot (video_url + nguon_video), điểm vào = đoạn dư đầu clip 3D (câu lệnh riêng — trigger 0328). Ghi xv_job để vào sổ tiền.
//   cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-seedance-kie.mts --canh=9216 [--dpg=480p] [--model=bytedance/seedance-2-fast] [--xem]
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boiCanhCanh, taoJob, xongJob } from '../src/lib/xuong-video/doc-db';
import { khoiVideoCanh } from '../src/lib/xuong-video/sinh-video';
import { ghep } from '../src/lib/xuong-video/prompt-khoi';
import { uploadToR2 } from '../src/lib/r2';
import { loiPromptGui, loiClipThamChieu } from '../src/lib/xuong-video/chan-gui-video';
import { dangChongBau } from '../src/lib/xuong-video/bo-set-3d';

const arg = (k: string, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const canhId = Number(arg('canh')); const dpg = arg('dpg', '480p') as '480p' | '720p'; const model = arg('model', 'bytedance/seedance-2-fast');
const xem = process.argv.includes('--xem');
const key = process.env.KIE_API_KEY; if (!key) { console.error('thiếu KIE_API_KEY'); process.exit(1); }
const db = getDb()!; const bc = await boiCanhCanh(db, canhId); if (!bc) { console.error('không thấy shot'); process.exit(1); }
const kx = bc.canh.khung_xam; const clip = kx?.clip && kx.clip.ma === kx.ma ? kx.clip : null;
if (!clip || !bc.canh.keyframe_url) { console.error('shot thiếu clip 3D còn mới hoặc keyframe'); process.exit(1); }

const nguoi = bc.nhanVat.filter((v) => v.loai === 'nhan_vat' && bc.canh.nhan_vat.includes(v.id) && v.anh_ref?.[0]);
const anh = [bc.canh.keyframe_url, ...nguoi.map((v) => v.anh_ref[0]!)];
const goi = nguoi.map((v, i) => `@Image${i + 2} is the character sheet of ${v.ten === 'Chú' ? 'the man' : v.ten === 'Nhóc' ? 'the boy' : v.ten}: keep exactly that face, hair and outfit.`).join(' ');
const than = ghep(khoiVideoCanh(bc).filter((k) => k.ma !== 'huong'));
const prompt = `@Image1 is the exact look of this shot: same drawing style, set, light, colours, framing and the same people in the same clothes. ${goi} @Video1 is a rough grey 3D blockout of this same shot: copy ONLY its camera, timing, where everyone stands and how they move — never its grey mannequin look. ${than}`;
const giayRa = 5;   // Kie nhận 4–15 s; 5 s đủ phủ clip 3D (4 s) + điểm vào
console.log(`shot #${bc.canh.thu_tu} · ${model} ${dpg} · ảnh ${anh.length} · video ${clip.url} · prompt ${prompt.length} ký tự`);
// LUẬT CHẤM TRƯỚC KHI GỬI (chan-gui-video.ts — anh 14/11/2026): lỗi nào cũng chặn, không tốn tiền
const loiGui = [...loiPromptGui(prompt, { tiLe: bc.kt.ti_le, tenNhanVat: bc.nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten) }), ...loiClipThamChieu([{ so: bc.canh.thu_tu, clip }]), ...(dangChongBau([bc.canh])[bc.canh.id] ?? [])];
if (loiGui.length) { console.error(`✗ CHẶN trước khi gửi (${loiGui.length} lỗi):\n  - ${loiGui.join('\n  - ')}`); process.exit(3); }
if (xem) { console.log(prompt); console.log(anh.join('\n')); process.exit(0); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1 ngay sau khi anh duyệt lượt này'); process.exit(2); }

const giaGiay = dpg === '720p' ? 7.5 : 3.4;   // ¢/giây có video vào (kie.ai/seedance-2-0, 14/11/2026) — tính cả giây vào lẫn giây ra
const cents = giaGiay * (4 + giayRa);
const job = await taoJob(db, { canh_id: canhId, loai: 'video', provider: 'kie', model: `kie:${model}`, request: { thu: 'seedance-ref', prompt, anh, video: clip.url, dpg, vaoNguon: clip.vao }, cents });
const r = await fetch('https://api.kie.ai/api/v1/jobs/createTask', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model, input: { prompt, reference_image_urls: anh, reference_video_urls: [clip.url], resolution: dpg, aspect_ratio: bc.kt.ti_le === '9:16' ? '9:16' : '16:9', duration: giayRa, generate_audio: false } }) });
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
  const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
  const url = await uploadToR2(`xuong-video/clip/${canhId}-${randomUUID()}.mp4`, buf, 'video/mp4');
  if (!url) { await xongJob(db, job, { loi: 'đẩy kho hỏng' }); process.exit(1); }
  await xongJob(db, job, { output_url: url, chi_phi_cents: cents });
  await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, nguon_video = ${JSON.stringify({ model: `kie:${model}`, prompt, job, khung_dau: bc.canh.keyframe_url })}::jsonb, trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${canhId}`);
  await db.execute(sql`UPDATE xv_canh SET ky_thuat = jsonb_set(coalesce(ky_thuat, '{}'::jsonb), '{vao_s}', ${JSON.stringify(clip.vao)}::jsonb) WHERE id = ${canhId}`);
  console.log(`xong ${Math.round((Date.now() - t0) / 1000)}s · ${url} · ~${cents.toFixed(1)}¢`);
  process.exit(0);
}
