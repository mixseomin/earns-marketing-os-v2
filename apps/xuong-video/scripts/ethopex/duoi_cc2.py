#!/usr/bin/env python3
"""ĐUÔI CC2 DÙNG CHUNG (anh 26/11/2026 #116269 "CTA quá ngắn và cụt. Logo ko đúng" → "ghép lại cho đúng logo, CTA giống AD. Nút CTA phải có điểm nhấn,
dùng lại form của AD"): một hàm duy nhất ghép đuôi cho MỌI video CC2 — đoạn cắt mới (cat-canh.dung_tap) lẫn ghép lại thành phẩm cũ (ghep-lai-cc2.py).
  - lớp logo gốc + nút (lop-logo-cc2.py → <lop>.png) hiện mờ HIEN_TRUOC giây trước khi hết đoạn sạch, chạy trên hình đang chuyển động
  - hết đoạn sạch → giữ khung cuối thêm DUNG giây (thẻ cuối tĩnh như AD), nút vẫn nảy
  - nút nảy = khung nhip_nut của AD (dung-mau.nhip_nut: phóng 1→1,12 ba nhịp + quầng màu logo + vệt sáng), lặp liên tục tới hết video
  - tiếng phim mờ dần FADE giây cuối (không cắt cụt), đệm lặng tới hết
Khung nảy nằm ở <lop không đuôi>-nhip/%03d.png + vị trí trong <lop không đuôi>-nhip.json (lop-logo-cc2.py dựng cùng lúc với lớp logo).
tra-repo-ok: mã dán keo nội bộ (bộ lọc ffmpeg cho hàm sẵn có)."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import nen_video as NV
W, H = 1080, 1920
HIEN_TRUOC, DUNG, FADE = 4.5, 2.5, 1.5
MA_HOA = NV.nen_h264(crf=23, bit="3M", maxrate="4500k")

def nhip_cua(lop):
    """→ (thư mục khung, x, y) hoặc lỗi to nếu thiếu — không có nút nảy thì không ra CC2"""
    g = os.path.splitext(lop)[0] + "-nhip"
    if not (os.path.isdir(g) and os.path.exists(g + ".json")): raise SystemExit(f"thiếu khung nút nảy {g} — chạy lại lop-logo-cc2.py")
    j = json.load(open(g + ".json")); return g, int(j["x"]), int(j["y"])

def dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip())

def ghep(vao, ls, lop, out, a_vao=None):
    """vao = video có đoạn sạch [0, ls) (phần sau ls bỏ); a_vao = nguồn tiếng (mặc định chính vao, lấy tới ls + DUNG nếu có) → out dài ls + DUNG"""
    if ls < HIEN_TRUOC + 3: raise SystemExit(f"đoạn sạch {ls:.1f}s quá ngắn cho đuôi CC2")
    nd, nx, ny = nhip_cua(lop); T = ls + DUNG; h = ls - HIEN_TRUOC
    loc = (f"[0:v]trim=0:{ls:.3f},setpts=PTS-STARTPTS,fps=30,scale={W}:{H}:flags=lanczos:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,"
           f"tpad=stop_mode=clone:stop_duration={DUNG + 0.5}[c];"
           f"[1:v]format=rgba,fade=in:st={h:.3f}:d=0.4:alpha=1[o];[c][o]overlay=0:0:enable='gte(t,{h:.3f})'[v0];"
           f"[2:v]format=rgba,setpts=PTS+{h + 0.4:.3f}/TB[nn];[v0][nn]overlay={nx}:{ny}:enable='gte(t,{h + 0.4:.3f})'[v];"
           f"[3:a]atrim=0:{T:.3f},asetpts=PTS-STARTPTS,afade=out:st={T - FADE:.3f}:d={FADE},apad=whole_dur={T:.3f}[a]")
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vao, "-loop", "1", "-t", f"{T:.3f}", "-i", lop,
                        "-loop", "1", "-framerate", "30", "-t", f"{T:.3f}", "-i", os.path.join(nd, "%03d.png"), "-i", a_vao or vao,
                        "-filter_complex", loc, "-map", "[v]", "-map", "[a]", "-t", f"{T:.3f}", *MA_HOA, "-pix_fmt", "yuv420p", "-r", "30",
                        "-c:a", "aac", "-ar", "44100", "-movflags", "+faststart", out], capture_output=True, text=True, timeout=1800)
    if r.returncode: raise RuntimeError(f"ffmpeg đuôi CC2: {r.stderr[-400:]}")
    d = dur(out)
    if abs(d - T) > 0.6: raise RuntimeError(f"đuôi CC2 ra {d:.1f}s, tính {T:.1f}s")
    return round(d, 1)

if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) != 4: raise SystemExit("dùng: duoi_cc2.py <vao.mp4> <giây sạch> <lop.png> <ra.mp4>")
    print(ghep(a[0], float(a[1]), a[2], a[3]))
