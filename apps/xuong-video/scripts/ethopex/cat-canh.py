#!/usr/bin/env python3
"""BẢN B "CẢNH PHIM THẬT" (cách A, anh duyệt 19/10/2026) — 0đ, không sinh AI: cắt một đoạn kịch tính từ chính video QC / tập phim của
app gốc (spy.on.tc · qc_meta.video_hd, NetShort/ReelShort/DramaBox), giữ nguyên bố cục của họ (tên phim trên đầu, phụ đề thoại giữa,
tóm tắt cốt truyện dưới đáy), thêm NÚT ĐỎ CTA nhún nhẹ từ giây 3 tới hết, kết bằng THẺ CUỐI = poster SẠCH (logo thật của phim, không vẽ
thêm tên phim) + dòng vàng "WHAT HAPPENS NEXT?" (KHÔNG mũi tên / icon chỉ trỏ, KHÔNG chữ "Tap/Click" — luật CTA cta_qc.py, Support Ads 22/10/2026).
- GIỌNG CTA (anh 20/10/2026: "đoạn CTA cuối cần thêm điểm chạm về voice, kích thích bấm và rõ ràng hơn"): câu đọc ElevenLabs v3
  (assets/ethopex/cta-<lang>-<giọng>.mp3, sinh MỘT lần dùng lại) nhanh 1.15×, vào trước cú cắt 1s (tiếng phim lặng dần dưới giọng),
  thẻ cuối kéo dài theo câu đọc.
- Cắt ở đầu một cảnh và ngay sau khoảnh khắc treo (cliffhanger); tiếng mờ hai đầu để không cụt thoại.
- Phóng lên 1080x1920 (lanczos, 0đ) khi nguồn < 1080p — báo rõ nguồn gốc trong ghi chú lô. Phim THẮNG: nâng nguồn bằng Topaz trước (nang-hd.py, chặn phim chưa thắng).
- Mọi chữ (nút, dòng hỏi) qua luật chữ studio (ghep-b.chu_studio).
Dùng: python3 cat-canh.py <nguon.mp4> <tu_giay> <den_giay> <poster.png> <font.json|-> <CTA> <ra.mp4> [giong.mp3|-] [cau_hoi]"""
import json, os, sys, importlib.util
from PIL import Image, ImageDraw

D = os.path.dirname(os.path.abspath(__file__))
def nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(D, tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
gb = nap("gb", "ghep-b.py"); gx = gb.gx; CQ = nap("cta_qc", "cta_qc.py")
W, H = gx.W, gx.H
# MÃ HOÁ (23/10/2026): Mac dùng bộ mã hoá phần cứng (đo 85s: libx264 23,4s → videotoolbox 11,4s, SSIM 0,9935); box3 không có → libx264 như cũ
MA_HOA = ["-c:v", "h264_videotoolbox", "-b:v", "6M", "-maxrate", "9M"] if sys.platform == "darwin" else ["-c:v", "libx264", "-crf", "18"]
TOC_GIONG, VAO_TRUOC, Y_NUT = 1.15, 1.0, 1600

def the_cuoi_anh(poster, hoi, ra):
    """poster sạch + dòng hỏi vàng (nút chồng riêng để nhún). 22/10/2026 bỏ 2 mũi tên vàng chỉ xuống nút — Meta coi là icon dụ nhấp."""
    im = Image.open(poster).convert("RGBA").resize((W, H)); d = ImageDraw.Draw(im, "RGBA")
    for i in range(120): d.line([(0, 1430 + i), (W, 1430 + i)], fill=(0, 0, 0, int(150 * i / 120)))   # dải tối mờ dần, không che logo poster
    d.rectangle([0, 1550, W, H], fill=(0, 0, 0, 150))
    f = gx.ImageFont.truetype(gx.FA, 72); y = 1470
    for dong in gx.ngat_can(hoi, 22): gx.ve_dong(d, y, dong, f, True, 8, mau=gx.VANG); y += 84
    im.convert("RGB").save(ra)

def dung(nguon, tu, den, poster, cfg, cta, out, giong=None, hoi="WHAT HAPPENS NEXT?"):
    for chu in (cta, hoi):
        if CQ.sai_luat(chu): raise SystemExit(f"CTA CHAN: chữ '{chu}' dính '{CQ.sai_luat(chu)}' — luật CTA (cta_qc.py): không Tap/Click/Toca, không mũi tên")
    tmp = os.path.splitext(out)[0]; cta, hoi = [x.replace("\n", " ") for x in gb.chu_studio(cta, hoi)]
    gb.lop_nut(cta, cfg, tmp + "-nut.png"); the_cuoi_anh(poster, hoi, tmp + "-the-cuoi.png")
    L = den - tu
    V = gx.dur(giong) / TOC_GIONG if giong else 0
    TC = max(2.5, V - VAO_TRUOC + 0.5); T = L + TC
    vao = ["-i", nguon, "-loop", "1", "-t", f"{T}", "-i", tmp + "-nut.png", "-loop", "1", "-t", f"{TC}", "-i", tmp + "-the-cuoi.png"]
    am = f"[0:a]atrim={tu}:{den},asetpts=PTS-STARTPTS,afade=in:d=0.3,afade=out:st={L - VAO_TRUOC - 0.2 if giong else L - 0.3}:d={VAO_TRUOC + 0.2 if giong else 0.3},apad=pad_dur={TC}[nen]"
    if giong:
        vao += ["-i", giong]
        am += f";[3:a]atempo={TOC_GIONG},volume=1.8,adelay={int((L - VAO_TRUOC) * 1000)}|{int((L - VAO_TRUOC) * 1000)}[g];[nen][g]amix=inputs=2:duration=first:normalize=0[a]"
    else: am = am.replace("[nen]", "[a]")
    loc = (f"[0:v]trim={tu}:{den},setpts=PTS-STARTPTS,scale={W}:{H}:flags=lanczos:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,setsar=1[c];"
           f"[2:v]scale={W}:{H},zoompan=z='1+0.03*on/{int(TC * 30)}':d=1:s={W}x{H}:fps=30,setsar=1,trim=0:{TC}[tc];"
           f"[c][tc]concat=n=2:v=1:a=0[cv];"
           f"[1:v]format=rgba,fade=in:st=3:d=0.4:alpha=1[nut];[cv][nut]overlay=0:'{Y_NUT}+8*sin(2*PI*1.6*t)':shortest=1[v];" + am)
    gx.sh("ffmpeg", "-v", "error", "-y", *vao, "-filter_complex", loc, "-map", "[v]", "-map", "[a]", "-t", f"{T}",
          *MA_HOA, "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "44100", "-movflags", "+faststart", out)
    print(out, round(gx.dur(out), 1))

if __name__ == "__main__":
    a = sys.argv[1:]
    # CỔNG THOẠI (20/10/2026, Meta từ chối #65717/#65719 "Adult Sexual Exploitation"): phụ đề/chữ trong đoạn dính mua bán dâm, quan hệ,
    # đe doạ lột đồ → KHÔNG cắt (kiem-thoai.py đọc chữ mỗi giây bằng Vision macOS)
    k = __import__("subprocess").run(["python3", os.path.join(D, "kiem-thoai.py"), a[0], a[1], a[2]], capture_output=True, text=True)
    if k.returncode != 0: sys.exit(k.stdout.strip() or k.stderr.strip() or "THOAI CHAN: không đọc được phụ đề")
    dung(a[0], float(a[1]), float(a[2]), a[3], json.load(open(a[4])) if a[4] != "-" else None, a[5], a[6],
         a[7] if len(a) > 7 and a[7] != "-" else None, a[8] if len(a) > 8 else "WHAT HAPPENS NEXT?")
