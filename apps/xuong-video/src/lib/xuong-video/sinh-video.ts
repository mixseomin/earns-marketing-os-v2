// Lõi sinh video cho một shot + nhận kết quả (Veo qua Google hoặc model fal) — tách khỏi actions.ts để script trên box
// (scripts/sinh-shot.mts) và server action (sinhVideoCanh / kiemVideo) dùng CÙNG một đường; actions chỉ kiểm quyền rồi gọi vào đây.
import { moTaChuyenDong } from './bo-set-3d';
import 'server-only';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { uploadToR2 } from '@/lib/r2';
import { batDauVeo, docVeo, taiVeo, taiAnhBase64 } from './google';
import { docFal, guiFal, dauVaoTheoSchema, khoaFal } from './fal';
import { chuoiVideo, guiVideoCong, docVideoCong, giaVideoCong, laHetTien, tachKhoa, MO_HINH_CONG, type BuocNguon, type NguonSinh } from './cong-ai';
import { baoHetTien } from './bao-het-tien';
import { promptKyThuatVideo } from './dien-anh';
import { dongThoai, promptCamXuc, laLoiDan, dungTiengClip } from './am-thanh';
import { tronModelCanh } from './sinh-anh';
import { chanVideo } from './quy-trinh';
import { chupTruoc } from './hoan-tac';
import { sinhGiongShots } from './sinh-giong';
import { type Canh, type TapHoSo, coMau, camCongCuVe, loaiCongCuVe, laTayNguoi, lamTronClip, noiKhungShot, boThoaiTrongPrompt, tenNgonNgu, chanChuModel, phongCachHinh, MO_HINH_VIDEO, NANG_CAP, KHOP_MIENG } from './kieu';
import { boiCanhCanh, taoJob, xongJob, mapJob, giaVideoSv, s, type Db, type Row } from './doc-db';
/** Khung hình sống (nhip-hinh.ts): clip AI hay đứng như ảnh — nhân vật làm hành động bằng cả thân, chuyển động phụ không ngừng. */
const KHUNG_SONG = 'Keep the whole frame alive: the characters perform the action with clear, readable whole-body movement (not just a small facial change), and secondary motion never stops — fur, leaves, grass, clouds and small background details keep drifting.';

type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });

/** Prompt gửi model video cho một shot — tách riêng để script xem trước (0đ) đúng câu sẽ gửi (scripts/sinh-shot.mts --xem). */
/** Thẻ shot cho clip: hành động đi trọn từ trạng thái mở tới trạng thái kết, giữ hướng màn hình (trục 180°). */
const theVideo = (dd: Canh['dan_dung']): string => [dd?.mo?.trim() && dd?.ket?.trim() ? `The action runs completely from: ${dd.mo.trim()} — to: ${dd.ket.trim()}` : '', dd?.dien?.trim() ? `Cartoon acting (anticipation, action, follow-through, squash and stretch, hold the reaction): ${dd.dien.trim().replace(/[.\s]+$/, '')}` : '', dd?.huong?.trim() ? `Keep screen direction: ${dd.huong.trim()}` : ''].filter(Boolean).map((x) => `${x}.`).join(' ');
export function promptVideoCanh(bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>): string {
  // Shot đã có file giọng riêng → clip KHÔNG được tự đọc thoại (Veo đọc giọng lơ lớ, chồng với TTS — #1219); miệng vẫn cử động để khớp miệng sau.
  const coGiong = dongThoai(bc.canh, bc.nhanVat).some((d) => d.url);
  // Sản phẩm/người/bối cảnh phải giữ y như khung đầu (keyframe đã duyệt): Veo tự "sửa" quần theo chữ tả trong prompt_video và cho nhân vật
  // đi khỏi khung (thử 2 shot 09/10/2026) — nói rõ khung đầu là chân lý, chủ thể ở trong khung suốt clip, không chữ.
  const coSp = bc.nhanVat.some((v) => v.loai === 'san_pham');
  const giuKhung = `The first frame is the ground truth: keep every person, ${coSp ? 'the product (exact same garment — cut, color, pockets, fabric — never restyled), ' : ''}the set and the framing exactly as in it; the main subject stays fully in frame for the whole clip; no text, captions or logos appear.`;
  // Thoại: KHÔNG lấy câu trong ngoặc kép của prompt_video (ngôn ngữ cũ, Veo in thành phụ đề) — ghép từ dòng thoại hiện tại của shot;
  // có file giọng riêng rồi thì clip câm (chỉ cử miệng). Nên sinh GIỌNG trước VIDEO.
  const dong = dongThoai(bc.canh, bc.nhanVat).filter((d) => d.loi.trim());
  // Lời dẫn ngoài khung (V.O./voice-over/không có người nói) KHÔNG được cho ai trong khung nhép miệng — thử 09/10/2026: lời Linda V.O. mà prompt
  // bảo "nhân vật cử miệng" thì ông Tom nhép câu của vợ. Chỉ người nói có mặt trong shot + không ghi V.O. mới cử miệng.
  const laVO = (d: { nhan_vat: string; dien_xuat: string }) => !d.nhan_vat.trim() || laLoiDan(d.dien_xuat);
  const trongKhung = dong.filter((d) => !laVO(d));
  const thoaiVeo = coGiong || !dong.length ? '' : [
    trongKhung.length ? `On-camera dialogue (${tenNgonNgu(bc.kt.ngon_ngu)}, natural lip-sync, no subtitles): ${trongKhung.map((d) => `${d.nhan_vat} says "${d.loi.trim()}"`).join('; ')}.` : '',
    dong.some(laVO) ? `Off-screen voice-over (${tenNgonNgu(bc.kt.ngon_ngu)}, nobody in frame moves their lips for it): ${dong.filter(laVO).map((d) => `"${d.loi.trim()}"`).join(' ')}` : '',
  ].filter(Boolean).join(' ');
  return [phongCachHinh(bc.kt.phong_cach) ? `Visual style: ${phongCachHinh(bc.kt.phong_cach).replace(/[.\s]+$/, '')}.` : '', camCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat)), boThoaiTrongPrompt(bc.canh.prompt_video.trim() || bc.canh.hanh_dong), theVideo(bc.canh.dan_dung), moTaChuyenDong(bc.canh.khung_xam?.di), coMau(bc.kt.qc) ? '' : KHUNG_SONG, thoaiVeo, giuKhung, bc.canh.trang_phuc.trim() ? `Clothing stays exactly: ${bc.canh.trang_phuc.trim()}; no extra garments.` : '', promptKyThuatVideo(bc.canh.ky_thuat), promptCamXuc(bc.canh, bc.nhanVat, 'video'),
    coGiong ? `IMPORTANT: the audio track must contain NO spoken words or voice — only ambient sound; a separate voice recording is added later. ${trongKhung.length ? `${[...new Set(trongKhung.map((d) => d.nhan_vat))].join(' and ')} mouth their lines with natural lip movement in silence.` : 'The lines are an off-screen voice-over: nobody in frame talks or moves their lips as if speaking.'}` : ''].filter(Boolean).join(' ');
}

/** Nối cảnh: khung cuối = keyframe cảnh kế (cùng tập) khi tập bật noi_khung → các clip ghép liền mạch, bản cuối khớp bố cục bản nháp.
 *  Một chỗ cho lúc sinh thật và sơ đồ nguồn. */
export async function khungCuoiCanh(db: Db, canhId: number): Promise<string | null> {
  // Keyframe KẾT của chính shot (sinh từ khung màu chỗ kết của bản 3D) thắng mọi nguồn khác: video phải đi đúng từ chỗ mở tới chỗ kết.
  const kk = (await db.execute(sql`SELECT keyframe_ket FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[];
  if (kk[0]?.keyframe_ket) return s(kk[0].keyframe_ket);
  const ke = (await db.execute(sql`SELECT c2.keyframe_url, t.noi_khung, c.ky_thuat FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id
    LEFT JOIN LATERAL (SELECT keyframe_url FROM xv_canh x WHERE x.tap_id = c.tap_id AND x.thu_tu > c.thu_tu ORDER BY x.thu_tu LIMIT 1) c2 ON true WHERE c.id = ${canhId}`)) as unknown as Row[];
  return ke[0] && noiKhungShot(ke[0].noi_khung === true, { ky_thuat: ke[0].ky_thuat as { chuyen_canh?: string } | null }) && ke[0].keyframe_url ? s(ke[0].keyframe_url) : null;
}

/** Veo trên Google → cùng model trên fal (dự phòng khi Google hết lượt/ngày). Id đã kiểm tồn tại trên fal.ai/models 15/10/2026. */
const VEO_SANG_FAL: Record<string, string> = {
  'veo-3.1-lite-generate-preview': 'fal-ai/veo3.1/lite/image-to-video',
  'veo-3.1-fast-generate-preview': 'fal-ai/veo3.1/fast/image-to-video',
  'veo-3.1-generate-preview': 'fal-ai/veo3.1/image-to-video',
};

/** Gửi một shot đi sinh video (nháp hoặc bản cuối) — shot phải đã duyệt keyframe. Trả về id job; kết quả về qua kiemVideoTap. */
/** tuDong (nút "Sinh nháp" một lần bấm, 13/10/2026 — "không lỗi thì chặn"): keyframe đang chọn chưa duyệt → bấm sinh video = duyệt nó;
 *  còn dòng thoại/lời dẫn chưa có giọng → sinh giọng trước, giọng xong máy tự gửi video (hoanTatAm). Trả data = 0 khi mới xếp giọng. */
/** thu = SINH THỬ ngoài quy trình (anh 14/10/2026: "phải cho thử ngoài quy trình"): bỏ cổng sản xuất (duyệt keyframe, kiểm khung, animatic,
 *  giọng trước) — vẫn cần keyframe; job ghi rõ 🧪 THỬ. Chỉ admin bấm, tiền tính như thường. */
/** boQuaCong: đi thẳng model đã chọn (Google), không qua chuỗi cổng — dùng khi task cổng vừa treo/hỏng và đang sinh lại. */
export async function batDauVideoCanh(db: Db, canhId: number, moHinh?: string, ban: 'nhap' | 'cuoi' = 'nhap', tuDong = false, thu = false, boQuaCong = false): Promise<Kq<number>> {
  let bc = await boiCanhCanh(db, canhId);
  if (!bc) return loi('không thấy cảnh');
  if (!thu && tuDong && bc.canh.keyframe_url && (bc.canh.trang_thai === 'co_keyframe' || bc.canh.trang_thai === 'nhap')) {
    await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['trang_thai', 'loi'], moTa: 'duyệt keyframe (bấm Sinh nháp)', nguoi: 'Sinh nháp' });
    await db.execute(sql`UPDATE xv_canh SET trang_thai = 'duyet', loi = '', updated_at = now() WHERE id = ${canhId}`);
    bc = (await boiCanhCanh(db, canhId))!;
  }
  if (!thu && tuDong && dongThoai(bc.canh, bc.nhanVat).some((d) => d.loi.trim() && !d.url)) {
    const g = await sinhGiongShots(db, bc.canh.tap_id, [canhId], { chiThieu: true, sauVideo: { moHinh, ban } });
    return g.ok ? { ok: true, data: 0 } : loi(`Sinh giọng trước video không được: ${g.loi}`);
  }
  // Cổng sản xuất (quy-trinh.ts): keyframe đã duyệt + GIỌNG TRƯỚC VIDEO.
  // + ANIMATIC đã duyệt (quy-trinh.ts › chanAnimatic): đọc hồ sơ tập + mọi shot của tập để so mã.
  const tapR = ((await db.execute(sql`SELECT t.ho_so, p.loai FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${bc.canh.tap_id}`)) as unknown as Row[])[0];
  const dsTap = ((await db.execute(sql`SELECT thu_tu, nhanh, keyframe_url, phat_s, thoi_luong_s FROM xv_canh WHERE tap_id = ${bc.canh.tap_id}`)) as unknown as Row[]).map((r) => ({ thu_tu: Number(r.thu_tu), nhanh: String(r.nhanh ?? ''), keyframe_url: (r.keyframe_url as string | null) ?? null, phat_s: r.phat_s == null ? null : Number(r.phat_s), thoi_luong_s: Number(r.thoi_luong_s) }));
  const qt = chanVideo(bc.canh, bc.nhanVat, { hoSo: (tapR?.ho_so ?? {}) as TapHoSo, ds: dsTap, laQc: tapR?.loai === 'quang_cao' });
  // Một cảnh một model ảnh (sinh-anh.ts › tronModelCanh): keyframe lệch model của cảnh thì không tiêu tiền video lên nó.
  { const tm = await tronModelCanh(db, bc.canh); if (tm) qt.push(tm); }
  if ((!thu && qt.length) || !bc.canh.keyframe_url) return loi(`Shot #${bc.canh.thu_tu} chưa qua quy trình: ${qt.join('; ') || 'chưa có keyframe'}`);
  const chan = chanChuModel(bc.kt.ngon_ngu, { phongCach: bc.kt.phong_cach, shot: bc.canh, anchor: bc.nhanVat });
  if (chan) return loi(chan);
  if (moHinh && (/^(fal|shopaikey|google):/.test(moHinh) || MO_HINH_VIDEO.some((m) => m.key === moHinh))) bc.kt.mo_hinh_video = moHinh as typeof bc.kt.mo_hinh_video;
  // Khoá model (cong-ai.ts › tachKhoa): 'shopaikey:<model>' = đúng cổng đó (không dự phòng) · 'google:<model>' = Google trực tiếp · trần = tự chọn.
  const khoaVid = tachKhoa(bc.kt.mo_hinh_video);
  if (khoaVid.kieu === 'google') { bc.kt.mo_hinh_video = khoaVid.model as typeof bc.kt.mo_hinh_video; boQuaCong = true; }
  const prompt = promptVideoCanh(bc);
  const giay = lamTronClip(bc.canh.thoi_luong_s);
  const laFal = bc.kt.mo_hinh_video.startsWith('fal:');
  const khungCuoi = await khungCuoiCanh(db, canhId);
  // Tiếng clip chỉ sinh khi shot có người nói trong khung chưa có giọng riêng — cùng luật bản xuất dùng tiếng clip (dungTiengClip).
  // Google Veo (Gemini API) không có công tắc tiếng: vẫn sinh, bản xuất tự bỏ.
  const tieng = dungTiengClip(bc.canh, bc.nhanVat);
  const job = await taoJob(db, { nhan: `${thu ? '🧪 THỬ (ngoài quy trình) · ' : ''}Video ${ban === 'cuoi' ? 'BẢN CUỐI' : 'nháp'} · cảnh #${bc.canh.thu_tu} ${bc.canh.canh} · ${giay}s${tieng ? '' : ' · không tiếng'}`, canh_id: canhId, loai: 'video', provider: laFal ? 'fal' : 'google', model: bc.kt.mo_hinh_video, request: { prompt, giay, doPhanGiai: bc.kt.do_phan_giai, tiLe: bc.kt.ti_le, ban, khungDau: bc.canh.keyframe_url, khungCuoi, tieng: laFal ? tieng : true } });
  let kq: { ok: true; taskId: string } | { ok: false; loi: string };
  // CHUỖI CỔNG (cong-ai.ts): shot dùng Veo → thử Grok qua ShopAIKey trước (rẻ hơn, ~95s); không nhận thì gọi Google như cũ.
  const thuCong: BuocNguon[] = [];
  const chuoi = khoaVid.kieu === 'cong' ? [{ cong: khoaVid.cong, model: khoaVid.model, giay: MO_HINH_CONG.find((m) => m.key === `${khoaVid.cong}:${khoaVid.model}`)?.giay ?? 10 }] : chuoiVideo(bc.kt.mo_hinh_video);
  if (!laFal && !boQuaCong) {
    for (const b of chuoi) {
      const g = await guiVideoCong(b.cong, b.model, { prompt, anhDau: bc.canh.keyframe_url, giay: b.giay });
      if (g.ok) {
        thuCong.push({ cong: b.cong, model: b.model, ok: true });
        const nguon: NguonSinh = { cong: b.cong, model: b.model, ...giaVideoCong(b.cong, b.model), thu: thuCong };
        await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${g.taskId}, provider = ${b.cong}, model = ${b.model}, nguon = ${JSON.stringify(nguon)}::jsonb,
          request = request || ${JSON.stringify({ giay: b.giay })}::jsonb, updated_at = now() WHERE id = ${job}`);
        await db.execute(sql`UPDATE xv_canh SET trang_thai = 'dang_sinh', loi = '', updated_at = now() WHERE id = ${canhId}`);
        if (thuCong.some((x) => x.het_tien)) void baoHetTien(db, thuCong, `video shot #${bc.canh.thu_tu} · job #${job}`).catch(() => {});
        return { ok: true, data: job };
      }
      thuCong.push({ cong: b.cong, model: b.model, ok: false, loi: g.loi, het_tien: laHetTien(b.cong, g.loi, g.status) });
    }
    // Chọn đích danh một cổng mà cổng không nhận → báo lỗi, KHÔNG tự sang Google (anh đã chọn nguồn).
    if (khoaVid.kieu === 'cong') {
      const l = thuCong[thuCong.length - 1]?.loi ?? 'cổng không nhận';
      await db.execute(sql`UPDATE xv_job SET nguon = ${JSON.stringify({ cong: khoaVid.cong, model: khoaVid.model, thu: thuCong })}::jsonb WHERE id = ${job}`);
      await xongJob(db, job, { loi: l });
      return loi(`${bc.kt.mo_hinh_video}: ${l}`);
    }
    if (thuCong.length) {
      await db.execute(sql`UPDATE xv_job SET nguon = ${JSON.stringify({ cong: 'google', model: bc.kt.mo_hinh_video, thu: [...thuCong, { cong: 'google', model: bc.kt.mo_hinh_video, ok: true }] })}::jsonb WHERE id = ${job}`);
      if (thuCong.some((x) => x.het_tien)) void baoHetTien(db, thuCong, `video shot #${bc.canh.thu_tu} · job #${job}`).catch(() => {});
    }
  }
  if (laFal) {
    const id = bc.kt.mo_hinh_video.slice(4);
    kq = await guiFal(id, await dauVaoTheoSchema(id, { prompt, anhDau: bc.canh.keyframe_url, anhCuoi: khungCuoi, giay: bc.canh.thoi_luong_s || giay, tiLe: bc.kt.ti_le, tieng, loai: loaiCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat)) }));
  } else {
    const anhDau = await taiAnhBase64(bc.canh.keyframe_url);
    if (!anhDau) { await xongJob(db, job, { loi: 'không tải được keyframe' }); return loi('không tải được keyframe'); }
    const anhCuoi = khungCuoi ? await taiAnhBase64(khungCuoi) : null;
    kq = await batDauVeo({ model: bc.kt.mo_hinh_video, prompt, anhDau, anhCuoi, tiLe: bc.kt.ti_le, doPhanGiai: bc.kt.do_phan_giai, giay, loai: loaiCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat)) });
    // DỰ PHÒNG CUỐI = cùng Veo qua fal (anh 15/10/2026 "fallback đi, phần video phải vậy mới thông"): Google trực tiếp chỉ ~10 lượt/ngày/model
    // ở Tier 1 → lượt 11 trở đi dính 429 cả ngày. Không áp khi anh chọn đích danh 'google:<model>' (đã chọn nguồn thì báo lỗi, không tự đổi).
    const falId = VEO_SANG_FAL[bc.kt.mo_hinh_video];
    if (!kq.ok && khoaVid.kieu !== 'google' && falId && khoaFal()) {
      const loiGoogle = kq.loi;
      const f = await guiFal(falId, await dauVaoTheoSchema(falId, { prompt, anhDau: bc.canh.keyframe_url, anhCuoi: khungCuoi, giay: bc.canh.thoi_luong_s || giay, tiLe: bc.kt.ti_le, tieng, loai: loaiCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat)) }));
      const thu: BuocNguon[] = [...thuCong, { cong: 'google', model: bc.kt.mo_hinh_video, ok: false, loi: loiGoogle }, { cong: 'fal', model: falId, ok: f.ok, ...(f.ok ? {} : { loi: f.loi }) }];
      await db.execute(sql`UPDATE xv_job SET provider = 'fal', model = ${`fal:${falId}`}, nguon = ${JSON.stringify({ cong: 'fal', model: falId, thu })}::jsonb WHERE id = ${job}`);
      kq = f.ok ? f : { ok: false, loi: `Google: ${loiGoogle} · fal: ${f.loi}` };
    }
  }
  if (!kq.ok) {
    await xongJob(db, job, { loi: kq.loi });
    await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = ${kq.loi}, updated_at = now() WHERE id = ${canhId}`);
    return loi(kq.loi);
  }
  await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${kq.taskId}, updated_at = now() WHERE id = ${job}`);
  await db.execute(sql`UPDATE xv_canh SET trang_thai = 'dang_sinh', loi = '', updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: job };
}

/** Hỏi provider các job video đang chạy của tập: xong thì tải về R2, ghi tiền, gắn vào shot (nháp/bản cuối/khớp miệng). */
export async function kiemVideoTap(db: Db, tapId: number): Promise<{ conChay: number; vuaXong: number }> {
  const jobs = (await db.execute(sql`SELECT j.* FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE c.tap_id = ${tapId} AND j.loai = 'video' AND j.trang_thai = 'chay' AND j.task_id IS NOT NULL`)) as unknown as Row[];
  let conChay = 0, vuaXong = 0;
  for (const r of jobs.map(mapJob)) {
    // Nhiều bên cùng hỏi (trang đang mở + script trên box): nhận job theo "thuê" 45s qua updated_at — ai cập nhật trước thì xử, bên kia bỏ
    // qua vòng này; không thì một clip bị tải/ghi hai lần (phiên bản trùng, tiền cộng đôi).
    const thue = (await db.execute(sql`UPDATE xv_job SET updated_at = now() WHERE id = ${r.id} AND trang_thai = 'chay' AND updated_at < now() - interval '45 seconds' RETURNING id`)) as unknown as Row[];
    if (!thue.length) { conChay++; continue; }
    const laCong = r.provider === 'shopaikey';
    const kq = r.provider === 'fal' ? await docFal(r.task_id!) : laCong ? await docVideoCong(r.provider, r.task_id!, r.created_at) : await docVeo(r.task_id!);
    if (!kq.done) { conChay++; continue; }
    if (!kq.ok) {
      await xongJob(db, r.id, { loi: kq.loi });
      // Task cổng treo / hỏng → sinh lại thẳng qua Google (không qua cổng nữa), shot không đứng chờ.
      if (laCong && r.canh_id != null) {
        const rqc = (((await db.execute(sql`SELECT request FROM xv_job WHERE id = ${r.id}`)) as unknown as Row[])[0]?.request ?? {}) as { ban?: 'nhap' | 'cuoi' };
        const lai = await batDauVideoCanh(db, r.canh_id, undefined, rqc.ban ?? 'nhap', false, false, true);
        if (lai.ok) { conChay++; continue; }
      }
      await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = ${kq.loi}, updated_at = now() WHERE id = ${r.canh_id}`);
      continue;
    }
    const buf = r.provider === 'fal' || laCong ? await fetch(kq.uri).then((x) => (x.ok ? x.arrayBuffer().then((a) => Buffer.from(a)) : null)).catch(() => null) : await taiVeo(kq.uri);
    const url = buf ? await uploadToR2(`xuong-video/clip/${r.canh_id}-${randomUUID()}.mp4`, buf, 'video/mp4') : null;
    if (!url) {
      await xongJob(db, r.id, { loi: 'tải/lưu video thất bại' });
      await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = 'tải/lưu video thất bại', updated_at = now() WHERE id = ${r.canh_id}`);
      continue;
    }
    const req = (await db.execute(sql`SELECT request, model FROM xv_job WHERE id = ${r.id}`)) as unknown as Row[];
    const rq = (req[0]?.request ?? {}) as { giay?: number; doPhanGiai?: '720p' | '1080p'; ban?: 'nhap' | 'cuoi'; nangCap?: boolean; khopMieng?: boolean; prompt?: string; khungDau?: string; khungCuoi?: string | null; tieng?: boolean };
    const cong = (r.nguon?.cents != null && laCong) ? r.nguon.cents : null;
    const gia = cong != null ? cong : rq.nangCap ? NANG_CAP.giaGiayCents * (rq.giay ?? 8) : rq.khopMieng ? KHOP_MIENG.giaGiayCents * (rq.giay ?? 8) : await giaVideoSv(s(req[0]?.model), rq.doPhanGiai ?? '720p', rq.giay ?? 8, rq.tieng !== false);
    await xongJob(db, r.id, { output_url: url, chi_phi_cents: gia });
    const pb = JSON.stringify([{ url, ban: rq.ban === 'cuoi' || rq.nangCap ? 'cuoi' : 'nhap', model: s(req[0]?.model), job: r.id, luc: new Date().toISOString() }]);
    await db.execute(sql`UPDATE xv_canh SET video_phien_ban = video_phien_ban || ${pb}::jsonb WHERE id = ${r.canh_id}`);
    if (rq.ban === 'cuoi' || rq.nangCap) {
      await db.execute(sql`UPDATE xv_canh SET video_cuoi_url = ${url}, trang_thai = 'xong', loi = '', chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${r.canh_id}`);
    } else if (rq.khopMieng) {
      // Khớp miệng: thay bản nháp đang dùng, GIỮ nguồn sinh (model/prompt/khung) của clip gốc để bản cuối vẫn tái lập được.
      await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, trang_thai = 'xong', loi = '', chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${r.canh_id}`);
    } else {
      // Nháp: lưu NGUỒN để bản cuối tái lập đúng (model, prompt, khung đầu/cuối).
      const nguon = { model: s(req[0]?.model), prompt: rq.prompt ?? '', khung_dau: rq.khungDau ?? null, khung_cuoi: rq.khungCuoi ?? null, giay: rq.giay ?? null, job: r.id };
      await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, nguon_video = ${JSON.stringify(nguon)}::jsonb, trang_thai = 'xong', loi = '', chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${r.canh_id}`);
    }
    vuaXong++;
  }
  return { conChay, vuaXong };
}
