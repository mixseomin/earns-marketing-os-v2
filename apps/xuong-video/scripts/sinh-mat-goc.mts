// ẢNH MẶT QUAY TRÁI / PHẢI cho nhân vật người của một phim (sinh-anh.ts › sinhMatGoc) — nguồn ảnh mẫu cùng phía cho 🩹 sửa hướng nhìn.
// Mặc định CHỈ ƯỚC (0đ): liệt kê nhân vật thiếu mặt quay trái / phải (anh_mat.dau, |quay đầu| ≥ 12°) × giá ảnh. --chay = sinh (TỐN TIỀN, chỉ khi anh
// đã duyệt), đợi xong, rồi cắt lại ảnh sát mặt (soi-mat.ts › damBaoAnhMat, 0đ) và in góc quay đầu đo được của từng ảnh.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-mat-goc.mts --phim=119 [--chay] [--nv=287,289]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sinhMatGoc } from '../src/lib/xuong-video/sinh-anh';
import { damBaoAnhMat } from '../src/lib/xuong-video/soi-mat';
import { mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';
import { GIA_SUA_MAT_VND } from '../src/lib/xuong-video/khung';

const val = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const phimId = Number(val('phim')); if (!phimId) { console.error('thiếu --phim=<id>'); process.exit(1); }
const chiNv = val('nv').split(',').filter(Boolean).map(Number);
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];

const nv = (await q(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = 'nhan_vat' AND jsonb_array_length(anh_ref) > 0 ORDER BY id`)).map(mapNhanVat)
  .filter((v) => !chiNv.length || chiNv.includes(v.id));
await damBaoAnhMat(db, nv);   // cắt lại ảnh sát mặt nếu ảnh mẫu / bộ cắt đổi (0đ) — đếm thiếu theo số đo mới nhất
const thieu = nv.map((v) => {
  const dau = v.anh_mat?.dau ?? [];
  return { v, ben: (['trai', 'phai'] as const).filter((b) => !dau.some((d) => d != null && d * (b === 'trai' ? -1 : 1) >= 12)) };
}).filter((x) => x.ben.length);
const so = thieu.reduce((a, x) => a + x.ben.length, 0);
for (const x of thieu) console.log(`  ${x.v.ten} (#${x.v.id}): thiếu mặt quay ${x.ben.map((b) => (b === 'trai' ? 'trái' : 'phải')).join(' + ')}`);
console.log(`→ ${so} ảnh × ~${GIA_SUA_MAT_VND}₫ (ckey Nano Banana; cổng hỏng thì Google ~874₫) ≈ ${Math.round(so * GIA_SUA_MAT_VND)}₫`);
if (!process.argv.includes('--chay') || !so) process.exit(0);

const jobs: number[] = [];
for (const x of thieu) { const r = await sinhMatGoc(db, x.v.id, [...x.ben]); if (r.ok) jobs.push(...r.data); else console.log(`  ✗ ${x.v.ten}: ${r.loi}`); }
const t0 = Date.now();
while (Date.now() - t0 < 20 * 60_000) {
  const r = (await q(sql`SELECT count(*) FILTER (WHERE trang_thai = 'cho') AS cho, count(*) FILTER (WHERE trang_thai = 'loi') AS loi, coalesce(sum(chi_phi_cents), 0) AS tien FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[])`))[0]!;
  process.stdout.write(`\r  đợi ${jobs.length} ảnh: còn ${r.cho} · lỗi ${r.loi} · ${Number(r.tien).toFixed(2)}¢   `);
  if (Number(r.cho) === 0) break;
  await new Promise((ok) => setTimeout(ok, 5000));
}
console.log('');
for (const l of await q(sql`SELECT nhan, trang_thai, loi, output_url FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[]) ORDER BY id`)) console.log(`  ${l.trang_thai === 'xong' ? '✓' : '✗'} ${l.nhan}: ${l.trang_thai === 'xong' ? l.output_url : String(l.loi).slice(0, 160)}`);
// cắt lại ảnh sát mặt (khoá đổi theo anh_ref) — in góc quay đầu đo được
const moi = (await q(sql`SELECT * FROM xv_nhan_vat WHERE id = ANY(${`{${thieu.map((x) => x.v.id).join(',')}}`}::int[]) ORDER BY id`)).map(mapNhanVat);
await damBaoAnhMat(db, moi);
for (const v of moi) console.log(`  ${v.ten}: ảnh sát mặt ${v.anh_mat?.url.length ?? 0}, quay đầu ${JSON.stringify(v.anh_mat?.dau ?? [])}`);
process.exit(0);
