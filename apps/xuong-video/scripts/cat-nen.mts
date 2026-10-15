// NGƯỜI CẮT NỀN cho phim khuôn "Một dáng, mọi nơi" (cat-nen.ts): sinh 1 ảnh người nền xanh (TỐN TIỀN ~1 ảnh — chỉ chạy khi anh đã duyệt,
// tiền tố DUYET_SINH_1_LAN=1) → máy chủ tự tách nền → PNG vào lớp phủ cat-nen của tập. Script đợi tới khi xong rồi in url.
//   --phim=<id>            : phim (lấy nhân vật đầu tiên loai nhan_vat + các anchor sản phẩm có ảnh)
//   --dang="…"             : dáng đứng (mặc định = ô "dang" phim điền lúc tạo từ template)
//   --xem                  : (0đ) chỉ in prompt + danh sách ảnh tham chiếu, không sinh
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cat-nen.mts --phim=50
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sinhAnhCatNen } from '../src/lib/xuong-video/sinh-anh';
import { promptCatNen, ID_LOP_CAT_NEN } from '../src/lib/xuong-video/cat-nen';
import { mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';
import type { KinhThanh, Lop } from '../src/lib/xuong-video/kieu';

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3);
const phimId = Number(gia('phim'));
if (!phimId) { console.error('thiếu --phim=<id>'); process.exit(1); }
const db = getDb()!;
const p = ((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[])[0];
if (!p) { console.error('không thấy phim'); process.exit(1); }
const kt = p.kinh_thanh as KinhThanh;
const dang = gia('dang') || String(kt.tu_template?.gia_tri?.dang ?? '');
const nvDs = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat);
const nv = nvDs.find((v) => v.loai === 'nhan_vat');
if (!nv) { console.error('phim không có nhân vật'); process.exit(1); }
const sp = nvDs.filter((v) => v.loai === 'san_pham' && v.anh_ref.length).slice(0, 2);
if (process.argv.includes('--xem')) {
  console.log(promptCatNen(nv, dang, sp, Math.min(2, nv.anh_ref.length), sp.length));
  console.log('tham chiếu:', [...nv.anh_ref.slice(0, 2), ...sp.map((v) => v.anh_ref[0])].join('\n  '));
  process.exit(0);
}
const r = await sinhAnhCatNen(db, nv.id, dang);
if (!r.ok) { console.error(r.loi); process.exit(1); }
console.log(`job #${r.data} — đang sinh ảnh nền xanh rồi tách nền…`);
for (let i = 0; i < 90; i++) {
  await new Promise((ok) => setTimeout(ok, 5000));
  const j = ((await db.execute(sql`SELECT trang_thai, output_url, loi, chi_phi_cents FROM xv_job WHERE id = ${r.data}`)) as unknown as Row[])[0]!;
  if (j.trang_thai === 'cho') continue;
  console.log(`job: ${j.trang_thai} · ${Number(j.chi_phi_cents)} cents · ảnh nền xanh: ${j.output_url ?? '-'}${j.loi ? ` · ${j.loi}` : ''}`);
  const tap = ((await db.execute(sql`SELECT id, lop FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so`)) as unknown as Row[])[0];
  const l = ((tap?.lop ?? []) as Lop[]).find((x) => x.id === ID_LOP_CAT_NEN);
  console.log(`lớp cắt nền tập #${tap?.id}: ${l ? l.url || '(chưa có url)' : 'KHÔNG CÓ lớp cat-nen — template không mang lớp này'}`);
  process.exit(j.trang_thai === 'xong' && l?.url ? 0 : 1);
}
console.error('quá 7,5 phút chưa xong — xem job trên studio');
process.exit(1);
