// KÊNH SẢN PHẨM — phần TÍNH (thuần, client import được; tự kiểm: tsx kenh-sp-tinh.test.mts). Đọc DB ở kenh-sp.ts.
// Kênh nội dung coi là SẢN PHẨM (xv_may.la_san_pham — anh 02/11/2026, kênh Yesterday's News Tonight): số đo hằng ngày ở kenh_so_ngay
// (kenh youtube, san_pham 'may:<mã>', hien = lượt xem cộng dồn, so_muc = video đã đăng, chi_tiet.nguoi_dk) do may-dung.mts --so-kenh ghi.
// 7 ngày = bản ghi mới nhất − bản ghi gần nhất có ngày ≤ hôm nay − 7; chưa có mốc đó = null ("–", chưa đo ≠ 0).

export type SoNgayKenh = { ngay: string; xem: number; daDang: number; nguoiDk: number | null };
export type VideoKenh = { slug: string; ten: string; trangThai: 'chua_xuat' | 'cho_cham' | 'duyet' | 'sua_lai' | 'da_dang'; ngayDang: string | null; url: string | null; xem: number | null; giay: number | null };
export type KenhSp = {
  ma: string; ten: string; chay: boolean; kenhUrl: string | null;
  tap: number; choDang: number; daDang: number;
  xem: number | null; xem7: number | null; nguoiDk: number | null; nguoiDk7: number | null; ngaySo: string | null; dangCuoi: string | null;
  /** phim Studio quản lý kênh (xv_phim.kinh_thanh.may = mã máy) · ảnh đại diện kênh (trang YouTube, may-dung --so-kenh) */
  phimId: number | null; anh: string | null;
  /** video của kênh (cây dưới dòng kênh): trạng thái theo chặng — chưa xuất → chờ chấm → DUYỆT / SỬA LẠI (Phòng Nội dung) → đã đăng */
  videos: VideoKenh[];
  /** social trỏ về kênh (bài short dẫn link kênh) — tab Tài sản gắn theo khung ?ky= */
  social?: import('./social-tro-ve-tinh').TroVe | null;
};

const lui = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/** Số mới nhất + chênh 7 ngày từ các bản ghi ngày của một kênh. */
export function tinhSoKenh(ds: SoNgayKenh[], hom: string): Pick<KenhSp, 'xem' | 'xem7' | 'nguoiDk' | 'nguoiDk7' | 'ngaySo'> {
  const xep = [...ds].sort((a, b) => b.ngay.localeCompare(a.ngay)), moi = xep[0];
  if (!moi) return { xem: null, xem7: null, nguoiDk: null, nguoiDk7: null, ngaySo: null };
  const cu = xep.find((d) => d.ngay <= lui(hom, 7));
  return {
    xem: moi.xem, xem7: cu ? moi.xem - cu.xem : null,
    nguoiDk: moi.nguoiDk, nguoiDk7: cu && cu.nguoiDk != null && moi.nguoiDk != null ? moi.nguoiDk - cu.nguoiDk : null,
    ngaySo: moi.ngay,
  };
}

/** Chặng của một video kênh — đã đăng thắng mọi thứ; chưa có bản xuất = chưa xuất; có bản xuất mà Phòng Nội dung chưa chấm = chờ chấm. */
export const changVideo = (v: { daDang: boolean; xuat: boolean; cham: string | null }): VideoKenh['trangThai'] =>
  v.daDang ? 'da_dang' : !v.xuat ? 'chua_xuat' : v.cham === 'DUYET' ? 'duyet' : v.cham === 'SUA_LAI' ? 'sua_lai' : 'cho_cham';
