-- anh 25/11/2026: "Ko set trần ngày hay số camp limit nào hết … Xoá hết cho tao"
-- bỏ trần camp mới / ngày (null = không trần; tran_len.py thôi ghi), trần tổng ngân sách ngày, trần bộ, trần camp / phim / tài khoản (0 = không trần), trần $/ngày của khối
update etp.cau_hinh set gia_tri = 'null'::jsonb, ai = 'anh 25/11/2026 bỏ trần', luc = now() where khoa in ('tran_camp_moi_ngay', 'tran_ngay');
update etp.cau_hinh set gia_tri = '{}'::jsonb, luc = now() where khoa = 'tran_bo';
update etp.cau_hinh set gia_tri = '0'::jsonb, ai = 'anh 25/11/2026 bỏ trần', luc = now() where khoa = 'tran_phim';
update etp.khoi set tran_ngay = null;
