// THỬ LoRA một nhân vật: ảnh đa dạng (biểu cảm / góc / hướng nhìn / vị trí) bằng fal flux-lora + ảnh theo ĐỘ SÂU 3D của shot thật bằng fal flux-lora-depth.
// TỐN TIỀN (~$0,035 / ảnh) — chỉ chạy với DUYET_SINH_1_LAN=1. In bảng URL để soát bằng mắt.
//   cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/lora/thu-lora.mts <nhan_vat_id> [--canh=<id,…>]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapNhanVat, mapCanh, taoJob, xongJob, type Row } from '../../src/lib/xuong-video/doc-db';
import { chayAnhFal } from '../../src/lib/xuong-video/fal';
import { uploadToR2 } from '../../src/lib/r2';

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
const ra: { loai: string; url: string; mo: string }[] = [];
const ve = async (nhan: string, mh: string, input: Record<string, unknown>, mo: string) => {
  const job = await taoJob(db, { nhan: `LoRA · thử ${nv.ten} · ${nhan}`, nhan_vat_id: id, loai: 'anh', provider: 'fal', model: `fal:${mh}`, request: input });
  const kq = await chayAnhFal(mh, input);
  if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); console.log(`✗ ${nhan}: ${kq.loi.slice(0, 120)}`); return; }
  const url = await uploadToR2(`xuong-video/lora/${id}/thu-${Date.now()}.jpg`, kq.data, kq.mimeType);
  await xongJob(db, job, { output_url: url ?? undefined, chi_phi_cents: 3.5 });
  if (url) { ra.push({ loai: nhan, url, mo }); console.log(`· ${nhan} ${url}`); }
};
for (const [i, t] of THU.entries()) await ve(`đa dạng ${i + 1}`, 'fal-ai/flux-lora', { prompt: `${goc}. ${t}. ${PHONG}`, loras, image_size: { width: 768, height: 1024 }, num_images: 1, output_format: 'jpeg', enable_safety_checker: false }, t);
for (const cid of canhIds) {
  const c = mapCanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE id = ${cid}`)) as unknown as Row[])[0]!);
  const sau = c.khung_xam?.sau; if (!sau) { console.log(`✗ #${c.thu_tu}: chưa có độ sâu`); continue; }
  await ve(`độ sâu #${c.thu_tu}`, 'fal-ai/flux-lora-depth', { prompt: `${goc}. ${c.dan_dung?.mo ?? ''}. ${PHONG}`, image_url: sau, loras, image_size: { width: 768, height: 1365 }, num_images: 1, output_format: 'jpeg', enable_safety_checker: false }, `#${c.thu_tu} ${c.dan_dung?.mo ?? ''}`);
}
console.log(JSON.stringify({ so: ra.length, tien: `$${(ra.length * 0.035).toFixed(2)}` }));
process.exit(0);
