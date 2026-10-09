// Sinh TỪNG BƯỚC cho vài shot chọn tay trên box (anh 09/10/2026: "cấm làm hàng loạt — tập trung 2 shot đầu xem ra thế nào"):
//   --canh=73,74                 : id shot (bắt buộc). Mặc định chỉ ƯỚC LƯỢNG (0đ), không chạy gì.
//   --xem                        : (0đ) in đúng prompt video sẽ gửi cho từng shot + cổng ngôn ngữ — kiểm trước khi tiêu tiền.
//   --mo-hinh=<key>              : model ảnh cho --keyframe (so A/B, vd gemini-nano-banana-2.1); mặc định theo kinh thánh.
//   --keyframe                   : sinh lại 1 keyframe cho mỗi shot, đợi xong, CHỌN ảnh mới làm keyframe đang dùng (ảnh cũ vẫn trong dải ứng viên,
//                                  ↶ Hoàn tác được). 09/10/2026: không chọn → video chạy từ keyframe cũ sai quần, mất $0,40.
//   --chon=<url>                 : (0đ) chọn một ảnh trong dải ứng viên làm keyframe đang dùng (chỉ khi --canh có MỘT shot).
//   --duyet                      : đánh dấu shot đã duyệt keyframe (0đ) — bước bắt buộc trước --video.
//   --video                      : sinh video nháp (Veo/fal theo kinh thánh) qua hàng đợi tối đa --song-song=2 clip, tự đợi hạn mức, in link + tiền.
//   --giong                      : sinh giọng cho dòng thoại CHƯA có giọng của các shot (--giong-lai: cả dòng đã có), đợi file, in link.
//   --xuat                       : (0đ) dựng MP4 CHỈ các shot này (chữ màn kiểu phim, logo, giọng, nhạc) để xem thử — không ghi vào danh sách bản xuất của tập.
//   THỨ TỰ: --keyframe → (anh xem) → --duyet → --giong → --video. Giọng TRƯỚC video: có file giọng thì Veo sinh clip câm (chỉ cử miệng),
//   không có thì Veo tự đọc thoại — đọc lơ lớ và dễ in phụ đề giả (thử 09/10/2026 tốn $0,40 cho 2 clip hỏng).
//   MỖI LẦN CHẠY MỘT CỜ TỐN TIỀN. Ví dụ:
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-shot.mts --canh=73,74 --keyframe
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sinhKeyframeCanh } from '../src/lib/xuong-video/sinh-anh';
import { batDauVideoCanh, kiemVideoTap, promptVideoCanh } from '../src/lib/xuong-video/sinh-video';
import { sinhGiongShots } from '../src/lib/xuong-video/sinh-giong';
import { giaAnhSv } from '../src/lib/xuong-video/hoan-tat';
import { dongThoai, giaGiong } from '../src/lib/xuong-video/am-thanh';
import { dsMoHinhGiong } from '../src/lib/xuong-video/giong';
import { boiCanhCanh, mapCanh, giaVideoSv, type Row } from '../src/lib/xuong-video/doc-db';
import { lamTronClip, tien, chanChuModel, coTiengViet } from '../src/lib/xuong-video/kieu';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
import { chayXuat } from '../src/lib/xuong-video/xuat-chay';
import { mapNhanVat, mapTap } from '../src/lib/xuong-video/doc-db';

const arg = (k: string) => process.argv.includes(`--${k}`);
const ids = ((process.argv.find((a) => a.startsWith('--canh=')) ?? '').split('=')[1] ?? '').split(',').map(Number).filter((x) => x > 0);
if (!ids.length) { console.error('thiếu --canh=<id,id>'); process.exit(1); }
const urlChon = (process.argv.find((a) => a.startsWith('--chon=')) ?? '').slice(7);
const moHinhAnh = (process.argv.find((a) => a.startsWith('--mo-hinh=')) ?? '').slice(10) || undefined;
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const doi = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Chọn ảnh làm keyframe đang dùng — cùng câu với action chonKeyframe, kèm chụp hoàn tác. */
async function chonKf(id: number, url: string) {
  await chupTruoc(db!, { bang: 'xv_canh', id, cot: ['keyframe_url', 'keyframe_uv', 'trang_thai'], moTa: 'chọn keyframe (script)', nguoi: 'script sinh-shot' });
  await db!.execute(sql`UPDATE xv_canh SET keyframe_url = ${url}, keyframe_uv = CASE WHEN keyframe_uv @> ${JSON.stringify([url])}::jsonb THEN keyframe_uv ELSE keyframe_uv || ${JSON.stringify([url])}::jsonb END,
    trang_thai = CASE WHEN trang_thai IN ('nhap', 'loi', 'duyet', 'xong') THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${id}`);
}
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
if (arg('xem')) {
  for (const bc of bcs) {
    const p = promptVideoCanh(bc);
    console.log(`\n── #${bc.canh.thu_tu} keyframe đang dùng: ${bc.canh.keyframe_url}`);
    console.log(`   cổng: ${chanChuModel(kt.ngon_ngu, { phongCach: kt.phong_cach, shot: bc.canh, anchor: bc.nhanVat }) ?? 'sạch'} · tiếng Việt trong prompt: ${coTiengViet(p) ? 'CÓ' : 'không'} · chữ "text/caption" ngoài lệnh cấm: ${/(?<!no )\b(text|captions?|subtitles?)\b(?! or| appear)/i.test(p.replace(/no text, captions or logos appear/i, '')) ? 'CÓ' : 'không'}`);
    console.log(p);
  }
process.exit(0);
}
if (!arg('keyframe') && !arg('duyet') && !arg('video') && !arg('giong') && !arg('xuat') && !urlChon) { console.log('(chỉ ước lượng — thêm MỘT cờ --keyframe / --duyet / --video / --giong để chạy)'); process.exit(0); }

if (arg('keyframe')) {
  const jobs: number[] = [];
  for (const bc of bcs) { const r = await sinhKeyframeCanh(db, bc.canh.id, 1, moHinhAnh); if (r.ok) jobs.push(...r.data); else console.log(`  ✗ #${bc.canh.thu_tu}: ${r.loi}`); }
  for (let i = 0; i < 120; i++) {
    const r = await q(sql`SELECT count(*) FILTER (WHERE trang_thai = 'cho') AS cho FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[])`);
    if (Number(r[0]?.cho) === 0) break; await doi(5000);
  }
  const kq = await q(sql`SELECT j.canh_id, j.trang_thai, j.output_url, j.loi, j.chi_phi_cents, c.thu_tu FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE j.id = ANY(${`{${jobs.join(',')}}`}::int[]) ORDER BY c.thu_tu`);
  for (const r of kq) {
    if (r.trang_thai === 'xong' && r.output_url) await chonKf(Number(r.canh_id), String(r.output_url));
    console.log(`  #${r.thu_tu} ${r.trang_thai} ${r.output_url ?? r.loi} · ${tien(Number(r.chi_phi_cents))}${r.output_url ? ' · ĐÃ CHỌN làm keyframe (cần --duyet lại trước --video)' : ''}`);
  }
}
if (urlChon) {
  if (bcs.length !== 1) { console.error('--chon chỉ dùng với MỘT shot'); process.exit(1); }
  await chonKf(bcs[0]!.canh.id, urlChon);
  console.log(`  ✓ #${bcs[0]!.canh.thu_tu} keyframe = ${urlChon}`);
}
if (arg('duyet')) {
  for (const bc of bcs) await db.execute(sql`UPDATE xv_canh SET trang_thai = 'duyet', loi = '', updated_at = now() WHERE id = ${bc.canh.id} AND keyframe_url IS NOT NULL`);
  console.log(`  ✓ đã duyệt keyframe ${bcs.length} shot`);
}
if (arg('video')) {
  // Hàng đợi có trần: Veo chỉ nhận ~3 yêu cầu cùng lúc — gửi 19 một lượt thì 16 bị "rate limit" (10/10/2026). Tối đa --song-song=2 clip
  // đang chạy; clip xong mới gửi tiếp; bị hạn mức thì đợi 60s rồi gửi lại (lượt bị từ chối không tốn tiền).
  const toiDa = Number((process.argv.find((a) => a.startsWith('--song-song=')) ?? '').split('=')[1] || 2);
  const cho = [...bcs]; const chay = new Map<number, number>(); const jobs: number[] = []; let nghi = 0; let soLanCho = 0; let dungHan = false;
  const t0 = Date.now();
  while ((cho.length || chay.size) && Date.now() - t0 < 50 * 60_000 && soLanCho <= 5 && !dungHan) {
    while (cho.length && chay.size < toiDa && Date.now() >= nghi) {
      const bc = cho.shift()!;
      const r = await batDauVideoCanh(db, bc.canh.id);
      if (r.ok) { chay.set(r.data, bc.canh.thu_tu); jobs.push(r.data); console.log(`  → gửi #${bc.canh.thu_tu}`); }
      else if (/THEO NGÀY/.test(r.loi)) { console.log(`  ✗ dừng: ${r.loi}`); cho.unshift(bc); dungHan = true; break; }
      else if (/rate limit|hạn mức|429/i.test(r.loi)) { cho.unshift(bc); soLanCho++; if (soLanCho > 5) { console.log(`  ✗ dừng: Google vẫn báo hạn mức sau 5 lần đợi — ${r.loi}`); break; } nghi = Date.now() + 60_000; console.log(`  … hạn mức, đợi 60s (#${bc.canh.thu_tu}, lần ${soLanCho})`); }
      else console.log(`  ✗ #${bc.canh.thu_tu}: ${r.loi}`);
    }
    await doi(10000);
    await kiemVideoTap(db, tapId);
    if (chay.size) {
      const xong = await q(sql`SELECT id, trang_thai, output_url, loi FROM xv_job WHERE id = ANY(${`{${[...chay.keys()].join(',')}}`}::int[]) AND trang_thai <> 'chay'`);
      for (const r of xong) { console.log(`  #${chay.get(Number(r.id))} ${r.trang_thai} ${r.output_url ?? r.loi}`); chay.delete(Number(r.id)); }
    }
  }
  const tong = await q(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS t, count(*) FILTER (WHERE trang_thai = 'xong') AS xong, count(*) FILTER (WHERE trang_thai <> 'xong') AS hong FROM xv_job WHERE id = ANY(${`{${jobs.join(',') || 0}}`}::int[])`);
  console.log(`  video: ${tong[0]?.xong} xong · ${tong[0]?.hong} hỏng/chưa xong · ${tien(Number(tong[0]?.t))}${cho.length ? ` · còn ${cho.length} chưa gửi` : ''}`);
}
if (arg('giong')) {
  // Chỉ dòng CHƯA có giọng (giữ giọng đã duyệt); --giong-lai để sinh lại cả dòng đã có.
  const r = await sinhGiongShots(db, tapId, ids, { chiThieu: !arg('giong-lai') });
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
if (arg('xuat')) {
  const tap = mapTap(((await q(sql`SELECT * FROM xv_tap WHERE id = ${tapId}`)) as Row[])[0]!);
  const phim = (await q(sql`SELECT p.loai, p.kinh_thanh FROM xv_phim p JOIN xv_tap t ON t.phim_id = p.id WHERE t.id = ${tapId}`))[0]!;
  const nhanVat = (await q(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${tap.phim_id} ORDER BY id`)).map(mapNhanVat);
  const canhTap = (await q(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)).map(mapCanh);
  const r = await chayXuat({ loai: String(phim.loai) as never, tiLe: kt.ti_le, canh: canhTap, nhanVat, tap, qc: kt.qc, nhanh: null, chiThuTu: bcs.map((b) => b.canh.thu_tu) });
  console.log(r.ok ? `  ✓ MP4 ${r.giay}s → ${r.url}${r.canhThieu.length ? ` · thiếu ${r.canhThieu.join(', ')}` : ''}` : `  ✗ ${r.loi}`);
}
process.exit(0);
