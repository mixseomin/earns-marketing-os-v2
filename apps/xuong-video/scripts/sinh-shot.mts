// Sinh TỪNG BƯỚC cho vài shot chọn tay trên box (anh 09/10/2026: "cấm làm hàng loạt — tập trung 2 shot đầu xem ra thế nào"):
//   --canh=73,74                 : id shot (bắt buộc). Mặc định chỉ ƯỚC LƯỢNG (0đ), không chạy gì.
//   --keyframe                   : sinh lại 1 keyframe cho mỗi shot (kể cả shot đã có — ảnh cũ vẫn nằm trong dải ứng viên), đợi xong, in link.
//   --duyet                      : đánh dấu shot đã duyệt keyframe (0đ) — bước bắt buộc trước --video.
//   --video                      : gửi sinh video nháp (Veo/fal theo kinh thánh), đợi provider trả, in link + tiền.
//   --giong                      : sinh giọng đọc từng dòng thoại của các shot, đợi file, in link.
//   THỨ TỰ: --keyframe → (anh xem) → --duyet → --giong → --video. Giọng TRƯỚC video: có file giọng thì Veo sinh clip câm (chỉ cử miệng),
//   không có thì Veo tự đọc thoại — đọc lơ lớ và dễ in phụ đề giả (thử 09/10/2026 tốn $0,40 cho 2 clip hỏng).
//   MỖI LẦN CHẠY MỘT CỜ TỐN TIỀN. Ví dụ:
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-shot.mts --canh=73,74 --keyframe
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sinhKeyframeCanh } from '../src/lib/xuong-video/sinh-anh';
import { batDauVideoCanh, kiemVideoTap } from '../src/lib/xuong-video/sinh-video';
import { sinhGiongShots } from '../src/lib/xuong-video/sinh-giong';
import { giaAnhSv } from '../src/lib/xuong-video/hoan-tat';
import { dongThoai, giaGiong } from '../src/lib/xuong-video/am-thanh';
import { dsMoHinhGiong } from '../src/lib/xuong-video/giong';
import { boiCanhCanh, mapCanh, giaVideoSv, type Row } from '../src/lib/xuong-video/doc-db';
import { lamTronClip, tien } from '../src/lib/xuong-video/kieu';

const arg = (k: string) => process.argv.includes(`--${k}`);
const ids = ((process.argv.find((a) => a.startsWith('--canh=')) ?? '').split('=')[1] ?? '').split(',').map(Number).filter((x) => x > 0);
if (!ids.length) { console.error('thiếu --canh=<id,id>'); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const doi = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

const bcs = [];
for (const id of ids) { const bc = await boiCanhCanh(db, id); if (!bc) { console.error(`không thấy shot #${id}`); process.exit(1); } bcs.push(bc); }
const kt = bcs[0]!.kt; const tapId = bcs[0]!.canh.tap_id;
const giaAnh = await giaAnhSv(kt.mo_hinh_anh).catch(() => 0);
const dm = await dsMoHinhGiong();
let uocVideo = 0, uocGiong = 0;
for (const bc of bcs) {
  const giay = lamTronClip(bc.canh.thoi_luong_s);
  uocVideo += await giaVideoSv(kt.mo_hinh_video, kt.do_phan_giai, giay).catch(() => 0);
  for (const d of dongThoai(bc.canh, bc.nhanVat)) { const v = bc.nhanVat.find((x) => x.ten === d.nhan_vat); uocGiong += giaGiong(dm.find((m) => m.key === (v?.giong_model || 'elevenlabs:eleven_v3')), d.loi.length) ?? 0; }
}
console.log(`tập #${tapId} · ${bcs.map((b) => `#${b.canh.thu_tu} (id ${b.canh.id}, ${b.canh.trang_thai}${b.canh.keyframe_url ? ', có keyframe' : ''})`).join(' · ')}`);
console.log(`  ước: keyframe ${bcs.length} × ${tien(giaAnh)} = ${tien(giaAnh * bcs.length)} · video ${kt.mo_hinh_video} ${kt.do_phan_giai} ≈ ${tien(uocVideo)} · giọng ≈ ${tien(uocGiong)}`);
if (!arg('keyframe') && !arg('duyet') && !arg('video') && !arg('giong')) { console.log('(chỉ ước lượng — thêm MỘT cờ --keyframe / --duyet / --video / --giong để chạy)'); process.exit(0); }

if (arg('keyframe')) {
  const jobs: number[] = [];
  for (const bc of bcs) { const r = await sinhKeyframeCanh(db, bc.canh.id, 1); if (r.ok) jobs.push(...r.data); else console.log(`  ✗ #${bc.canh.thu_tu}: ${r.loi}`); }
  for (let i = 0; i < 120; i++) {
    const r = await q(sql`SELECT count(*) FILTER (WHERE trang_thai = 'cho') AS cho FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[])`);
    if (Number(r[0]?.cho) === 0) break; await doi(5000);
  }
  const kq = await q(sql`SELECT j.canh_id, j.trang_thai, j.output_url, j.loi, j.chi_phi_cents, c.thu_tu FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE j.id = ANY(${`{${jobs.join(',')}}`}::int[]) ORDER BY c.thu_tu`);
  for (const r of kq) console.log(`  #${r.thu_tu} ${r.trang_thai} ${r.output_url ?? r.loi} · ${tien(Number(r.chi_phi_cents))}`);
}
if (arg('duyet')) {
  for (const bc of bcs) await db.execute(sql`UPDATE xv_canh SET trang_thai = 'duyet', loi = '', updated_at = now() WHERE id = ${bc.canh.id} AND keyframe_url IS NOT NULL`);
  console.log(`  ✓ đã duyệt keyframe ${bcs.length} shot`);
}
if (arg('video')) {
  const jobs: number[] = [];
  for (const bc of bcs) { const r = await batDauVideoCanh(db, bc.canh.id); if (r.ok) jobs.push(r.data); else console.log(`  ✗ #${bc.canh.thu_tu}: ${r.loi}`); }
  console.log(`  đã gửi ${jobs.length} clip, đợi provider…`);
  for (let i = 0; i < 90; i++) {
    const k = await kiemVideoTap(db, tapId);
    const con = await q(sql`SELECT count(*) AS n FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[]) AND trang_thai = 'chay'`);
    process.stdout.write(`\r  còn chạy ${con[0]?.n} (tập: ${k.conChay})   `);
    if (Number(con[0]?.n) === 0) break; await doi(10000);
  }
  console.log('');
  const kq = await q(sql`SELECT j.trang_thai, j.output_url, j.loi, j.chi_phi_cents, c.thu_tu FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE j.id = ANY(${`{${jobs.join(',')}}`}::int[]) ORDER BY c.thu_tu`);
  for (const r of kq) console.log(`  #${r.thu_tu} ${r.trang_thai} ${r.output_url ?? r.loi} · ${tien(Number(r.chi_phi_cents))}`);
}
if (arg('giong')) {
  const r = await sinhGiongShots(db, tapId, ids, {});
  if (!r.ok) { console.error('  ✗', r.loi); process.exit(1); }
  console.log(`  đã gửi ${r.data} dòng thoại, đợi file…`);
  for (let i = 0; i < 60; i++) {
    const cho = await q(sql`SELECT count(*) AS n FROM xv_job WHERE loai = 'am' AND trang_thai = 'cho' AND canh_id = ANY(${`{${ids.join(',')}}`}::int[])`);
    if (Number(cho[0]?.n) === 0) break; await doi(5000);
  }
  const rows = (await q(sql`SELECT * FROM xv_canh WHERE id = ANY(${`{${ids.join(',')}}`}::int[]) ORDER BY thu_tu`)).map(mapCanh);
  for (const c of rows) for (const d of c.thoai) console.log(`  #${c.thu_tu} ${d.nhan_vat || 'lời dẫn'}: "${d.loi}" → ${d.url ?? '(chưa có file)'}`);
  const tienG = await q(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS t, count(*) FILTER (WHERE trang_thai = 'loi') AS loi FROM xv_job WHERE loai = 'am' AND canh_id = ANY(${`{${ids.join(',')}}`}::int[]) AND created_at > now() - interval '15 minutes'`);
  console.log(`  giọng: ${tien(Number(tienG[0]?.t))} · lỗi ${tienG[0]?.loi}`);
}
process.exit(0);
