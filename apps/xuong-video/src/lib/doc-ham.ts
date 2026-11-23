// SỔ HÀM ĐỌC đi đường song song (anh 11/11/2026: "bấm vào đâu thì hiện ở đó thôi"). Server action của Next chạy NỐI ĐUÔI trên một trình duyệt:
// mở tab Shots kéo theo 11 lệnh đọc xếp hàng (~0,25 s mỗi lệnh đi về box3) → nội dung hiện sau 2,7 s. Hàm ĐỌC (không ghi) liệt kê ở đây đi qua
// route /api/xv/doc (POST thường, chạy song song); phía trình duyệt gọi bằng lib/doc.ts cùng tên + cùng kiểu. Mỗi hàm tự kiểm admin như cũ.
// Thêm một hàm đọc vào đây = hết xếp hàng cho nó. CHỈ hàm đọc — hàm ghi giữ server action (đúng thứ tự bấm).
import { tongQuanPhim, dsPhimTemplate, dsNhomTuDo, dsSanPhamTong } from './actions-ds-phim';
import { nhatKyTap, nhatKyCanh, quyTrinhTap, dsMauPhim, toiS2, dsPhimS2, dsGoiTheLoai, dsTemplateS2, dsDoiS2, docCoSoS2, hangDoiS2, camNangS2, creditS2, soCreditS2, xemLenhS2, banDaSinhS2, banNhacS2, docAiS2, giongNvS2 } from './actions-studio2';
import { trangThaiXuat, docTemplate } from './actions';
import { dsThietKe, docThietKe, dsMauCrS2, anhMauCrS2, dsPhimThuS2, anhPhimS2, dsThuMucTK } from './actions-thiet-ke';
import { dsPhim, docPhim, dsMoHinh, dsCanh, dsThungRac, phieuShotsTap, baoCaoChuanBiAction, docHoanTac, uocTien, uocAm, kiemVideo, docViecNen, demNguonPhim } from './actions';

export const HAM_DOC = { docAiS2, giongNvS2, dsThietKe, docThietKe, dsMauCrS2, anhMauCrS2, dsPhimThuS2, anhPhimS2, dsThuMucTK, creditS2, soCreditS2, tongQuanPhim, dsPhimTemplate, dsNhomTuDo, dsSanPhamTong, dsPhim, docPhim, dsMoHinh, dsCanh, dsThungRac, phieuShotsTap, baoCaoChuanBiAction, docHoanTac, uocTien, uocAm, kiemVideo, docViecNen, demNguonPhim, nhatKyTap, nhatKyCanh, quyTrinhTap, dsMauPhim, trangThaiXuat, toiS2, dsPhimS2, dsGoiTheLoai, dsTemplateS2, dsDoiS2, docTemplate, docCoSoS2, hangDoiS2, camNangS2, xemLenhS2, banDaSinhS2, banNhacS2 };
export type HamDoc = typeof HAM_DOC;
