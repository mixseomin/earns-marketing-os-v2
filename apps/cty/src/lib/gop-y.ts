'use server';

// HÒM GÓP Ý CỦA CTY — lõi dùng chung @mos2/gop-y/server (cùng một bản với studio); tệp này chỉ gắn người đăng nhập + R2 của cty
// và project 'cty' (bảng mos2.on.tc/p/cty/plays). Claude nhặt bằng /tasks-cty (`GOPY_PROJECT=cty scripts/gop-y.sh`).
import 'server-only';
import * as hom from '@mos2/gop-y/server';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2, r2Enabled } from '@/lib/r2';

const DU_AN = 'cty';

export async function taiAnhGopY(dataUrl: string) { return hom.taiAnh(await getCurrentUser(), dataUrl, 'gop-y-cty', { uploadToR2, r2Enabled }); }
export async function guiGopY(input: Parameters<typeof hom.guiGopY>[2]) { return hom.guiGopY(DU_AN, await getCurrentUser(), input); }
export async function dsGopYCuaToi() { return hom.dsGopYCuaToi(DU_AN, await getCurrentUser()); }
export async function docTraoDoi(taskId: number) { return hom.docTraoDoi(DU_AN, await getCurrentUser(), taskId); }
export async function guiTraoDoi(input: Parameters<typeof hom.guiTraoDoi>[2]) { return hom.guiTraoDoi(DU_AN, await getCurrentUser(), input); }
