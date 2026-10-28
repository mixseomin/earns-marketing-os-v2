#!/usr/bin/env python3
"""BẢN B creative Ethopex = mẫu thắng số 3 "NHÂN VẬT ~10s" — ghép (0đ) từ MỘT clip hero studio (tao-nhan-vat.mts → tu-lam-phim.mts).
Khuôn theo mẫu thắng (soi 19/10/2026): MỘT cảnh liền, nhân vật nhìn thẳng ống kính; LOGO tên phim kiểu poster (chữ vàng
chuyển sắc + viền tối + quầng sáng, dòng "EXCLUSIVE" nhỏ bên dưới) hiện từ giây 4 (sau hook 0–4s, đúng nhịp chữ "@giây" của cảnh trong studio); nút đỏ viền vàng có bóng hiện từ giây 4,6 và
nhún nhẹ tới hết. ÂM = CHỈ NHẠC (anh 19/10/2026: tiếng gốc của clip bị cắt → "voice cụt cụt").
Bỏ hẳn bản cũ (3 đoạn cắt ghép + chữ trên dải đen — anh: "nhìn cứ rác rác").
Chữ (tên phim, CTA) = chữ màn của cảnh hero trong studio (đã khai để người xem studio chấm; qua luật chữ studio).
Dòng HOOK (chữ trắng viền đen, trên đầu khung, từ giây 0,3) — người xem studio đòi câu gợi chuyện (19/10/2026: 5/10 khi chỉ có logo).
Mọi chữ qua chu-studio.mts (luật chữ studio: không dấu chấm cuối câu…) trước khi vẽ.
Dùng: python3 ghep-b.py <job.json>  (job = {doan:[{file,giay,hook}], nhac, ten, cta, font, ra} — cảnh cuối là hero, logo + nút hiện trong cảnh đó)"""
import json, os, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFilter
import importlib.util

spec = importlib.util.spec_from_file_location("gx", os.path.join(os.path.dirname(os.path.abspath(__file__)), "ghep-xem.py"))
gx = importlib.util.module_from_spec(spec); spec.loader.exec_module(gx)
W, H = gx.W, gx.H
VANG_SANG, VANG_TOI = (255, 236, 170), (196, 132, 34)

def chu_vang(kt, chu, f):
    """mặt nạ chữ → tô vàng chuyển sắc dọc"""
    m = Image.new("L", kt, 0); ImageDraw.Draw(m).text((10, 10), chu, font=f, fill=255)
    g = Image.new("RGBA", kt); dg = ImageDraw.Draw(g)
    for y in range(kt[1]):
        t = y / max(1, kt[1] - 1); dg.line([(0, y), (kt[0], y)], fill=tuple(int(VANG_SANG[i] + (VANG_TOI[i] - VANG_SANG[i]) * t) for i in range(3)) + (255,))
    g.putalpha(m); return g, m

def mau_phang(kt, rgb, alpha):
    return Image.merge("RGBA", (*[Image.new("L", kt, v) for v in rgb], alpha))

def lop_logo(ten, nhan, cfg, ra):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); f, _ = gx.font_poster(cfg, 104)
    dong = gx.ngat_can(ten, 16); y = 1130 - 60 * (len(dong) - 1)
    for x in dong:
        bb = f.getbbox(x); kt = (int(bb[2]) + 20, int(bb[3]) + 30); x0 = int((W - kt[0]) / 2)
        mat, m = chu_vang(kt, x, f)
        quang = m.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(14)).point(lambda p: int(p * 0.55))
        im.alpha_composite(mau_phang(kt, (255, 190, 80), quang), (x0, y))                       # quầng sáng
        im.alpha_composite(mau_phang(kt, (40, 18, 4), m.filter(ImageFilter.MaxFilter(9))), (x0, y))  # viền tối
        im.alpha_composite(mat, (x0, y)); y += int(kt[1] * 0.9)
    fn = gx.ImageFont.truetype(gx.FA, 40); d = ImageDraw.Draw(im); rong = d.textlength(nhan, font=fn)
    d.text(((W - rong) / 2, y + 6), nhan, font=fn, fill=(255, 244, 214), stroke_width=4, stroke_fill=(40, 18, 4))
    im.save(ra)

def lop_hook(hook, ra):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); f = gx.ImageFont.truetype(gx.FA, 66); y = 250
    cau = [k.strip() for k in re.split(r"\n|(?<=[.!?])\s+", hook) if k.strip()]   # mỗi câu một khối, không để chữ mồ côi
    for x in [z for k in cau for z in gx.ngat_can(k, 26)]:
        gx.ve_dong(d, y, x, f, vien=8); y += 84
    im.save(ra)

def chu_studio(*cau):
    """đưa chữ qua đúng luật chữ của studio (chu-studio.mts → doanChuMan)"""
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as o: json.dump([{"chu": c, "phat": 3} for c in cau], o)
    goc = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
    subprocess.run([os.path.join(goc, "node_modules/.bin/tsx"), os.path.join(os.path.dirname(os.path.abspath(__file__)), "chu-studio.mts"), o.name],
                   check=True, cwd=os.path.join(goc, "apps/xuong-video"), env={**os.environ, "NODE_OPTIONS": "--conditions=react-server"}, capture_output=True)
    return [r["chu"] for r in json.load(open(o.name))]

# mau: biến thể màu nút để đo điểm chạm (anh 28/10/2026) — 'do' mặc định (đỏ chuyển sắc), 'xanh' xanh lá chuyển sắc; viền vàng + chữ trắng giữ nguyên
NUT_MAU = {'do': ((235, 40, 45), (90, 25, 25), (90, 0, 0)), 'xanh': ((40, 190, 90), (25, 95, 45), (0, 60, 20))}
def lop_nut(cta, cfg, ra, mau='do'):
    im = Image.new("RGBA", (W, 300), (0, 0, 0, 0)); d = ImageDraw.Draw(im); fs = 54
    while fs > 32 and d.textlength(cta, font=gx.font_poster(cfg, fs, True)[0]) > W - 260: fs -= 2
    fc = gx.font_poster(cfg, fs, True)[0]; rong = d.textlength(cta, font=fc)
    x0, x1, y0, y1 = int((W - rong) / 2 - 60), int((W + rong) / 2 + 60), 70, 70 + fs + 60; r = (y1 - y0) // 2
    bong = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(bong).rounded_rectangle([x0 + 6, y0 + 12, x1 + 6, y1 + 12], radius=r, fill=(0, 0, 0, 170))
    im.alpha_composite(bong.filter(ImageFilter.GaussianBlur(10)))
    nen = Image.new("RGBA", im.size, (0, 0, 0, 0)); dn = ImageDraw.Draw(nen)
    (r0, g0, b0), (dr, dg, db), vien_chu = NUT_MAU.get(mau, NUT_MAU['do'])
    for i in range(y1 - y0):   # chuyển sắc: trên sáng, dưới thẫm
        t = i / (y1 - y0); dn.line([(x0, y0 + i), (x1, y0 + i)], fill=(int(r0 - dr * t), int(g0 - dg * t), int(b0 - db * t), 255))
    m = Image.new("L", im.size, 0); ImageDraw.Draw(m).rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255); nen.putalpha(m)
    im.alpha_composite(nen); d = ImageDraw.Draw(im)
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, outline=(250, 205, 90, 255), width=6)
    d.rounded_rectangle([x0 + 18, y0 + 8, x1 - 18, y0 + int((y1 - y0) * 0.42)], radius=r // 2, fill=(255, 255, 255, 40))   # bóng kính
    d.text(((W - rong) / 2, y0 + 28), cta, font=fc, fill=(255, 255, 255), stroke_width=2, stroke_fill=vien_chu)
    im.save(ra)

def dung(doan, nhac, ten, cta, cfg, out):
    """doan = [{file, giay, hook}] — các cảnh nối liền (cảnh 1 bất công, cảnh cuối hero); logo + nút hiện ở cảnh cuối (sau hook của nó)"""
    tmp = os.path.splitext(out)[0]; nhan = "EXCLUSIVO" if any(k in cta.upper() for k in ("MÁS", "MÍRALA")) else "EXCLUSIVE"
    chu = chu_studio(*[d["hook"] for d in doan], ten, cta); hooks, ten, cta = chu[:len(doan)], chu[-2].replace("\n", " ").strip('"'), chu[-1].replace("\n", " ")
    lop_logo(ten, nhan, cfg, tmp + "-logo.png"); lop_nut(cta, cfg, tmp + "-nut.png")
    T = sum(d["giay"] for d in doan); bd = [sum(d["giay"] for d in doan[:i]) for i in range(len(doan))]
    logo_tu = bd[-1] + min(2.5, doan[-1]["giay"] / 2)
    vao, loc = [], []
    for i, d in enumerate(doan):
        vao += ["-t", f"{d['giay']}", "-i", d["file"]]
        loc.append(f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,setsar=1,trim=0:{d['giay']},setpts=PTS-STARTPTS[c{i}]")
    n = len(doan); loc.append("".join(f"[c{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v0]")
    vao += ["-loop", "1", "-t", f"{T}", "-i", tmp + "-logo.png", "-loop", "1", "-t", f"{T}", "-i", tmp + "-nut.png"]
    loc.append(f"[{n}:v]format=rgba,fade=in:st={logo_tu}:d=0.6:alpha=1[logo];[{n + 1}:v]format=rgba,fade=in:st={logo_tu + 0.6}:d=0.4:alpha=1[nut]")
    loc.append(f"[v0][logo]overlay=0:'if(lt(t,{logo_tu + 0.6}),30*({logo_tu + 0.6}-t)/0.6,0)'[l0];[l0][nut]overlay=0:'1540+8*sin(2*PI*1.6*t)'[h0]")
    cuoi = "h0"
    for i, h in enumerate(hooks):
        if not h.strip(): continue
        f = f"{tmp}-hook{i}.png"; lop_hook(h, f); k = n + 2 + i
        het = (bd[i] + doan[i]["giay"]) if i < n - 1 else logo_tu
        vao += ["-loop", "1", "-t", f"{T}", "-i", f]
        loc.append(f"[{k}:v]format=rgba,fade=in:st={bd[i] + 0.2}:d=0.3:alpha=1,fade=out:st={het - 0.3}:d=0.3:alpha=1[hk{i}];[{cuoi}][hk{i}]overlay=0:0[h{i + 1}]"); cuoi = f"h{i + 1}"
    ia = len([x for x in vao if x == "-i"])
    vao += ["-i", nhac] if nhac and nhac != "-" else ["-f", "lavfi", "-t", f"{T}", "-i", "anullsrc=r=44100:cl=stereo"]
    loc.append(f"[{ia}:a]aresample=44100,volume=0.9,afade=out:st={T - 0.8}:d=0.8[a]")
    gx.sh("ffmpeg", "-v", "error", "-y", *vao, "-filter_complex", ";".join(loc), "-map", f"[{cuoi}]", "-map", "[a]", "-t", f"{T}",
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-r", "30", "-c:a", "aac", "-ar", "44100", "-movflags", "+faststart", out)
    print(out, round(gx.dur(out), 1))

if __name__ == "__main__":
    # python3 ghep-b.py <job.json>   job = {doan:[{file,giay,hook}], nhac, ten, cta, font:{…}|null, ra}
    j = json.load(open(sys.argv[1]))
    dung(j["doan"], j.get("nhac"), j["ten"], j["cta"], j.get("font"), j["ra"])
