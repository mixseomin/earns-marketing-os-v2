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
# 3 Mbps (26/10/2026): 6M ra ~66 MB/đoạn 85s, đường đẩy iMac → box3 chỉ ~1 Mbit/s → lô 70 đoạn mất >10 giờ (phim-moi len pm-26101408 gãy giữa chừng). FB tự nén lại, 3M 1080p đủ nét
MA_HOA = ["-c:v", "h264_videotoolbox", "-b:v", "3M", "-maxrate", "4500k"] if sys.platform == "darwin" else ["-c:v", "libx264", "-crf", "23"]
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
    try: _dung1(nguon, tu, den, tmp, cta, out, giong)
    except gx.Treo as e:
        # TREO (25/10/2026, phim 166083 đoạn 477: ffmpeg 9 kẹt sch_wait 0% CPU, 3 lần): người gác giết rồi dựng lại HAI LƯỢT —
        # lượt 1 cắt đoạn + phóng 1080x1920 ra tệp riêng, lượt 2 ghép nút + thẻ cuối + giọng trên tệp ngắn đó (đồ thị khác, không trim trên nguồn dài)
        print(f"TREO: {e} → dựng hai lượt", file=sys.stderr, flush=True)
        L = den - tu; doan = tmp + "-doan.mp4"
        gx.sh("ffmpeg", "-v", "error", "-y", "-ss", f"{tu}", "-t", f"{L}", "-i", nguon, "-vf", f"scale={W}:{H}:flags=lanczos:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,setsar=1",
              *MA_HOA, "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "44100", doan, han=1800)
        _dung1(doan, 0.0, gx.dur(doan), tmp, cta, out, giong)
        os.remove(doan)

# KIỂU "TẬP NGUYÊN" (anh 28/10/2026 "thử thêm cách của Kiên"): một tập trọn, KHÔNG nút CTA giữa video, KHÔNG giọng CTA; 3 giây cuối hiện ô tên phim (vàng)
# + nút đỏ "WATCH NOW" góc dưới phải — đúng mẫu creative thắng của Kim Kiên (#54757 / #53591 / #54460 / #53830, xem tờ khung 28/10/2026). Chữ qua luật CTA.
O_CUOI = 3.0
def the_ten(ten, nut, ra):
    from PIL import ImageFont
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im, "RGBA")
    ft, fn = ImageFont.truetype(gx.FA, 44), ImageFont.truetype(gx.FA, 34)
    dong = gx.ngat_can(ten, 22)[:2]; rong = max(max(d.textlength(x, font=ft) for x in dong), d.textlength(nut, font=fn) + 80) + 60
    cao = 40 + 54 * len(dong) + 84; x0, y0 = W - 40 - rong, H - 300 - cao
    d.rounded_rectangle([x0, y0, x0 + rong, y0 + cao], 22, fill=(20, 20, 20, 215))
    y = y0 + 26
    for x in dong: d.text((x0 + rong / 2, y), x, font=ft, fill=gx.VANG, anchor="ma"); y += 54
    bw = d.textlength(nut, font=fn) + 80; bx = x0 + (rong - bw) / 2
    d.rounded_rectangle([bx, y + 10, bx + bw, y + 70], 30, fill=(229, 57, 53, 255)); d.text((bx + bw / 2, y + 40), nut, font=fn, fill=(255, 255, 255), anchor="mm")
    im.save(ra)

def dung_tap(nguon, tu, den, ten, out, nut="WATCH NOW", cam=()):
    """cam = các giây (trên nguồn) dính thoại / khung cấm → bỏ cửa sổ ±1,5s quanh mỗi giây, phần còn lại nối liền (anh 28/10/2026: "đoạn nào vi phạm
    chủ động cắt bỏ luôn. Ko cần phải liền mạch") — không bỏ cả tập như trước"""
    if CQ.sai_luat(nut): raise SystemExit(f"CTA CHAN: chữ '{nut}' dính '{CQ.sai_luat(nut)}'")
    tmp = os.path.splitext(out)[0]; the_ten(ten, nut, tmp + "-the-ten.png")
    kh = []
    for g in sorted(float(x) for x in cam if tu <= float(x) <= den):
        a_, z_ = max(tu, g - 1.5), min(den, g + 1.5)
        if kh and a_ <= kh[-1][1]: kh[-1][1] = max(kh[-1][1], z_)
        else: kh.append([a_, z_])
    bo = "+".join(f"between(t,{a_ - tu:.2f},{z_ - tu:.2f})" for a_, z_ in kh)
    L = (den - tu) - sum(z_ - a_ for a_, z_ in kh)
    if L < 30: raise SystemExit(f"bỏ giây cấm xong còn {L:.0f}s — quá ngắn, bỏ tập")
    cv = f"select='not({bo})',setpts=N/FRAME_RATE/TB," if bo else ""; ca = f"aselect='not({bo})',asetpts=N/SR/TB," if bo else ""
    loc = (f"[0:v]trim={tu}:{den},setpts=PTS-STARTPTS,fps=30,{cv}scale={W}:{H}:flags=lanczos:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1[c];"
           f"[1:v]format=rgba,fade=in:st={L - O_CUOI}:d=0.3:alpha=1[o];[c][o]overlay=0:0:enable='gte(t,{L - O_CUOI})'[v];"
           f"[0:a]atrim={tu}:{den},asetpts=PTS-STARTPTS,{ca}afade=in:d=0.2,afade=out:st={L - 0.6}:d=0.6[a]")
    if kh: print("bỏ giây cấm:", ", ".join(f"{a_:.1f}–{z_:.1f}s" for a_, z_ in kh), file=sys.stderr)
    gx.sh("ffmpeg", "-v", "error", "-y", "-i", nguon, "-loop", "1", "-t", f"{L}", "-i", tmp + "-the-ten.png", "-filter_complex", loc, "-map", "[v]", "-map", "[a]", "-t", f"{L}",
          *MA_HOA, "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "44100", "-movflags", "+faststart", out, han=3600)
    dv, da = gx.dur_luong(out)
    if abs(dv - L) > 1.5 or abs(da - L) > 1.5: raise RuntimeError(f"đoạn ra hình {dv:.1f}s / tiếng {da:.1f}s khác độ dài tính {L:.1f}s — nguồn lỗi mối nối, bỏ đoạn")
    for p in (tmp + "-the-ten.png",):
        try: os.remove(p)
        except OSError: pass
    print(out, round(dv, 1))

def _dung1(nguon, tu, den, tmp, cta, out, giong):
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
          *MA_HOA, "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "44100", "-movflags", "+faststart", out, han=3600)
    # KIỂM ĐỘ DÀI (25/10/2026, phim 166083: nguồn lỗi mốc khung → video 173s trên 89s tiếng mà vẫn ra tệp): lệch > 1,5s với độ dài tính = tệp hỏng, không cho lên
    # so TỪNG LUỒNG (25/10/2026, phim 165802 đoạn 800: hình 3,6s / tiếng 89s mà độ dài tệp = 89s nên lọt): hình và tiếng đều phải sát T
    dv, da = gx.dur_luong(out)
    if abs(dv - T) > 1.5 or abs(da - T) > 1.5: raise RuntimeError(f"đoạn ra hình {dv:.1f}s / tiếng {da:.1f}s khác độ dài tính {T:.1f}s — nguồn lỗi mối nối / mốc khung, bỏ đoạn")
    print(out, round(dv, 1))

if __name__ == "__main__":
    a = sys.argv[1:]
    # CỔNG THOẠI (20/10/2026, Meta từ chối #65717/#65719 "Adult Sexual Exploitation"): phụ đề/chữ trong đoạn dính mua bán dâm, quan hệ,
    # đe doạ lột đồ → KHÔNG cắt (kiem-thoai.py đọc chữ mỗi giây bằng Vision macOS)
    k = __import__("subprocess").run(["python3", os.path.join(D, "kiem-thoai.py"), a[0], a[1], a[2]], capture_output=True, text=True)
    if os.environ.get("ETP_KIEU") == "tap":   # kiểu tập nguyên: giây thoại cấm (kiem-thoai) + giây cấm cat-cuoi-lo đã đọc (ETP_CAM) → BỎ những giây đó, không bỏ cả tập
        import re as _re
        cam = [float(x) for x in _re.findall(r"THOAI CHAN: (\d+(?:\.\d+)?)s «", k.stdout)] + [float(x) for x in os.environ.get("ETP_CAM", "").split(",") if x.strip()]
        if k.returncode != 0 and not cam: sys.exit(k.stdout.strip() or k.stderr.strip() or "THOAI CHAN: không đọc được phụ đề")
        dung_tap(a[0], float(a[1]), float(a[2]), os.environ.get("ETP_TEN") or "Watch the full story", a[6], cam=cam); sys.exit(0)
    if k.returncode != 0: sys.exit(k.stdout.strip() or k.stderr.strip() or "THOAI CHAN: không đọc được phụ đề")
    dung(a[0], float(a[1]), float(a[2]), a[3], json.load(open(a[4])) if a[4] != "-" else None, a[5], a[6],
         a[7] if len(a) > 7 and a[7] != "-" else None, a[8] if len(a) > 8 else "WHAT HAPPENS NEXT?")
