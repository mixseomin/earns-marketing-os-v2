// Sơ đồ nguồn của một shot — đọc job đã sinh ra keyframe / clip đang dùng rồi so với câu lệnh + tham chiếu GIỜ sẽ gửi
// (chuanBiKeyframe, promptVideoCanh, khungCuoiCanh — cùng hàm lúc sinh thật, nên "đã đổi" là đổi thật, không phải lệch cách ghép).
import 'server-only';
import { sql } from 'drizzle-orm';
import { boiCanhCanh, n, s, type Db, type Row } from './doc-db';
import { chuanBiKeyframe } from './sinh-anh';
import { promptVideoCanh, khungCuoiCanh } from './sinh-video';
import { khacCauLenh, type BuocNguon, type NguonShot } from './phu-thuoc';

const rq = (r: Row) => (r.request && typeof r.request === 'object' ? (r.request as Record<string, unknown>) : {});
const buoc = (r: Row): BuocNguon => ({ job: n(r.id), model: s(r.model), luc: s(r.created_at), chi_phi_cents: n(r.chi_phi_cents), nhan: s(r.nhan), prompt: s(rq(r).prompt), doi: [], cauLenh: null });
const cung = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export async function nguonShot(db: Db, canhId: number): Promise<NguonShot | null> {
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return null;
  const c = bc.canh;
  const { prompt: promptAnhNay, urlRef, vai } = chuanBiKeyframe(bc);
  const promptVideoNay = promptVideoCanh(bc);
  const khungCuoiNay = await khungCuoiCanh(db, canhId);
  const vid = c.video_cuoi_url || c.video_url;
  const jobs = (await db.execute(sql`SELECT id, loai, model, nhan, request, chi_phi_cents, created_at, output_url FROM xv_job
    WHERE canh_id = ${canhId} AND trang_thai = 'xong' ORDER BY id DESC`)) as unknown as Row[];

  let keyframe: NguonShot['keyframe'] = null;
  const jk = c.keyframe_url ? jobs.find((j) => s(j.output_url) === c.keyframe_url) : undefined;
  if (jk) {
    const t = rq(jk).thamChieuUrl; const da = Array.isArray(t) ? t.map(String) : null;
    keyframe = { ...buoc(jk), thamChieuUrl: da };
    if (da && !cung(da, urlRef)) keyframe.doi.push('ảnh tham chiếu đã đổi sau khi sinh keyframe');
    if (keyframe.prompt && keyframe.prompt !== promptAnhNay) keyframe.cauLenh = khacCauLenh(keyframe.prompt, promptAnhNay);
  }

  let video: NguonShot['video'] = null;
  const jv = vid ? jobs.find((j) => s(j.output_url) === vid) : undefined;
  if (jv) {
    // Clip đang dùng có thể là bản xử lý sau (nâng cấp / khớp miệng) — không mang câu lệnh; lần ngược về clip gốc gần nhất có khung đầu.
    const goc = rq(jv).khungDau ? jv : jobs.find((j) => n(j.id) < n(jv.id) && s(j.loai) === 'video' && rq(j).khungDau);
    const g = goc ?? jv; const r = rq(g);
    video = { ...buoc(g), khungDau: r.khungDau ? s(r.khungDau) : null, khungCuoi: r.khungCuoi ? s(r.khungCuoi) : null, xuLySau: goc && goc !== jv ? s(jv.nhan) || 'xử lý sau' : null };
    if (video.khungDau && video.khungDau !== c.keyframe_url) video.doi.push('clip sinh từ keyframe KHÁC keyframe đang chọn');
    if (video.khungDau && (video.khungCuoi ?? null) !== khungCuoiNay) video.doi.push(khungCuoiNay ? 'khung cuối đã đổi (keyframe shot sau đổi hoặc vừa bật nối khung)' : 'lúc sinh có khung cuối, giờ không còn (tắt nối khung / shot sau mất keyframe)');
    if (video.prompt && video.prompt !== promptVideoNay) video.cauLenh = khacCauLenh(video.prompt, promptVideoNay);
  }
  return { thu_tu: c.thu_tu, canh: c.canh, ti_le: bc.kt.ti_le, keyframe_url: c.keyframe_url, video_url: vid, thamChieu: vai, keyframe, video, khungCuoiNay, promptAnhNay, promptVideoNay };
}
