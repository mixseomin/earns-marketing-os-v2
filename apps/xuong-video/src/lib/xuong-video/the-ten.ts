// THẺ TÊN NHÂN VẬT (character name super / lower third — anh 19/10/2026, học phim ngắn dọc NetShort "Karma at the Crossroad": mỗi nhân vật
// lần đầu ra mặt có tên + vai hiện cạnh người, vd "Helen West · Lily's Grandmother"). Ngành: chữ giới thiệu nhân vật (name super, character
// card) là quy ước của phim ngắn dọc và truyền hình nhiều nhân vật — khán giả lướt điện thoại cần biết "ai là ai" trong 1–2 giây, không chờ
// thoại gọi tên. Đặt ở SHOT ĐẦU nhân vật là chủ thể rõ mặt (cận / trung / qua vai), hiện ~2,5 giây, không đè chữ màn (1/3 trên) và phụ đề (dưới).
// Đây là LỚP PHỦ thường (lop.ts): nút "🏷 Thẻ tên" trên timeline thêm vào tap.lop — người dựng sửa chữ / dời / xoá như mọi lớp, bản xuất vẽ
// bằng libass như lớp chữ khác. KHÔNG tự chạy cho phim nào. Vai (dòng nhỏ) chỉ ghi khi truyền chucDanh — không tự rút từ tiểu sử vì tiểu sử
// chứa bí mật nhân vật (lộ thân phận = phá cú lật). Thuần, có test (the-ten.test.mts).
import { lopMoi, idLop } from './lop';
import type { Lop } from './kieu';
import type { KyThuatShot } from './dien-anh';

export const TIEN_TO_THE_TEN = 'Thẻ tên · ';
/** Cỡ cảnh thấy rõ mặt — chỗ đặt thẻ tên. Toàn cảnh / đặc tả / chèn vật không đặt (không biết chữ chỉ vào ai). */
const CO_THAY_MAT = ['ms', 'mcu', 'cu', 'ots', 'two', 'pov'];
/** Vai kể không đặt thẻ: chi tiết, tâm trạng (không phải lúc giới thiệu người). */
const VAI_KHONG = ['chi_tiet', 'tam_trang'];
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Một thẻ tên = nhóm 1–2 lớp chữ (tên to vàng nghiêng + vai nhỏ), trượt vào, mờ ra. tu = giây bắt đầu shot trong phim, phat = độ dài shot. */
export function lopTheTen(ten: string, tu: number, phat: number, vai?: string): Lop[] {
  const nhom = `tt-${idLop()}`; const bd = r2(tu + Math.min(0.3, phat * 0.15)); const kt = r2(Math.max(bd + 1, Math.min(tu + phat - 0.15, bd + 2.5)));
  const chung = { den: kt, nhom, vao: 'truot' as const, ra: 'mo' as const, nghieng: true, mau: '#F5C46B', vien: '#2A1C00', x: 0.36, w: 0.6 };
  return [
    lopMoi('chu', bd, { ...chung, ten: `${TIEN_TO_THE_TEN}${ten}`, chu: ten, font: 'Montserrat Black', co: 0.062, vien_day: 0.06, y: 0.55 }),
    ...(vai?.trim() ? [lopMoi('chu', bd, { ...chung, ten: `${TIEN_TO_THE_TEN}${ten} · vai`, chu: vai.trim(), font: 'Montserrat', co: 0.03, vien_day: 0.05, y: 0.595 })] : []),
  ];
}

type ShotThe = { id: number; nhan_vat: number[]; phat_s?: number | null; thoi_luong_s?: number | null; ky_thuat?: KyThuatShot | null; may_3d?: { khung?: string[] } | null };
type NvThe = { id: number; ten: string; loai: string };
/** Shot đầu mỗi nhân vật là CHỦ THỂ rõ mặt: cỡ thấy mặt, vai kể không phải chi tiết / tâm trạng, và nhân vật là người duy nhất trong shot hoặc
 *  đứng đầu danh sách khung (may_3d.khung). batDau[i] = giây bắt đầu shot i. Nhân vật đã có thẻ (lớp mang tên "Thẻ tên · X") bỏ qua —
 *  bấm lại không nhân đôi. Trả lớp mới + danh sách ai chưa có chỗ đặt (chỉ xuất hiện ở toàn cảnh / đặc tả). */
export function theTenTap(canh: ShotThe[], batDau: number[], nhanVat: NvThe[], lop: Lop[], chucDanh?: (ten: string) => string | undefined): { lop: Lop[]; khongCho: string[] } {
  const nguoi = nhanVat.filter((v) => v.loai === 'nhan_vat');
  const daCo = new Set(lop.filter((l) => l.ten?.startsWith(TIEN_TO_THE_TEN)).map((l) => l.ten!.slice(TIEN_TO_THE_TEN.length).replace(/ · vai$/, '')));
  const out: Lop[] = []; const khongCho: string[] = [];
  for (const v of nguoi) {
    if (daCo.has(v.ten)) continue;
    const i = canh.findIndex((c) => {
      if (!c.nhan_vat.includes(v.id)) return false;
      const kt = c.ky_thuat ?? {};
      if (!CO_THAY_MAT.includes(kt.co_canh ?? '') || VAI_KHONG.includes(kt.vai ?? '')) return false;
      const nguoiTrong = nguoi.filter((x) => c.nhan_vat.includes(x.id));
      return nguoiTrong.length === 1 || c.may_3d?.khung?.[0] === v.ten;
    });
    if (i < 0) { if (canh.some((c) => c.nhan_vat.includes(v.id))) khongCho.push(v.ten); continue; }
    const c = canh[i]!;
    out.push(...lopTheTen(v.ten, batDau[i] ?? 0, Number(c.phat_s || c.thoi_luong_s || 3), chucDanh?.(v.ten)));
  }
  return { lop: out, khongCho };
}
