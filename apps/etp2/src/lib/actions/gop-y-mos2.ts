'use server';

// HÒM GÓP Ý 💬 CỦA ETP2 — lõi dùng chung @mos2/gop-y/server theo chuẩn packages/gop-y/CHUAN.md (anh 17/11/2026 "Chuẩn hoá toàn bộ phần gopy
// để áp dụng cho mọi nơi dùng nó"). Trước đây tệp này là bản máy chủ CHÉP RIÊNG (không có choYKien → số đỏ chỉ đếm card kẹt, không demGopY);
// nay chỉ gắn: người đăng nhập + R2 của etp2 + hòm 'mos2' (card gửi từ etp / etp2 nằm chung hòm mos2, Huy nhận theo source_url) + hai phần
// riêng Ethopex: (1) tab Của tôi / số đỏ chỉ tính card gửi từ etp / etp2 (anh 14/11/2026: góp ý MOS2 không hiện ở etp2);
// (2) nút rung khi HUY đang làm (hàng việc của Huy <CTY_DATA_DIR>/etp-sua.json, anh 12/11/2026) — không phải Đạt (kỹ sư hòm mos2 trong KY_SU_HOM).
// KHÔNG viết lại truy vấn / luồng ở đây — thiếu gì thì thêm vào gói (packages/gop-y/src/server.ts) cho mọi app cùng có.
import 'server-only';
import fs from 'node:fs';
import * as hom from '@mos2/gop-y/server';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2, r2Enabled } from '@/lib/r2';
import { deleteImage } from '@/lib/actions/uploads';

const DU_AN = 'mos2';
/** Card gửi từ etp.on.tc / etp2.on.tc. Cùng luật bản apps/web (gop-y-mos2.ts NGUON_ETP) — sửa thì sửa cả hai. */
const NGUON_ETP = /^https?:\/\/etp2?\.on\.tc(\/|$)/;
/** Card claimed quá trần phiên kỹ sư (CHUAN.md: 45 phút) coi là phiên đã chết — không rung mãi. */
const TRAN_DANG_LAM_MS = 45 * 60_000;
/** Kỹ sư AI phụ trách góp ý Phòng Ethopex (id sổ /opt/cty/cong-ty/nhan-su/huy) — hàng việc etp-sua.json bên dưới là hàng của người này. */
const KY_SU_ETP = 'huy';
const TEP_HUY =`${process.env.CTY_DATA_DIR || '/var/lib/cty'}/etp-sua.json`;

/** Hòm etp2 chỉ cho admin (layout gắn nút cho admin; guiGopY của gói cũng admin-only) — đọc / trả lời luồng cũng vậy, kẻo người đăng nhập khác đọc card mos2. */
const admin = async () => { const me = await getCurrentUser(); return me && me.role === 'admin' ? me : null; };

export async function taiAnhGopY(dataUrl: string) { return hom.taiAnh(await admin(), dataUrl, 'gop-y', { uploadToR2, r2Enabled }); }
/** Bỏ ảnh nháp khỏi R2 (nút ✕ trên ảnh đính kèm) — như bản cũ. */
export async function xoaAnhGopY(url: string) { return (await admin()) ? deleteImage(url) : { ok: false }; }
export async function guiGopY(input: Parameters<typeof hom.guiGopY>[2]) { return hom.guiGopY(DU_AN, await admin(), input); }
export async function dsGopYCuaToi() { return (await hom.dsGopYCuaToi(DU_AN, await admin())).filter((b) => NGUON_ETP.test(b.trang)); }
export async function docTraoDoi(taskId: number) { return hom.docTraoDoi(DU_AN, await admin(), taskId); }
export async function guiTraoDoi(input: Parameters<typeof hom.guiTraoDoi>[2]) { return hom.guiTraoDoi(DU_AN, await admin(), input); }

/** Việc Huy đang làm trong hàng etp-sua.json (worker/tho-may-viec.mjs ghi, etp2 chạy cùng máy box3). */
function huyDangLam(): string | null {
  try {
    const hang = (JSON.parse(fs.readFileSync(TEP_HUY, 'utf8')).hang ?? []) as Array<{ id: number; chu?: string; tt?: string }>;
    const v = hang.find((x) => x.tt === 'dang');
    return v ? `#${v.id}${String(v.chu ?? '').replace(/<[^>]+>/g, '').split('\n')[0]!.slice(0, 60)}` : null;
  } catch { return null; }   // chưa có hàng = không làm gì
}

/** Số cho nút 💬 (CHUAN.md): working = card etp của tôi đang claimed trong trần + Huy đang làm; can_y_kien = card etp đang chờ ý kiến của tôi. */
export async function demGopY(): Promise<hom.DemGopY> {
  const ds = await dsGopYCuaToi(), bay = Date.now();
  const lam = ds.filter((b) => b.trangThai === 'claimed' && bay - Date.parse(b.capNhat) < TRAN_DANG_LAM_MS).map((b) => `#${b.id} ${b.noiDung.split('\n')[0]!.slice(0, 60)}`);
  const huy = huyDangLam();
  const dangLam = huy ? [huy, ...lam] : lam;
  const cho = ds.filter((b) => b.choYKien);
  // tên kỹ sư phụ trách phòng: cùng sổ SOUL.md + cờ tắt nhip-chinh.json như mọi hòm của gói (góp ý #1673) — dải đầu hòm của gói tự ghi "Huy đang …"
  return { working: dangLam.length, dangLam, can_y_kien: cho.length, choYKien: cho.map((b) => b.id), kySu: hom.kySuPhuTrach(KY_SU_ETP) };
}
