// Sinh hình cho một phim trên box (không cần phiên đăng nhập) — TỐN TIỀN, chỉ chạy khi anh đã duyệt con số:
//   --uoc        : chỉ ƯỚC LƯỢNG (0đ): đếm anchor chưa ảnh gốc + shot chưa keyframe × giá model → in ra, không chạy gì.
//   --anchor     : sinh ảnh gốc cho anchor chưa có ảnh (sinh-anh.sinhAnhGoc), đợi xong.
//   --keyframe   : sinh 1 keyframe cho mọi shot chưa có (sinh-anh.sinhKeyframeCanh), đợi xong.
//   --xuat       : dựng MP4 thử (0đ, ffmpeg) → R2 + ghi vào tập như nút ⬇ Xuất.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-anh-phim.mts --phim=5 --uoc
//   (chạy từ apps/xuong-video để tsx đọc tsconfig có alias @/lib; --conditions=react-server để 'server-only' không ném lỗi ngoài Next)
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sinhAnhGoc, sinhKeyframeCanh } from '../src/lib/xuong-video/sinh-anh';
import { boiCanhTap, mapCanh, taoJob, type Row } from '../src/lib/xuong-video/doc-db';
import { chayXuat } from '../src/lib/xuong-video/xuat-chay';
import { docKinhThanh, tien } from '../src/lib/xuong-video/kieu';
import { giaAnhSv } from '../src/lib/xuong-video/hoan-tat';

const arg = (k: string) => process.argv.includes(`--${k}`);
const phimId = Number((process.argv.find((a) => a.startsWith('--phim=')) ?? '').split('=')[1] || 0);
if (!phimId) { console.error('thiếu --phim=<id>'); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];

const p = await q(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`);
if (!p[0]) { console.error('không thấy phim'); process.exit(1); }
const kt = docKinhThanh(p[0].kinh_thanh as never);
const anchorThieu = await q(sql`SELECT id, ten, loai FROM xv_nhan_vat WHERE phim_id = ${phimId} AND jsonb_array_length(anh_ref) = 0 AND mo_ta <> '' ORDER BY id`);
const tap = await q(sql`SELECT id, so FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so LIMIT 1`);
const tapId = Number(tap[0]?.id ?? 0);
const canhThieu = tapId ? await q(sql`SELECT id, thu_tu, canh FROM xv_canh WHERE tap_id = ${tapId} AND keyframe_url IS NULL AND prompt_anh <> '' ORDER BY thu_tu`) : [];
const giaAnh = await giaAnhSv(kt.mo_hinh_anh).catch(() => 0);
console.log(`phim #${phimId} · model ảnh ${kt.mo_hinh_anh} ≈ ${tien(giaAnh)}/ảnh`);
console.log(`  anchor chưa ảnh gốc: ${anchorThieu.length} → ≈ ${tien(anchorThieu.length * giaAnh)}`);
console.log(`  shot chưa keyframe: ${canhThieu.length} → ≈ ${tien(canhThieu.length * giaAnh)}`);
if (arg('uoc') || (!arg('anchor') && !arg('keyframe') && !arg('xuat'))) { console.log('(chỉ ước lượng — thêm --anchor / --keyframe / --xuat để chạy)'); process.exit(0); }

/** Đợi các job ảnh xong (cả đường Cloudflare lẫn hàng nền trong tiến trình này). */
async function doi(jobs: number[], nhan: string, phutToiDa = 25) {
  const t0 = Date.now();
  while (Date.now() - t0 < phutToiDa * 60_000) {
    const r = await q(sql`SELECT count(*) FILTER (WHERE trang_thai = 'cho') AS cho, count(*) FILTER (WHERE trang_thai = 'xong') AS xong, count(*) FILTER (WHERE trang_thai = 'loi') AS loi, coalesce(sum(chi_phi_cents), 0) AS tien FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[])`);
    const x = r[0]!;
    process.stdout.write(`\r  ${nhan}: xong ${x.xong}/${jobs.length} · lỗi ${x.loi} · ${tien(Number(x.tien))}   `);
    if (Number(x.cho) === 0) { console.log(''); return; }
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  console.log(`\n  ${nhan}: quá ${phutToiDa} phút, còn job chưa xong — xem sổ chi phí`);
}
if (arg('anchor') && anchorThieu.length) {
  const jobs: number[] = [];
  for (const a of anchorThieu) { const r = await sinhAnhGoc(db, Number(a.id)); if (r.ok) jobs.push(r.data); else console.log(`  ✗ ${a.ten}: ${r.loi}`); }
  await doi(jobs, 'ảnh gốc');
  const loi = await q(sql`SELECT nhan, loi FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[]) AND trang_thai = 'loi'`);
  for (const l of loi) console.log(`  ✗ ${l.nhan}: ${String(l.loi).slice(0, 160)}`);
}
if (arg('keyframe') && canhThieu.length) {
  const jobs: number[] = [];
  for (const c of canhThieu) { const r = await sinhKeyframeCanh(db, Number(c.id), 1); if (r.ok) jobs.push(...r.data); else console.log(`  ✗ #${c.thu_tu} ${c.canh}: ${r.loi}`); }
  await doi(jobs, 'keyframe');
  const loi = await q(sql`SELECT nhan, loi FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[]) AND trang_thai = 'loi'`);
  for (const l of loi) console.log(`  ✗ ${l.nhan}: ${String(l.loi).slice(0, 160)}`);
}
if (arg('xuat') && tapId) {
  const bc = (await boiCanhTap(db, tapId))!;
  const canh = (await q(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)).map(mapCanh);
  const job = await taoJob(db, { phim_id: phimId, nhan: `Xuất bản · tập ${bc.tap.so} (script)`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: 'A' } });
  const kq = await chayXuat({ loai: bc.loai, tiLe: kt.ti_le, canh, nhanVat: bc.nhanVat, tap: bc.tap, qc: kt.qc, nhanh: 'A' });
  if (!kq.ok) { await db.execute(sql`UPDATE xv_job SET trang_thai = 'loi', loi = ${kq.loi} WHERE id = ${job}`); console.log(`  ✗ xuất: ${kq.loi}`); }
  else {
    await db.execute(sql`UPDATE xv_tap SET xuat = coalesce(xuat, '[]'::jsonb) || ${JSON.stringify([{ url: kq.url, nhanh: 'A', giay: Math.round(kq.giay * 10) / 10, luc: new Date().toISOString(), job }])}::jsonb, video_url = ${kq.url}, updated_at = now() WHERE id = ${tapId}`);
    await db.execute(sql`UPDATE xv_job SET trang_thai = 'xong', output_url = ${kq.url}, loi = ${kq.canhThieu.length ? `thiếu hình: ${kq.canhThieu.join(', ')} (bỏ qua)` : ''} WHERE id = ${job}`);
    console.log(`  ✓ bản xuất ${kq.giay}s → ${kq.url}${kq.canhThieu.length ? ` · thiếu hình: ${kq.canhThieu.join(', ')}` : ''}`);
  }
}
const tong = await q(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS c FROM xv_job WHERE phim_id = ${phimId}`);
console.log(`tổng đã chi cho phim #${phimId}: ${tien(Number(tong[0]!.c))} → https://studio.on.tc/?m=phim&mId=${phimId}`);
process.exit(0);
