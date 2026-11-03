"""CẤM DỰNG VIDEO TRÊN BOX3 (anh 03/11/2026: "giờ đang treo cụ box3 của tao rồi. Tắt nó ngay" → "Cấm mày ren video trên box3").
Box3 chạy mos2 / etp / studio / Postgres cho cả nhà — một lượt cắt Ethopex (cat-cuoi-lo + cat-canh, ffmpeg 124% CPU) đẩy load lên 12 và treo máy.
Mọi script DỰNG / MÃ HOÁ video gọi cam() ngay đầu: trên box3 thì thoát luôn, không mã hoá gì. Đọc khung / cắt ảnh tĩnh / ffprobe không bị cấm.
Video dựng ở iMac (tho.py, máy chạy dòng phim) hoặc máy dựng Cloudflare (cloudflare/dung-video — studio đã dùng)."""
import os, socket, sys

def tren_box3():
    return socket.gethostname().split(".")[0] == "box3" or os.path.exists("/opt/earns-marketing-os-v2/.env.production")

def cam(viec="dựng video"):
    if tren_box3():
        print(f"CẤM {viec} trên box3 (anh 03/11/2026) — chạy ở iMac hoặc máy dựng Cloudflare", file=sys.stderr, flush=True)
        raise SystemExit(3)
