// SỔ HÀM GHI cho Studio 2 (studio2.on.tc, apps/studio2) — anh 20/11/2026: "làm 1 lượt đến khi tao có thể tạo video mới trên s2".
// Studio 2 là trang tĩnh nên không gọi được server action của Next; các bước làm phim nó cần đi qua route /api/xv/ghi (POST thường), CHỈ những hàm
// liệt kê ở đây. Mỗi hàm vẫn là đúng server action studio đang dùng: tự kiểm quyền quản trị, tự gác cổng quy trình (quy-trinh.ts) và cổng tiền
// (chot-tien.ts) như khi bấm trên studio. Thêm một bước cho Studio 2 = thêm tên hàm vào đây. Hàm ĐỌC thì thêm ở doc-ham.ts.
import { taoPhim, taoPhimMau, taoTap, suaPhim, suaTap, vietKichBanTap, tachCanhTap, batDauNguoiXem, suaTheoNguoiXem, duyetNguoiXemTayAction, goiYAIKinhThanh, goiYAIBoAnchor,
  sinhAnhThieuAction, sinhKeyframe, chonKeyframe, duyetCanh, sinhGiong, duyetAnimatic, sinhVideoCanh, sinhNhac, xuatTap, suaCanh, xepCanh, themCanh, luuKhuonChuoi, kiemKhungTapAction, duyetKhungTayAction, boQuaSoiClipAction, taoPhimTuTemplate } from './actions';
import { taoPhimS2, datQuyenS2, phanTichAstrolasS2, moTraPhiS2, veLaiAnhMauS2, taoNhanVatS2, sinhLaiCanhS2, sinhAmS2, lenhAiS2 } from './actions-studio2';
import { luuThietKe, luuTruThietKe, taoThuMucTK, chuyenThuMucTK, doiThuMucTK } from './actions-thiet-ke';

export const HAM_GHI = { lenhAiS2, taoPhim, taoPhimMau, taoTap, suaPhim, suaTap, vietKichBanTap, tachCanhTap, batDauNguoiXem, suaTheoNguoiXem, duyetNguoiXemTayAction, goiYAIKinhThanh, goiYAIBoAnchor,
  sinhAnhThieuAction, sinhKeyframe, chonKeyframe, duyetCanh, sinhGiong, duyetAnimatic, sinhVideoCanh, sinhNhac, xuatTap, suaCanh, xepCanh, themCanh, luuKhuonChuoi, kiemKhungTapAction, duyetKhungTayAction, boQuaSoiClipAction, taoPhimTuTemplate, taoPhimS2, datQuyenS2, phanTichAstrolasS2, moTraPhiS2, veLaiAnhMauS2, taoNhanVatS2, sinhLaiCanhS2, sinhAmS2, luuThietKe, luuTruThietKe, taoThuMucTK, chuyenThuMucTK, doiThuMucTK };
export type HamGhi = typeof HAM_GHI;
