// Một việc sinh ảnh (ảnh gốc / biến thể / keyframe) gói thành dữ liệu thuần → chạy được ở HAI nơi bằng cùng một hàm:
// Cloudflare Worker (consumer hàng đợi xv-jobs, worker/index.ts) hoặc hàng nền trong tiến trình studio (dự phòng khi
// hàng đợi không nhận). Không đụng DB: kết quả trả về để studio ghi sổ (hoan-tat.ts). Import tương đối, không '@/', để Worker bundle được.
import { sinhAnh, taiAnhBase64, type AnhVao } from './google';
import { uploadToR2 } from '../r2';
import type { TiLe } from './kieu';

export type ViecAnh = {
  job: number; model: string; prompt: string; thamChieuUrl: string[]; tiLe: TiLe | '1:1'; kichCo?: '1K' | '2K';
  /** tiền tố khoá R2 sau 'xuong-video/', vd 'anchor/12' → xuong-video/anchor/12-<uuid>.png */
  thuMuc: string;
  /** chỉ thử đường hàng đợi → Worker: không gọi model, không tốn tiền */
  thu?: boolean;
};
export type KqViec = { job: number; ok: true; url: string; model: string } | { job: number; ok: false; loi: string };

const duoi = (mime: string) => (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');

export async function chayViecAnh(v: ViecAnh): Promise<KqViec> {
  try {
    const thamChieu = (await Promise.all(v.thamChieuUrl.map(taiAnhBase64))).filter((x): x is AnhVao => !!x);
    const kq = await sinhAnh({ model: v.model, prompt: v.prompt, thamChieu, thamChieuUrl: v.thamChieuUrl, tiLe: v.tiLe, kichCo: v.kichCo ?? '1K' });
    if (!kq.ok) return { job: v.job, ok: false, loi: kq.loi };
    const url = await uploadToR2(`xuong-video/${v.thuMuc}-${crypto.randomUUID()}.${duoi(kq.mimeType)}`, kq.data, kq.mimeType);
    if (!url) return { job: v.job, ok: false, loi: 'R2 không nhận ảnh' };
    return { job: v.job, ok: true, url, model: kq.model };
  } catch (e) {
    return { job: v.job, ok: false, loi: `lỗi khi chạy: ${e instanceof Error ? e.message : String(e)}` };
  }
}
