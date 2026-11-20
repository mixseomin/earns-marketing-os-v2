// SỔ HÀM GHI cho Studio 2 (studio2.on.tc, apps/studio2) — anh 20/11/2026: "làm 1 lượt đến khi tao có thể tạo video mới trên s2".
// Studio 2 là trang tĩnh nên không gọi được server action của Next; các bước làm phim nó cần đi qua route /api/xv/ghi (POST thường), CHỈ những hàm
// liệt kê ở đây. Mỗi hàm vẫn là đúng server action studio đang dùng: tự kiểm quyền quản trị, tự gác cổng quy trình (quy-trinh.ts) và cổng tiền
// (chot-tien.ts) như khi bấm trên studio. Thêm một bước cho Studio 2 = thêm tên hàm vào đây. Hàm ĐỌC thì thêm ở doc-ham.ts.
import { taoPhim, taoPhimMau, taoTap, suaPhim, suaTap, vietKichBanTap, tachCanhTap, batDauNguoiXem, suaTheoNguoiXem, duyetNguoiXemTayAction, goiYAIKinhThanh, goiYAIBoAnchor,
  sinhAnhThieuAction, sinhKeyframe, chonKeyframe, duyetCanh, sinhGiong, duyetAnimatic, sinhVideoCanh, sinhNhac, xuatTap, suaCanh, xepCanh, themCanh, taoPhimTuTemplate } from './actions';
import { taoPhimS2, datQuyenS2, phanTichAstrolasS2 } from './actions-studio2';

export const HAM_GHI = { taoPhim, taoPhimMau, taoTap, suaPhim, suaTap, vietKichBanTap, tachCanhTap, batDauNguoiXem, suaTheoNguoiXem, duyetNguoiXemTayAction, goiYAIKinhThanh, goiYAIBoAnchor,
  sinhAnhThieuAction, sinhKeyframe, chonKeyframe, duyetCanh, sinhGiong, duyetAnimatic, sinhVideoCanh, sinhNhac, xuatTap, suaCanh, xepCanh, themCanh, taoPhimTuTemplate, taoPhimS2, datQuyenS2, phanTichAstrolasS2 };
export type HamGhi = typeof HAM_GHI;
