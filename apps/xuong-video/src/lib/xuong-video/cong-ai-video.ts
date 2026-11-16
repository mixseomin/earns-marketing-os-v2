// VIDEO QUA CỔNG AI CHUNG (anh 16/11/2026: một nguồn cho mọi model) — gửi / đọc / tải / xoá việc video của studio đi qua cổng spy (POST /api/ai, cong-media.mjs):
// loai 'video_gui' {cong, model, …} (ép đúng cổng + ĐÚNG model studio chọn — kể cả 'google' = Veo chính hãng) · 'video_doc' · 'video_tai' (Veo cần khoá khi tải,
// cổng tải hộ) · 'video_xoa' (PlenX: xoá bản trên nền tảng sau khi lưu R2). Studio không giữ khoá / token nào; token PlenX chỉ cổng xoay.
import 'server-only';
import { goiCong, loiCua } from './cong-ai-goi';
import { khungVideoCong } from './cong-ai';

type KqGui = { ok: true; taskId: string } | { ok: false; loi: string; status?: number };
type KqDoc = { done: false } | { done: true; ok: true; uri: string } | { done: true; ok: false; loi: string; treo?: boolean };

export async function guiVideoCong(cong: string, model: string, o: { /** khung hình của phim */ tiLe?: string | null; prompt: string; anhDau: string; /** ảnh CUỐI (keyframe KẾT) */ anhCuoi?: string | null; giay: number; /** độ phân giải của phim */ doPhanGiai?: '720p' | '1080p'; /** danh từ cần loại (Veo negativePrompt) */ phuDinh?: string | null }): Promise<KqGui> {
  try {
    const r = await goiCong<{ task_id?: string }>({ viec: 'xv-video', loai: 'video_gui', cong, model, prompt: o.prompt, anh_dau: o.anhDau, anh_cuoi: o.anhCuoi ?? null, giay: o.giay,
      ti_le: khungVideoCong(o.tiLe), do_phan_giai: o.doPhanGiai, phu_dinh: o.phuDinh ?? null }, 180e3);
    return r.task_id ? { ok: true, taskId: r.task_id } : { ok: false, loi: 'cổng không trả task_id' };
  } catch (e) { const loi = loiCua(e); return { ok: false, loi: loi.slice(0, 400), status: /hết tiền|insufficient|balance|402/i.test(loi) ? 402 : undefined }; }
}
export async function docVideoCong(cong: string, taskId: string, taoLuc: string): Promise<KqDoc> {
  try { return await goiCong<KqDoc>({ viec: 'xv-video-doc', loai: 'video_doc', cong, task_id: taskId, tao_luc: taoLuc }, 60e3); }
  catch (e) { console.error(`[video_doc ${cong}]`, loiCua(e)); return { done: false }; }   // lỗi mạng / cổng bận → nhịp sau đọc lại
}
/** Tải clip về buffer: link Veo (cần khoá) → cổng tải hộ (video_tai); link công khai (PlenX / Kie / ShopAIKey / fal) → tải thẳng. */
export async function taiVideoCong(uri: string): Promise<Buffer | null> {
  try {
    if (/^https:\/\/generativelanguage\.googleapis\.com\//.test(uri)) { const r = await goiCong<{ video_b64: string }>({ viec: 'xv-video-tai', loai: 'video_tai', uri }, 6 * 60e3); return Buffer.from(r.video_b64, 'base64'); }
    const r = await fetch(uri, { signal: AbortSignal.timeout(300e3) }); return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch (e) { console.error('[video_tai]', loiCua(e)); return null; }
}
/** Xoá bản trên nền tảng sau khi đã lưu R2 (chỉ PlenX giữ lịch sử). Lỗi chỉ ghi log. */
export async function donVideoCong(cong: string | null | undefined, uri: string): Promise<void> {
  if (cong !== 'plenxai') return;
  try { await goiCong({ viec: 'xv-video-xoa', loai: 'video_xoa', cong, uri }, 60e3); } catch (e) { console.error('[video_xoa plenxai]', loiCua(e)); }
}
/** SEEDANCE 2.0 THAM CHIẾU qua cổng (Kie r2v: ảnh + clip 3D tham chiếu + giọng @Audio1) — đường sinh cụm (scripts/thu-seedance-cum.mts, thu-seedance-kie.mts).
 *  giayVao = độ dài video tham chiếu (Kie tính tiền giây vào + giây ra). Trả task_id; đọc bằng docVideoCong('kie', …). */
export async function guiSeedance(model: string, o: { prompt: string; anh: string[]; video: string[]; giong?: string | null; dpg: string; tiLe?: string | null; giay: number; giayVao?: number }): Promise<KqGui> {
  try {
    const r = await goiCong<{ task_id?: string }>({ viec: 'xv-seedance', loai: 'video_gui', cong: 'kie', model, prompt: o.prompt, anh_dau: o.anh[0], anh_tham_chieu: o.anh, video_tham_chieu: o.video,
      am_tham_chieu: o.giong ? [o.giong] : [], co_tieng: !!o.giong, do_phan_giai: o.dpg, ti_le: khungVideoCong(o.tiLe), giay: o.giay, giay_vao: o.giayVao }, 180e3);
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
