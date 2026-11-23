#!/usr/bin/env python3
"""DỌN KHO ETHOPEX TRÊN iMAC (anh 15/11/2026: "iMac cấm quá tải và hdd tốn như vậy" — ~/.cache/ethopex lên 69 GB, ổ còn 5,5 GB, máy đơ).
Xoá bản ĐẦU VÀO tải lại được + bản ra ảnh tĩnh ĐÃ CÓ BẢN TRÊN KHO:
  - thu-vien/tv<id>.mp4   : thu-vien-len.py curl lại từ etp.thu_vien.video MỖI lần chạy → bản cũ là đồ thừa (giữ tv*.goc.mp4 + lo-*.json)
  - anh-tinh/<phim>/tap*.mp4 : tai-tap.py tải 3 tập miễn phí để chọn khung → chọn xong là thừa
  - anh-tinh/<phim>/khung/*.jpg : khung tách từ tập để chấm mặt; khung() xoá sạch rồi tách lại mỗi lượt
  - anh-tinh/<phim>/*.mp4 (bản ra anh-tinh / po / att / cts / pd) cũ hơn 48 giờ: anh-tinh.py + tinh-ba-kieu.py rsync lên box3 → thu-vien-them
    đưa vào kho img.on.tc (etp.thu_vien.video) ngay trong lượt dựng, không script nào đọc lại bản iMac → bản iMac là bản thừa
    (anh 23/11/2026: anh-tinh/ lên 21 GB, ~3 GB / ngày, ổ còn 22 GB). 48 giờ chừa chỗ cho lượt --xem soát tay.
Giữ nguyên: nguon/ (đang dùng, đọc chữ gắn giờ tệp ghep-cuoi), ra/ (creative đã dựng), ảnh chữ / giọng / poster nhỏ trong anh-tinh/<phim>.
Ngưỡng tuổi tính theo từng luật (đầu vào 6 giờ, bản ra 48 giờ); --gio N đè ngưỡng mọi luật.
Dùng (iMac): python3 don-kho.py [--xem] [--gio N]      --xem = chỉ đếm, không xoá
thu-vien-len.py và anh-tinh.py gọi khi chạy xong; --tu-kiem chạy bài tự kiểm."""
import os, re, sys, tempfile, time

C = os.path.expanduser("~/.cache/ethopex")
LUAT = [("thu-vien", re.compile(r"tv\d+\.mp4"), False, 6),        # (thư mục, mẫu tên, tìm trong thư mục con, giờ tối thiểu)
        ("anh-tinh", re.compile(r"tap\d+\.mp4"), True, 6),
        ("anh-tinh", re.compile(r"[^/]+\.jpg", re.S), "khung", 6),     # chỉ trong anh-tinh/<phim>/khung/
        ("anh-tinh", re.compile(r"(?!tap\d+\.mp4)[^/]+\.mp4"), "phim", 48)]   # bản ra ngay trong anh-tinh/<phim>/

def quet(goc, gio=None):
    ra = []
    for thu, mau, sau, gio_luat in LUAT:
        d = os.path.join(goc, thu); han = time.time() - (gio if gio is not None else gio_luat) * 3600
        if not os.path.isdir(d): continue
        di = os.walk(d) if sau else [(d, [], os.listdir(d))]
        for g, _, ts in di:
            sau_ = os.path.relpath(g, d).split(os.sep)
            if sau == "khung" and not (len(sau_) == 2 and sau_[1] == "khung"): continue
            if sau == "phim" and len(sau_) != 1 or sau == "phim" and sau_ == ["."]: continue
            for t in ts:
                f = os.path.join(g, t)
                if mau.fullmatch(t) and os.path.isfile(f) and os.path.getmtime(f) < han: ra.append(f)
    return ra

def don(goc=C, gio=None, xem=False):
    ds = quet(goc, gio); n = sum(os.path.getsize(f) for f in ds)
    if not xem:
        for f in ds: os.remove(f)
    return len(ds), n

def tu_kiem():
    with tempfile.TemporaryDirectory() as g:
        cu = time.time() - 3 * 86400
        def tao(p, cu_=True):
            p = os.path.join(g, p); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "wb").write(b"x" * 10)
            if cu_: os.utime(p, (cu, cu))
            return p
        xoa = [tao("thu-vien/tv12.mp4"), tao("anh-tinh/100002/tap1.mp4"), tao("anh-tinh/100002/khung/tap1_0001.jpg"),
               tao("anh-tinh/100002/po1-1.mp4"), tao("anh-tinh/100002/anh-tinh-100002-1.mp4")]
        giu = [tao("thu-vien/tv12.goc.mp4"), tao("thu-vien/lo-tv1.json"), tao("anh-tinh/100002/chu-0.png"),
               tao("anh-tinh/100002/giong-ab.mp3"), tao("anh-tinh/100002/poster.jpg"), tao("anh-tinh/to-2311.jpg"),
               tao("nguon/1/tap1.mp4"), tao("ra/x/c-1-1.mp4"), tao("thu-vien/tv13.mp4", cu_=False),
               tao("anh-tinh/100003/anh-tinh-100003-1.mp4", cu_=False)]      # mới → lô đang chạy / chờ soát
        assert don(g, xem=True) == (5, 50), "đếm sai"
        assert all(os.path.exists(f) for f in xoa), "--xem không được xoá"
        assert don(g) == (5, 50)
        assert not any(os.path.exists(f) for f in xoa), "còn sót bản thừa"
        assert all(os.path.exists(f) for f in giu), "xoá nhầm ảnh chữ / giọng / bản mới"
        assert don(g) == (0, 0), "lần hai phải rỗng"
        assert don(os.path.join(g, "khong-co")) == (0, 0), "thư mục không có phải im"
        p = tao("anh-tinh/100004/po1-1.mp4"); os.utime(p, (time.time() - 30 * 3600,) * 2)
        assert don(g) == (0, 0) and os.path.exists(p), "bản ra 30 giờ phải giữ (ngưỡng 48)"
    print("tự kiểm 7/7")

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--tu-kiem" in a: tu_kiem(); sys.exit()
    gio = int(a[a.index("--gio") + 1]) if "--gio" in a else None
    so, n = don(gio=gio, xem="--xem" in a)
    print(f"dọn kho ethopex: {'sẽ xoá' if '--xem' in a else 'đã xoá'} {so} tệp thừa · {n / 1e9:.1f} GB ({f"tệp cũ hơn {gio} giờ" if gio is not None else "đầu vào > 6 giờ, bản ra > 48 giờ"})")
