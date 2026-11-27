'use server';

// HÒM GÓP Ý CỦA MOS2 + CITY — lõi dùng chung @mos2/gop-y/server (packages/gop-y/CHUAN.md, cùng một bản với cty / studio).
// Tệp này chỉ gắn người đăng nhập + luật riêng của mos2: team ETP gửi được từ etp.on.tc, tab "Của tôi" mỗi nơi chỉ hiện card
// gửi từ nơi đó (mos2 ↔ etp/etp2), admin thấy thêm card máy / Claude tạo, trạng thái đi qua setBacklinkSite (cổng "xong phải có kết quả").
// Góp ý etp.on.tc / etp2.on.tc nằm CHUNG hòm mos2; luật lọc nguồn này có cả ở repo etp2 — sửa thì sửa cả hai.
import * as hom from '@mos2/gop-y/server';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { quyenGopYS2, tuStudio2 } from '@/lib/gop-y-quyen-s2';
import { boLocNguon, noiDangXem, trangRieng } from '@/lib/gop-y-loc-nguon';
import { HEADER_KHACH, laTrangKhach, nguoiKhach } from '@/lib/gop-y-khach';
import { setBacklinkSite, setBacklinkSchedule } from '@/lib/actions/architecture';

export type TinTraoDoi = hom.TinTraoDoi;
export type GopYCuaToi = hom.GopYCuaToi;

/** Hòm = project_id của card = khoá site_status: mos2 (nút 💬 mọi màn) và city (city.on.tc, xử bằng /tasks-city). */
const HOM_GOP_Y = ['mos2', 'city', 'xuong-video'];
/** HÒM THEO NƠI GỬI: studio2.on.tc là mặt khác của Xưởng video → card về hòm xuong-video (Vinh, /tasks-studio), không về mos2 — trước đây
 *  card studio2 nằm hòm mos2, Đạt (chỉ sửa apps/web) nhận rồi trả về (#1741, anh 21/11/2026 "Tại sao lại là mos2 xử lý?"). Thêm trang = thêm một dòng. */
const HOM_THEO_NOI: Record<string, { hom: string }> = { 'studio2.on.tc': { hom: 'xuong-video' } };
async function noiGui() { const h = await headers(); return noiDangXem(h.get('host'), h.get('referer')); }
async function homCua(x: unknown) { const theoNoi = HOM_THEO_NOI[await noiGui()]; if (theoNoi) return theoNoi.hom; return typeof x === 'string' && HOM_GOP_Y.includes(x) ? x : 'mos2'; }
/** Người gửi: phiên mos2, hoặc KHÁCH của trang công khai (dantranh — middleware đã kiểm VN + gắn mã, lib/gop-y-khach.ts). */
async function nguoiGui(): Promise<hom.Nguoi | null> {
  const me = await getCurrentUser();
  if (me) return me;
  return nguoiKhach((await headers()).get(HEADER_KHACH), await noiGui());
}
/** Khách gửi tối đa 6 góp ý / giờ — trang công khai không đăng nhập, chặn xả rác (dòng lỗi hiện ngay dưới nút Gửi). */
async function khachQuaNhieu(email: string) {
  const db = getDb(); if (!db) return false;
  const r = (await db.execute(sql`SELECT count(*)::int AS n FROM human_tasks WHERE prep_payload->>'source_platform' = 'feedback'
    AND lower(prep_payload->'trao_doi'->0->>'nguoi') = lower(${email}) AND created_at > now() - interval '1 hour'`)) as unknown as Array<{ n: number }>;
  return Number(r[0]?.n ?? 0) >= 6;
}
const hostCua = (u: unknown) => { try { return new URL(String(u || '')).hostname; } catch { return ''; } };
const laTrangEtp = (u: string) => { try { return new URL(u).hostname === 'etp.on.tc'; } catch { return false; } };
const homNayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
/** Thẻ do MÁY / Claude tạo thay anh: admin thấy trong "Của tôi" để theo dõi / trả lời / duyệt (anh 17/11/2026). */
const NGUOI_MAY = ['may-quet', 'claude', 'ai'];

const ghiTrangThai: hom.TuyChon = {
  datTrangThai: (id, h, st, url) => setBacklinkSite(id, h, st, url),
  henHomNay: (id, h) => setBacklinkSchedule(id, h, homNayVN()),
};
async function tuyChonDoc(): Promise<hom.TuyChon> {
  const h = await headers(); // nguồn theo nơi đang xem: mos2 / etp / castle (lib/gop-y-loc-nguon.ts)
  // Kỹ sư theo nơi đang xem = cột kySu của sổ TRANG_RIENG (castle Thắng #1673, dantranh Nguyệt, studio2 Vinh, worlds Giang); trang khách khác → Nguyệt
  const noi = noiDangXem(h.get('host'), h.get('referer')), kySu = trangRieng(noi)?.kySu ?? (laTrangKhach(noi) ? 'nguyet' : undefined);
  return { ...ghiTrangThai, nguoiMay: NGUOI_MAY, locNguon: boLocNguon(h.get('host'), h.get('referer')), kySu };
}

export async function guiGopYMos2(input: { loai: string; noiDung: string; trang: string; anhUrls: string[]; nguCanh?: string; hom?: string }) {
  const nguoi = await nguoiGui(), h = await homCua(input.hom);
  if (nguoi?.role === 'khach') {   // khách trang công khai: chỉ hòm mos2, chỉ từ trang khách, trần 6 góp ý / giờ
    if (await khachQuaNhieu(nguoi.email)) return { ok: false, error: 'Bạn đã gửi 6 góp ý trong một giờ — đợi một lúc rồi gửi tiếp; nháp vẫn giữ.' };
    return hom.guiGopY(h, nguoi, input, { ...ghiTrangThai, choPhepGui: h === 'mos2' && laTrangKhach(hostCua(input.trang)) });
  }
  const me = await getCurrentUser(), hd = await headers();
  const choPhepGui = !!me && me.role !== 'admin' && (
    (h === 'mos2' && laTrangEtp(String(input.trang || '')) && !!(await quyenEtp(me)))
    || (h === 'xuong-video' && tuStudio2(hd.get('host'), hd.get('referer'), hd.get('sec-fetch-dest')) && (await quyenGopYS2(me.id))));
  return hom.guiGopY(h, me, input, { ...ghiTrangThai, choPhepGui });
}
export async function dsGopYCuaToi(homVao?: string) { return hom.dsGopYCuaToi(await homCua(homVao), await nguoiGui(), await tuyChonDoc()); }
/** Số cho nút 💬 (CHUAN.md): rung khi Đạt đang làm + số đỏ góp ý đang chờ ý kiến của chính người xem. */
export async function demGopY(homVao?: string) { return hom.demGopY(await homCua(homVao), await nguoiGui(), await tuyChonDoc()); }
/** Luồng trao đổi — card có thể ở hòm mos2 hoặc city (drawer card trên plays gọi theo id). */
export async function docTraoDoiCard(taskId: number) { return hom.docTraoDoi(HOM_GOP_Y, await nguoiGui(), taskId); }
export async function guiTraoDoiCard(input: { taskId: number; noiDung: string; anhUrls: string[]; xuLy: string }) {
  return hom.guiTraoDoi(HOM_GOP_Y, await nguoiGui(), input, ghiTrangThai);
}
