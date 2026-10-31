// PHÂN QUYỀN etp.on.tc (anh 31/10/2026: "David và Sơn là admin sẽ xem đc full như hiện tại. Sau này sẽ có tk của Kiên sẽ chỉ xem phần của Kiên,
// ko được xem các phần khác để tăng sự sáng tạo và tìm tòi ra ngách mới"; Sơn "được edit camp của Sơn"). MỘT chỗ gác cho trang /etp và mọi action etp —
// trước đây mỗi nơi tự viết `role !== 'admin' && chiHost !== 'etp.on.tc'`. Sổ: etp.quyen (migration 0380).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import type { AuthUser } from '@/lib/auth';
import type { DuLieuEtp } from '@/lib/etp-doc';

/** chu = admin mos2 (xem + làm hết) · admin = xem hết, sửa camp trong tài khoản của nguoiId · nguoi = chỉ phần của nguoiId, không sửa */
export type QuyenEtp = { vai: 'chu' | 'admin' | 'nguoi'; nguoiId: number | null };

export async function quyenEtp(me: AuthUser | null): Promise<QuyenEtp | null> {
  if (!me) return null;
  if (me.role === 'admin') return { vai: 'chu', nguoiId: null };
  const r = ((await getDb()!.execute(sql`select vai, nguoi_id from etp.quyen where user_id = ${me.id}`)) as unknown as { vai: string; nguoi_id: number | null }[])[0];
  if (!r || (r.vai !== 'admin' && r.vai !== 'nguoi')) return null;
  return { vai: r.vai, nguoiId: r.nguoi_id == null ? null : Number(r.nguoi_id) };
}

/** ?ng= người được xem: vai nguoi bị khoá về chính mình, gõ tay số khác cũng không đổi được */
export const ngCua = (q: QuyenEtp, ng?: string) => (q.vai === 'nguoi' ? String(q.nguoiId) : ng);
/** được tải phần nặng / chữ chấm (dữ liệu nhà) không */
export const xemNha = (q: QuyenEtp) => q.vai !== 'nguoi';
/** camp này có được sửa không: chỉ admin etp có nguoiId, camp nằm trong tài khoản QC của người đó (kiểm lại lần nữa ở cổng Ethopex) */
export const suaNguoi = (q: QuyenEtp) => (q.vai === 'admin' ? q.nguoiId : null);

/** phiên Ethopex riêng của người (sua-ngoai.py ket cất) còn hạn tới đâu — null = chưa kết nối / đã hết hạn. Chỉ đọc NGÀY, không bao giờ đọc chuỗi phiên. */
export async function hetPhienEthopex(nguoiId: number | null): Promise<string | null> {
  if (nguoiId == null) return null;
  const r = ((await getDb()!.execute(sql`select gia_tri->${String(nguoiId)}->>'het' het from xv_khoa_ngoai where ten = 'ethopex_nguoi'`)) as unknown as { het: string | null }[])[0];
  return r?.het && new Date(r.het).getTime() > Date.now() + 60_000 ? r.het : null;
}

// DỮ LIỆU CHO VAI nguoi — danh sách CHO PHÉP, không phải danh sách cấm: trường nào không ghi ở GIU thì về rỗng theo RONG.
// Thêm trường mới vào DuLieuEtp mà quên ở đây → tsc báo thiếu khoá trong RONG → buộc quyết định, mặc định là KHÔNG lộ.
const GIU = ['nhe', 'luc', 'nay', 'ngay', 'camps', 'creatives', 'phims', 'soNgay', 'demNgay', 'theLoai', 'xetLuat', 'xetLuc', 'lsBac'] as const;
type Giu = (typeof GIU)[number];
const RONG: Omit<DuLieuEtp, Giu | 'nguoi' | 'cauHinh'> = {
  thuVien: [], nhatKy: [], canhBao: [], dongBo: null, boTk: {}, pheu: [], diemCham: {}, soLuat: [], thayThe: [], taiNguyen: [], mayTho: [],
  hangDoi: { cho: 0, dang: 0, xong: 0, loi: 0 }, bao: [], roas: [], roasChay: [], baoHoa: [], nbLoi: [], quet: {}, tieuChi: [], cham: {}, dangSx: [], chamHang: {},
  lichGio: [], khungSo: [], lichTat: [], khungGio: [], khungNay: '', chamTat: { bat: false, camp: [], mienLuc: null }, phot: [],
};
/** cấu hình luật được thấy: chỉ thứ cột Luật / đề xuất bậc cần để vẽ (thang bậc) — anh 31/10/2026 cho Kiên xem đề xuất bậc của máy */
const CAU_HINH_NGUOI = new Set(['thang_bo', 'thang_muc']);

export function catChoNguoi(d: DuLieuEtp, nguoiId: number): DuLieuEtp {
  if (d.nguoi.dang !== nguoiId || !d.nguoi.ngoai) throw new Error(`etp: dữ liệu đang của người #${d.nguoi.dang}, không phải #${nguoiId}`);
  const giu = Object.fromEntries(GIU.map((k) => [k, d[k]])) as Pick<DuLieuEtp, Giu>;
  const ban = d.nguoi.ds.find((x) => x.id === nguoiId);
  return { ...RONG, ...giu,
    nguoi: { ds: ban ? [ban] : [], dang: nguoiId, nha: null, ngoai: true },
    cauHinh: d.cauHinh.filter((k) => CAU_HINH_NGUOI.has(k.khoa)),
    demNgay: Object.fromEntries(Object.entries(d.demNgay).map(([k, v]) => [k, { ...v, tat: 0 }])) };   // tat = camp máy nhà tắt (nhật ký nhà)
}
