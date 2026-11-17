// KEYFRAME QWEN TRÊN MÁY THUÊ — đầu vào + nạp kết quả (anh 17/11/2026, keyframe-qwen.ts). 0đ (tiền máy trả ở may-h3.sh).
//   --vao --tap=<id> --chi=<thứ tự,…> [--so-ban=3]   → in JSON [{ ten, vao }]: vao.json cho scripts/h3/chay-anh.py (câu lệnh Qwen dựng từ khối keyframe của studio)
//   --nap --canh=<id> --tep=<a.png,b.png,…>          → đẩy kho, thêm vào ứng viên keyframe (keyframe_uv) của shot; shot chưa có keyframe thì lấy bản đầu
// Lô đầy đủ trên iMac: bash scripts/h3/keyframe-qwen.sh <tap_id> <thứ tự,…>   (dựng vào → may-h3.sh XV_MO_HINH=qwen-edit → nạp)
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/keyframe-qwen.mts …
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boiCanhCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { chuanBiKeyframe } from '../src/lib/xuong-video/sinh-anh';
import { promptQwen } from '../src/lib/xuong-video/keyframe-qwen';
import { uploadToR2 } from '../src/lib/r2';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const db = getDb()!;
if (process.argv.includes('--vao')) {
  const tap = Number(arg('tap')); const chi = arg('chi').split(',').map(Number).filter(Boolean); const soBan = Number(arg('so-ban')) || 3;
  const ds = (await db.execute(sql`SELECT id, thu_tu FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as Row[];
  const ra: { ten: string; canh: number; vao: unknown }[] = [];
  for (const c of ds.filter((x) => !chi.length || chi.includes(Number(x.thu_tu)))) {
    const bc = await boiCanhCanh(db, Number(c.id)); if (!bc) continue;
    const kb = chuanBiKeyframe(bc);
    if (!bc.canh.khung_xam?.mau && !kb.vai[0]?.nhan.includes('3D')) { console.error(`#${c.thu_tu}: chưa có khung 3D — Qwen cần ảnh bố cục`); continue; }
    const q = promptQwen({ khoi: kb.khoi?.mot_buoc ?? [], vai: kb.vai });
    ra.push({ ten: `kf-${c.id}`, canh: Number(c.id), vao: { prompt: q.prompt, anh: q.anh, seed: Number(c.id), so_ban: soBan, buoc: 4 } });
  }
  console.log(JSON.stringify(ra));
} else if (process.argv.includes('--nap')) {
  const canh = Number(arg('canh')); const teps = arg('tep').split(',').filter((t) => t && existsSync(t));
  if (!canh || !teps.length) { console.error('cần --canh=<id> --tep=<png,…> có thật'); process.exit(1); }
  const urls: string[] = [];
  for (const [k, t] of teps.entries()) { const u = await uploadToR2(`xuong-video/keyframe/${canh}-qwen-b${k + 1}-${randomUUID()}.png`, readFileSync(t), 'image/png'); if (u) urls.push(u); }
  if (!urls.length) { console.error('đẩy kho hỏng'); process.exit(1); }
  await chupTruoc(db, { bang: 'xv_canh', id: canh, cot: ['keyframe_url', 'keyframe_uv'], moTa: 'nạp keyframe Qwen máy thuê', nguoi: 'keyframe-qwen.mts' });
  await db.execute(sql`UPDATE xv_canh SET keyframe_uv = coalesce(keyframe_uv, '[]'::jsonb) || ${JSON.stringify(urls)}::jsonb, keyframe_url = coalesce(keyframe_url, ${urls[0]!}), updated_at = now() WHERE id = ${canh}`);
  console.log(JSON.stringify({ canh, urls }));
}
process.exit(0);
