'use server';

// HÒM GÓP Ý CỦA CTY — lõi dùng chung @mos2/gop-y/server (cùng một bản với studio); tệp này chỉ gắn người đăng nhập + R2 của cty
// và project 'cty' (bảng mos2.on.tc/p/cty/plays). Claude nhặt bằng /tasks-cty (`GOPY_PROJECT=cty scripts/gop-y.sh`).
import 'server-only';
import * as hom from '@mos2/gop-y/server';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2, r2Enabled } from '@/lib/r2';
import { nhanSu } from '@/lib/cong-ty';

const DU_AN = 'cty';

export async function taiAnhGopY(dataUrl: string) { return hom.taiAnh(await getCurrentUser(), dataUrl, 'gop-y-cty', { uploadToR2, r2Enabled }); }
export async function guiGopY(input: Parameters<typeof hom.guiGopY>[2]) { return hom.guiGopY(DU_AN, await getCurrentUser(), input); }
export async function dsGopYCuaToi() { return hom.dsGopYCuaToi(DU_AN, await getCurrentUser()); }
export async function docTraoDoi(taskId: number) { return hom.docTraoDoi(DU_AN, await getCurrentUser(), taskId); }
/** Số cho nút 💬 (packages/gop-y/CHUAN.md): rung khi Khôi đang làm + số đỏ góp ý đang chờ ý kiến của chính người xem. */
export async function demGopY() { return hom.demGopY(DU_AN, await getCurrentUser()); }
/** Hòm 💬 tab Của tôi: việc giao thẳng cho Khôi (kỹ sư hòm cty) — đọc <CTY_DATA_DIR>/giao/khoi.json, chỉ admin. */
export async function hangGiao() {
  const hg = await hom.hangGiao(DU_AN, await getCurrentUser());
  return hg ? { ...hg, ten: String(nhanSu(hg.nguoi)?.fm.ten ?? hg.nguoi) } : null;
}
export async function guiTraoDoi(input: Parameters<typeof hom.guiTraoDoi>[2]) { return hom.guiTraoDoi(DU_AN, await getCurrentUser(), input); }
