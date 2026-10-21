// ẢNH TOÀN THÂN DÁNG CHỮ A cho máy ảnh→3D (gan-rig.py): tay buông sát người thì mesh sinh ra liền tay với thân, gắn rig xong giơ tay kéo theo cả vạt
// áo (21/10/2026, Lâm Hạ). Chuẩn ngành (Mixamo, AccuRig, Tripo): mẫu rig dựng từ dáng chữ A / T. Tham chiếu = ảnh mẫu nhân vật; job KHÔNG gắn
// nhan_vat_id nên ảnh chỉ nằm ở job (output_url), không chen vào anh_ref của nhân vật. TỐN ~0,4¢ / ảnh (ckey Nano Banana Pro).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set/nguoi-3d/sinh-dang-a.mts --nv=379 [--sau]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { taoJob, mapNhanVat, type Row } from '../../../src/lib/xuong-video/doc-db';
import { dayViecAnh } from '../../../src/lib/xuong-video/hoan-tat';

const val = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const nvId = Number(val('nv')); if (!nvId) { console.error('thiếu --nv=<id>'); process.exit(1); }
const MODEL = val('model') || 'ckey:wowztools/nano-banana-pro';
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const nv = mapNhanVat((await q(sql`SELECT * FROM xv_nhan_vat WHERE id = ${nvId}`))[0]!);
const sau = process.argv.includes('--sau');
const prompt = `Full-body character turnaround reference of the SAME person in the reference images (identical face, hair, outfit, shoes). ${sau ? 'BACK view, seen from directly behind' : 'FRONT view, facing the camera'}, `
  + 'standing in a neutral A-pose: arms straight and held about 30 degrees away from the body, a clear gap between each arm and the torso, palms facing the thighs, fingers relaxed and slightly apart, '
  + 'legs straight and about shoulder width apart with a gap between them, feet flat. Orthographic-looking straight-on camera at chest height, whole body from head to toe in frame with margin, '
  + 'plain flat light-grey seamless studio background, soft even lighting, no cast shadow, no text, no labels, no props. Photorealistic.';
const job = await taoJob(db, { nhan: `Dáng chữ A ${sau ? 'sau' : 'trước'} · ${nv.ten} (ảnh→3D)`, loai: 'anh', provider: MODEL.split(':')[0]!, model: MODEL, request: { prompt, dich: 'dang_a' } });
await dayViecAnh({ job, model: MODEL, prompt, thamChieuUrl: nv.anh_ref.slice(0, 3), tiLe: '1:1', thuMuc: `nguoi-3d/${nvId}` });
const t0 = Date.now(); let j: Row | undefined;
while (Date.now() - t0 < 5 * 60_000) {
  j = (await q(sql`SELECT trang_thai, loi, output_url, chi_phi_cents, provider FROM xv_job WHERE id = ${job}`))[0];
  if (j && j.trang_thai !== 'cho') break;
  await new Promise((ok) => setTimeout(ok, 4000));
}
console.log(JSON.stringify({ job, trang_thai: j?.trang_thai, url: j?.output_url, cents: Number(j?.chi_phi_cents ?? 0), provider: j?.provider, loi: j?.loi || undefined }));
process.exit(0);
