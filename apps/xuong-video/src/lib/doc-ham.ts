// SỔ HÀM ĐỌC đi đường song song (anh 11/11/2026: "bấm vào đâu thì hiện ở đó thôi"). Server action của Next chạy NỐI ĐUÔI trên một trình duyệt:
// mở tab Shots kéo theo 11 lệnh đọc xếp hàng (~0,25 s mỗi lệnh đi về box3) → nội dung hiện sau 2,7 s. Hàm ĐỌC (không ghi) liệt kê ở đây đi qua
// route /api/xv/doc (POST thường, chạy song song); phía trình duyệt gọi bằng lib/doc.ts cùng tên + cùng kiểu. Mỗi hàm tự kiểm admin như cũ.
// Thêm một hàm đọc vào đây = hết xếp hàng cho nó. CHỈ hàm đọc — hàm ghi giữ server action (đúng thứ tự bấm).
import { tongQuanPhim, dsPhimTemplate, dsNhomTuDo, dsSanPhamTong } from './actions-ds-phim';
import { dsPhim, docPhim, dsMoHinh, dsCanh, dsThungRac, phieuShotsTap, baoCaoChuanBiAction, docHoanTac, uocTien, uocAm, kiemVideo } from './actions';

export const HAM_DOC = { tongQuanPhim, dsPhimTemplate, dsNhomTuDo, dsSanPhamTong, dsPhim, docPhim, dsMoHinh, dsCanh, dsThungRac, phieuShotsTap, baoCaoChuanBiAction, docHoanTac, uocTien, uocAm, kiemVideo };
export type HamDoc = typeof HAM_DOC;
