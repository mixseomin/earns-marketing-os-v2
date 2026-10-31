// SINH TUYẾN TRUYỆN + SỔ GÀI / TRẢ cho các phim có bản đồ series (anh 31/10/2026: "Gài / Trả không có data — thiếu data thì sinh thêm vào").
// Cùng đường với nút ✨ AI rút từ bản đồ (claude.ts › goiYTuyenTruyen → tuyen-truyen.ts › tronAi: chỉ điền chỗ trống). Ghi tiền vào sổ chi phí
// của từng phim, chụp kinh_thanh trước khi ghi (↶ Hoàn tác được). Chạy trên box3:
//   cd apps/xuong-video && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-tuyen-truyen.mts [--phim=16,13] [--lai] [--chay]
//   mặc định: mọi phim không lưu trữ có ≥ 2 tập trên bản đồ mà sổ còn trống; chỉ in danh sách. --chay = gọi AI + ghi. --lai = cả phim đã có sổ.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiYTuyenTruyen } from '../src/lib/xuong-video/claude';
import { tronAi } from '../src/lib/xuong-video/tuyen-truyen';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
import { ghiTienChu } from '../src/lib/xuong-video/doc-db';
import type { KinhThanh } from '../src/lib/xuong-video/kieu';

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const chay = process.argv.includes('--chay'), lai = process.argv.includes('--lai');
const chiPhim = gia('phim').split(',').map(Number).filter(Boolean);
const db = getDb()!;
const rows = (await db.execute(sql`SELECT id, ten, kinh_thanh FROM xv_phim WHERE jsonb_typeof(kinh_thanh->'series'->'tap') = 'array'
  AND jsonb_array_length(kinh_thanh->'series'->'tap') >= 2 ORDER BY id`)) as unknown as { id: number; ten: string; kinh_thanh: KinhThanh }[];
const ds = rows.filter((r) => (chiPhim.length ? chiPhim.includes(r.id) : !r.kinh_thanh.luu_tru)
  && (lai || !(r.kinh_thanh.series?.so_gai_tra?.length && r.kinh_thanh.series?.tuyen?.length)));
console.log(`${ds.length} phim: ${ds.map((r) => `#${r.id} ${r.ten}`).join(' | ')}`);
if (!chay) process.exit(0);

let tongVnd = 0;
const mot = async (r: (typeof ds)[number]) => {
  const k = await goiYTuyenTruyen(r.kinh_thanh, r.ten);
  if (!k.ok) { console.log(`#${r.id} LỖI ${k.loi}`); return; }
  if (k.model && k.tokens) await ghiTienChu(db, r.id, 'AI rút tuyến truyện + gài/trả', k.model, k.tokens);
  tongVnd += k.tokens?.vnd ?? 0;
  // đọc lại ngay trước khi ghi — người có thể vừa sửa trên trang trong lúc AI chạy
  const moi = ((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${r.id}`)) as unknown as { kinh_thanh: KinhThanh }[])[0]!.kinh_thanh;
  const s = tronAi(moi.series!, k.data, () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  await chupTruoc(db, { bang: 'xv_phim', id: r.id, cot: ['kinh_thanh'], moTa: 'AI rút tuyến truyện + gài/trả', nguoi: 'sinh-tuyen-truyen' });
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{series}', ${JSON.stringify(s)}::jsonb), updated_at = now() WHERE id = ${r.id}`);
  console.log(`#${r.id} ${r.ten}: ${s.tuyen?.length ?? 0} tuyến · ${k.data.su_kien.length} ô sự kiện · ${s.so_gai_tra?.length ?? 0} chi tiết gài/trả · ${k.model} · ${k.tokens?.vnd != null ? `${Math.round(k.tokens.vnd)}₫` : `${k.tokens?.in}/${k.tokens?.out} tok`}`);
};
for (let i = 0; i < ds.length; i += 4) await Promise.all(ds.slice(i, i + 4).map(mot));   // song song có trần
console.log(`xong · tiền ckey báo: ${Math.round(tongVnd)}₫`);
process.exit(0);
