// TỰ KIỂM ĐƯỜNG "BỘ SINH CHÍNH = H3 / SEEDANCE" (góp ý #1638) — chạy TRONG MỘT GIAO DỊCH RỒI HUỶ (ROLLBACK): không đổi dữ liệu thật, 0đ, không gọi model.
//   cd apps/xuong-video && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/kiem-hang-cum.mts --phim=<id> [--bo=h3|seedance]
// Các bước (giống hệt nút Sinh khi phim đặt bộ sinh chính): đặt kinh_thanh.bo_sinh_video → lấy shot đầu có clip 3D còn mới → xepHangCum (sinh-video.ts,
// đúng hàm batDauVideoCanh gọi) → đọc job hàng (provider / model / cents) như scripts/hang-video.mts --ds sẽ thấy → bấm lần hai không nhân đôi hàng →
// ROLLBACK, in lại bo_sinh_video để chứng minh không còn dấu vết.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { xepHangCum } from '../src/lib/xuong-video/sinh-video';
import { clip3dMoi, type Canh } from '../src/lib/xuong-video/kieu';

const arg = (k: string): string => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const phim = Number(arg('phim'));
const bo = (arg('bo') || 'h3') as 'h3' | 'seedance';
if (!phim || !['h3', 'seedance'].includes(bo)) { console.error('dùng: --phim=<id> [--bo=h3|seedance]'); process.exit(2); }
const db = getDb()!;
type R = Record<string, unknown>;
const out: string[] = [];
const HUY = 'ROLLBACK (tự kiểm, không ghi gì)';
try {
  await db.transaction(async (tx) => {
    const q = async (s: ReturnType<typeof sql>) => (await tx.execute(s)) as unknown as R[];
    await q(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{bo_sinh_video}', ${JSON.stringify(bo)}::jsonb) WHERE id = ${phim}`);
    out.push(`1. đặt bộ sinh chính phim #${phim} = ${(await q(sql`SELECT kinh_thanh->>'bo_sinh_video' AS bo FROM xv_phim WHERE id = ${phim}`))[0]?.bo}`);
    const rows = (await q(sql`SELECT c.* FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${phim} ORDER BY c.tap_id, c.thu_tu, c.id`)) as unknown as Canh[];
    const moi = rows.filter((r) => clip3dMoi(r));
    out.push(`2. shot có clip 3D còn mới (đầu vào cụm): ${moi.length}/${rows.length}`);
    const c = moi[0];
    if (!c) { out.push('   → không có shot nào xếp hàng được (nút Sinh sẽ báo "dựng 3D lại trước")'); throw new Error(HUY); }
    const k1 = await xepHangCum(tx as never, c, bo, 'nhap');
    const k2 = await xepHangCum(tx as never, c, bo, 'nhap');
    out.push(`3. nút Sinh shot id ${c.id} (#${c.thu_tu}) → ${JSON.stringify(k1)} · bấm lần hai → ${JSON.stringify(k2)}`);
    const j = await q(sql`SELECT j.id, j.provider, j.model, j.trang_thai, j.chi_phi_cents, j.request FROM xv_job j WHERE j.canh_id = ${c.id} AND j.loai = 'video' AND j.trang_thai = 'hang'`);
    out.push(`4. hàng của shot (hang-video.mts --ds đọc đúng bảng này): ${j.length} job ${JSON.stringify(j)}`);
    throw new Error(HUY);
  });
} catch (e) { out.push(`5. ${(e as Error).message}`); }
out.push(`6. sau huỷ: bo_sinh_video phim #${phim} = '${((await db.execute(sql`SELECT kinh_thanh->>'bo_sinh_video' AS bo FROM xv_phim WHERE id = ${phim}`)) as unknown as R[])[0]?.bo ?? ''}'`);
console.log(out.join('\n'));
process.exit(0);
