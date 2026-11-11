// KEYFRAME = ẢNH TỪ CỔNG NGOÀI (anh 11/11/2026: "sinh lại key bằng Muse" — Muse của Meta không có API, ảnh lấy bằng trình duyệt rồi đưa vào đây).
// Một lệnh cho mọi nguồn ảnh không đi qua cổng sinh ảnh của studio: tải tệp lên R2 (xuong-video/keyframe/), gán làm keyframe mở của shot,
// thêm vào dải ứng viên, ghi một job (provider = --cong, model = --model, tiền = --vnd mỗi ảnh, mặc định 0) và chụp hoàn tác như nút chọn keyframe.
// Ảnh cũ vẫn nằm trong dải ứng viên.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/keyframe-tu-tep.mts --tap=<id> --cong=muse --model=muse:image [--vnd=0] <thu_tu>=<tệp hoặc URL> …
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../src/lib/r2';
import { taoJob } from '../src/lib/xuong-video/doc-db';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';

const db = getDb()!;
const co = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tap = Number(co('tap')), cong = co('cong'), model = co('model'), vnd = Number(co('vnd') ?? 0);
const cap = process.argv.slice(2).filter((a) => !a.startsWith('--') && a.includes('=')).map((a) => { const i = a.indexOf('='); return { thu: Number(a.slice(0, i)), nguon: a.slice(i + 1) }; });
if (!tap || !cong || !model || !cap.length) { console.error('cần --tap=<id> --cong=<nguồn> --model=<model> <thu_tu>=<tệp|URL> …'); process.exit(1); }

const ra: { thu: number; canh: number; url: string }[] = [];
for (const { thu, nguon } of cap) {
  const c = ((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tap} AND thu_tu = ${thu} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY id LIMIT 1`)) as unknown as { id: number }[])[0];
  if (!c) { console.error(`tập ${tap} không có shot thứ ${thu} — bỏ`); continue; }
  const buf = /^https?:\/\//.test(nguon) ? Buffer.from(await (await fetch(nguon)).arrayBuffer()) : readFileSync(nguon);
  const duoi = buf.subarray(0, 4).toString('hex') === '89504e47' ? 'png' : buf.subarray(8, 12).toString() === 'WEBP' ? 'webp' : 'jpg';
  const url = await uploadToR2(`xuong-video/keyframe/${c.id}-${randomUUID()}.${duoi}`, buf, duoi === 'jpg' ? 'image/jpeg' : `image/${duoi}`);
  if (!url) { console.error(`shot ${thu}: tải lên R2 hỏng`); continue; }
  await chupTruoc(db, { bang: 'xv_canh', id: Number(c.id), cot: ['keyframe_url', 'keyframe_uv', 'trang_thai'], moTa: `keyframe = ảnh ${cong}`, nguoi: 'script keyframe-tu-tep' });
  await taoJob(db, { nhan: `Keyframe · ${cong} · cảnh #${thu}`, canh_id: Number(c.id), loai: 'anh', provider: cong, model, request: { dich: 'keyframe_ngoai', nguon: /^https?:/.test(nguon) ? nguon : 'tệp' }, xong: true, cents: (vnd / 26000) * 100 });   // giá đã biết (ảnh sinh xong ở cổng ngoài) → cổng tiền so ngưỡng, không báo 'không ước được'
  await db.execute(sql`UPDATE xv_job SET output_url = ${url}, chi_phi_cents = ${Math.round((vnd / 26000) * 10000) / 100} WHERE id = (SELECT max(id) FROM xv_job WHERE canh_id = ${Number(c.id)} AND model = ${model})`);
  await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${url},
    keyframe_uv = CASE WHEN keyframe_uv @> ${JSON.stringify([url])}::jsonb THEN keyframe_uv ELSE coalesce(keyframe_uv, '[]'::jsonb) || ${JSON.stringify([url])}::jsonb END,
    trang_thai = CASE WHEN trang_thai IN ('nhap', 'loi', 'duyet', 'xong') THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${Number(c.id)}`);
  ra.push({ thu, canh: Number(c.id), url });
}
console.log(JSON.stringify({ ok: true, tap, gan: ra.length, ra }));
process.exit(0);
