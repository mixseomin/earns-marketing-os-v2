#!/usr/bin/env python3
"""BẢN B creative Ethopex = mẫu thắng số 3 "NHÂN VẬT ~10s" (0đ, chỉ dựng lại clip studio đã sinh + đã chấm).
Khuôn: 3 đoạn nhân vật chính (~3,3s/đoạn, cảm xúc → xung đột → cao trào), KHÔNG lời kể / phụ đề; tên phim chữ động
(font + màu poster, hiện từ giây 0,2) ở dưới; nút đỏ CTA hiện từ giây 6,5 và nhún nhẹ tới hết. Âm = nhạc phim + tiếng clip nhỏ.
Chữ lấy từ ds.json ĐÃ qua chu-studio.mts (luật chữ studio) — dòng 1 tên phim, dòng 2 CTA của cảnh cuối.
Dùng: python3 ghep-b.py <ds.json> <thư mục clip đã tải (ghep-xem: <tap>-<tt>.mp4, nhac<tap>.mp3)> <chọn.json> <thư mục ra>
  chọn.json = {"<tap>": [tt, tt, tt]}"""
import importlib.util, json, os, subprocess, sys
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location("gx", os.path.join(os.path.dirname(os.path.abspath(__file__)), "ghep-xem.py"))
gx = importlib.util.module_from_spec(spec); spec.loader.exec_module(gx)
W, H, DOAN, CTA_TU = gx.W, gx.H, 3.3, 6.5

def lop_ten(ten, cfg, ra, nhan):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im, "RGBA")
    ft, mt = gx.font_poster(cfg, 92); dong = gx.ngat_can(ten, 18); y = 1180 - 50 * (len(dong) - 1)
    d.rectangle([0, y - 110, W, y + 112 * len(dong) + 20], fill=(0, 0, 0, 110))
    gx.ve_dong(d, y - 88, nhan, gx.ImageFont.truetype(gx.FA, 46), True, 5)
    for x in dong: gx.ve_dong(d, y, x, ft, True, 8, mau=mt); y += 112
    im.save(ra)

def lop_cta(cta, cfg, ra):
    im = Image.new("RGBA", (W, 260), (0, 0, 0, 0)); d = ImageDraw.Draw(im, "RGBA"); fs = 58
    while fs > 34 and d.textlength(cta, font=gx.font_poster(cfg, fs, True)[0]) > W - 220: fs -= 2
    fc = gx.font_poster(cfg, fs, True)[0]; rong = d.textlength(cta, font=fc); y = 60
    d.rounded_rectangle([(W - rong) / 2 - 50, y, (W + rong) / 2 + 50, y + fs + 54], radius=(fs + 54) // 2, fill=gx.DO + (255,), outline=(255, 255, 255, 255), width=4)
    d.text(((W - rong) / 2, y + 24), cta, font=fc, fill=gx.TRANG)
    im.save(ra)

def dung(ds, nguon, chon, ra_dir):
    os.makedirs(ra_dir, exist_ok=True)
    for tap, tts in sorted(chon.items(), key=lambda x: int(x[0])):
        tap = int(tap); hang = [r for r in ds if r["tap"] == tap]; cuoi = max(hang, key=lambda r: r["tt"])
        dong = [x for x in cuoi["chu"].split("\n") if x.strip()]; ten = dong[0].strip('"'); cta = dong[1]
        nhan = "MINISERIE" if "MÍRALA" in cta else "SHORT DRAMA"; cfg = cuoi.get("font")
        p = lambda f: os.path.join(ra_dir, f)
        lop_ten(ten, cfg, p(f"b-ten{tap}.png"), nhan); lop_cta(cta, cfg, p(f"b-cta{tap}.png"))
        vao, loc = [], []
        for i, tt in enumerate(tts):
            v = os.path.join(nguon, f"{tap}-{tt}.mp4"); L = gx.dur(v); bd = max(0.0, min(L - DOAN - 0.1, L * 0.35))
            vao += ["-ss", f"{bd:.2f}", "-t", f"{DOAN}", "-i", v]
            co_tieng = bool(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", v],
                                           capture_output=True, text=True).stdout.strip())
            nguon_a = f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.35" if co_tieng else f"anullsrc=r=44100:cl=stereo,atrim=0:{DOAN}"
            loc.append(f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,setsar=1[v{i}];{nguon_a}[a{i}]")
        n = len(tts); T = DOAN * n
        vao += ["-loop", "1", "-t", f"{T}", "-i", p(f"b-ten{tap}.png"), "-loop", "1", "-t", f"{T}", "-i", p(f"b-cta{tap}.png"),
                "-i", os.path.join(nguon, f"nhac{tap}.mp3")]
        it, ic, im_ = n, n + 1, n + 2
        loc.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[cv][ca]")
        loc.append(f"[{it}:v]format=rgba,fade=in:st=0.2:d=0.6:alpha=1[ten]")
        loc.append(f"[{ic}:v]format=rgba,fade=in:st={CTA_TU}:d=0.4:alpha=1[cta]")
        loc.append(f"[cv][ten]overlay=0:'if(lt(t,0.8),40*(0.8-t)/0.6,0)'[v1]")
        loc.append(f"[v1][cta]overlay=0:'1560+10*sin(2*PI*2*t)'[v]")
        loc.append(f"[{im_}:a]volume=0.5[m];[ca][m]amix=inputs=2:duration=first:normalize=0[a]")
        out = p(f"creative-b-{tap}.mp4")
        gx.sh("ffmpeg", "-v", "error", "-y", *vao, "-filter_complex", ";".join(loc), "-map", "[v]", "-map", "[a]", "-t", f"{T}",
              "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-r", "30", "-c:a", "aac", "-ar", "44100", "-movflags", "+faststart", out)
        print(tap, round(gx.dur(out), 1), flush=True)

if __name__ == "__main__":
    dung(json.load(open(sys.argv[1])), sys.argv[2], json.load(open(sys.argv[3])), sys.argv[4])
