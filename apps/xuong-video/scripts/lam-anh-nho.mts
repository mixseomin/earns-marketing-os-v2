// Làm bù ảnh nhỏ (anh-nho-may.ts) cho mọi ảnh đang có trong kho studio: keyframe + ứng viên, ảnh gốc nhân vật, ảnh biến thể, poster.
// 0đ (ffmpeg trên box + R2). Ảnh mới sinh tự làm sẵn ở hoan-tat.ts; script này chỉ cho ảnh có từ trước.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/lam-anh-nho.mts
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { lamSanNho } from '../src/lib/xuong-video/anh-nho-may';
const db = getDb()!;
const r = (await db.execute(sql`
  SELECT keyframe_url AS u FROM xv_canh WHERE keyframe_url IS NOT NULL
  UNION SELECT jsonb_array_elements_text(keyframe_uv) FROM xv_canh WHERE jsonb_typeof(keyframe_uv) = 'array'
  UNION SELECT jsonb_array_elements_text(anh_ref) FROM xv_nhan_vat WHERE jsonb_typeof(anh_ref) = 'array'
  UNION SELECT anh_url FROM xv_bien_the WHERE anh_url IS NOT NULL
  UNION SELECT jsonb_array_elements_text(poster_uv) FROM xv_phim WHERE jsonb_typeof(poster_uv) = 'array'`)) as unknown as { u: string }[];
const ds = [...new Set(r.map((x) => x.u).filter(Boolean))];
let xong = 0, nac = 0;
for (let i = 0; i < ds.length; i += 4) {
  const kq = await Promise.all(ds.slice(i, i + 4).map((u) => lamSanNho(u)));
  for (const k of kq) { nac += k; if (k) xong++; }
  if (i % 40 === 0) console.log(`${i + kq.length}/${ds.length}`);
}
console.log(`xong: ${xong}/${ds.length} ảnh, ${nac} bản nhỏ`);
process.exit(0);
