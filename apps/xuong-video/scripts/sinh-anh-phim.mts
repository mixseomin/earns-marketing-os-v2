// Sinh hình cho một phim trên box (không cần phiên đăng nhập) — TỐN TIỀN, chỉ chạy khi anh đã duyệt con số:
//   --uoc        : chỉ ƯỚC LƯỢNG (0đ): đếm anchor chưa ảnh gốc + shot chưa keyframe × giá model → in ra, không chạy gì.
//   --xem-prompt : (0đ) in câu lệnh keyframe sẽ gửi của các shot đang chọn (--lam-lai --chi=…), không sinh gì.
//   --tiep-job   : đẩy lại job ảnh treo của tập (tiến trình chạy nó đã chết) bằng đúng đầu vào đã lưu — không chạy lại bước đã trả tiền.
//   --anchor     : sinh ảnh gốc cho anchor chưa có ảnh (sinh-anh.sinhAnhGoc), đợi xong.
//   --bien-the   : sinh ảnh tham chiếu cho biến thể chưa có ảnh (sinh-anh.sinhAnhBienTheDb — sổ trang phục), đợi xong.
//   --keyframe   : sinh 1 keyframe cho mọi shot chưa có (sinh-anh.sinhKeyframeCanh), đợi xong. --nguon=<cổng:model> = đúng nguồn đó, một bước. --cong-anh=<cổng:model> = vẫn nhiều bước, bước Nano qua cổng đó. --lam-lai = sinh lại mọi shot (ảnh cũ giữ làm ứng viên).
//   --nhac=<model> [--mo-ta-nhac="…"] : sinh MỘT bài nhạc nền cả tập (dài = giây phát của nhánh A), đợi xong — TỐN TIỀN.
//   --xuat       : dựng MP4 thử (0đ, ffmpeg) → R2 + ghi vào tập như nút ⬇ Xuất. QC có lời dẫn mà chưa có nhạc nền → bị chặn;
//                  --thieu-nhac = vẫn xuất làm bản nháp (gắn cờ đỏ "thiếu nhạc nền").
//   Cổng ngôn ngữ: phim không phải tiếng Việt mà shot còn chữ màn/thoại tiếng Việt → DỪNG trước --keyframe/--xuat (dịch tập trước); --bo-qua-ngon-ngu để ép.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-anh-phim.mts --phim=5 --uoc
//   (chạy từ apps/xuong-video để tsx đọc tsconfig có alias @/lib; --conditions=react-server để 'server-only' không ném lỗi ngoài Next)
import { songSong } from '../src/lib/xuong-video/song-song';
import { lookPhim } from '../src/lib/xuong-video/look';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sinhAnhGoc, sinhKeyframeCanh, sinhAnhBienTheDb, chuanBiKeyframe, chamKeyframe, DUNG_XUONG } from '../src/lib/xuong-video/sinh-anh';
import { boiCanhCanh, boiCanhTap, mapCanh, taoJob, type Row } from '../src/lib/xuong-video/doc-db';
import { chayXuat, ghiBanXuat } from '../src/lib/xuong-video/xuat-chay';
import { sinhNhacTap } from '../src/lib/xuong-video/sinh-nhac';
import { docKinhThanh, tien, shotLechNgonNgu, tenNgonNgu } from '../src/lib/xuong-video/kieu';
import { dayViecAnh, giaAnhSv } from '../src/lib/xuong-video/hoan-tat';
import { chamVideo, promptVideoCanh } from '../src/lib/xuong-video/sinh-video';

const arg = (k: string) => process.argv.includes(`--${k}`);
const phimId = Number((process.argv.find((a) => a.startsWith('--phim=')) ?? '').split('=')[1] || 0);
if (!phimId) { console.error('thiếu --phim=<id>'); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];

const p = await q(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`);
if (!p[0]) { console.error('không thấy phim'); process.exit(1); }
const kt = docKinhThanh(p[0].kinh_thanh as never);
// Bối cảnh CÓ BỘ SET 3D không sinh ảnh mẫu (anh 17/10/2026 "để khi đổi góc quay AI không bịa"): keyframe shot có khung 3D bỏ ảnh bối cảnh khỏi
// tham chiếu (sinh-anh.ts › nvRef) — nguồn hình phòng là bộ set + tên tiếng Anh từng khối; ảnh AI tả lại phòng chỉ tốn tiền và đẻ bản phòng thứ hai.
// Thẻ bối cảnh đó hiện ảnh 3D (anh-set-3d.tsx). Muốn ảnh AI thì bấm sinh tay trên thẻ.
const anchorThieuDu = await q(sql`SELECT id, ten, loai, mo_ta FROM xv_nhan_vat WHERE phim_id = ${phimId} AND jsonb_array_length(anh_ref) = 0 AND mo_ta <> '' AND NOT (loai = 'boi_canh' AND bo_set_id IS NOT NULL) ORDER BY id`);
// CÙNG MỘT KIỂU VẬT (4 ghế da, 2 cửa thang máy — đối tượng xuyên suốt, bo-set-3d.ts › doiTuongThieu): mô tả giống hệt → sinh MỘT ảnh rồi chép cho các bản
// còn lại (không trả tiền N lần cho cùng một món, các bản lại giống nhau tuyệt đối).
const kieuCua = (x: Row) => `${String(x.loai)}|${String(x.mo_ta).trim().toLowerCase()}`;
const anchorThieu = anchorThieuDu.filter((x, i) => anchorThieuDu.findIndex((y) => kieuCua(y) === kieuCua(x)) === i);
const banSao = anchorThieuDu.filter((x) => !anchorThieu.includes(x));
const tap = await q(sql`SELECT id, so FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so LIMIT 1`);
const tapId = Number(tap[0]?.id ?? 0);
// --lam-lai: sinh lại keyframe cho MỌI shot (3D / dáng đổi sau lượt trước) — ảnh cũ vẫn nằm trong keyframe_uv (ứng viên, chọn lại được), ảnh mới thành ảnh chọn.
const lamLai = arg('lam-lai');
// --chi=<số shot,…>: chỉ các shot này (thứ tự trên lưới) — sinh lại đúng shot hỏng, không cả tập
const chi = new Set((process.argv.find((a) => a.startsWith('--chi=')) ?? '').slice(6).split(',').filter(Boolean).map(Number));
const canhThieu = (tapId ? await q(sql`SELECT id, thu_tu, canh, keyframe_url, (khung_xam->>'sau') IS NOT NULL AS co_sau, (khung_xam->>'xuong') IS NOT NULL AS co_xuong FROM xv_canh WHERE tap_id = ${tapId} AND (${lamLai} OR keyframe_url IS NULL) AND prompt_anh <> '' ORDER BY thu_tu`) : []).filter((c) => !chi.size || chi.has(Number(c.thu_tu)));
// --nguon=<cổng:model> (vd ckey:wowztools/nano-banana-2): sinh keyframe ĐÚNG nguồn đó, một bước — không tự rơi sang cổng đắt hơn, không qua FLUX độ sâu.
const nguon = (process.argv.find((a) => a.startsWith('--nguon=')) ?? '').slice(8);
// --cong-anh=<cổng:model> (vd plenxai:nano-banana-2): GIỮ đường nhiều bước (độ sâu / ghép từng người / sửa mặt), riêng các bước Nano đi đúng cổng này.
const congAnh = (process.argv.find((a) => a.startsWith('--cong-anh=')) ?? '').slice(11);
// Shot có bản đồ độ sâu 3D mặc định đi HAI BƯỚC (sinh-anh.ts: FLUX depth fal $0,05 + ảnh sửa nhân dạng) — ước giá phải tính bước FLUX (17/10/2026:
// ước $0,034/ảnh trong khi đường thật ~ $0,09/ảnh).
const haiBuoc = nguon || kt.keyframe_hai_buoc === false ? 0 : canhThieu.filter((c) => c.co_sau).length;
const xuongN = nguon || kt.keyframe_hai_buoc === false ? 0 : (DUNG_XUONG ? canhThieu.filter((c) => c.co_sau && c.co_xuong).length : 0);   // bước 1 độ sâu + dáng: $0,075 thay $0,05
const giaAnh = await giaAnhSv(nguon || kt.mo_hinh_anh).catch(() => 0);
console.log(`phim #${phimId} · model ảnh ${kt.mo_hinh_anh} ≈ ${tien(giaAnh)}/ảnh`);
console.log(`  anchor chưa ảnh gốc: ${anchorThieu.length} → ≈ ${tien(anchorThieu.length * giaAnh)}`);
// --bien-the: ảnh tham chiếu cho BIẾN THỂ chưa có ảnh (sổ trang phục — bo-set-3d.ts › lookChuaChuan chặn keyframe khi biến thể sổ người trỏ tới thiếu ảnh)
const btThieu = await q(sql`SELECT b.id, b.ten, v.ten AS nv FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id WHERE v.phim_id = ${phimId} AND b.anh_url IS NULL ORDER BY b.id`);
console.log(`  biến thể chưa ảnh: ${btThieu.length} → ≈ ${tien(btThieu.length * giaAnh)}`);
console.log(`  shot chưa keyframe: ${canhThieu.length} → ≈ ${tien(canhThieu.length * giaAnh + (haiBuoc - xuongN) * 5 + xuongN * 7.5)}${haiBuoc ? ` (gồm ${haiBuoc} shot hai bước: ${xuongN ? `${xuongN} shot độ sâu + dáng ≈ $0.075, ` : ''}FLUX độ sâu ≈ $0.05/shot)` : ''}${nguon ? ` · nguồn ${nguon}, một bước` : ''}`);
// --xem-prompt (0đ): in câu lệnh keyframe SẼ gửi (một bước, hoặc bước 1 FLUX + bước 2 sửa nhân dạng) của các shot đang chọn — soát chữ trước khi xin duyệt tiền
if (arg('xem-prompt')) {
  for (const c of canhThieu) {
    const bc = await boiCanhCanh(db as never, Number(c.id)); if (!bc) continue;
    const k = chuanBiKeyframe(bc);
    console.log(`\n#${c.thu_tu} ${c.canh}`);
    if (k.haiBuoc?.lop && !nguon) console.log(`  [GHÉP TỪNG NGƯỜI · ${k.haiBuoc.lop.nguoi.length} người ≈ $${(0.05 + k.haiBuoc.lop.nguoi.length * 0.084 + 0.034).toFixed(2)}]\n  [nền]\n  ${k.haiBuoc.lop.nen.prompt}\n${k.haiBuoc.lop.nguoi.map((x) => `  [${x.ten} · xa ${x.xa} cm · ${x.ref.length} ảnh mẫu]\n  ${x.prompt1}\n  → ${x.prompt2}`).join('\n')}`);
    else if (k.haiBuoc && !nguon) console.log(`  [bước 1 FLUX]\n  ${k.haiBuoc.prompt1}\n  [bước 2 · ${k.haiBuoc.ref2.length + 1} ảnh]\n  ${k.haiBuoc.prompt2}`);
    else console.log(`  [một bước · ${k.urlRef.length} ảnh]\n  ${k.prompt}`);
    console.log(`  [video]\n  ${promptVideoCanh(bc)}`);
    const ck = chamKeyframe(bc); const cv = chamVideo(bc); const loi = [...ck.loi, ...cv.loi];
    console.log(`  ${loi.some((l) => l.phat >= 20) ? '✗' : '✓'} điểm prompt keyframe ${ck.diem}/100 · video ${cv.diem}/100${loi.length ? `\n    ${loi.map((l) => `−${l.phat} ${l.chu}`).join('\n    ')}` : ''}`);
  }
  process.exit(0);
}
if (arg('uoc') || (!arg('anchor') && !arg('bien-the') && !arg('keyframe') && !arg('xuat') && !process.argv.some((a) => a.startsWith('--nhac=')))) { console.log('(chỉ ước lượng — thêm --anchor / --keyframe / --nhac=… / --xuat để chạy)'); process.exit(0); }

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
  for (const [i, x] of (await songSong(anchorThieu, (a) => sinhAnhGoc(db, Number(a.id)))).entries()) { const r = x.ok ? x.data : { ok: false as const, loi: x.loi }; if (r.ok) jobs.push(r.data); else console.log(`  ✗ ${anchorThieu[i]!.ten}: ${r.loi}`); }
  await doi(jobs, 'ảnh gốc');
  const loi = await q(sql`SELECT nhan, loi FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[]) AND trang_thai = 'loi'`);
  for (const l of loi) console.log(`  ✗ ${l.nhan}: ${String(l.loi).slice(0, 160)}`);
  for (const b of banSao) {
    const goc = anchorThieu.find((x) => kieuCua(x) === kieuCua(b))!;
    const r = await q(sql`UPDATE xv_nhan_vat d SET anh_ref = g.anh_ref, updated_at = now() FROM xv_nhan_vat g WHERE d.id = ${Number(b.id)} AND g.id = ${Number(goc.id)} AND jsonb_array_length(g.anh_ref) > 0 RETURNING d.id`);
    console.log(`  ${r.length ? '⧉' : '✗'} ${b.ten}: ${r.length ? `chép ảnh của ${goc.ten}` : `${goc.ten} chưa có ảnh`}`);
  }
}
if (arg('bien-the') && btThieu.length) {
  const jobs: number[] = [];
  for (const [i, x] of (await songSong(btThieu, (b) => sinhAnhBienTheDb(db, Number(b.id), nguon || undefined))).entries()) { const r = x.ok ? x.data : { ok: false as const, loi: x.loi }; const b = btThieu[i]!; if (r.ok) jobs.push(r.data); else console.log(`  ✗ ${b.nv} · ${b.ten}: ${r.loi}`); }
  await doi(jobs, 'biến thể');
  const loi = await q(sql`SELECT nhan, loi FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[]) AND trang_thai = 'loi'`);
  for (const l of loi) console.log(`  ✗ ${l.nhan}: ${String(l.loi).slice(0, 160)}`);
}
// Cổng ngôn ngữ (0đ): chữ sai thì ảnh/giọng sinh ra cũng phải làm lại — 09/10/2026 phim EN ra chữ VI, keyframe chạy mù mất tiền.
if ((arg('keyframe') || arg('xuat')) && tapId && !arg('bo-qua-ngon-ngu')) {
  const shots = await q(sql`SELECT thu_tu, chu_man, thoai, loi_thoai, canh, goc_may, hanh_dong, am_thanh, phan_doan, trang_phuc, prompt_anh, prompt_video FROM xv_canh WHERE tap_id = ${tapId}`);
  const lech = shotLechNgonNgu(kt.ngon_ngu, shots as never);
  if (lech.length) { console.error(`  ✗ phim ${tenNgonNgu(kt.ngon_ngu)} nhưng ${lech.length} shot còn chữ màn/thoại tiếng Việt (#${lech.slice(0, 10).join(', #')}) — dịch tập trước (scripts/dich-tap.mts), hoặc --bo-qua-ngon-ngu`); process.exit(2); }
}
// --tiep-job (0đ thêm): job ẢNH của tập đang 'cho' mà tiến trình chạy nó đã chết (hàng nền trong tiến trình sinh-anh-phim) — đẩy lại đúng đầu vào đã lưu
// (prompt + ảnh tham chiếu, kể cả ảnh bước 1 FLUX đã trả tiền), không chạy lại FLUX. Job bước 1 treo (gọi đồng bộ, không đẩy lại được) → đánh lỗi.
if (arg('tiep-job') && tapId) {
  const treo = await q(sql`SELECT j.id, j.nhan, j.model, j.request, j.canh_id FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE c.tap_id = ${tapId} AND j.loai = 'anh' AND j.trang_thai = 'cho' AND j.created_at < now() - interval '3 minutes' ORDER BY j.id`);
  const day: number[] = [];
  for (const j of treo) {
    const rq = (j.request ?? {}) as { prompt?: string; thamChieuUrl?: string[] };
    if (String(j.nhan).includes('bước 1') || !rq.prompt) { await db.execute(sql`UPDATE xv_job SET trang_thai = 'loi', loi = 'tiến trình chạy job đã chết (không đẩy lại được bước gọi đồng bộ)' WHERE id = ${j.id}`); console.log(`  ✗ job ${j.id} ${j.nhan}: đánh lỗi`); continue; }
    await dayViecAnh({ job: Number(j.id), model: String(j.model), prompt: rq.prompt, thamChieuUrl: rq.thamChieuUrl ?? [], tiLe: kt.ti_le, thuMuc: `keyframe/${j.canh_id}` });
    day.push(Number(j.id)); console.log(`  ↻ job ${j.id} ${j.nhan}`);
  }
  if (day.length) await doi(day, 'job tiếp');
}
if (arg('keyframe') && canhThieu.length) {
  const jobs: number[] = [];
  // SONG SONG có trần (song-song.ts): bước 1 FLUX gọi đồng bộ từng shot — tuần tự thì 25 shot × ~1 phút
  await songSong(canhThieu, async (c) => {
    if (lamLai) await db.execute(sql`UPDATE xv_canh SET keyframe_url = NULL WHERE id = ${c.id}`);   // ảnh mới về thì thành ảnh chọn (hoan-tat: coalesce)
    // MỖI SHOT BỌC RIÊNG: một lỗi (mạng, cổng) không đổ cả lượt — 17/10/2026 ConnectTimeout ở shot #12 làm chết tiến trình, 4 job hàng nền treo, 5 shot mất ảnh chọn
    const r = await sinhKeyframeCanh(db, Number(c.id), 1, nguon || undefined, congAnh || undefined).catch((e: unknown) => ({ ok: false as const, loi: `lỗi không bắt được: ${e instanceof Error ? e.message : String(e)}` }));
    if (r.ok) jobs.push(...r.data);
    else { console.log(`  ✗ #${c.thu_tu} ${c.canh}: ${r.loi}`); if (lamLai && c.keyframe_url) await db.execute(sql`UPDATE xv_canh SET keyframe_url = coalesce(keyframe_url, ${String(c.keyframe_url)}) WHERE id = ${c.id}`); }
  });
  await doi(jobs, 'keyframe');
  // --lam-lai: job hỏng SAU khi đã gửi (cổng từ chối, hết giờ) → shot không còn ảnh chọn; trả lại ảnh cũ (vẫn nằm trong keyframe_uv), không để trống.
  if (lamLai) for (const c of canhThieu) if (c.keyframe_url) await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${String(c.keyframe_url)} WHERE id = ${c.id} AND keyframe_url IS NULL`);
  const loi = await q(sql`SELECT nhan, loi FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[]) AND trang_thai = 'loi'`);
  for (const l of loi) console.log(`  ✗ ${l.nhan}: ${String(l.loi).slice(0, 160)}`);
}
const moNhac = (process.argv.find((a) => a.startsWith('--nhac=')) ?? '').slice(7);
if (moNhac && tapId) {
  const moTa = (process.argv.find((a) => a.startsWith('--mo-ta-nhac=')) ?? '').slice(13);
  const truoc = Number((await q(sql`SELECT coalesce(max(id), 0) AS m FROM xv_job`))[0]!.m);
  const r = await sinhNhacTap(db, tapId, moNhac, undefined, moTa);
  if (!r.ok) { console.log(`  ✗ nhạc: ${r.loi}`); process.exit(1); }
  for (let i = 0; i < 120; i++) {
    const j = await q(sql`SELECT id, nhan, trang_thai, loi, output_url, chi_phi_cents FROM xv_job WHERE id > ${truoc} AND loai = 'am' AND request->>'dich' = 'nhac' AND request->>'tap_id' = ${String(tapId)} ORDER BY id DESC LIMIT 1`);
    if (j[0] && j[0].trang_thai !== 'cho') { console.log(`  ${j[0].trang_thai === 'xong' ? '✓' : '✗'} ${j[0].nhan} · ${tien(Number(j[0].chi_phi_cents))} → ${j[0].output_url ?? j[0].loi}`); break; }
    await new Promise((ok) => setTimeout(ok, 5000));
  }
}
if (arg('xuat') && tapId) {
  const bc = (await boiCanhTap(db, tapId))!;
  const canh = (await q(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)).map(mapCanh);
  const job = await taoJob(db, { phim_id: phimId, nhan: `Xuất bản · tập ${bc.tap.so} (script)`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: 'A' } });
  const kq = await chayXuat({ loai: bc.loai, tiLe: kt.ti_le, nhipStopMotion: kt.nhip_stop_motion, look: lookPhim(kt), canh, nhanVat: bc.nhanVat, tap: bc.tap, qc: kt.qc, nhanh: 'A', choThieuNhac: arg('thieu-nhac') });
  if (!kq.ok) { await db.execute(sql`UPDATE xv_job SET trang_thai = 'loi', loi = ${kq.loi} WHERE id = ${job}`); console.log(`  ✗ xuất: ${kq.loi}`); }
  else {
    await ghiBanXuat(db, { tapId, job, nhanh: 'A', kq });
    console.log(`  ✓ bản xuất ${kq.giay}s → ${kq.url}${kq.canhThieu.length ? ` · thiếu hình: ${kq.canhThieu.join(', ')}` : ''}`);
    for (const c of kq.canhBao) console.log(`  ⚠ ${c}`);
  }
}
const tong = await q(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS c FROM xv_job WHERE phim_id = ${phimId} AND tinh_chi`);
console.log(`tổng đã chi cho phim #${phimId}: ${tien(Number(tong[0]!.c))} → https://studio.on.tc/?m=phim&mId=${phimId}`);
process.exit(0);
