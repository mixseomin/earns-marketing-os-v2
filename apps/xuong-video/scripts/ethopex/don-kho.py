#!/usr/bin/env python3
"""DỌN KHO ETHOPEX TRÊN iMAC (anh 15/11/2026: "iMac cấm quá tải và hdd tốn như vậy" — ~/.cache/ethopex lên 69 GB, ổ còn 5,5 GB, máy đơ).
CHỈ xoá bản ĐẦU VÀO tải lại được, không xoá bản ra:
  - thu-vien/tv<id>.mp4   : thu-vien-len.py curl lại từ etp.thu_vien.video MỖI lần chạy → bản cũ là đồ thừa (giữ tv*.goc.mp4 + lo-*.json)
  - anh-tinh/<phim>/tap*.mp4 : tai-tap.py tải 3 tập miễn phí để chọn khung → chọn xong là thừa
Giữ nguyên: nguon/ (đang dùng, đọc chữ gắn giờ tệp ghep-cuoi), ra/ (creative đã dựng), anh-tinh po/att/cts/pd/anh-tinh-*.mp4 (bản ra).
Tệp mới hơn 6 giờ không đụng (lô đang chạy; tv*.mp4 / tập tải về chỉ dùng trong MỘT lượt vài phút — nguon/ và ra/ máy đã tự dọn theo vòng ngày).
Dùng (iMac): python3 don-kho.py [--xem] [--gio N]      --xem = chỉ đếm, không xoá
thu-vien-len.py và anh-tinh.py gọi khi chạy xong; --tu-kiem chạy bài tự kiểm."""
import os, re, sys, tempfile, time

C = os.path.expanduser("~/.cache/ethopex")
LUAT = [("thu-vien", re.compile(r"tv\d+\.mp4"), False),        # (thư mục, mẫu tên, tìm trong thư mục con)
        ("anh-tinh", re.compile(r"tap\d+\.mp4"), True)]

def quet(goc, gio):
    han = time.time() - gio * 3600; ra = []
    for thu, mau, sau in LUAT:
        d = os.path.join(goc, thu)
        if not os.path.isdir(d): continue
        di = os.walk(d) if sau else [(d, [], os.listdir(d))]
        for g, _, ts in di:
            for t in ts:
                f = os.path.join(g, t)
                if mau.fullmatch(t) and os.path.isfile(f) and os.path.getmtime(f) < han: ra.append(f)
    return ra

def don(goc=C, gio=6, xem=False):
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
        xoa = [tao("thu-vien/tv12.mp4"), tao("anh-tinh/100002/tap1.mp4")]
        giu = [tao("thu-vien/tv12.goc.mp4"), tao("thu-vien/lo-tv1.json"), tao("anh-tinh/100002/po1-1.mp4"),
               tao("anh-tinh/100002/anh-tinh-100002-1.mp4"), tao("nguon/1/tap1.mp4"), tao("ra/x/c-1-1.mp4"),
               tao("thu-vien/tv13.mp4", cu_=False)]      # mới → lô đang chạy
        assert don(g, 24, xem=True) == (2, 20), "đếm sai"
        assert all(os.path.exists(f) for f in xoa), "--xem không được xoá"
        assert don(g, 24) == (2, 20)
        assert not any(os.path.exists(f) for f in xoa), "còn sót bản đầu vào"
        assert all(os.path.exists(f) for f in giu), "xoá nhầm bản ra / bản mới"
        assert don(g, 24) == (0, 0), "lần hai phải rỗng"
        assert don(os.path.join(g, "khong-co")) == (0, 0), "thư mục không có phải im"
    print("tự kiểm 6/6")

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--tu-kiem" in a: tu_kiem(); sys.exit()
    gio = int(a[a.index("--gio") + 1]) if "--gio" in a else 6
    so, n = don(gio=gio, xem="--xem" in a)
    print(f"dọn kho ethopex: {'sẽ xoá' if '--xem' in a else 'đã xoá'} {so} tệp đầu vào tải lại được · {n / 1e9:.1f} GB (tệp cũ hơn {gio} giờ)")
