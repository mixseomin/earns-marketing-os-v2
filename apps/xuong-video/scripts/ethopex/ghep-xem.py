#!/usr/bin/env python3
"""GHÉP BẢN XEM / BẢN NỘP creative Ethopex từ đúng clip + giọng + nhạc studio đã sinh (0đ, ffmpeg + PIL).
CHUẨN CHỮ (anh 19/10/2026): giọng nhanh 1.15×; phụ đề ngắt dòng CÂN, không cắt giữa tên phim / "Learn More"; màu nhấn vàng cho nhãn
SHORT DRAMA, tên phim, con số, chữ IN HOA; thẻ cuối = tên phim to màu vàng + NÚT ĐỎ CTA một dòng (tự co chữ cho vừa nút).
FONT POSTER (anh 19/10/2026): tên phim + chữ nút CTA dùng font & màu giống chữ tên phim trên poster (kinh_thanh.ethopex.font
{file, wght?, mau, cta_file?, cta_wght?} — font OFL ở apps/xuong-video/assets/fonts/poster/); phụ đề thường giữ chữ dễ đọc.
Dùng: python3 ghep-xem.py <ds.json> <thư mục ra>   (ds.json = mảng {tap, tt, phat, v, g, chu, nhac, font} — lấy từ xv_canh/xv_tap/xv_phim)"""
import json, os, re, subprocess, sys, textwrap, time, urllib.request
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FA = next((f for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf") if os.path.exists(f)), "/System/Library/Fonts/Supplemental/Arial Bold.ttf")   # box3 (23/10/2026): Liberation Sans Bold cùng số đo chữ với Arial
TOC_DO = 1.15                        # giọng nhanh hơn (anh: "giọng hơi chậm")
VANG, TRANG, DO = (255, 214, 10), (255, 255, 255), (220, 20, 50)
GIU_LIEN = ["Learn More", "LEARN MORE", "Más información", "MÁS INFORMACIÓN", "SHORT DRAMA", "MINISERIE"]
NB = " "

FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "fonts", "poster")
def font_poster(cfg, co, cta=False):
    """font + màu theo poster; thiếu cấu hình thì Arial Bold + vàng"""
    if not cfg: return ImageFont.truetype(FA, co), VANG
    ten = cfg.get("cta_file") if cta and cfg.get("cta_file") else cfg["file"]; w = cfg.get("cta_wght") if cta and cfg.get("cta_file") else cfg.get("wght")
    f = ImageFont.truetype(os.path.join(FONT_DIR, ten), co)
    if w:
        try: f.set_variation_by_axes([100, w] if "wdth" in ten else [w])   # Fredoka: trục (wdth, wght)
        except Exception: pass
    return f, tuple(cfg.get("mau", VANG))

class Treo(RuntimeError): pass
TREO_GIAY = 180   # CPU của cả nhóm tiến trình không nhích quá 0,5s trong chừng này giây = treo
def _cpu_nhom(pgid):
    """tổng CPU (giây) của nhóm tiến trình — đọc ps, không cần psutil"""
    r = subprocess.run(["ps", "-eo", "pgid=,cputime="], capture_output=True, text=True).stdout; tong = 0.0
    for l in r.splitlines():
        x = l.split()
        if len(x) == 2 and x[0] == str(pgid):
            t = x[1].replace("-", ":").split(":"); tong += sum(float(v) * 60 ** i for i, v in enumerate(reversed(t)))
    return tong
def sh(*a, han=None):
    """chạy lệnh (ffmpeg…) có NGƯỜI GÁC TREO (anh 25/10/2026 "treo thì phải có một con phụ trách mà fix nó"): phim 166083 ffmpeg 9 kẹt sch_wait
    ở 0% CPU 8 giờ, 3 lần, thợ đứng theo. Gác: CPU cả nhóm tiến trình không nhích > TREO_GIAY giây (hoặc quá `han` giây) → giết cả nhóm,
    ném Treo để nơi gọi đổi cách dựng (cat-canh: hai lượt). ffmpeg luôn thêm -nostdin."""
    a = list(a)
    if a and a[0] == "ffmpeg" and "-nostdin" not in a: a.insert(1, "-nostdin")
    p = subprocess.Popen(a, start_new_session=True); t0 = moc = time.time(); cpu0 = -1.0
    while True:
        try: r = p.wait(timeout=5)
        except subprocess.TimeoutExpired: r = None
        if r is not None:
            if r: raise subprocess.CalledProcessError(r, a)
            return
        cpu = _cpu_nhom(p.pid)
        if cpu > cpu0 + 0.5: cpu0, moc = cpu, time.time()
        if time.time() - moc > TREO_GIAY or (han and time.time() - t0 > han):
            try: os.killpg(p.pid, 9)
            except Exception: pass
            p.wait(); raise Treo(f"{a[0]} treo {int(time.time() - moc)}s không nhích CPU (tổng {int(time.time() - t0)}s) — đã giết")
def dur(f): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]))
def tai(u, f):
    """tải có hạn chờ + thử lại (19/10/2026: urlretrieve không hạn chờ treo cả lượt ghép 10 phút ở 0% CPU)"""
    hong = os.path.exists(f) and subprocess.run(["ffprobe", "-v", "error", f], capture_output=True).returncode != 0   # tệp dở của lượt bị ngắt
    if u and (hong or not (os.path.exists(f) and os.path.getsize(f) > 0)):
        for lan in range(4):
            try:
                with urllib.request.urlopen(u, timeout=60) as r, open(f + ".tam", "wb") as o: o.write(r.read())
                os.replace(f + ".tam", f); break
            except Exception as e:
                if lan == 3: raise
                print(f"  tải lại ({lan + 1}) {u[-50:]}: {e}", flush=True)
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

def ve_dong(d, y, dong, f, nhan=False, vien=7, mau=None):
    """vẽ một dòng căn giữa, tô màu từng chữ (mau = màu cố định, vd màu tên phim theo poster)"""
    tu = dong.split(" "); sp = d.textlength(" ", font=f)
    rong = sum(d.textlength(w, font=f) for w in tu) + sp * (len(tu) - 1); x = (W - rong) / 2
    for w in tu:
        d.text((x, y), w, font=f, fill=mau or mau_tu(w, nhan), stroke_width=vien, stroke_fill="black"); x += d.textlength(w, font=f) + sp

def phu_de(chu, ra, cfg=None):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); f = ImageFont.truetype(FA, 64); fp, mp = font_poster(cfg, 70)
    khoi = [x.strip() for x in (chu or "").split("\n") if x.strip()]
    dong = []
    for k in khoi:
        m = re.match(r"^(SHORT DRAMA|MINISERIE)\s*:\s*(.+)$", k)
        if m: dong += [(m.group(1), "nhan")] + [(x.strip('"'), "ten") for x in ngat_can(m.group(2))]   # nhãn một dòng riêng, tên phim ngắt theo từ
        else: dong += [(x, "")] if False else [(x, "") for x in ngat_can(k)]
    y = 1240
    for x, loai in dong:
        if loai == "ten": ve_dong(d, y, x, fp, vien=6, mau=mp); y += 88      # tên phim = font + màu poster
        else: ve_dong(d, y, x, f, loai == "nhan"); y += 82
    im.save(ra)

def the_cuoi(chu, nen, ra, cfg=None):
    """nền = khung cuối clip thẻ cuối (poster) làm mờ nhẹ; tên phim to vàng + nút đỏ CTA một dòng"""
    khoi = [x.strip() for x in (chu or "").split("\n") if x.strip()]
    ten = khoi[0].strip('"') if khoi else ""; cta = khoi[1] if len(khoi) > 1 else "WATCH FREE · LEARN MORE"   # luật CTA cta_qc.py: không "Tap"
    im = Image.open(nen).convert("RGB").resize((W, H)); d = ImageDraw.Draw(im, "RGBA")
    d.rectangle([0, 1180, W, H], fill=(0, 0, 0, 150))
    ft, mt = font_poster(cfg, 88); y = 1220
    for x in ngat_can(ten, 18): ve_dong(d, y, x, ft, True, 8, mau=mt); y += 104
    fs = 58
    while fs > 34 and ImageDraw.Draw(im).textlength(cta, font=font_poster(cfg, fs, True)[0]) > W - 220: fs -= 2
    fc = font_poster(cfg, fs, True)[0]; rong = d.textlength(cta, font=fc); y += 40
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
                the_cuoi(r["chu"], f"n{tap}.png", f"tc{tap}.png", r.get("font"))
                o = f"seg{tap}-{tt}.mp4"
                sh("ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", f"tc{tap}.png", *(["-i", g] if g else ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]),
                   "-filter_complex", "[0:v]scale=1080:1920,zoompan=z='1+0.03*on/90':d=1:s=1080x1920:fps=30,setsar=1[v];[1:a]apad,volume=1.6[g]",
                   "-map", "[v]", "-map", "[g]", "-t", f"{L:.2f}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-c:a", "aac", "-ar", "44100", "-ac", "2", o)
            else:
                phu_de(r["chu"], png, r.get("font")); o = f"seg{tap}-{tt}.mp4"
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
    # chữ phải qua luật chữ của studio trước (chu-studio.mts: không dấu chấm cuối câu…) — ghép không tự xử lý chữ
    goc = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
    subprocess.run([os.path.join(goc, "node_modules/.bin/tsx"), os.path.join(os.path.dirname(os.path.abspath(__file__)), "chu-studio.mts"), os.path.abspath(sys.argv[1])],
                   check=True, cwd=os.path.join(goc, "apps/xuong-video"), env={**os.environ, "NODE_OPTIONS": "--conditions=react-server"})
    ghep(json.load(open(sys.argv[1])), sys.argv[2])
