#!/usr/bin/env python3
"""CẤT VIDEO LÊN GOOGLE DRIVE (anh 28/10/2026: "các file khi render, cắt video xong phải lưu lên drive.google chứ? Sao cứ lưu hết ở iMac làm đầy máy").
Kho làm việc ~/.cache/ethopex (iMac) → Drive htuan82 (rclone remote 'gdrive', 5 TB) thư mục ethopex-cache/, GIỮ NGUYÊN đường dẫn tương đối.
Chỉ cất tệp NẶNG (video / tiếng) đã nằm yên ≥ min_age; ảnh tờ soát, json, tsv, log ở lại máy (nhỏ, máy đọc thường xuyên).
`rclone move` chỉ xoá bản trên máy SAU KHI Drive nhận đủ và khớp mã băm — không có bước xoá tay.
Cần lại một tệp đã cất: dam_bao(<đường dẫn tuyệt đối>) kéo về đúng chỗ (len-creative.py, cat-cuoi-lo.py gọi trước khi đọc).
  cat_drive.py cat [--min-age 24h] [--giu <thư mục tương đối>…]   → cất (chạy nền taskpolicy -b)
  cat_drive.py lay <đường dẫn>                                        → kéo một tệp / thư mục về
  cat_drive.py xem                                                    → dung lượng trên máy vs Drive"""
import os, shutil, subprocess, sys

GOC = os.path.expanduser("~/.cache/ethopex")
DICH = "gdrive:ethopex-cache"
DUOI = ("mp4", "mov", "mkv", "webm", "wav", "m4a", "mp3", "aac")
LOG = os.path.join(GOC, "cat-drive.log")


def co_rclone():
    return shutil.which("rclone") and "gdrive:" in subprocess.run(["rclone", "listremotes"], capture_output=True, text=True).stdout


def cat(min_age="24h", giu=()):
    """cất mọi tệp nặng đã nằm yên ≥ min_age; giu = thư mục tương đối (vd 'ra/pm-26101408') còn đang dùng → không đụng. Trả số GB trống sau khi cất."""
    if not co_rclone():
        print("cất Drive: chưa có rclone remote 'gdrive' — bỏ qua (máy giữ nguyên tệp)", flush=True); return shutil.disk_usage(os.path.expanduser("~")).free / 1e9
    lenh = ["taskpolicy", "-b", "rclone", "move", GOC, DICH, "--min-age", min_age, "--transfers", "4", "--log-file", LOG, "--log-level", "INFO",
            "--stats-one-line", "--stats", "0"]
    for d in giu: lenh += ["--exclude", f"/{d.strip('/')}/**"]
    for e in DUOI: lenh += ["--include", f"*.{e}", "--include", f"*.{e.upper()}"]
    r = subprocess.run(lenh, capture_output=True, text=True)
    trong = shutil.disk_usage(os.path.expanduser("~")).free / 1e9
    print(f"cất Drive ({DICH}, tệp nằm yên ≥ {min_age}): {'xong' if r.returncode == 0 else 'LỖI rc=' + str(r.returncode) + ' ' + r.stderr[-200:]} · ổ iMac còn trống {trong:.0f} GB · nhật ký {LOG}", flush=True)
    return trong


def dam_bao(p):
    """tệp / thư mục p (tuyệt đối, nằm trong ~/.cache/ethopex) không còn trên máy → kéo bản đã cất trên Drive về đúng chỗ. True khi có tệp."""
    p = os.path.abspath(os.path.expanduser(p))
    if os.path.exists(p): return True
    if not p.startswith(GOC + os.sep) or not co_rclone(): return False
    rel = os.path.relpath(p, GOC)
    subprocess.run(["rclone", "copyto", f"{DICH}/{rel}", p], capture_output=True)
    if not os.path.exists(p): subprocess.run(["rclone", "copy", f"{DICH}/{rel}", p], capture_output=True)   # thư mục
    ok = os.path.exists(p)
    print(f"lấy từ Drive: {rel} → {'có' if ok else 'KHÔNG có trên Drive'}", flush=True)
    return ok



def keo_thu_muc(d, mau="*.mp4"):
    """thư mục d (tuyệt đối, trong ~/.cache/ethopex): kéo các tệp khớp mẫu đã cất trên Drive mà máy không còn (rclone copy bỏ qua tệp đã có)."""
    d = os.path.abspath(os.path.expanduser(d))
    if not d.startswith(GOC + os.sep) or not co_rclone(): return
    subprocess.run(["rclone", "copy", f"{DICH}/{os.path.relpath(d, GOC)}", d, "--include", mau, "--ignore-existing"], capture_output=True)

if __name__ == "__main__":
    a = sys.argv[1:] or ["xem"]
    if a[0] == "cat":
        cat(a[a.index("--min-age") + 1] if "--min-age" in a else "24h", a[a.index("--giu") + 1:] if "--giu" in a else ())
    elif a[0] == "lay":
        for x in a[1:]: dam_bao(x)
    elif a[0] == "xem":
        subprocess.run(["du", "-sh", GOC]); subprocess.run(["rclone", "size", DICH])
