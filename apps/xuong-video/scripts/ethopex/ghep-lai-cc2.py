#!/usr/bin/env python3
"""GHÉP LẠI ĐUÔI CC2 CỦA THÀNH PHẨM ĐÃ CÓ (anh 26/11/2026: "Loại lỗi này của CC2 mày phải tự check hàng loạt và sửa lại hết cho tao. Ko cần cắt lại video,
chỉ cần ghép lại cho đúng logo, CTA giống AD. Nút CTA phải có điểm nhấn, dùng lại form của AD").
Không cắt lại từ tập nguồn: lấy chính tệp thành phẩm, dò chỗ lớp phủ cũ (ô chữ tên phim / logo cũ) bắt đầu, bỏ từ đó → đoạn sạch, rồi đuôi chung duoi_cc2.ghep
(logo gốc + nút nảy form AD, giữ khung cuối, tiếng mờ dần). Tệp cũ giữ cạnh: <tệp>.truoc-cc2.mp4 (không xoá).
Chạy (iMac, ~/.venvs/poster-mau/bin/python vì cần numpy + lop-logo-cc2):
  ghep-lai-cc2.py <tệp thành phẩm.mp4> <content_id> <locale> <tên phim> <link phim> [--xem]
In JSON {file, sach, giay, lop}. --xem: chỉ dò + in, không ghi đè.
tra-repo-ok: mã dán keo nội bộ."""
import json, os, shutil, subprocess, sys
import numpy as np
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import duoi_cc2 as DC
TM = os.path.expanduser("~/.cache/ethopex/cc2-lop")
PY = os.path.expanduser("~/.venvs/poster-mau/bin/python")

def khung(f, tu, n_giay, w=108, h=192, fps=10):
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{tu:.3f}", "-i", f, "-t", f"{n_giay:.3f}", "-vf", f"fps={fps},scale={w}:{h},format=gray",
                        "-f", "rawvideo", "-"], capture_output=True)
    a = np.frombuffer(r.stdout, np.uint8); return a[: a.size // (w * h) * w * h].reshape(-1, h, w).astype(np.int16)

def do_sach(f):
    """→ giây đoạn sạch (trước khi lớp phủ cũ hiện). Lớp phủ = vùng ảnh ĐỨNG YÊN giống khung cuối trong khi nền chạy; lùi từ cuối tới khi vùng đó khác."""
    d = DC.dur(f); tu = max(0.0, d - 8.0); a = khung(f, tu, d - tu)
    if len(a) < 20: raise SystemExit(f"{f}: không đọc được khung đuôi")
    cuoi = a[-1]; tinh = np.all(np.abs(a[-5:] - cuoi) < 6, axis=0)
    if tinh.mean() > 0.6 or tinh.sum() < 200:   # cả khung đứng yên / vùng tĩnh quá nhỏ → không dò được, lấy mốc cũ 5 giây
        return max(0.0, d - 5.4), "mac-dinh"
    lech = np.array([np.abs(x - cuoi)[tinh].mean() for x in a])
    i = len(a) - 1
    while i > 0 and lech[i - 1] < 10: i -= 1
    return max(0.0, tu + i / 10 - 0.4), f"do:{tinh.mean():.2f}"

def lop_cua(cid, loc, ten, url):
    tm = os.path.join(TM, str(cid)); os.makedirs(tm, exist_ok=True); lop = os.path.join(tm, f"lop-cc2-{loc}.png")
    if not (os.path.exists(lop) and os.path.isdir(lop[:-4] + "-nhip")):
        # ĐÚNG LOGO CỦA AD: phim đã có AD → chép poster + logo gốc đã tách của AD (anh-tinh/<cid>), cùng một logo; chưa có → poster og:image trang phim (tai-tap.og_anh)
        ad = os.path.expanduser(f"~/.cache/ethopex/anh-tinh/{cid}")
        for t in ("poster.jpg", "logo-goc.png", "logo-goc.json"):
            if os.path.exists(os.path.join(ad, t)) and not os.path.exists(os.path.join(tm, t)): shutil.copy2(os.path.join(ad, t), os.path.join(tm, t))
        if not os.path.exists(os.path.join(tm, "poster.jpg")):
            import importlib.util
            s_ = importlib.util.spec_from_file_location("tai_tap", os.path.join(D, "tai-tap.py")); TT = importlib.util.module_from_spec(s_); s_.loader.exec_module(TT)
            u = TT.og_anh(url); b = TT.lay(u, ref=url) if u else b""
            if len(b) < 2000 or b[:1] in (b"<", b"{"): raise SystemExit(f"{cid}: không tải được poster từ {url}")
            open(os.path.join(tm, "poster.jpg"), "wb").write(b)
        r = subprocess.run([PY, os.path.join(D, "lop-logo-cc2.py"), tm, str(cid), ten, loc, url, lop], capture_output=True, text=True, timeout=900)
        if r.returncode: raise SystemExit(f"logo CC2 {cid}: {(r.stderr or r.stdout).strip()[-300:]}")
    return lop

if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if x != "--xem"]; xem = "--xem" in sys.argv
    if len(a) != 5: raise SystemExit(__doc__)
    f, cid, loc, ten, url = a
    truoc = f[:-4] + ".truoc-cc2.mp4"
    if not os.path.exists(truoc) and not xem: shutil.copy2(f, truoc)   # luôn ghép từ bản trước-sửa, chạy lại không ghép chồng
    vao = truoc if os.path.exists(truoc) else f
    ls, cach = do_sach(vao)
    lop = lop_cua(cid, loc, ten, url)
    if xem: print(json.dumps({"file": f, "sach": round(ls, 2), "cach": cach, "dai_cu": round(DC.dur(vao), 2), "lop": lop}, ensure_ascii=False)); sys.exit(0)
    tam = f[:-4] + ".cc2-tam.mp4"; g = DC.ghep(vao, ls, lop, tam); os.replace(tam, f)
    print(json.dumps({"file": f, "sach": round(ls, 2), "cach": cach, "giay": g, "lop": lop}, ensure_ascii=False))
