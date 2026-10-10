'use server';

// HÒM GÓP Ý CỦA STUDIO — lõi nằm ở @mos2/gop-y/server (dùng chung với cty.on.tc, gom 10/10/2026); tệp này chỉ gắn người
// đăng nhập + R2 của studio và project 'xuong-video' (bảng mos2.on.tc/p/xuong-video/plays).
// Claude nhặt bằng `GOPY_PROJECT=xuong-video scripts/gop-y.sh` (lệnh /tasks-studio). Ảnh lên R2 thư mục gop-y-studio.
import 'server-only';
import * as hom from '@mos2/gop-y/server';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2, r2Enabled } from '@/lib/r2';

export type { TinTraoDoi, GopYCuaToi } from '@mos2/gop-y/server';
const DU_AN = 'xuong-video';

export async function taiAnhGopY(dataUrl: string) { return hom.taiAnh(await getCurrentUser(), dataUrl, 'gop-y-studio', { uploadToR2, r2Enabled }); }
/** Bỏ ảnh chưa gửi (✕ hoặc Huỷ nháp): chỉ gỡ khỏi form, KHÔNG xoá file R2 — studio không xoá thật bất cứ thứ gì (card #1192). */
export async function xoaAnhGopY(_url: string): Promise<{ ok: boolean }> { return { ok: true }; }
export async function guiGopY(input: Parameters<typeof hom.guiGopY>[2]) { return hom.guiGopY(DU_AN, await getCurrentUser(), input); }
export async function dsGopYCuaToi() { return hom.dsGopYCuaToi(DU_AN, await getCurrentUser()); }
export async function docTraoDoi(taskId: number) { return hom.docTraoDoi(DU_AN, await getCurrentUser(), taskId); }
export async function guiTraoDoi(input: Parameters<typeof hom.guiTraoDoi>[2]) { return hom.guiTraoDoi(DU_AN, await getCurrentUser(), input); }
