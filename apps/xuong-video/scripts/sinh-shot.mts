// Sinh TỪNG BƯỚC cho vài shot chọn tay trên box (anh 09/10/2026: "cấm làm hàng loạt — tập trung 2 shot đầu xem ra thế nào"):
//   --canh=73,74                 : id shot (bắt buộc). Mặc định chỉ ƯỚC LƯỢNG (0đ), không chạy gì.
//   --xem                        : (0đ) in đúng prompt video sẽ gửi cho từng shot + cổng ngôn ngữ — kiểm trước khi tiêu tiền.
//   --mo-hinh=<key>              : model ảnh cho --keyframe (so A/B, vd gemini-nano-banana-2.1); mặc định theo kinh thánh.
//   --video --thu                : sinh THỬ video ngoài quy trình (như nút 🧪 Sinh thử), ảnh cuối = keyframe kết nếu có
//   --ghep-nen                   : (0đ) ghép lại nền ảnh kết / giữa từ ảnh Nano mới nhất (ghep-vung.ts › ghepNenKet)
//   --keyframe-ket [--ep]        : sinh keyframe KẾT + GIỮA (khung 3D kết / giữa) → keyframe_ket / keyframe_giua — dải nhịp ảnh thứ 2 của video; --ep = cả shot không gắn cờ đổi khung
//   --keyframe                   : sinh lại 1 keyframe cho mỗi shot, đợi xong, CHỌN ảnh mới làm keyframe đang dùng (ảnh cũ vẫn trong dải ứng viên,
//                                  ↶ Hoàn tác được). 09/10/2026: không chọn → video chạy từ keyframe cũ sai quần, mất $0,40.
//   --chon=<url>                 : (0đ) chọn một ảnh trong dải ứng viên làm keyframe đang dùng (chỉ khi --canh có MỘT shot).
//   --duyet                      : đánh dấu shot đã duyệt keyframe (0đ) — bước bắt buộc trước --video.
//   --video                      : sinh video nháp (Veo/fal theo kinh thánh) qua hàng đợi tối đa --song-song=2 clip, tự đợi hạn mức, in link + tiền.
//   --giong-dan=<model>|<voice>  : (kèm --giong) đổi giọng LỜI DẪN của cả phim, vd fal-ai/elevenlabs/tts/eleven-v3|Jessica
//   --giong                      : sinh giọng cho dòng thoại CHƯA có giọng của các shot (--giong-lai: cả dòng đã có), đợi file, in link.
//   --xuat                       : (0đ) dựng MP4 CHỈ các shot này (chữ màn kiểu phim, logo, giọng, nhạc) để xem thử — không ghi vào danh sách bản xuất của tập.
//   THỨ TỰ: --keyframe → (anh xem) → --duyet → --giong → --video. Giọng TRƯỚC video: có file giọng thì Veo sinh clip câm (chỉ cử miệng),
//   không có thì Veo tự đọc thoại — đọc lơ lớ và dễ in phụ đề giả (thử 09/10/2026 tốn $0,40 cho 2 clip hỏng).
//   MỖI LẦN CHẠY MỘT CỜ TỐN TIỀN. Ví dụ:
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-shot.mts --canh=73,74 --keyframe
import { lookPhim } from '../src/lib/xuong-video/look';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sinhKeyframeCanh, sinhKeyframeKetCanh } from '../src/lib/xuong-video/sinh-anh';
import { batDauVideoCanh, kiemVideoTap, promptVideoCanh } from '../src/lib/xuong-video/sinh-video';
import { sinhGiongShots, MODEL_GIONG_MAC_DINH } from '../src/lib/xuong-video/sinh-giong';
import { khopGiongTap } from '../src/lib/xuong-video/hau-ky';
import { giaAnhSv } from '../src/lib/xuong-video/hoan-tat';
import { dongThoai, dungTiengClip, giaGiongTheo } from '../src/lib/xuong-video/am-thanh';
import { dsMoHinhGiong } from '../src/lib/xuong-video/giong';
import { boiCanhCanh, mapCanh, giaVideoSv, type Row } from '../src/lib/xuong-video/doc-db';
import { doiModelVideo } from '../src/lib/xuong-video/qc-cam-xuc';
import { chuoiVideo } from '../src/lib/xuong-video/cong-ai';
import { lamTronClip, tien, chanChuModel, coTiengViet } from '../src/lib/xuong-video/kieu';
import { chonKeyframe } from '../src/lib/xuong-video/tu-sua-clip';
import { chayXuat } from '../src/lib/xuong-video/xuat-chay';
import { mapNhanVat, mapTap } from '../src/lib/xuong-video/doc-db';

const arg = (k: string) => process.argv.includes(`--${k}`);
const ids = ((process.argv.find((a) => a.startsWith('--canh=')) ?? '').split('=')[1] ?? '').split(',').map(Number).filter((x) => x > 0);
if (!ids.length) { console.error('thiếu --canh=<id,id>'); process.exit(1); }
const urlChon = (process.argv.find((a) => a.startsWith('--chon=')) ?? '').slice(7);
const moHinhAnh = (process.argv.find((a) => a.startsWith('--mo-hinh=')) ?? '').slice(10) || undefined;
// --mo-hinh-video=fal:fal-ai/veo3.1/lite/image-to-video : cùng Veo 3.1 Lite qua fal (cùng giá) khi khoá Google hết hạn mức/tiền (10/10/2026).
const moHinhVideo = (process.argv.find((a) => a.startsWith('--mo-hinh-video=')) ?? '').slice(16) || undefined;
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const doi = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Chọn ảnh làm keyframe đang dùng — cùng câu với action chonKeyframe, kèm chụp hoàn tác. */
const chonKf = (id: number, url: string) => chonKeyframe(db!, id, url, 'script sinh-shot');
const bcs = [];
for (const id of ids) { const bc = await boiCanhCanh(db, id); if (!bc) { console.error(`không thấy shot #${id}`); process.exit(1); } bcs.push(bc); }
const kt = bcs[0]!.kt; const tapId = bcs[0]!.canh.tap_id;
const giaAnh = await giaAnhSv(kt.mo_hinh_anh).catch(() => 0);
const dm = await dsMoHinhGiong();
let uocVideo = 0, uocGiong = 0; const dsModelVideo = new Set<string>();
for (const bc of bcs) {
  const giay = lamTronClip(bc.canh.thoi_luong_s);
  // ước theo ĐÚNG model sẽ gửi: shot có trẻ em tự sang Kling (qc-cam-xuc.ts › doiModelVideo) — trước 16/10/2026 dòng ước vẫn ghi Veo $0.20 cho clip Kling ~$0.70
  const mv = doiModelVideo(kt.mo_hinh_video, bc.nhanVat.filter((v) => v.loai === 'nhan_vat'))?.model ?? kt.mo_hinh_video; dsModelVideo.add(mv);
  uocVideo += await giaVideoSv(mv, kt.do_phan_giai, giay, dungTiengClip(bc.canh, bc.nhanVat)).catch(() => 0);   // cùng luật tiếng với lúc sinh/tính tiền thật
  for (const d of dongThoai(bc.canh, bc.nhanVat)) { const v = bc.nhanVat.find((x) => x.ten === d.nhan_vat); uocGiong += giaGiongTheo(dm, v?.giong_model || (!v && bc.kt.giong_dan?.model) || MODEL_GIONG_MAC_DINH(), d.loi.length) ?? 0; }
}
console.log(`tập #${tapId} · ${bcs.map((b) => `#${b.canh.thu_tu} (id ${b.canh.id}, ${b.canh.trang_thai}${b.canh.keyframe_url ? ', có keyframe' : ''})`).join(' · ')}`);
console.log(`  ước: keyframe ${bcs.length} × ${tien(giaAnh)} = ${tien(giaAnh * bcs.length)} · video ${[...dsModelVideo].join(' + ')} ${kt.do_phan_giai} ≈ ${tien(uocVideo)} · giọng ≈ ${tien(uocGiong)}`);
if (arg('xem')) {
  for (const bc of bcs) {
    const p = promptVideoCanh(bc);
    console.log(`\n── #${bc.canh.thu_tu} keyframe đang dùng: ${bc.canh.keyframe_url}`);
    console.log(`   cổng: ${chanChuModel(kt.ngon_ngu, { phongCach: kt.phong_cach, shot: bc.canh, anchor: bc.nhanVat }) ?? 'sạch'} · tiếng Việt trong prompt: ${coTiengViet(p) ? 'CÓ' : 'không'} · chữ "text/caption" ngoài lệnh cấm: ${/(?<!no )\b(text|captions?|subtitles?)\b(?! or| appear)/i.test(p.replace(/no text, captions or logos appear/i, '')) ? 'CÓ' : 'không'}`);
    console.log(p);
  }
process.exit(0);
}
if (!arg('keyframe') && !arg('keyframe-ket') && !arg('ghep-nen') && !arg('duyet') && !arg('video') && !arg('giong') && !arg('xuat') && !urlChon) { console.log('(chỉ ước lượng — thêm MỘT cờ --keyframe / --duyet / --video / --giong để chạy)'); process.exit(0); }

if (arg('keyframe')) {
  const jobs: number[] = [];
  // --thu: THỬ ngoài quy trình (cảnh mẫu một cảnh — bỏ cổng cấp tập / thẻ shot, giữ cổng prompt + ngôn ngữ + thành phần), như --video --thu
  for (const bc of bcs) { const r = await sinhKeyframeCanh(db, bc.canh.id, 1, moHinhAnh, undefined, !!arg('thu')); if (r.ok) jobs.push(...r.data); else console.log(`  ✗ #${bc.canh.thu_tu}: ${r.loi}`); }
  for (let i = 0; i < 120; i++) {
    const r = await q(sql`SELECT count(*) FILTER (WHERE trang_thai = 'cho') AS cho FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[])`);
    if (Number(r[0]?.cho) === 0) break; await doi(5000);
  }
  // Đường nhiều bước (ghép từng người, bước 1 + bước 2) đã tự chọn ảnh CUỐI (sinh-anh.ts › chonKeyframe); job giữa chừng (plate, ô mặt 1024²) chỉ là
  // bước trung gian — chọn đè từng job làm #3 / #15 (22/10/2026) nhận ô mặt vuông làm keyframe. Chỉ chọn khi shot chưa có ảnh nào.
  const kq = await q(sql`SELECT j.canh_id, j.trang_thai, j.output_url, j.loi, j.chi_phi_cents, j.nhan, c.thu_tu, c.keyframe_url FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE j.id = ANY(${`{${jobs.join(',')}}`}::int[]) ORDER BY c.thu_tu, j.id`);
  for (const r of kq) {
    const chon = r.trang_thai === 'xong' && r.output_url && !r.keyframe_url;
    if (chon) await chonKf(Number(r.canh_id), String(r.output_url));
    console.log(`  #${r.thu_tu} ${r.trang_thai} ${String(r.nhan).replace(/ · cảnh #\d+.*$/, '')} ${r.output_url ?? r.loi} · ${tien(Number(r.chi_phi_cents))}${chon ? ' · ĐÃ CHỌN làm keyframe' : ''}`);
  }
  for (const bc of bcs) { const c = await q(sql`SELECT keyframe_url FROM xv_canh WHERE id = ${bc.canh.id}`); console.log(`  #${bc.canh.thu_tu} keyframe đang chọn: ${c[0]?.keyframe_url ?? '(chưa có)'} (cần --duyet trước --video)`); }
}
// --ghep-nen (0đ + tách người ~$0,002 / người): GHÉP LẠI nền ảnh KẾT / GIỮA từ ảnh Nano mới nhất đã sinh (ghep-vung.ts › ghepNenKet) — sửa bước ghép không
// phải trả tiền sinh lại ảnh.
if (arg('ghep-nen')) {
  const { ghepNenKet } = await import('../src/lib/xuong-video/ghep-vung');
  for (const bc of bcs) for (const giua of [false, true]) {
    const j = (await db.execute(sql`SELECT output_url FROM xv_job WHERE canh_id = ${bc.canh.id} AND request->>'dich' = ${giua ? 'keyframe_giua' : 'keyframe_ket'} AND trang_thai = 'xong' AND output_url IS NOT NULL ORDER BY id DESC LIMIT 1`)) as unknown as { output_url: string }[];
    if (!j[0]) continue;
    const g = await ghepNenKet(db, bc.canh.id, j[0].output_url, giua);
    if (!g) { console.log(`  · #${bc.canh.thu_tu} ${giua ? 'GIỮA' : 'KẾT'}: không áp dụng (khung 3D chưa có góc kết)`); continue; }
    if (giua) await db.execute(sql`UPDATE xv_canh SET keyframe_giua = ${g.url}, updated_at = now() WHERE id = ${bc.canh.id}`);
    else await db.execute(sql`UPDATE xv_canh SET keyframe_ket = ${g.url}, updated_at = now() WHERE id = ${bc.canh.id}`);
    console.log(`  #${bc.canh.thu_tu} ${giua ? 'GIỮA' : 'KẾT'} ghép nền ${g.url} · vùng AI ${g.vung}% · nền Nano lệch ${g.lech}%`);
  }
  process.exit(0);
}
// --keyframe-ket: sinh KEYFRAME KẾT (khung cuối, từ khung màu chỗ kết của bản 3D) → xv_canh.keyframe_ket; video nhận làm ảnh cuối.
if (arg('keyframe-ket')) {
  const jobs: number[] = [];
  for (const bc of bcs) { const r = await sinhKeyframeKetCanh(db, bc.canh.id, { ep: arg('ep') }); if (r.ok) jobs.push(...r.data); else console.log(`  ✗ #${bc.canh.thu_tu}: ${r.loi}`); }
  for (let i = 0; i < 120 && jobs.length; i++) {
    const r = await q(sql`SELECT count(*) FILTER (WHERE trang_thai = 'cho') AS cho FROM xv_job WHERE id = ANY(${`{${jobs.join(',')}}`}::int[])`);
    if (Number(r[0]?.cho) === 0) break; await doi(5000);
  }
  const kq = jobs.length ? await q(sql`SELECT j.trang_thai, j.output_url, j.loi, j.chi_phi_cents, c.thu_tu FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE j.id = ANY(${`{${jobs.join(',')}}`}::int[]) ORDER BY c.thu_tu`) : [];
  for (const r of kq) console.log(`  #${r.thu_tu} KẾT ${r.trang_thai} ${r.output_url ?? r.loi} · ${tien(Number(r.chi_phi_cents))}`);
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
  // Trần song song THEO CỔNG (anh 24/10/2026: "sao không sinh song song?" — 17 clip qua Kie chạy 2 một lúc, vòng 50 phút không kịp): Google trực tiếp
  // ~3 yêu cầu cùng lúc → 2; cổng trung gian (Kie / PlenX) tự xếp hàng phía họ → 8. --song-song đè khi cần.
  // model khoá cổng 'kie:veo3_lite' / 'fal:…' → cổng là tiền tố; model trần 'veo-…' → cổng đầu chuỗi (cong-ai.ts › chuoiVideo)
  const mVid = String(moHinhVideo ?? bcs[0]?.kt.mo_hinh_video ?? ''); const congDau = /^[a-z]+:/.test(mVid) ? mVid.split(':')[0] : chuoiVideo(mVid, false)[0]?.cong ?? 'google';
  const toiDa = Number((process.argv.find((a) => a.startsWith('--song-song=')) ?? '').split('=')[1] || (congDau && congDau !== 'google' ? 8 : 2));
  const phutToiDa = Math.max(50, Math.ceil(bcs.length / toiDa) * 12);   // vòng chờ đủ cho số clip / trần song song (~8–10 phút mỗi lượt clip)
  const cho = [...bcs]; const chay = new Map<number, number>(); const jobs: number[] = []; let nghi = 0; let soLanCho = 0; let dungHan = false;
  const t0 = Date.now();
  while ((cho.length || chay.size) && Date.now() - t0 < phutToiDa * 60_000 && soLanCho <= 5 && !dungHan) {
    while (cho.length && chay.size < toiDa && Date.now() >= nghi) {
      const bc = cho.shift()!;
      // --thu: SINH THỬ ngoài quy trình (cùng hàm nút 🧪 Sinh thử) — bỏ cổng duyệt / kiểm khung / animatic; job ghi 🧪 THỬ.
      // Lỗi bất ngờ khi gửi một shot không giết cả vòng (đã gửi thì job vẫn được theo dõi tiếp).
      const r = await batDauVideoCanh(db, bc.canh.id, moHinhVideo, 'nhap', false, arg('thu')).catch((e: unknown) => ({ ok: false as const, loi: `lỗi khi gửi: ${e instanceof Error ? e.message : String(e)}` }));
      if (r.ok) { chay.set(r.data, bc.canh.thu_tu); jobs.push(r.data); console.log(`  → gửi #${bc.canh.thu_tu}`); }
      else if (/THEO NGÀY/.test(r.loi)) { console.log(`  ✗ dừng: ${r.loi}`); cho.unshift(bc); dungHan = true; break; }
      else if (/rate limit|hạn mức|429/i.test(r.loi)) { cho.unshift(bc); soLanCho++; if (soLanCho > 5) { console.log(`  ✗ dừng: Google vẫn báo hạn mức sau 5 lần đợi — ${r.loi}`); break; } nghi = Date.now() + 60_000; console.log(`  … hạn mức, đợi 60s (#${bc.canh.thu_tu}, lần ${soLanCho})`); }
      else console.log(`  ✗ #${bc.canh.thu_tu}: ${r.loi}`);
    }
    await doi(10000);
    await kiemVideoTap(db, tapId).catch((e: unknown) => console.log(`  ! lượt kiểm lỗi (sẽ hỏi lại): ${e instanceof Error ? e.message : String(e)}`));
    if (chay.size) {
      const xong = await q(sql`SELECT id, trang_thai, output_url, loi FROM xv_job WHERE id = ANY(${`{${[...chay.keys()].join(',')}}`}::int[]) AND trang_thai <> 'chay'`);
      for (const r of xong) { console.log(`  #${chay.get(Number(r.id))} ${r.trang_thai} ${r.output_url ?? r.loi}`); chay.delete(Number(r.id)); }
    }
  }
  const tong = await q(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS t, count(*) FILTER (WHERE trang_thai = 'xong') AS xong, count(*) FILTER (WHERE trang_thai <> 'xong') AS hong FROM xv_job WHERE id = ANY(${`{${jobs.join(',') || 0}}`}::int[])`);
  console.log(`  video: ${tong[0]?.xong} xong · ${tong[0]?.hong} hỏng/chưa xong · ${tien(Number(tong[0]?.t))}${cho.length ? ` · còn ${cho.length} chưa gửi` : ''}`);
  // SOÁT CLIP TRONG PHIÊN là bước BẮT BUỘC sau mỗi lượt video (anh 19/10/2026: "phải tự check sau mỗi lần có video… tao phải check từng tí 1 thế
  // này à" — clip #1 cà phê vọt lên trời gửi thẳng cho anh, không ai đối chiếu kịch bản). Máy soi chữ / nét mặt không bắt được hành động sai, vật lý
  // sai, lệch nối shot — phải xem khung. In luôn tờ soát (8 khung + kế hoạch shot) của đúng các shot vừa có clip; chưa ghi soát (--ghi) thì chưa báo.
  const coClip = (await q(sql`SELECT DISTINCT c.thu_tu FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE j.id = ANY(${`{${jobs.join(',') || 0}}`}::int[]) AND j.trang_thai = 'xong' ORDER BY 1`)).map((r) => Number(r.thu_tu));
  if (coClip.length) {
    const { execFileSync } = await import('node:child_process');
    console.log(`\n⚠ CLIP CHƯA SOÁT #${coClip.join(', #')} — xem tờ khung bên dưới, đối chiếu kế hoạch (hành động · vật lý · nối shot sau · người · mặt), ghi bằng soat-cam-xuc.mts --ghi TRƯỚC khi báo anh:`);
    try { console.log(execFileSync(process.execPath, [...process.execArgv, 'scripts/soat-cam-xuc.mts', String(tapId), '--in', `--shot=${coClip.join(',')}`], { encoding: 'utf8', maxBuffer: 32 << 20, timeout: 600_000 })); }
    catch (e) { console.log(`  ! không in được tờ soát: ${e instanceof Error ? e.message : String(e)}`); }
    // CỔNG NỐI CẮT tự chạy (luat-dung.ts › do_tren_hinh_that — anh 24/10/2026: "áp dụng cho mọi phim mà không phải nhắc"): tập có sơ đồ cảnh thì đo
    // hai đầu mọi đường cắt trên clip đã dùng (0đ) + hỏi trạng thái dáng / đồ (--hoi, ~0,3¢ / khung) khi lượt này đã được duyệt tiền
    const coSoDo = (await q(sql`SELECT khong_gian <> '{}'::jsonb AS co FROM xv_tap WHERE id = ${tapId}`))[0]?.co;
    if (coSoDo) { console.log('\n── CỔNG NỐI CẮT (soat-huong.mts) ──');
      try { const ra = execFileSync(process.execPath, [...process.execArgv, 'scripts/soat-huong.mts', String(tapId), ...(process.env.DUYET_SINH_1_LAN ? ['--hoi'] : [])], { encoding: 'utf8', maxBuffer: 32 << 20, timeout: 1_200_000 });
        console.log(ra.slice(ra.indexOf('ĐƯỜNG CẮT'))); }
      catch (e) { console.log(`  ! cổng nối cắt lỗi: ${e instanceof Error ? e.message : String(e)}`); } }
  }
}
if (arg('giong')) {
  // Chỉ dòng CHƯA có giọng (giữ giọng đã duyệt); --giong-lai để sinh lại cả dòng đã có.
  // --giong-dan=<model>|<voice>: đặt giọng LỜI DẪN cho cả phim (khoá ở kinh_thanh.giong_dan) rồi đọc bằng giọng đó.
  const gd = (process.argv.find((a) => a.startsWith('--giong-dan=')) ?? '').slice(12).split('|');
  const r = await sinhGiongShots(db, tapId, ids, { chiThieu: !arg('giong-lai'), ...(gd[0] && gd[1] ? { theoNguoi: { '': { model: gd[0], voice: gd[1] } } } : {}) });
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
  // Giọng xong là KHỚP GIÂY PHÁT theo giọng luôn (hau-ky.ts) — trước đây làm tay, quên là giọng đè nhau / bị tăng tốc.
  const kg = await khopGiongTap(db, tapId, 'script sinh-shot');
  console.log(kg.ok ? `  ⏱ khớp giây theo giọng: ${kg.data.doi} shot đổi · tổng ${kg.data.tong}s` : `  ✗ khớp giọng: ${kg.loi}`);
}
if (arg('xuat')) {
  const tap = mapTap(((await q(sql`SELECT * FROM xv_tap WHERE id = ${tapId}`)) as Row[])[0]!);
  const phim = (await q(sql`SELECT p.loai, p.kinh_thanh FROM xv_phim p JOIN xv_tap t ON t.phim_id = p.id WHERE t.id = ${tapId}`))[0]!;
  const nhanVat = (await q(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${tap.phim_id} ORDER BY id`)).map(mapNhanVat);
  const canhTap = (await q(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)).map(mapCanh);
  const r = await chayXuat({ loai: String(phim.loai) as never, tiLe: kt.ti_le, nhipStopMotion: kt.nhip_stop_motion, look: lookPhim(kt), canh: canhTap, nhanVat, tap, qc: kt.qc, nhanh: null, chiThuTu: bcs.map((b) => b.canh.thu_tu), boQuaSoi: true, phuDe: kt.phu_de });
  console.log(r.ok ? `  ✓ MP4 ${r.giay}s → ${r.url}${r.canhThieu.length ? ` · thiếu ${r.canhThieu.join(', ')}` : ''}` : `  ✗ ${r.loi}`);
}
process.exit(0);
