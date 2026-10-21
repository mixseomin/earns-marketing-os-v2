// PHỦ AI lên bản render 3D thuần (anh 21/10/2026: "sinh thử cái cảnh kia xem đc ko") — ảnh render Blender = khung bố cục (máy, chỗ đứng, số con,
// ánh sáng), mô hình ảnh vẽ lại thành still phim hoạt hình chi tiết. Một ảnh / lần, ~0,4¢ (ckey Nano Banana Pro) — dưới ngưỡng tự chạy $0,01.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-3d/phu-ai.mts --anh=<tệp.png>[,<tệp 2>] --loi=<tệp prompt.txt> [--model=…]
import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../../src/lib/r2';
import { taoJob, type Row } from '../../src/lib/xuong-video/doc-db';
import { dayViecAnh } from '../../src/lib/xuong-video/hoan-tat';

const val = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3);
const tep = val('anh').split(',').filter(Boolean); if (!tep.length) { console.error('thiếu --anh=<tệp>'); process.exit(1); }
const prompt = (await readFile(val('loi'), 'utf8')).trim();
const MODEL = val('model') || 'ckey:wowztools/nano-banana-pro';
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const ref: string[] = [];
for (const f of tep) {
  const u = await uploadToR2(`xuong-video/thu-3d/${Date.now()}-${f.split('/').pop()}`, await readFile(f), f.endsWith('.png') ? 'image/png' : 'image/jpeg');
  if (!u) { console.error('không tải lên R2 được', f); process.exit(1); } ref.push(u);
}
const job = await taoJob(db, { nhan: 'Thử 3D thuần → phủ AI (hang khủng long)', loai: 'anh', provider: MODEL.split(':')[0]!, model: MODEL, request: { prompt, ref, dich: 'thu_3d' } });
await dayViecAnh({ job, model: MODEL, prompt, thamChieuUrl: ref, tiLe: '9:16', thuMuc: 'thu-3d' });
const t0 = Date.now(); let j: Row | undefined;
while (Date.now() - t0 < 5 * 60_000) {
  j = (await q(sql`SELECT trang_thai, loi, output_url, chi_phi_cents, provider FROM xv_job WHERE id = ${job}`))[0];
  if (j && j.trang_thai !== 'cho') break;
  await new Promise((ok) => setTimeout(ok, 4000));
}
console.log(JSON.stringify({ job, ref, trang_thai: j?.trang_thai, url: j?.output_url, cents: Number(j?.chi_phi_cents ?? 0), provider: j?.provider, loi: j?.loi || undefined }));
process.exit(0);
