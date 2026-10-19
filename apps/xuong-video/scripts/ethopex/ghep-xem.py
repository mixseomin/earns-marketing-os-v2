#!/usr/bin/env python3
"""GHÉP BẢN XEM / BẢN NỘP creative Ethopex từ đúng clip + giọng + nhạc studio đã sinh (0đ, ffmpeg + PIL).
CHUẨN CHỮ (anh 19/10/2026): giọng nhanh 1.15×; phụ đề ngắt dòng CÂN, không cắt giữa tên phim / "Learn More"; màu nhấn vàng cho nhãn
SHORT DRAMA, tên phim, con số, chữ IN HOA; thẻ cuối = tên phim to màu vàng + NÚT ĐỎ CTA một dòng (tự co chữ cho vừa nút).
Dùng: python3 ghep-xem.py <ds.json> <thư mục ra>   (ds.json = mảng {tap, tt, phat, v, g, chu, nhac} — lấy từ xv_canh/xv_tap)"""
import json, os, re, subprocess, sys, textwrap, urllib.request
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FA = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
TOC_DO = 1.15                        # giọng nhanh hơn (anh: "giọng hơi chậm")
VANG, TRANG, DO = (255, 214, 10), (255, 255, 255), (220, 20, 50)
GIU_LIEN = ["Learn More", "LEARN MORE", "Más información", "MÁS INFORMACIÓN", "SHORT DRAMA", "MINISERIE"]
NB = " "

def sh(*a): subprocess.run(a, check=True)
def dur(f): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]))
def tai(u, f):
    if u and not os.path.exists(f): urllib.request.urlretrieve(u, f)
    return f if u else None

def khoa_cum(s):
    """không ngắt dòng giữa tên phim trong ngoặc kép và các cụm GIU_LIEN"""
    for c in GIU_LIEN: s = s.replace(c, c.replace(" ", NB))
    # tên phim trong ngoặc kép chỉ khoá liền khi vừa một dòng; dài hơn thì ngắt theo TỪ (không bao giờ cắt giữa chữ)
    return re.sub(r'"[^"]+"', lambda m: m.group(0).replace(" ", NB) if len(m.group(0)) <= 24 else m.group(0), s)

def ngat_can(s, toi_da=24):
    """ngắt thành ít dòng nhất có thể với độ dài các dòng gần bằng nhau (không để một chữ mồ côi)"""
    tu = khoa_cum(s).split(" ")
    n = max(1, -(-len(" ".join(tu)) // toi_da))
    for so in range(n, n + 3):
        dich = len(" ".join(tu)) / so; dong, cur = [], []
        for w in tu:
            if cur and len(" ".join(cur + [w])) > dich + 4 and len(dong) < so - 1: dong.append(" ".join(cur)); cur = [w]
            else: cur.append(w)
        dong.append(" ".join(cur))
        if all(len(d) <= toi_da + 6 for d in dong): return [d.replace(NB, " ") for d in dong]
    return [d.replace(NB, " ") for d in textwrap.wrap(" ".join(tu), toi_da, break_long_words=False, break_on_hyphens=False)]

def mau_tu(w, nhan):
    return VANG if nhan or re.search(r"\d", w) or (len(w) > 1 and w.isupper()) else TRANG

def ve_dong(d, y, dong, f, nhan=False, vien=7):
    """vẽ một dòng căn giữa, tô màu từng chữ"""
    tu = dong.split(" "); sp = d.textlength(" ", font=f)
    rong = sum(d.textlength(w, font=f) for w in tu) + sp * (len(tu) - 1); x = (W - rong) / 2
    for w in tu:
        d.text((x, y), w, font=f, fill=mau_tu(w, nhan), stroke_width=vien, stroke_fill="black"); x += d.textlength(w, font=f) + sp

def phu_de(chu, ra):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); f = ImageFont.truetype(FA, 64)
    khoi = [x.strip() for x in (chu or "").split("\n") if x.strip()]
    dong = []
    for k in khoi:
        m = re.match(r"^(SHORT DRAMA|MINISERIE)\s*:\s*(.+)$", k)
        if m: dong += [(m.group(1), True)] + [(x, True) for x in ngat_can(m.group(2))]   # nhãn một dòng riêng, tên phim ngắt theo từ
        else: dong += [(x, False) for x in ngat_can(k)]
    y = 1240
    for x, nhan in dong: ve_dong(d, y, x, f, nhan); y += 82
    im.save(ra)

def the_cuoi(chu, nen, ra):
    """nền = khung cuối clip thẻ cuối (poster) làm mờ nhẹ; tên phim to vàng + nút đỏ CTA một dòng"""
    khoi = [x.strip() for x in (chu or "").split("\n") if x.strip()]
    ten = khoi[0].strip('"') if khoi else ""; cta = khoi[1] if len(khoi) > 1 else "WATCH FREE · TAP LEARN MORE"
    im = Image.open(nen).convert("RGB").resize((W, H)); d = ImageDraw.Draw(im, "RGBA")
    d.rectangle([0, 1180, W, H], fill=(0, 0, 0, 150))
    ft = ImageFont.truetype(FA, 78); y = 1230
    for x in ngat_can(ten, 20): ve_dong(d, y, x, ft, True, 8); y += 96
    fs = 58
    while fs > 34 and ImageDraw.Draw(im).textlength(cta, font=ImageFont.truetype(FA, fs)) > W - 220: fs -= 2
    fc = ImageFont.truetype(FA, fs); rong = d.textlength(cta, font=fc); y += 40
    d.rounded_rectangle([(W - rong) / 2 - 50, y, (W + rong) / 2 + 50, y + fs + 54], radius=(fs + 54) // 2, fill=DO + (255,))
    d.text(((W - rong) / 2, y + 24), cta, font=fc, fill=TRANG)
    im.save(ra)

def ghep(ds, ra_dir):
    os.makedirs(ra_dir, exist_ok=True); os.chdir(ra_dir); kq = {}
    for tap in sorted({r["tap"] for r in ds}):
        segs, nh = [], None; hang = [r for r in ds if r["tap"] == tap]
        for r in hang:
            tt = r["tt"]; v = tai(r["v"], f"{tap}-{tt}.mp4"); g = tai(r.get("g"), f"{tap}-{tt}.mp3"); nh = r.get("nhac")
            cuoi = tt == max(x["tt"] for x in hang)
            if g:
                sh("ffmpeg", "-v", "error", "-y", "-i", g, "-af", f"atempo={TOC_DO}", f"{tap}-{tt}-n.wav"); g = f"{tap}-{tt}-n.wav"
            L = (dur(g) + 0.25) if g else (2.8 if cuoi else float(r["phat"]) / TOC_DO)
            png = f"o{tap}-{tt}.png"
            if cuoi:
                sh("ffmpeg", "-v", "error", "-y", "-sseof", "-0.2", "-i", v, "-frames:v", "1", "-update", "1", f"n{tap}.png")
                the_cuoi(r["chu"], f"n{tap}.png", f"tc{tap}.png")
                o = f"seg{tap}-{tt}.mp4"
                sh("ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", f"tc{tap}.png", *(["-i", g] if g else ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]),
                   "-filter_complex", "[0:v]scale=1080:1920,zoompan=z='1+0.03*on/90':d=1:s=1080x1920:fps=30,setsar=1[v];[1:a]apad,volume=1.6[g]",
                   "-map", "[v]", "-map", "[g]", "-t", f"{L:.2f}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-c:a", "aac", "-ar", "44100", "-ac", "2", o)
            else:
                phu_de(r["chu"], png); o = f"seg{tap}-{tt}.mp4"
                sh("ffmpeg", "-v", "error", "-y", "-stream_loop", "-1", "-i", v, "-i", png, *(["-i", g] if g else ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]),
                   "-filter_complex", f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,setsar=1[a];[a][1:v]overlay[v];[2:a]apad,volume=1.6[g]",
                   "-map", "[v]", "-map", "[g]", "-t", f"{L:.2f}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-c:a", "aac", "-ar", "44100", "-ac", "2", o)
            segs.append(o)
        open(f"l{tap}.txt", "w").write("".join(f"file '{s}'\n" for s in segs))
        sh("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"l{tap}.txt", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-r", "30", "-c:a", "aac", "-ar", "44100", f"cat{tap}.mp4")
        m = tai(nh, f"nhac{tap}.mp3"); out = f"creative-{tap}.mp4"
        if m: sh("ffmpeg", "-v", "error", "-y", "-i", f"cat{tap}.mp4", "-i", m, "-filter_complex", "[1:a]volume=0.22[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-movflags", "+faststart", out)
        else: os.replace(f"cat{tap}.mp4", out)
        kq[tap] = round(dur(out), 1); print(tap, kq[tap], flush=True)
    return kq

if __name__ == "__main__":
    ghep(json.load(open(sys.argv[1])), sys.argv[2])
