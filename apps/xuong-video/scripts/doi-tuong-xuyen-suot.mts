// ĐỐI TƯỢNG XUYÊN SUỐT của một phim (bo-set-3d.ts › doiTuongThieu — anh 22/10/2026: "cái gì xuất hiện hơn 1 shot thì phải cho hết vào mục đối tượng
// được định nghĩa hình ảnh, đặc điểm, ảnh mẫu đầy đủ"). 0đ:
//   (không cờ) : liệt kê vật set thấy ≥ 2 shot mà chưa là đối tượng / thiếu ảnh mẫu, theo từng bộ set.
//   --tao      : tạo đối tượng còn thiếu (xv_nhan_vat: người phụ = nhan_vat, còn lại = dao_cu; mô tả = mô tả en của vật set; ảnh mẫu = ảnh dán của vật
//                set nếu có). Ảnh mẫu còn thiếu thì sinh ở tab Phim (TỐN TIỀN — hỏi anh trước).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/doi-tuong-xuyen-suot.mts --phim=132 [--tao]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boSetCuaShot, doiTuongThieu } from '../src/lib/xuong-video/bo-set-3d';
import type { Row } from '../src/lib/xuong-video/doc-db';
import type { BoSet, KhungXam } from '../src/lib/xuong-video/kieu';

const arg = (k: string) => process.argv.find((a) => a === `--${k}` || a.startsWith(`--${k}=`))?.split('=')[1] ?? (process.argv.includes(`--${k}`) ? '1' : '');
const phimId = Number(arg('phim'));
if (!phimId) { console.error('thiếu --phim=<id>'); process.exit(1); }
const db = getDb();
const q = async (x: ReturnType<typeof sql>) => (await db.execute(x)) as unknown as Row[];
const nv = (await q(sql`SELECT id, ten, loai, bo_set_id, anh_ref FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`))
  .map((x) => ({ id: Number(x.id), ten: String(x.ten), loai: String(x.loai), bo_set_id: x.bo_set_id == null ? null : Number(x.bo_set_id), anh: ((x.anh_ref ?? []) as string[]).length }));
const shots = await q(sql`SELECT c.nhan_vat, c.khung_xam FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${phimId} AND c.khung_xam IS NOT NULL AND coalesce(c.nhanh, '') IN ('', 'A')`);
const sets = await q(sql`SELECT id, ten, du_lieu FROM xv_bo_set WHERE id = ANY(${`{${[...new Set(nv.filter((v) => v.bo_set_id).map((v) => v.bo_set_id))].join(',')}}`}::int[]) ORDER BY id`);
let tao = 0;
for (const st of sets) {
  const vat = ((st.du_lieu as BoSet['du_lieu'])?.vat ?? []) as Parameters<typeof doiTuongThieu>[1];
  const ds = shots.filter((x) => boSetCuaShot({ nhan_vat: (x.nhan_vat as number[]) ?? [] }, nv) === Number(st.id)).map((x) => ({ khung_xam: x.khung_xam as KhungXam }));
  const thieu = doiTuongThieu(ds, vat, nv);
  console.log(`\n== ${st.ten} (set ${st.id}) · ${ds.length} shot có khung · thiếu ${thieu.length}`);
  for (const x of thieu) {
    const v = x.vat as { en?: string; anh?: string; ao?: string } | undefined;
    console.log(`  ${x.ly_do === 'chua_co' ? '✗ chưa có' : '◐ thiếu ảnh'} · ${x.ten} · ${x.so_shot} shot · ${x.nguoi ? 'người' : 'vật'}${v?.anh ? ' · có ảnh dán set' : ''} · ${v?.en ?? ''}`);
    if (!arg('tao') || x.ly_do !== 'chua_co') continue;
    const moTa = [v?.en, v?.ao && `wearing ${v.ao}`].filter(Boolean).join(', ');
    await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, bo_set_id) VALUES (${phimId}, ${x.nguoi ? 'nhan_vat' : 'dao_cu'}, ${x.ten}, ${moTa}, ${JSON.stringify(v?.anh ? [v.anh] : [])}::jsonb, ${Number(st.id)})`);   // bo_set_id = đồ cố định của set: cổng không đòi gắn tay / chỗ đứng riêng
    tao++;
  }
}
if (arg('tao')) console.log(`\nđã tạo ${tao} đối tượng`);
process.exit(0);
