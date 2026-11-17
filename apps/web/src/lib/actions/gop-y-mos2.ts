'use server';

// HÒM GÓP Ý CỦA MOS2 + CITY — lõi dùng chung @mos2/gop-y/server (packages/gop-y/CHUAN.md, cùng một bản với cty / studio).
// Tệp này chỉ gắn người đăng nhập + luật riêng của mos2: team ETP gửi được từ etp.on.tc, tab "Của tôi" mỗi nơi chỉ hiện card
// gửi từ nơi đó (mos2 ↔ etp/etp2), admin thấy thêm card máy / Claude tạo, trạng thái đi qua setBacklinkSite (cổng "xong phải có kết quả").
// Góp ý etp.on.tc / etp2.on.tc nằm CHUNG hòm mos2; luật lọc nguồn này có cả ở apps/etp2 — sửa thì sửa cả hai.
import * as hom from '@mos2/gop-y/server';
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { setBacklinkSite, setBacklinkSchedule } from '@/lib/actions/architecture';

export type TinTraoDoi = hom.TinTraoDoi;
export type GopYCuaToi = hom.GopYCuaToi;

/** Hòm = project_id của card = khoá site_status: mos2 (nút 💬 mọi màn) và city (city.on.tc, xử bằng /tasks-city). */
const HOM_GOP_Y = ['mos2', 'city'];
const NGUON_ETP = '^https?://etp2?\\.on\\.tc(/|$)';
const laHostEtp = (host: string | null) => /^etp2?\.on\.tc$/.test(String(host ?? '').split(':')[0] ?? '');
const homCua = (x: unknown) => (typeof x === 'string' && HOM_GOP_Y.includes(x) ? x : 'mos2');
const laTrangEtp = (u: string) => { try { return new URL(u).hostname === 'etp.on.tc'; } catch { return false; } };
const homNayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
/** Thẻ do MÁY / Claude tạo thay anh: admin thấy trong "Của tôi" để theo dõi / trả lời / duyệt (anh 17/11/2026). */
const NGUOI_MAY = ['may-quet', 'claude', 'ai'];

const ghiTrangThai: hom.TuyChon = {
  datTrangThai: (id, h, st, url) => setBacklinkSite(id, h, st, url),
  henHomNay: (id, h) => setBacklinkSchedule(id, h, homNayVN()),
};
async function tuyChonDoc(): Promise<hom.TuyChon> {
  return { ...ghiTrangThai, nguoiMay: NGUOI_MAY, locNguon: { mau: NGUON_ETP, khop: laHostEtp((await headers()).get('host')) } };
}

export async function guiGopYMos2(input: { loai: string; noiDung: string; trang: string; anhUrls: string[]; nguCanh?: string; hom?: string }) {
  const me = await getCurrentUser(), h = homCua(input.hom);
  const choPhepGui = !!me && me.role !== 'admin' && h === 'mos2' && laTrangEtp(String(input.trang || '')) && (await quyenEtp(me));
  return hom.guiGopY(h, me, input, { ...ghiTrangThai, choPhepGui });
}
export async function dsGopYCuaToi(homVao?: string) { return hom.dsGopYCuaToi(homCua(homVao), await getCurrentUser(), await tuyChonDoc()); }
/** Số cho nút 💬 (CHUAN.md): rung khi Đạt đang làm + số đỏ góp ý đang chờ ý kiến của chính người xem. */
export async function demGopY(homVao?: string) { return hom.demGopY(homCua(homVao), await getCurrentUser(), await tuyChonDoc()); }
/** Luồng trao đổi — card có thể ở hòm mos2 hoặc city (drawer card trên plays gọi theo id). */
export async function docTraoDoiCard(taskId: number) { return hom.docTraoDoi(HOM_GOP_Y, await getCurrentUser(), taskId); }
export async function guiTraoDoiCard(input: { taskId: number; noiDung: string; anhUrls: string[]; xuLy: string }) {
  return hom.guiTraoDoi(HOM_GOP_Y, await getCurrentUser(), input, ghiTrangThai);
}
