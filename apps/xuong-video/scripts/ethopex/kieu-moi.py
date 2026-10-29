#!/usr/bin/env python3
"""NĂM KIỂU CREATIVE MỚI KHÔNG THEO GÓC SPY (anh 29/10/2026: "đa dạng cách tạo nội dung … làm cả 5 cho vào thư viện để xem trước cho 1 film").
0đ, không sinh AI: dựng từ tập phim gốc (tai-tap.py) bằng ffmpeg + lớp chữ PIL. Mỗi phim một kế hoạch JSON (kieu-moi/<content_id>.json: giây cắt + chữ),
chữ do người dựng viết theo đúng cốt phim (đã xem tờ khung). Thân video dựng ở đây → cat-canh.py lo THẺ CUỐI (poster sạch + câu hỏi vàng) + nút CTA
+ giọng CTA như mọi creative; nút chỉ hiện ở thẻ cuối (ETP_NUT_TU=cuoi — bài học #62014: nút gắn suốt thân phim = nút giả, AFS chặn).
Kiểu (nhãn kho etp — một sổ với MAU_DANG / MA_DANG của etp-view.tsx và DANG_CHUAN của diem_cham.py):
  chon_phe  "chọn phe"        — cảnh cao trào, dừng hình + thẻ câu hỏi hai lựa chọn (kéo bình luận)
  binh_luan "bình luận"       — cảnh thật + 2–3 bong bóng bình luận nổi lên phía trên (bài đang được bàn tán)
  top3      "ba khoảnh khắc"  — ba cảnh mạnh nhất, số 3 → 2 → 1, cảnh 1 là cú lật
  truoc_sau "trước sau"       — chia đôi màn hình: trên lúc bị coi thường, dưới lúc lật thế, rồi một cảnh toàn màn
  tin_nhan  "tin nhắn"        — mở bằng màn chat điện thoại (tin hiện từng dòng, tiếng ting), rồi vào cảnh thật
Dùng (iMac): python3 kieu-moi.py <ke-hoach.json> [kiểu…]  → <ra>/<kiểu>.mp4 + in đường tệp. Nạp thư viện: thu-vien-them.mts --content=… --dang=…"""
import importlib.util, json, os, re, sys
from PIL import Image, ImageDraw, ImageFont

D = os.path.dirname(os.path.abspath(__file__))
def nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(D, tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
CC = nap("cat_canh", "cat-canh.py"); gb, gx, CQ = CC.gb, CC.gx, CC.CQ
W, H, MA_HOA = gx.W, gx.H, CC.MA_HOA
NHAN = {"chon_phe": "chọn phe", "binh_luan": "bình luận", "top3": "ba khoảnh khắc", "truoc_sau": "trước sau", "tin_nhan": "tin nhắn"}
FA, FR = gx.FA, next((f for f in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf") if os.path.exists(f)), gx.FA)
EMOJI = "/System/Library/Fonts/Apple Color Emoji.ttc"
LA_EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿❤️‍]+")
VID = ["-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "44100"]
KHUNG = f"scale={W}:{H}:flags=lanczos:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,setsar=1"

# ── chữ (có emoji màu: Apple Color Emoji chỉ vẽ ở cỡ 160 → vẽ riêng rồi thu nhỏ) ──
def _f(p, c): return ImageFont.truetype(p, c)
def _manh(t): return [m for m in re.split(f"({LA_EMOJI.pattern})", t) if m]
def _em(m): return [ch for ch in m if ch not in "️‍"]
def rong_chu(t, f, c):
    d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    return sum(int(c * 1.15) * len(_em(m)) if LA_EMOJI.fullmatch(m) else d.textlength(m, font=f) for m in _manh(t))
def ve_chu(im, xy, t, p, c, mau, vien=0):
    """vẽ một dòng trái → phải, trả về bề rộng"""
    d = ImageDraw.Draw(im); f = _f(p, c); x, y = xy
    for m in _manh(t):
        if LA_EMOJI.fullmatch(m):
            for ch in _em(m):
                e = Image.new("RGBA", (200, 200), (0, 0, 0, 0)); ImageDraw.Draw(e).text((0, 0), ch, font=_f(EMOJI, 160), embedded_color=True)
                e = e.crop(e.getbbox() or (0, 0, 160, 160)).resize((int(c * 1.05), int(c * 1.05))); im.alpha_composite(e, (int(x), int(y + c * 0.08))); x += int(c * 1.15)
        else:
            d.text((x, y), m, font=f, fill=mau, stroke_width=vien, stroke_fill="black"); x += d.textlength(m, font=f)
    return x - xy[0]
def ngat(t, p, c, rong):
    dong, cur = [], ""
    for w in t.split(" "):
        thu = (cur + " " + w).strip()
        if cur and rong_chu(thu, _f(p, c), c) > rong: dong.append(cur); cur = w
        else: cur = thu
    return dong + [cur]
def sach(*cau):
    for c in cau:
        if CQ.sai_luat(c): raise SystemExit(f"CTA CHAN: chữ '{c}' dính '{CQ.sai_luat(c)}' (cta_qc.py)")
    return [x.replace("\n", " ") for x in gb.chu_studio(*cau)]

# ── ffmpeg ──
def sh(*a): gx.sh("ffmpeg", "-v", "error", "-y", *a, han=1800)
def doan(src, a, b, ra, them_vf=""):
    sh("-ss", f"{a}", "-t", f"{b - a}", "-i", src, "-vf", KHUNG + them_vf, "-af", "afade=in:d=0.15", *MA_HOA, *VID, ra); return ra
def noi(cac, ra):
    vao = sum((["-i", x] for x in cac), []); n = len(cac)
    sh(*vao, "-filter_complex", "".join(f"[{i}:v][{i}:a]" for i in range(n)) + f"concat=n={n}:v=1:a=1[v][a]", "-map", "[v]", "-map", "[a]", *MA_HOA, *VID, ra); return ra
def phu(nen, lop, ra):
    """lop = [(png, tu, den | None)] chồng lên nền, mờ vào 0,25s"""
    vao, loc, cur = ["-i", nen], "", "0:v"
    for i, (png, a, b) in enumerate(lop, 1):
        vao += ["-loop", "1", "-i", png]
        loc += f"[{i}:v]format=rgba,fade=in:st={a}:d=0.25:alpha=1[l{i}];[{cur}][l{i}]overlay=0:0:shortest=1:enable='between(t,{a},{b if b is not None else 9999})'[o{i}];"; cur = f"o{i}"
    sh(*vao, "-filter_complex", loc.rstrip(";"), "-map", f"[{cur}]", "-map", "0:a", *MA_HOA, *VID, ra); return ra

# ── lớp chữ ──
def the_bang(t, ra, y=150, mau_nen=(229, 57, 53, 235)):
    """dải chữ đậm đầu khung (hook)"""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); c = 62; dong = ngat(t, FA, c, W - 160)
    ImageDraw.Draw(im).rounded_rectangle([50, y, W - 50, y + 40 + 74 * len(dong)], 28, fill=mau_nen)
    for i, x in enumerate(dong): ve_chu(im, ((W - rong_chu(x, _f(FA, c), c)) / 2, y + 22 + 74 * i), x, FA, c, (255, 255, 255))
    im.save(ra); return ra
def the_hoi(hoi, chon, ra):
    """thẻ thăm dò: câu hỏi + hai lựa chọn"""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.rectangle([0, 0, W, H], fill=(0, 0, 0, 90))
    c = 72; dong = ngat(hoi, FA, c, W - 220); cao = 70 + 86 * len(dong) + 170 * len(chon) + 30; y0 = H - 330 - cao   # nửa dưới: không che mặt nhân vật
    d.rounded_rectangle([70, y0, W - 70, y0 + cao], 40, fill=(255, 255, 255, 245)); y = y0 + 44
    for x in dong: ve_chu(im, ((W - rong_chu(x, _f(FA, c), c)) / 2, y), x, FA, c, (20, 20, 20)); y += 86
    y += 26
    for i, x in enumerate(chon):
        d.rounded_rectangle([110, y, W - 110, y + 140], 70, fill=(240, 240, 245, 255), outline=((229, 57, 53) if i == 0 else (59, 130, 246)), width=7)
        ve_chu(im, (160, y + 34), x, FA, 64, (20, 20, 20)); y += 170
    im.save(ra); return ra
def the_binh_luan(ten, chu, thich, ra, y):
    """một bong bóng bình luận (ảnh đại diện chữ cái đầu + tên + chữ + 'Like · Reply') — trả y của bong bóng kế"""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = 44; dong = ngat(chu, FR, c, 700)
    cao = 30 + 54 + 56 * len(dong) + 20; x0 = 60
    av = [(91, 33, 182), (190, 24, 93), (3, 105, 161), (21, 128, 61)][sum(map(ord, ten)) % 4]
    d.ellipse([x0, y + 8, x0 + 96, y + 104], fill=av); d.text((x0 + 48, y + 56), ten[0], font=_f(FA, 52), fill="white", anchor="mm")
    bx = x0 + 116; bw = max([rong_chu(x, _f(FR, c), c) for x in dong] + [d.textlength(ten, font=_f(FA, 40))]) + 64
    d.rounded_rectangle([bx, y, bx + bw, y + cao], 36, fill=(242, 242, 245, 250))
    d.text((bx + 32, y + 22), ten, font=_f(FA, 40), fill=(20, 20, 20)); yy = y + 76
    for x in dong: ve_chu(im, (bx + 32, yy), x, FR, c, (25, 25, 25)); yy += 56
    d.text((bx + 34, y + cao + 12), "Like  ·  Reply", font=_f(FA, 34), fill=(255, 255, 255), stroke_width=4, stroke_fill="black")
    if thich:
        tw = rong_chu(f"👍 {thich}", _f(FR, 34), 34); px = bx + bw - 60
        d.rounded_rectangle([px, y + cao - 26, px + tw + 30, y + cao + 26], 26, fill=(255, 255, 255, 255)); ve_chu(im, (px + 14, y + cao - 21), f"👍 {thich}", FR, 34, (40, 40, 40))
    im.save(ra); return y + cao + 76
def the_so(so, nhan, ra):
    """huy hiệu #N + nhãn khoảnh khắc (góc trên trái)"""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([50, 130, 250, 330], fill=(255, 214, 10, 255), outline=(0, 0, 0), width=8); d.text((150, 232), f"#{so}", font=_f(FA, 100), fill=(0, 0, 0), anchor="mm")
    c = 60; w_ = rong_chu(nhan, _f(FA, c), c); d.rounded_rectangle([270, 180, 270 + w_ + 60, 280], 24, fill=(0, 0, 0, 200)); ve_chu(im, (300, 194), nhan, FA, c, (255, 214, 10))
    im.save(ra); return ra
def the_truoc_sau(tren, duoi, ra):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.rectangle([0, H // 2 - 6, W, H // 2 + 6], fill=(255, 255, 255, 255))
    for (chu, mau), y in ((tren, 140), (duoi, H // 2 + 50)):   # nhãn trên chừa ~140px: khung ứng dụng (tên trang, nút đóng) che mép trên
        c = 64; w_ = rong_chu(chu, _f(FA, c), c); d.rounded_rectangle([50, y, 50 + w_ + 70, y + 100], 22, fill=mau); ve_chu(im, (85, y + 16), chu, FA, c, (255, 255, 255))
    im.save(ra); return ra
def man_chat(ten, tin, n, ra):
    """màn chat điện thoại với n tin đầu (tin = [(ai, chữ)], ai = 'ho' bên trái xám | 'toi' bên phải xanh)"""
    im = Image.new("RGBA", (W, H), (12, 12, 14, 255)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 300], fill=(28, 28, 32, 255)); d.ellipse([W / 2 - 70, 60, W / 2 + 70, 200], fill=(120, 120, 130))
    d.text((W / 2, 140), ten[0], font=_f(FA, 80), fill="white", anchor="mm"); ve_chu(im, ((W - rong_chu(ten, _f(FR, 44), 44)) / 2, 232), ten, FR, 44, (235, 235, 240))
    c, y = 64, 400   # chữ chat cỡ 64 (bản đầu 50 nhỏ, nửa dưới trống — soát tờ khung 29/10/2026)
    for ai, chu in tin[:n]:
        dong = ngat(chu, FR, c, 760); bw = max(rong_chu(x, _f(FR, c), c) for x in dong) + 80; bh = 44 + 80 * len(dong)
        x0 = 50 if ai == "ho" else W - 50 - bw
        d.rounded_rectangle([x0, y, x0 + bw, y + bh], 44, fill=(58, 58, 62, 255) if ai == "ho" else (10, 132, 255, 255)); yy = y + 20
        for x in dong: ve_chu(im, (x0 + 40, yy), x, FR, c, (255, 255, 255)); yy += 80
        y += bh + 30
    im.convert("RGB").save(ra); return ra

# ── năm kiểu: mỗi hàm dựng THÂN (chưa thẻ cuối) → tệp mp4 ──
def chon_phe(src, k, tm):
    hook, hoi, *chon = sach(k["hook"], k["hoi"], *k["chon"]); g = k["giu"]
    cac = [doan(src, a, b, f"{tm}-cp{i}.mp4") for i, (a, b) in enumerate(k["doan"])]
    a, b = k["dung_hinh"]
    sh("-ss", f"{a}", "-t", f"{b - a}", "-i", src, "-vf", KHUNG + f",tpad=stop_mode=clone:stop_duration={g}", "-af", f"afade=out:st={b - a - 0.4}:d=0.4,apad=pad_dur={g}",
       "-t", f"{b - a + g}", *MA_HOA, *VID, f"{tm}-cpz.mp4")
    nen = noi(cac + [f"{tm}-cpz.mp4"], f"{tm}-cpn.mp4"); L = gx.dur(nen)
    return phu(nen, [(the_bang(hook, f"{tm}-cp-hook.png"), 0, 4.5), (the_hoi(hoi, chon, f"{tm}-cp-hoi.png"), round(L - g, 2), None)], f"{tm}-than.mp4")
def binh_luan(src, k, tm):
    nen = noi([doan(src, a, b, f"{tm}-bl{i}.mp4") for i, (a, b) in enumerate(k["doan"])], f"{tm}-bln.mp4"); lop, y = [], 150
    for i, (ten, chu, thich, t) in enumerate(k["binh_luan"]):
        p = f"{tm}-bl-{i}.png"; y = the_binh_luan(ten, sach(chu)[0], thich, p, y); lop.append((p, t, None))
    return phu(nen, lop, f"{tm}-than.mp4")
def top3(src, k, tm):
    cac, lop, t = [], [], 0.0
    for i, (so, nhan, a, b) in enumerate(k["khoanh_khac"]):
        cac.append(doan(src, a, b, f"{tm}-t3{i}.mp4")); lop.append((the_so(so, sach(nhan)[0], f"{tm}-t3-{i}.png"), round(t, 2), round(t + (b - a), 2))); t += b - a
    return phu(noi(cac, f"{tm}-t3n.mp4"), [(the_bang(sach(k["hook"])[0], f"{tm}-t3-hook.png", y=380, mau_nen=(0, 0, 0, 200)), 0, 3.5)] + lop, f"{tm}-than.mp4")
def truoc_sau(src, k, tm):
    (a1, b1), (a2, b2) = k["tren"], k["duoi"]; L = min(b1 - a1, b2 - a2); h2 = H // 2
    nua = lambda lech: f"scale={W}:-2:flags=lanczos,crop={W}:{h2}:0:ih*{lech},fps=30,setsar=1"
    sh("-ss", f"{a1}", "-t", f"{L}", "-i", src, "-ss", f"{a2}", "-t", f"{L}", "-i", src, "-filter_complex",
       f"[0:v]{nua(k.get('lech_tren', 0.2))}[t];[1:v]{nua(k.get('lech_duoi', 0.2))}[d];[t][d]vstack[v];[0:a]volume=0.3[x];[1:a]volume=1.0[y];[x][y]amix=inputs=2:duration=first:normalize=0[a]",
       "-map", "[v]", "-map", "[a]", "-t", f"{L}", *MA_HOA, *VID, f"{tm}-tsc.mp4")
    tren, duoi = sach(k["nhan_tren"], k["nhan_duoi"])
    chia = phu(f"{tm}-tsc.mp4", [(the_truoc_sau((tren, (229, 57, 53, 235)), (duoi, (22, 163, 74, 235)), f"{tm}-ts.png"), 0, None)], f"{tm}-tsc2.mp4")
    return noi([chia] + [doan(src, a, b, f"{tm}-ts{i}.mp4") for i, (a, b) in enumerate(k["sau"])], f"{tm}-than.mp4")
def tin_nhan(src, k, tm):
    tin = [(ai, c) for (ai, _), c in zip(k["tin"], sach(*[c for _, c in k["tin"]]))]; nhip, giu = k.get("nhip", 1.6), k.get("giu", 2.2)
    with open(f"{tm}-tn.txt", "w") as ds:
        for n in range(1, len(tin) + 1): ds.write(f"file '{man_chat(k['ten_chat'], tin, n, f'{tm}-tn{n}.png')}'\nduration {nhip if n < len(tin) else giu}\n")
        ds.write(f"file '{tm}-tn{len(tin)}.png'\n")
    T = nhip * (len(tin) - 1) + giu
    ting = "+".join(f"0.3*sin(2*PI*1320*(t-{i * nhip}))*exp(-30*(t-{i * nhip}))*gte(t\\,{i * nhip})" for i in range(len(tin)))
    sh("-f", "concat", "-safe", "0", "-i", f"{tm}-tn.txt", "-f", "lavfi", "-t", f"{T}", "-i", f"aevalsrc={ting}:s=44100:c=stereo",
       "-vf", "fps=30,format=yuv420p,setsar=1", "-map", "0:v", "-map", "1:a", "-t", f"{T}", *MA_HOA, *VID, f"{tm}-tnc.mp4")
    return noi([f"{tm}-tnc.mp4"] + [doan(src, a, b, f"{tm}-tnv{i}.mp4") for i, (a, b) in enumerate(k["doan"])], f"{tm}-than.mp4")
KIEU = {"chon_phe": chon_phe, "binh_luan": binh_luan, "top3": top3, "truoc_sau": truoc_sau, "tin_nhan": tin_nhan}
def cac_doan(k):
    """mọi đoạn nguồn một kiểu dùng — qua CỔNG THOẠI (kiem-thoai.py, cùng cổng cat-canh: phụ đề dính mua bán dâm / quan hệ / doạ lột đồ thì không cắt)"""
    ds = [tuple(x) for x in k.get("doan", []) + k.get("sau", [])] + [tuple(x[2:]) for x in k.get("khoanh_khac", [])]
    return ds + [tuple(k[x]) for x in ("dung_hinh", "tren", "duoi") if x in k]
def kiem_thoai(src, ds):
    import subprocess
    for a, b in ds:
        r = subprocess.run(["python3", os.path.join(D, "kiem-thoai.py"), src, str(a), str(b)], capture_output=True, text=True)
        if r.returncode != 0: raise SystemExit(f"THOAI CHAN {a}-{b}: {(r.stdout or r.stderr).strip()[:300]}")

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    kh = json.load(open(a[0])); src, ra = os.path.expanduser(kh["nguon"]), os.path.expanduser(kh["ra"]); os.makedirs(ra, exist_ok=True)
    cta = CQ.CTA["es" if kh.get("lang") == "es" else "en"]; os.environ["ETP_NUT_TU"] = "cuoi"
    for kieu in (a[1:] or list(KIEU)):
        kiem_thoai(src, cac_doan(kh[kieu]))
        tm = os.path.join(ra, f"_{kieu}"); than = KIEU[kieu](src, kh[kieu], tm); L = gx.dur(than)
        out = os.path.join(ra, f"{kieu}.mp4"); CC.dung(than, 0.0, L, os.path.expanduser(kh["poster"]), None, cta["nut"], out, cta["giong"], cta["hoi"])
        for f in os.listdir(ra):
            if f.startswith(f"_{kieu}"): os.remove(os.path.join(ra, f))
        print(json.dumps({"kieu": kieu, "nhan": NHAN[kieu], "file": out, "giay": round(gx.dur(out), 1)}, ensure_ascii=False), flush=True)
