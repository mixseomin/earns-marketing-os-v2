#!/usr/bin/env python3
"""GHÉP LẠI ĐUÔI CC2 CỦA THÀNH PHẨM ĐÃ CÓ (anh 26/11/2026: "Loại lỗi này của CC2 mày phải tự check hàng loạt và sửa lại hết cho tao. Ko cần cắt lại video,
chỉ cần ghép lại cho đúng logo, CTA giống AD. Nút CTA phải có điểm nhấn, dùng lại form của AD").
Không cắt lại từ tập nguồn: lấy chính tệp thành phẩm, dò chỗ lớp phủ cũ (ô chữ tên phim / logo cũ) bắt đầu, bỏ từ đó → đoạn sạch, rồi đuôi chung duoi_cc2.ghep
(logo gốc + nút nảy form AD, giữ khung cuối, tiếng mờ dần). Tệp cũ giữ cạnh: <tệp>.truoc-cc2.mp4 (không xoá).
Chạy (iMac, ~/.venvs/poster-mau/bin/python vì cần numpy + lop-logo-cc2):
  ghep-lai-cc2.py <tệp thành phẩm.mp4> <content_id> <locale> <tên phim> <link phim> [--xem]
In JSON {file, sach, giay, lop[, vo]}. --xem: chỉ dò + in, không ghi đè.
  --hook=<N>: hook thứ N của phim (mỗi creative cùng phim một hook khác — anh 27/11/2026); mặc định = số mẫu
  --giong=<kiểu>[:<mẫu>]: thêm GIỌNG ĐỌC HOOK đầu video (anh 27/11/2026 "Sửa lại toàn bộ câu đọc các camp đang chờ giờ lên") — câu khuôn đội trong sổ mẫu
  (etp-mau-cr.json thu_vien.giong.cau, mẫu thứ <mẫu>, mặc định 0) đọc bằng kiểu giọng anh-tinh.KIEU_GIONG qua cổng giọng chung (anh-tinh.giong, ~156₫ / câu);
  kiểu 'phim' = anh-tinh.giong_phim theo thể loại (--the-loai=<x>). Ngôn ngữ giọng = locale.
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
    """→ giây đoạn sạch (trước khi lớp phủ cũ hiện). Thành phẩm CC2 chỉ có hai khuôn đuôi cố định — dò vùng tĩnh hỏng khi nền cũng đứng yên
    (27/11/2026: phim 69809 dò ra 81,5 / 83,4 trong khi logo cũ đã mờ vào từ ~79,4 → logo cũ nằm dưới logo mới).
    - đuôi MỚI (duoi_cc2): khung cuối giữ nguyên DUNG giây, logo hiện HIEN_TRUOC giây trước đó → sạch = d − DUNG − HIEN_TRUOC − 0,2
    - đuôi CŨ: logo mờ vào ~5,6 giây trước hết → sạch = d − 6,0"""
    d = DC.dur(f); tu = max(0.0, d - 3.0); a = khung(f, tu, d - tu)
    if len(a) < 20: raise SystemExit(f"{f}: không đọc được khung đuôi")
    n = int((DC.DUNG - 0.5) * 10); dung = len(a) >= n and all((np.abs(x - a[-1]) < 6).mean() > 0.92 for x in a[-n:])   # nút vẫn nảy trên khung giữ → so phần lớn khung, không so trọn
    if dung: return max(0.0, d - DC.DUNG - DC.HIEN_TRUOC - 0.2), "duoi-moi"
    return max(0.0, d - 6.0), "duoi-cu"

import re
LOGO_BAN = int(re.search(r"^LOGO_BAN\s*=\s*(\d+)", open(os.path.join(D, "dung-mau.py")).read(), re.M).group(1))   # một nguồn: dung-mau.py

def ban_logo(tm):
    try: return json.load(open(os.path.join(tm, "logo-goc.json"))).get("ban")
    except Exception: return None

def lop_cua(cid, loc, ten, url):
    tm = os.path.join(TM, str(cid)); os.makedirs(tm, exist_ok=True); lop = os.path.join(tm, f"lop-cc2-{loc}.png")
    # lớp chỉ dùng lại khi logo nó dựng từ đúng bản tách hiện hành (dung-mau.LOGO_BAN) — anh 27/11/2026 #1897: lớp CC2 nhớ từ logo bản 5 (cụt chữ KING) vẫn được ghép
    # sau khi Huy nâng LOGO_BAN 6, vì lớp cũ bỏ qua số bản. Lệch bản → dựng lại lớp; lop-logo-cc2 gọi dung-mau.logo_goc → tách lại logo theo bản mới.
    if not (os.path.exists(lop) and os.path.isdir(lop[:-4] + "-nhip") and ban_logo(tm) == LOGO_BAN):
        # ĐÚNG LOGO CỦA AD: phim đã có AD → chép poster + logo gốc đã tách của AD (anh-tinh/<cid>), cùng một logo — chỉ khi logo AD cũng đúng bản hiện hành;
        # chưa có → poster og:image trang phim (tai-tap.og_anh)
        ad = os.path.expanduser(f"~/.cache/ethopex/anh-tinh/{cid}")
        if os.path.exists(os.path.join(ad, "poster.jpg")) and not os.path.exists(os.path.join(tm, "poster.jpg")): shutil.copy2(os.path.join(ad, "poster.jpg"), os.path.join(tm, "poster.jpg"))
        if ban_logo(ad) == LOGO_BAN and ban_logo(tm) != LOGO_BAN:
            for t in ("logo-goc.png", "logo-goc.json"):
                if os.path.exists(os.path.join(ad, t)): shutil.copy2(os.path.join(ad, t), os.path.join(tm, t))
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
    a = [x for x in sys.argv[1:] if not x.startswith("--")]; xem = "--xem" in sys.argv
    gy = next((x.split("=", 1)[1] for x in sys.argv if x.startswith("--giong=")), None)
    tl = next((x.split("=", 1)[1] for x in sys.argv if x.startswith("--the-loai=")), None)
    thu_hook = next((int(x.split("=", 1)[1]) for x in sys.argv if x.startswith("--hook=")), None)   # bản thứ mấy của phim → hook thứ mấy (mặc định = số mẫu)
    if len(a) != 5: raise SystemExit(__doc__)
    f, cid, loc, ten, url = a
    truoc = f[:-4] + ".truoc-cc2.mp4"
    if not os.path.exists(truoc) and not xem: shutil.copy2(f, truoc)   # luôn ghép từ bản trước-sửa, chạy lại không ghép chồng
    vao = truoc if os.path.exists(truoc) else f
    ls, cach = do_sach(vao)
    lop = lop_cua(cid, loc, ten, url)
    if xem: print(json.dumps({"file": f, "sach": round(ls, 2), "cach": cach, "dai_cu": round(DC.dur(vao), 2), "lop": lop}, ensure_ascii=False)); sys.exit(0)
    vo = None
    if gy:
        import importlib.util
        s_ = importlib.util.spec_from_file_location("anh_tinh", os.path.join(D, "anh-tinh.py")); AT = importlib.util.module_from_spec(s_); s_.loader.exec_module(AT)
        kieu, _, mau = gy.partition(":"); lg = loc[:2].lower(); mau = int(mau or 0) % len(AT.CAU[lg]); ten_ = AT.ten_sach(ten)
        if kieu == "phim": kieu = AT.giong_phim({"the_loai": tl})[0]
        if kieu in AT.GIONG_CAM: raise SystemExit(f"kiểu giọng '{kieu}' bị cấm (anh 27/11/2026 — mặc định giọng thường)")
        if kieu not in AT.KIEU_GIONG: raise SystemExit(f"kiểu giọng '{kieu}' không có trong anh-tinh.KIEU_GIONG ({', '.join(AT.KIEU_GIONG)})")
        hook, vnd_hook = AT.hook_phim(cid, lg, ten_, thu=thu_hook if thu_hook is not None else mau)   # bản thứ N của phim → hook thứ N (anh 27/11/2026 "Ko cho chạy đồng thời")   # hook giữ chân cốt truyện trong câu đọc (anh 27/11/2026) — sổ hook_phim, chỉ gọi AI lần đầu mỗi phim
        mp3, vnd, _ = AT.giong(cid, lg, ten_, kieu, os.path.dirname(lop), mau, hook)
        if not (mp3 and os.path.exists(mp3) and os.path.getsize(mp3) > 2000):   # cổng giọng trả tệp rỗng không kêu (27/11/2026 lần ghép song song) → dừng to, không ghép video câm hook
            if mp3 and os.path.exists(mp3): os.replace(mp3, mp3 + ".hong")
            raise SystemExit(f"giọng đọc hook {cid}: cổng giọng trả tệp rỗng ({mp3}) — chạy lại")
        vo = {"giong": kieu, "mau": mau, "cau": AT.cau_doc(lg, mau, kieu, ten_, (hook or {}).get("cau")), "vnd": vnd + vnd_hook, "mp3": mp3, **({"hook": hook} if hook else {})}
    tam = f[:-4] + ".cc2-tam.mp4"; g = DC.ghep(vao, ls, lop, tam, vo=vo and vo["mp3"]); os.replace(tam, f)
    print(json.dumps({"file": f, "sach": round(ls, 2), "cach": cach, "giay": g, "lop": lop, **({"vo": vo} if vo else {})}, ensure_ascii=False))
