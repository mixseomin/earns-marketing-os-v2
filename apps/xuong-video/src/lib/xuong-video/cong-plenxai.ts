// CỔNG PLENXAI (anh 21/10/2026: "lưu lại mọi thứ, tk, API qua token… để tao nạp tiền dùng cho rẻ" + "cơ chế fallback update thêm cái này").
// PlenX AI (plenxai.com, VN) bán Veo 3.1 rẻ nhất đã đo: Lite 720p 8s = 6 credit, 1080p = 8 credit; nạp VietQR 100₫ = 1 credit → 600₫ / 800₫ một clip (Kie 4.550₫).
// Từ 16/11/2026 MỌI lượt PlenX đi qua cổng AI chung (spy-on-tc/server/cong-media.mjs: video_gui / video_doc / video_xoa {cong:'plenxai'}, anh {cong:'plenxai'},
// plenx_ho_so) — CHỈ cổng giữ + xoay cặp token (/root/.secrets/plenxai.json; trước đó studio và cổng cùng xoay một tệp, refresh_token xoay mỗi lần nên hai nơi
// giẫm nhau). Token mất hiệu lực (đăng xuất / đăng nhập lại trên web) → chép lại cặp mới từ trình duyệt: scripts/plenxai-token.sh (ghi đúng tệp cổng đọc).
// Tệp này giữ chữ ký cũ (guiPlenx / docPlenx / xoaPlenx / hoSoPlenx) cho scripts.
import { goiCong } from './cong-ai-goi';
import { guiVideoCong, docVideoCong, donVideoCong } from './cong-ai-video';

/** Giá credit / clip theo bảng của server (đọc 21/10/2026, server mặc định "Flow Veo3"): model → độ phân giải → credit. */
export const CREDIT_PLENX: Record<string, Record<string, number>> = { 'veo3-lite': { '720': 6, '1080': 8 }, 'veo3-fast': { '720': 10, '1080': 14 }, 'wan-3.0': { '720': 18, '1080': 30 } };
export const VND_MOI_CREDIT = 100;   // nạp VietQR lẻ; gói tháng Pro ≈ 74,5₫

export type KqGui = { ok: true; taskId: string } | { ok: false; loi: string; status?: number };
export type KqDoc = { done: false } | { done: true; ok: true; uri: string } | { done: true; ok: false; loi: string; treo?: boolean };

/** Gửi một clip PlenX (Veo 3.1 Lite / Fast, hoặc Wan 3.0 qua máy chủ DURIAN — cổng chọn đường theo model). */
export async function guiPlenx(model: string, o: { tiLe?: string | null; prompt: string; anhDau: string; anhCuoi?: string | null; giay: number; doPhanGiai?: '720p' | '1080p' }): Promise<KqGui> {
  return guiVideoCong('plenxai', model, o);
}
/** Hỏi một clip PlenX. Cổng tự báo treo sau 12 phút chưa chạy (treoPhut giữ trong chữ ký cho nơi gọi cũ). */
export async function docPlenx(taskId: string, taoLuc: string, _treoPhut?: number): Promise<KqDoc> {
  return docVideoCong('plenxai', taskId, taoLuc);
}
/** Hồ sơ tài khoản (GET /users/me) — số dư credit cho kiểm token + Phòng Tài nguyên. 0đ. */
export async function hoSoPlenx(): Promise<Record<string, unknown>> {
  return (await goiCong<{ kq: Record<string, unknown> }>({ viec: 'xv-plenx-ho-so', loai: 'plenx_ho_so' }, 60e3)).kq;
}
/** Xoá clip trên PlenX sau khi đã lưu về R2 (anh 21/10/2026: "sinh xong và tải về thì xoá … trên nền tảng của họ"). */
export async function xoaPlenx(uri: string): Promise<void> { await donVideoCong('plenxai', uri); }
