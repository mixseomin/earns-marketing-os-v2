// ẢNH CHUẨN cho ĐỒ NHẬN DẠNG của bộ set (tranh, thư pháp, màn chiếu có nội dung, đồng hồ, bảng chỉ dẫn… — kiem-ai-3d.ts › LA_NHAN_DANG): mỗi món sinh
// MỘT ảnh phẳng nhìn thẳng từ chữ en của nó, lưu vào xv_bo_set.du_lieu.vat[].anh → dung-set.py dán lên mặt vật → khung 3D gửi AI đã có đúng bức đó,
// mọi góc máy như nhau (anh 17/10/2026: "tranh lúc hình A lúc tranh B"). nap.mts nạp lại thì giữ ảnh theo tên vật.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-anh-set.mts --phim=<id> [--chay] [--nguon=ckey:…]
//   mặc định chỉ ƯỚC (0đ) · --chay: sinh (TỐN TIỀN, cần DUYET_SINH_1_LAN=1)
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sinhAnh } from '../src/lib/xuong-video/google';
import { uploadToR2 } from '../src/lib/r2';
import { giaAnhSv } from '../src/lib/xuong-video/hoan-tat';
import { tien, type TiLeAnh } from '../src/lib/xuong-video/kieu';
import { LA_NHAN_DANG } from '../src/lib/xuong-video/kiem-ai-3d';
import type { Row } from '../src/lib/xuong-video/doc-db';

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3);
const phim = Number(gia('phim')); const nguon = gia('nguon') || 'ckey:wowztools/nano-banana-2'; const chay = process.argv.includes('--chay');
if (!phim) { console.error('thiếu --phim=<id>'); process.exit(1); }
if (chay && process.env.DUYET_SINH_1_LAN !== '1') { console.error('sinh ảnh TỐN TIỀN — chỉ chạy với DUYET_SINH_1_LAN=1 sau khi anh duyệt'); process.exit(1); }
const db = getDb()!;
type Vat = { ten: string; en?: string; co?: number[]; anh?: string };
const sets = (await db.execute(sql`SELECT id, ten, du_lieu FROM xv_bo_set WHERE phim_id = ${phim} ORDER BY id`)) as unknown as Row[];
const can = sets.flatMap((s) => ((s.du_lieu as { vat: Vat[] }).vat ?? []).map((v, i) => ({ sid: Number(s.id), set: String(s.ten), i, v })).filter((x) => LA_NHAN_DANG.test(x.v.en ?? '') && !x.v.anh));
const g = await giaAnhSv(nguon);
console.log(`đồ nhận dạng chưa có ảnh chuẩn: ${can.length} → ≈ ${tien(can.length * g)} (${nguon})`); for (const x of can) console.log(`  ${x.set} · ${x.v.ten}: ${x.v.en}`);
if (!chay) { console.log('(chỉ ước — thêm --chay để sinh)'); process.exit(0); }
// Tỉ lệ theo MẶT vật (bỏ cạnh mỏng nhất): vật treo tường (mỏng theo x hoặc y) → rộng = cạnh ngang còn lại, cao = z; vật nằm (mỏng theo z) → x × y.
const tiLe = (co?: number[]): TiLeAnh => {
  const [x, y, z] = co ?? [1, 1, 1]; const mong = [x!, y!, z!].indexOf(Math.min(x!, y!, z!));
  const [r, c] = mong === 2 ? [Math.max(x!, y!), Math.min(x!, y!)] : [mong === 0 ? y! : x!, z!];
  return r / c > 1.3 ? '16:9' : c / r > 1.3 ? '9:16' : '1:1';
};
for (const x of can) {
  const prompt = `${x.v.en}. Flat, straight-on, evenly lit view of the artwork / display surface ONLY, filling the entire image edge to edge — no frame, no wall, no room, no people, no hands, no reflections, no perspective. Photorealistic, high detail. Any text must be exactly as written in quotes above, otherwise no text.`;
  const kq = await sinhAnh({ model: nguon, prompt, tiLe: tiLe(x.v.co) });
  if (!kq.ok) { console.log(`  ✗ ${x.v.ten}: ${kq.loi}`); continue; }
  const url = await uploadToR2(`xuong-video/bo-set/${x.sid}-anh-${x.i}-${Date.now()}.${kq.mimeType.includes('png') ? 'png' : 'jpg'}`, kq.data, kq.mimeType);
  if (!url) { console.log(`  ✗ ${x.v.ten}: không lên kho được`); continue; }
  await db.execute(sql`UPDATE xv_bo_set SET du_lieu = jsonb_set(du_lieu, ${`{vat,${x.i},anh}`}::text[], ${JSON.stringify(url)}::jsonb), updated_at = now() WHERE id = ${x.sid}`);
  console.log(`  ✓ ${x.set} · ${x.v.ten}: ${url}`);
}
process.exit(0);
