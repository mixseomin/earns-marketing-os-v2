// VIDEO QUA CỔNG AI CHUNG (anh 16/11/2026: một nguồn cho mọi model) — gửi / đọc / xoá việc video của studio đi qua cổng spy (POST /api/ai, cong-media.mjs):
// loai 'video_gui' {cong, model, …} (ép đúng cổng + ĐÚNG model studio chọn, giá ghi sổ theo bảng studio) · 'video_doc' · 'video_xoa' (PlenX: xoá bản trên nền tảng
// sau khi lưu R2). Trước đó studio giữ adapter riêng Kie / ShopAIKey / WaveSpeed / PlenX trong cong-ai.ts — cùng lúc cổng cũng xoay refresh_token PlenX trong một
// tệp, hai nơi xoay. Tách khỏi cong-ai.ts vì cong-ai.ts còn được giao diện import (gói cổng đọc node:fs). Chữ ký giữ nguyên cho sinh-video.ts và scripts.
import 'server-only';
import { goiAi } from '@mos2/cong-ai';
import { khungVideoCong, type CongKey } from './cong-ai';

type KqGui = { ok: true; taskId: string } | { ok: false; loi: string; status?: number };
type KqDoc = { done: false } | { done: true; ok: true; uri: string } | { done: true; ok: false; loi: string; treo?: boolean };
const loiCua = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^cổng AI:\s*/, '');

export async function guiVideoCong(cong: CongKey, model: string, o: { /** khung hình của phim */ tiLe?: string | null; prompt: string; anhDau: string; /** ảnh CUỐI (keyframe KẾT) */ anhCuoi?: string | null; giay: number; /** độ phân giải của phim */ doPhanGiai?: '720p' | '1080p' }): Promise<KqGui> {
  try {
    const r = await goiAi({ viec: 'xv-video', loai: 'video_gui', cong, model, prompt: o.prompt, anh_dau: o.anhDau, anh_cuoi: o.anhCuoi ?? null, giay: o.giay, ti_le: khungVideoCong(o.tiLe), do_phan_giai: o.doPhanGiai } as never, { lan: 1, hanMs: 180e3 }) as unknown as { task_id?: string };
    return r.task_id ? { ok: true, taskId: r.task_id } : { ok: false, loi: 'cổng không trả task_id' };
  } catch (e) { const loi = loiCua(e); return { ok: false, loi: loi.slice(0, 400), status: /hết tiền|insufficient|balance|402/i.test(loi) ? 402 : undefined }; }
}
export async function docVideoCong(cong: string, taskId: string, taoLuc: string): Promise<KqDoc> {
  try { return await goiAi({ viec: 'xv-video-doc', loai: 'video_doc', cong, task_id: taskId, tao_luc: taoLuc } as never, { lan: 1, hanMs: 60e3 }) as unknown as KqDoc; }
  catch (e) { console.error(`[video_doc ${cong}]`, loiCua(e)); return { done: false }; }   // lỗi mạng / cổng bận → nhịp sau đọc lại
}
/** Xoá bản trên nền tảng sau khi đã lưu R2 (chỉ PlenX giữ lịch sử). Lỗi chỉ ghi log. */
export async function donVideoCong(cong: string | null | undefined, uri: string): Promise<void> {
  if (cong !== 'plenxai') return;
  try { await goiAi({ viec: 'xv-video-xoa', loai: 'video_xoa', cong, uri } as never, { lan: 1, hanMs: 60e3 }); } catch (e) { console.error('[video_xoa plenxai]', loiCua(e)); }
}
/** SEEDANCE 2.0 THAM CHIẾU qua cổng (Kie r2v: ảnh + clip 3D tham chiếu + giọng @Audio1) — đường sinh cụm (scripts/thu-seedance-cum.mts, thu-seedance-kie.mts).
 *  giayVao = độ dài video tham chiếu (Kie tính tiền giây vào + giây ra). Trả task_id; đọc bằng docVideoCong('kie', …). */
export async function guiSeedance(model: string, o: { prompt: string; anh: string[]; video: string[]; giong?: string | null; dpg: string; tiLe?: string | null; giay: number; giayVao?: number }): Promise<KqGui> {
  try {
    const r = await goiAi({ viec: 'xv-seedance', loai: 'video_gui', cong: 'kie', model, prompt: o.prompt, anh_dau: o.anh[0], anh_tham_chieu: o.anh, video_tham_chieu: o.video,
      am_tham_chieu: o.giong ? [o.giong] : [], co_tieng: !!o.giong, do_phan_giai: o.dpg, ti_le: khungVideoCong(o.tiLe), giay: o.giay, giay_vao: o.giayVao } as never, { lan: 1, hanMs: 180e3 }) as unknown as { task_id?: string };
    return r.task_id ? { ok: true, taskId: r.task_id } : { ok: false, loi: 'cổng không trả task_id' };
  } catch (e) { return { ok: false, loi: loiCua(e).slice(0, 400) }; }
}
/** Chờ một việc video xong (đọc 15 giây một lần qua cổng), tối đa phut phút. */
export async function choVideo(cong: string, taskId: string, taoLuc: string, phut = 25): Promise<{ ok: true; uri: string } | { ok: false; loi: string }> {
  const t0 = Date.now();
  for (;;) {
    await new Promise((x) => setTimeout(x, 15_000));
    const d = await docVideoCong(cong, taskId, taoLuc);
    if (d.done) return d.ok ? { ok: true, uri: d.uri } : { ok: false, loi: d.loi };
    if (Date.now() - t0 > phut * 60_000) return { ok: false, loi: `quá ${phut} phút` };
  }
}
