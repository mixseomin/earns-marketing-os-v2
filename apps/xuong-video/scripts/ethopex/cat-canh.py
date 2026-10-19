#!/usr/bin/env python3
"""BẢN B "CẢNH PHIM THẬT" (cách A, anh duyệt 19/10/2026) — 0đ, không sinh AI: cắt một đoạn kịch tính từ chính video QC / tập phim của
app gốc (spy.on.tc · qc_meta.video_hd, NetShort/ReelShort/DramaBox), giữ nguyên bố cục của họ (tên phim trên đầu, phụ đề thoại giữa,
tóm tắt cốt truyện dưới đáy), thêm NÚT ĐỎ CTA nhún nhẹ từ giây 3, kết bằng THẺ CUỐI = poster SẠCH (logo thật của phim) + nút — không vẽ thêm tên phim (chồng lên logo poster).
- Cắt ở đầu một cảnh và ngay sau khoảnh khắc treo (cliffhanger); tiếng mờ 0,3s hai đầu để không cụt thoại.
- Phóng lên 1080x1920 (lanczos) khi nguồn < 1080p — báo rõ nguồn gốc trong ghi chú lô.
- Chữ nút CTA qua luật chữ studio (ghep-b.chu_studio).
Dùng: python3 cat-canh.py <nguon.mp4> <tu_giay> <den_giay> <poster.png> <font.json|-> <CTA> <ra.mp4>"""
import json, os, sys, importlib.util

D = os.path.dirname(os.path.abspath(__file__))
def nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(D, tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
gb = nap("gb", "ghep-b.py"); gx = gb.gx
W, H, THE_CUOI = gx.W, gx.H, 2.5

def dung(nguon, tu, den, the_cuoi, cfg, cta, out):
    tmp = os.path.splitext(out)[0]; cta = gb.chu_studio(cta)[0].replace("\n", " ")
    gb.lop_nut(cta, cfg, tmp + "-nut.png"); L = den - tu; T = L + THE_CUOI
    from PIL import Image
    tc = Image.open(the_cuoi).convert("RGBA").resize((W, H)); tc.alpha_composite(Image.open(tmp + "-nut.png"), (0, 1560)); tc.convert("RGB").save(tmp + "-the-cuoi.png"); the_cuoi = tmp + "-the-cuoi.png"
    loc = (f"[0:v]trim={tu}:{den},setpts=PTS-STARTPTS,scale={W}:{H}:flags=lanczos:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,setsar=1[c];"
           f"[1:v]format=rgba,fade=in:st=3:d=0.4:alpha=1[nut];[c][nut]overlay=0:'1600+8*sin(2*PI*1.6*t)':shortest=1[c2];"
           f"[2:v]scale={W}:{H},zoompan=z='1+0.03*on/{int(THE_CUOI * 30)}':d=1:s={W}x{H}:fps=30,setsar=1,trim=0:{THE_CUOI}[tc];"
           f"[c2][tc]concat=n=2:v=1:a=0[v];"
           f"[0:a]atrim={tu}:{den},asetpts=PTS-STARTPTS,afade=in:d=0.3,afade=out:st={L - 0.3}:d=0.3,apad=pad_dur={THE_CUOI}[a]")
    gx.sh("ffmpeg", "-v", "error", "-y", "-i", nguon, "-loop", "1", "-t", f"{T}", "-i", tmp + "-nut.png", "-loop", "1", "-t", f"{THE_CUOI}", "-i", the_cuoi,
          "-filter_complex", loc, "-map", "[v]", "-map", "[a]", "-t", f"{T}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-r", "30",
          "-c:a", "aac", "-ar", "44100", "-movflags", "+faststart", out)
    print(out, round(gx.dur(out), 1))

if __name__ == "__main__":
    a = sys.argv[1:]
    dung(a[0], float(a[1]), float(a[2]), a[3], json.load(open(a[4])) if a[4] != "-" else None, a[5], a[6])
