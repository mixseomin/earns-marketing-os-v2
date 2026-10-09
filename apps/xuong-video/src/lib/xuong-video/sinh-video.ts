// Lõi sinh video cho một shot + nhận kết quả (Veo qua Google hoặc model fal) — tách khỏi actions.ts để script trên box
// (scripts/sinh-shot.mts) và server action (sinhVideoCanh / kiemVideo) dùng CÙNG một đường; actions chỉ kiểm quyền rồi gọi vào đây.
import 'server-only';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { uploadToR2 } from '@/lib/r2';
import { batDauVeo, docVeo, taiVeo, taiAnhBase64 } from './google';
import { docFal, guiFal, dauVaoTheoSchema } from './fal';
import { promptKyThuatVideo } from './dien-anh';
import { dongThoai, promptCamXuc } from './am-thanh';
import { lamTronClip, MO_HINH_VIDEO, NANG_CAP, KHOP_MIENG } from './kieu';
import { boiCanhCanh, taoJob, xongJob, mapJob, giaVideoSv, s, type Db, type Row } from './doc-db';

type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });

/** Gửi một shot đi sinh video (nháp hoặc bản cuối) — shot phải đã duyệt keyframe. Trả về id job; kết quả về qua kiemVideoTap. */
export async function batDauVideoCanh(db: Db, canhId: number, moHinh?: string, ban: 'nhap' | 'cuoi' = 'nhap'): Promise<Kq<number>> {
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return loi('không thấy cảnh');
  if (bc.canh.trang_thai !== 'duyet' && bc.canh.trang_thai !== 'loi' && bc.canh.trang_thai !== 'xong') return loi('cảnh chưa duyệt keyframe');
  if (!bc.canh.keyframe_url) return loi('cảnh chưa có keyframe');
  if (moHinh && (moHinh.startsWith('fal:') || MO_HINH_VIDEO.some((m) => m.key === moHinh))) bc.kt.mo_hinh_video = moHinh as typeof bc.kt.mo_hinh_video;
  // Shot đã có file giọng riêng → clip KHÔNG được tự đọc thoại (Veo đọc giọng lơ lớ, chồng với TTS — #1219); miệng vẫn cử động để khớp miệng sau.
  const coGiong = dongThoai(bc.canh, bc.nhanVat).some((d) => d.url);
  const prompt = [bc.kt.phong_cach ? `Visual style: ${bc.kt.phong_cach}.` : '', bc.canh.prompt_video.trim() || bc.canh.hanh_dong, bc.canh.trang_phuc.trim() ? `Clothing stays exactly: ${bc.canh.trang_phuc.trim()}; no extra garments.` : '', promptKyThuatVideo(bc.canh.ky_thuat), promptCamXuc(bc.canh, bc.nhanVat, 'video'),
    coGiong ? 'IMPORTANT: the audio track must contain NO spoken words or voice — the character mouths the lines with natural lip movement in silence; only ambient sound. A separate voice recording is added later.' : ''].filter(Boolean).join(' ');
  const giay = lamTronClip(bc.canh.thoi_luong_s);
  const laFal = bc.kt.mo_hinh_video.startsWith('fal:');
  // Nối cảnh: khung cuối = keyframe cảnh kế (cùng tập) khi tập bật noi_khung → các clip ghép liền mạch, bản cuối khớp bố cục bản nháp.
  const ke = (await db.execute(sql`SELECT c2.keyframe_url, t.noi_khung FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id
    LEFT JOIN LATERAL (SELECT keyframe_url FROM xv_canh x WHERE x.tap_id = c.tap_id AND x.thu_tu > c.thu_tu ORDER BY x.thu_tu LIMIT 1) c2 ON true WHERE c.id = ${canhId}`)) as unknown as Row[];
  const khungCuoi = ke[0]?.noi_khung === true && ke[0]?.keyframe_url ? s(ke[0].keyframe_url) : null;
  const job = await taoJob(db, { nhan: `Video ${ban === 'cuoi' ? 'BẢN CUỐI' : 'nháp'} · cảnh #${bc.canh.thu_tu} ${bc.canh.canh} · ${giay}s`, canh_id: canhId, loai: 'video', provider: laFal ? 'fal' : 'google', model: bc.kt.mo_hinh_video, request: { prompt, giay, doPhanGiai: bc.kt.do_phan_giai, tiLe: bc.kt.ti_le, ban, khungDau: bc.canh.keyframe_url, khungCuoi } });
  let kq: { ok: true; taskId: string } | { ok: false; loi: string };
  if (laFal) {
    const id = bc.kt.mo_hinh_video.slice(4);
    kq = await guiFal(id, await dauVaoTheoSchema(id, { prompt, anhDau: bc.canh.keyframe_url, anhCuoi: khungCuoi, giay: bc.canh.thoi_luong_s || giay, tiLe: bc.kt.ti_le }));
  } else {
    const anhDau = await taiAnhBase64(bc.canh.keyframe_url);
    if (!anhDau) { await xongJob(db, job, { loi: 'không tải được keyframe' }); return loi('không tải được keyframe'); }
    const anhCuoi = khungCuoi ? await taiAnhBase64(khungCuoi) : null;
    kq = await batDauVeo({ model: bc.kt.mo_hinh_video, prompt, anhDau, anhCuoi, tiLe: bc.kt.ti_le, doPhanGiai: bc.kt.do_phan_giai, giay });
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
    const kq = r.provider === 'fal' ? await docFal(r.task_id!) : await docVeo(r.task_id!);
    if (!kq.done) { conChay++; continue; }
    if (!kq.ok) {
      await xongJob(db, r.id, { loi: kq.loi });
      await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = ${kq.loi}, updated_at = now() WHERE id = ${r.canh_id}`);
      continue;
    }
    const buf = r.provider === 'fal' ? await fetch(kq.uri).then((x) => (x.ok ? x.arrayBuffer().then((a) => Buffer.from(a)) : null)).catch(() => null) : await taiVeo(kq.uri);
    const url = buf ? await uploadToR2(`xuong-video/clip/${r.canh_id}-${randomUUID()}.mp4`, buf, 'video/mp4') : null;
    if (!url) {
      await xongJob(db, r.id, { loi: 'tải/lưu video thất bại' });
      await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = 'tải/lưu video thất bại', updated_at = now() WHERE id = ${r.canh_id}`);
      continue;
    }
    const req = (await db.execute(sql`SELECT request, model FROM xv_job WHERE id = ${r.id}`)) as unknown as Row[];
    const rq = (req[0]?.request ?? {}) as { giay?: number; doPhanGiai?: '720p' | '1080p'; ban?: 'nhap' | 'cuoi'; nangCap?: boolean; khopMieng?: boolean; prompt?: string; khungDau?: string; khungCuoi?: string | null };
    const gia = rq.nangCap ? NANG_CAP.giaGiayCents * (rq.giay ?? 8) : rq.khopMieng ? KHOP_MIENG.giaGiayCents * (rq.giay ?? 8) : await giaVideoSv(s(req[0]?.model), rq.doPhanGiai ?? '720p', rq.giay ?? 8);
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
