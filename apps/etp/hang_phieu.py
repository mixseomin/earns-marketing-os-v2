"""HÀNG ĐỢI PHIẾU LÊN CAMP (card #1931, anh 28/11/2026 "Sao phải dừng … Phải tự cho vào hàng đợi"): phiếu gửi khi phim đang có phiếu cùng dạng chờ dựng
nằm 'xep' trong etp.phieu_len; etp.day_hang_phieu() (migration 0495) khởi dựng phiếu kế khi chỗ trống. Trigger đã đẩy ngay lúc phiếu trước rời 'dung';
dong-bo.py gọi chay(q) mỗi lượt 10 phút để thử lại khi máy dựng (mau_dung AD / dòng phim) còn bận lúc đó. Chỉ khởi DỰNG creative — không tạo / bật camp."""


def chay(q):
    so = int(q("select etp.day_hang_phieu()") or 0)
    con = int(q("select count(*) from etp.phieu_len where trang_thai = 'xep'") or 0)
    return {"khoi": so, "con_xep": con}
