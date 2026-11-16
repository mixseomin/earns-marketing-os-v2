// LUẬT MÁY QUAY THEO SHOT + NGUỒN (anh 16/11/2026: "trên timeline, studio có nhìn được chi tiết khi hover về nguồn kiến thức, tham khảo nào cho mỗi vị trí, điểm chấm không?").
// MỘT chỗ gom kết quả mọi luật máy quay của một tập theo từng shot — động cơ máy + nhảy hình (nhip-hinh.ts), ngữ pháp máy theo nhịp kịch (ngu-phap-may.ts), cỡ + máy
// một nguồn (chan-gui-video.ts) — mỗi lỗi gắn MÃ LUẬT (luat-dung.ts) để màn hình lấy tên luật + NGUỒN NGÀNH từ sổ NGANH (dien-anh-nganh.ts / nganh-luat-dung.ts).
// Cùng hàm với cổng tiền kỳ nên timeline và cổng nói cùng một câu. Thuần, tự kiểm: cham-may.test.mts.
import { kiemNhipHinh, TIEN_TO_NHIP_HINH } from './nhip-hinh';
import { dongCoMay, diCm, kiemNguPhapMay, TIEN_TO_NGU_PHAP } from './ngu-phap-may';
import { loiCoMay, shotCoMay } from './chan-gui-video';
import { chuThe } from './bo-set-3d';
import { NGANH } from './dien-anh-nganh';
import { LUAT_DUNG_CANH } from './luat-dung';
import { giayPhat, type Canh } from './kieu';

export type DanhGiaMay = { chu: string; luat: string };
/** Mã luật của một câu báo — để màn hình mở đúng luật + nguồn. */
const luatCua = (l: string): string => (/nhảy hình/.test(l) ? 'luat_30' : 'may_co_dong_co');

/** Lỗi máy quay theo shot (khoá = id shot). Câu báo cặp "#a–#b" gắn vào shot SAU (chỗ cú cắt rơi vào). */
export function chamMayTap(canh: Canh[], o: { theLoai?: string; laQc?: boolean; giay?: (c: Canh) => number } = {}): Map<number, DanhGiaMay[]> {
  const out = new Map<number, DanhGiaMay[]>(); const theoSo = new Map(canh.map((c) => [String(+c.thu_tu), c.id] as const));
  const gan = (l: string, luat: string, bo = '') => { const m = [...l.matchAll(/#(\d+(?:\.\d+)?)/g)].map((x) => String(+x[1]!)); const so = m.length > 1 && /–/.test(l) ? m[1]! : m[0];
    const id = so != null ? theoSo.get(so) : undefined; if (id == null) return; (out.get(id) ?? out.set(id, []).get(id)!).push({ chu: (bo ? l.replace(bo, '') : l).trim(), luat }); };
  // Canh.may_3d khai rộng hơn khuôn dongCoMay đọc (dat / nhin / vi_tri) — ép kiểu ở ranh giới, dữ liệu là cùng một bản ghi
  const dc = dongCoMay(canh.map((c) => ({ ...c, giay: (o.giay ?? giayPhat)(c), chu: c.may_3d ? chuThe(c.may_3d) : null, di_cm: c.may_3d ? diCm(c.may_3d.vi_tri) : null, cuoi: false })) as unknown as Parameters<typeof dongCoMay>[0]);
  for (const l of kiemNhipHinh(dc)) gan(l, luatCua(l), TIEN_TO_NHIP_HINH);
  for (const l of kiemNguPhapMay(dc, o.theLoai)) gan(l, 'may_co_dong_co', TIEN_TO_NGU_PHAP);
  if (!o.laQc) for (const l of loiCoMay(canh.map(shotCoMay))) gan(l, 'co_may_mot_nguon');
  return out;
}

/** Tên + nguồn ngành của một luật dựng (luat-dung.ts › key). */
export const nguonLuat = (key: string): { ten: string; nguon: string } => ({ ten: LUAT_DUNG_CANH.find((l) => l.key === key)?.ten ?? key, nguon: NGANH[`luat.${key}`]?.nganh.nguon ?? 'chưa có mục nguồn' });
/** Nguồn ngành của một kỹ thuật (nhóm.key, vd chuyen_dong.lia). */
export const nguonKyThuat = (nhom: string, key?: string | null): string | null => (key ? NGANH[`${nhom}.${key}`]?.nganh.nguon ?? null : null);
