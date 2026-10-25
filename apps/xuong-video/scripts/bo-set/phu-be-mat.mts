// PHỦ BỀ MẶT NGƯỜI THẬT lên clip 3D quay nhiều máy (anh 25/10/2026: "gửi video sinh từ 3D thô rồi AI hoàn thiện nốt phần bề mặt mà không làm đổi logic
// của nó trừ khi được yêu cầu"). Mỗi máy (cùng MỘT lần diễn — dung-set.py › may_them):
//   1. khung đầu 3D → khung người thật (sửa ảnh, giữ nguyên bố cục / chỗ đứng / tay / đồ — ảnh nhân vật làm mẫu ngoại hình)
//   2. Wan VACE (fal, depth): độ sâu + chuyển động TỪNG KHUNG lấy từ clip 3D, khung đầu người thật làm ngoại hình → logic (ai đứng đâu, tay nào cầm gì,
//      lúc nào đồ đổi tay) giữ nguyên; chỉ bề mặt (da, tóc, vải, ánh sáng) là của AI. Muốn đổi gì thì ghi trong --them (không ghi thì không đổi).
// Vào: /tmp/phu-<ten>/<may>.mp4 (clip 3D 16 khung/giây). Ra: R2 xuong-video/thu/… + in link từng máy. Tốn: ảnh ckey ~110₫ / máy + VACE $0,04/giây ở 480p.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/bo-set/phu-be-mat.mts --ten=giat-the --phim=353 --may=toan,can-tay,qua-vai,can-mat-ha [--do-phan-giai=480p] [--them="…"]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapNhanVat, kemBienThe, type Row } from '../../src/lib/xuong-video/doc-db';
import { sinhAnhMotCong } from '../../src/lib/xuong-video/cong-ai';
import { guiFal, docFal } from '../../src/lib/xuong-video/fal';
import { uploadToR2 } from '../../src/lib/r2';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const ten = gia('ten'), phim = Number(gia('phim')), dsMay = (gia('may') || '').split(',').filter(Boolean), dpg = gia('do-phan-giai') || '480p', them = gia('them') || '';
if (!ten || !phim || !dsMay.length) { console.error('cần --ten --phim --may'); process.exit(1); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1'); process.exit(2); }
const db = getDb()!; const thu = `/tmp/phu-${ten}`;
const VACE = 'fal-ai/wan-vace-14b/depth';
// ảnh mẫu người: ảnh mẫu đầu của mỗi nhân vật người trong phim (ngoại hình gốc — trạng thái đồ do clip 3D quyết)
const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phim} AND loai = 'nhan_vat' ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
const mau = nv.filter((v) => v.anh_ref[0]).map((v) => ({ ten: v.ten, mo_ta: v.mo_ta, anh: v.anh_ref[0]! }));
const giuLogic = 'Keep EXACTLY the camera angle, framing, every person\'s position, pose, gaze, hand positions, what each hand holds and every object\'s position and state — only the surfaces change.';
const len = async (f: string, k: string): Promise<string> => { const u = await uploadToR2(`xuong-video/thu/${ten}-${k}-${randomUUID()}${f.slice(f.lastIndexOf('.'))}`, readFileSync(f), f.endsWith('.mp4') ? 'video/mp4' : f.endsWith('.png') ? 'image/png' : 'image/jpeg'); if (!u) throw new Error(`không tải lên được ${f}`); return u; };

const ketQua: Record<string, string> = {};
await Promise.all(dsMay.map(async (m) => {
  const vid = `${thu}/${m}.mp4`; const k0 = `${thu}/${m}-dau.jpg`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', vid, '-frames:v', '1', '-q:v', '2', k0]);
  const giay = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', vid], { encoding: 'utf8' }).trim());
  const [uVid, uK0] = await Promise.all([len(vid, `${m}-3d`), len(k0, `${m}-3d-dau`)]);
  // 1. khung đầu người thật
  const pAnh = `Image 1 is a rough grey 3D blockout frame of a live-action vertical drama shot in a luxury corporate elevator lobby (dark marble walls, steel elevator doors, warm ceiling light). Turn it into a photorealistic film still. ${giuLogic} The people: ${mau.map((x, i) => `${x.ten} looks exactly like reference image ${i + 2} (face, hair, outfit)`).join('; ')}. ${them} No text, no captions.`;
  const a = await sinhAnhMotCong('ckey', 'wowztools/nano-banana-2', { prompt: pAnh, thamChieuUrl: [uK0, ...mau.map((x) => x.anh)], tiLe: '9:16' });
  if (!a.anh) { console.log(`${m}: khung đầu hỏng — ${a.loi}`); return; }
  writeFileSync(`${thu}/${m}-dau-that.png`, a.anh.data); const uDau = await len(`${thu}/${m}-dau-that.png`, `${m}-dau-that`);
  console.log(`${m}: khung đầu người thật ${uDau}`);
  // 2. VACE theo độ sâu clip 3D
  const g = await guiFal(VACE, { prompt: `Photorealistic live-action vertical short drama, luxury corporate elevator lobby. ${giuLogic} ${mau.map((x) => `${x.ten}: ${x.mo_ta.slice(0, 160)}`).join(' ')} ${them}`.slice(0, 1800),
    video_url: uVid, first_frame_url: uDau, ref_image_urls: [uDau, ...mau.map((x) => x.anh)].slice(0, 4), preprocess: true, num_frames: Math.max(17, Math.min(241, Math.round(giay * 16) + 1)),
    frames_per_second: 16, resolution: dpg, aspect_ratio: '9:16' });
  if (!g.ok) { console.log(`${m}: VACE từ chối — ${g.loi}`); return; }
  for (let i = 0; i < 180; i++) { await new Promise((r) => setTimeout(r, 10_000)); const d = await docFal(g.taskId);
    if (d.done && d.ok) { ketQua[m] = d.uri; writeFileSync(`${thu}/${m}-that.mp4`, Buffer.from(await (await fetch(d.uri)).arrayBuffer())); console.log(`${m}: xong ${d.uri}`); return; }
    if (d.done) { console.log(`${m}: VACE hỏng — ${d.loi}`); return; } }
  console.log(`${m}: quá 30 phút`);
}));
console.log(JSON.stringify(ketQua));
process.exit(0);
