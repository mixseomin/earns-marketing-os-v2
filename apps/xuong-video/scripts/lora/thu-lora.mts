// THỬ LoRA một nhân vật: ảnh đa dạng (biểu cảm / góc / hướng nhìn / vị trí) bằng fal flux-lora + ảnh theo ĐỘ SÂU 3D của shot thật bằng fal flux-lora-depth.
// TỐN TIỀN (~$0,035 / ảnh) — chỉ chạy với DUYET_SINH_1_LAN=1. In bảng URL để soát bằng mắt.
//   cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/lora/thu-lora.mts <nhan_vat_id> [--canh=<id,…>] [--mat=<sau-khoc_tham.png,…>]
// --mat: độ sâu MẶT 3D đã diễn biểu cảm (MPFB + 52 cơ mặt ARKit, tên tệp sau-<key BIEU_CAM>.png) → ảnh theo đúng nét mặt đó.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapNhanVat, mapCanh, taoJob, xongJob, type Row } from '../../src/lib/xuong-video/doc-db';
import { chayAnhFal } from '../../src/lib/xuong-video/fal';
import { readFileSync } from 'node:fs';
import { uploadToR2 } from '../../src/lib/r2';
import { BIEU_CAM } from '../../src/lib/xuong-video/qc-cam-xuc';

const id = Number(process.argv[2]); const canhIds = (process.argv.find((a) => a.startsWith('--canh=')) ?? '--canh=').slice(7).split(',').filter(Boolean).map(Number);
if (process.env.DUYET_SINH_1_LAN !== '1') { console.error('TỐN TIỀN — chỉ chạy với DUYET_SINH_1_LAN=1'); process.exit(1); }
const db = getDb()!;
const nv = mapNhanVat(((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE id = ${id}`)) as unknown as Row[])[0]!);
if (!nv.lora?.url) { console.error('nhân vật chưa có LoRA (scripts/lora/hoc-lora.mts)'); process.exit(1); }
const L = nv.lora; const loras = [{ path: L.url, scale: 1 }];
const goc = `${L.trigger}, ${nv.mo_ta}`;
const PHONG = 'Cinematic live-action film still, photorealistic, natural skin texture, 35mm film look, shallow depth of field. No text.';
const THU = [
  'close-up, crying silently, tears on her cheeks, looking down, soft window light, office background',
  'medium shot, laughing warmly, three-quarter view looking to the right, sunny cafe',
  'close-up, cold determined stare straight into the camera, dramatic side light, dark boardroom',
  'full-body shot, walking toward the camera in a white power suit, modern lobby, small in frame on the left third',
  'medium shot from behind over her shoulder, she looks back at the camera with a faint smirk, city street at dusk',
  'close-up, surprised, eyebrows raised, looking up and to the left, elevator lobby',
  'medium-wide shot, sitting at a desk, looking out the window in profile, rainy afternoon',
  'close-up from a low angle, angry, jaw clenched, looking down at someone off screen, night office',
];
// BỘ CẢM XÚC MẠNH (--bo=manh, anh 18/10/2026: "phải diễn được khóc thảm thiết, cười trong đau đớn tột cùng mới đi vào cảm xúc người xem"):
// tả cụ thể cơ mặt / nước mắt / thân thể — chữ chung chung ("crying") thì FLUX ra cau mày; LoRA 0,85 cho mặt được phép biến dạng theo cảm xúc.
const MANH = [
  'tight close-up, sobbing uncontrollably, face crumpled and contorted in anguish, mouth open in a choked wail, tears streaming down both cheeks, red swollen eyes, chin trembling, one hand pressed hard against her chest, harsh overhead light, empty office at night',
  'medium close-up, kneeling on a wet street at night, screaming in grief with her head tilted back, mouth wide open, rain and tears running down her face, soaked hair stuck to her cheeks, streetlight from above',
  'close-up, laughing hysterically through tears, a broken desperate laugh, eyes squeezed shut, tears pouring, eyebrows knitted together in pain, shoulders shaking, dim bedroom lamp light',
  'medium shot, sitting on the floor against a wall, hugging her knees, crying with her face half buried in her arms, shoulders heaving, one red tear-filled eye visible, cold blue moonlight',
  'close-up, forcing a trembling smile while tears pour down, lips quivering, eyes glassy and red, on the edge of breaking down, warm window light',
  'extreme close-up of her eyes and cheek, a single heavy tear rolling down, lower lip bitten hard to hold back a sob, very shallow depth of field',
];
const manh = process.argv.includes('--bo=manh');
const ra: { loai: string; url: string; mo: string }[] = [];
const ve = async (nhan: string, mh: string, input: Record<string, unknown>, mo: string) => {
  const job = await taoJob(db, { nhan: `LoRA · thử ${nv.ten} · ${nhan}`, nhan_vat_id: id, loai: 'anh', provider: 'fal', model: `fal:${mh}`, request: input });
  const kq = await chayAnhFal(mh, input);
  if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); console.log(`✗ ${nhan}: ${kq.loi.slice(0, 120)}`); return; }
  const url = await uploadToR2(`xuong-video/lora/${id}/thu-${Date.now()}.jpg`, kq.data, kq.mimeType);
  await xongJob(db, job, { output_url: url ?? undefined, chi_phi_cents: 3.5 });
  if (url) { ra.push({ loai: nhan, url, mo }); console.log(`· ${nhan} ${url}`); }
};
for (const [i, t] of (manh ? MANH : THU).entries()) await ve(`${manh ? 'cảm xúc mạnh' : 'đa dạng'} ${i + 1}`, 'fal-ai/flux-lora', { prompt: `${goc}. ${t}. ${PHONG}`, loras: manh ? [{ path: L.url, scale: 0.85 }] : loras, image_size: { width: 768, height: 1024 }, num_images: 1, output_format: 'jpeg', enable_safety_checker: false, ...(manh ? { guidance_scale: 4.5 } : {}) }, t);
for (const cid of canhIds) {
  const c = mapCanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE id = ${cid}`)) as unknown as Row[])[0]!);
  const sau = c.khung_xam?.sau; if (!sau) { console.log(`✗ #${c.thu_tu}: chưa có độ sâu`); continue; }
  await ve(`độ sâu #${c.thu_tu}`, 'fal-ai/flux-lora-depth', { prompt: `${goc}. ${c.dan_dung?.mo ?? ''}. ${PHONG}`, image_url: sau, loras, image_size: { width: 768, height: 1365 }, num_images: 1, output_format: 'jpeg', enable_safety_checker: false }, `#${c.thu_tu} ${c.dan_dung?.mo ?? ''}`);
}
const mats = (process.argv.find((a) => a.startsWith('--mat=')) ?? '--mat=').slice(6).split(',').filter(Boolean);
for (const f of mats) {
  const key = /sau-(\w+)\.png$/.exec(f)?.[1] ?? ''; const bc = BIEU_CAM.find((b) => b.key === key);
  if (!bc) { console.log(`✗ ${f}: tên tệp không khớp key BIEU_CAM`); continue; }
  const sau = await uploadToR2(`xuong-video/lora/${id}/mat-${key}-${Date.now()}.png`, readFileSync(f), 'image/png');
  if (!sau) { console.log(`✗ ${key}: tải độ sâu lỗi`); continue; }
  const t = `tight close-up portrait, ${bc.en}, harsh window side light, dim office background`;
  await ve(`mặt 3D ${bc.ten}`, 'fal-ai/flux-lora-depth', { prompt: `${goc}. ${t}. ${PHONG}`, image_url: sau, loras: [{ path: L.url, scale: 0.85 }], image_size: { width: 720, height: 1280 }, num_images: 1, output_format: 'jpeg', enable_safety_checker: false }, `${bc.ten} (độ sâu ${sau})`);
}
console.log(JSON.stringify({ so: ra.length, tien: `$${(ra.length * 0.035).toFixed(2)}` }));
process.exit(0);
