#!/usr/bin/env python3
"""MÁY DỰNG THEO MẪU HỌC TỪ ĐỐI THỦ — $0 dựng (PIL + ffmpeg trên iMac), chỉ tốn giọng ~156₫ + AI viết câu nhử ~20₫ / bản.
Anh 19/11/2026: "Tao cần xem trạng thái quá trình dựng ở đó luôn! Chưa có máy thì mày phải dựng lên" — mẫu đối thủ trong sổ (apps/etp2/src/lib/etp-mau-cr.json,
dt_*) có hàm vẽ ở đây; phim anh chọn ở tab Mẫu Creative (etp.mau_phim) → dựng → thư viện → creative (cổng mẫu len-creative nhận đúng mẫu qua dấu "mẫu:<mã>").
Dùng lại máy ảnh tĩnh (anh-tinh.py): tải 3 tập, khung đẹp AI xếp hạng, xoá phụ đề, tên phim tách từ poster, giọng (cổng giọng chung), dựng video phóng chậm.
TRẠNG THÁI từng bước ghi etp.mau_dung (mau, content_id) → chân thẻ tab Mẫu Creative hiện ngay: cho → tai_tap → chon_khung → ve_mau → giong → video → thu_vien → creative → xong | loi.
Chạy (iMac, ~/.venvs/poster-mau/bin/python — có rembg):
  dung-mau.py <mã mẫu> <content_id> [--xem]   (--xem: chỉ dựng ảnh + video, không nạp thư viện / không tải creative)
  dung-mau.py --hang                           (mọi phim đã chọn cho mẫu có hàm vẽ mà chưa dựng)
  dung-mau.py --bang <content_id>              (vẽ mọi mẫu trên một phim → bảng ghép xem trước, không giọng, không nạp)"""
import colorsys, importlib.util, json, math, os, random, re, subprocess, sys, traceback, urllib.request
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

D = os.path.dirname(os.path.abspath(__file__))
def _nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(D, tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
AT = _nap("anh_tinh", "anh-tinh.py"); TB = _nap("tinh_ba_kieu", "tinh-ba-kieu.py")
W, H = AT.W, AT.H
SO = json.load(open(os.path.join(D, "..", "..", "..", "etp2", "src", "lib", "etp-mau-cr.json"), encoding="utf-8"))["mau"]
F = "/System/Library/Fonts/Supplemental/"
PH = {"impact": ("Impact.ttf", 0), "arial_black": ("Arial Black.ttf", 0), "didot": ("Didot.ttc", 0), "bodoni": ("Bodoni 72.ttc", 0), "copper": ("Copperplate.ttc", 2),
      "basker": ("Baskerville.ttc", 4), "basker_ng": ("Baskerville.ttc", 5), "georgia_bi": ("Georgia Bold Italic.ttf", 0), "georgia_i": ("Georgia Italic.ttf", 0),
      "din": ("DIN Condensed Bold.ttf", 0), "futura": ("Futura.ttc", 4), "arial_b": ("Arial Bold.ttf", 0)}
def ph(ten, co): f, i = PH[ten]; return ImageFont.truetype(F + f, co, index=i)

# ---------- trạng thái ----------
def bang_sql():
    return ("create table if not exists etp.mau_dung (mau text not null, content_id integer not null, buoc text not null default 'cho', trang_thai text not null default 'cho', "
            "ghi text, creative_ids integer[] not null default '{}', tv_ids integer[] not null default '{}', vnd integer not null default 0, bat_dau timestamptz, "
            "cap_nhat timestamptz not null default now(), primary key (mau, content_id));")
def s_(v): return "null" if v is None else "$Q$" + str(v).replace("$Q$", "") + "$Q$"
def ghi_tt(mau, cid, buoc, tt="dang", ghi=None, **k):
    them = "".join(f", {c} = {v}" for c, v in k.items())
    AT.sql(bang_sql() + f" insert into etp.mau_dung (mau, content_id, buoc, trang_thai, ghi, bat_dau) values ({s_(mau)}, {int(cid)}, {s_(buoc)}, {s_(tt)}, {s_(ghi)}, now()) "
           f"on conflict (mau, content_id) do update set buoc = excluded.buoc, trang_thai = excluded.trang_thai, ghi = excluded.ghi, cap_nhat = now(){them}")
    print(f"[{mau} · {cid}] {buoc} · {tt}{' · ' + ghi if ghi else ''}", flush=True)

# ---------- câu nhử (cổng AI chung, haiku rẻ) ----------
def cau_nhu(ten, mo_ta, lang):
    """câu nhử 4–10 chữ + MỘT từ nhấn (tô đỏ) — kiểu 'To fight crime, he became a criminal'. Chữ trơn hai dòng HOOK / WORD (19/11/2026: khuôn JSON qua tuyến
    rẻ bị điền lệch ô — 'cau' ra lại đề bài, câu thật lạc sang 'nhan'), kiểm độ dài, hỏng thì gọi lại một lần; hai lần hỏng → câu dự phòng (báo to)."""
    k = dict(l.strip().split("=", 1) for l in open(os.path.expanduser("~/.secrets/cong-ai.env")) if "=" in l)["CONG_AI_KEY"].strip().strip('"')
    de = (f"Short drama: {ten}\nSynopsis: {mo_ta[:700]}\n\nWrite ONE intriguing movie-poster hook line in {'Spanish' if lang == 'es' else 'English'} (4-10 words, no spoiler of the ending, "
          "no quotes, no emoji, do not repeat the title). Then the single most dramatic word of that line.\nAnswer EXACTLY two lines:\nHOOK: <line>\nWORD: <word>")
    chi = 0
    for lan in range(2):
        try:
            r = urllib.request.urlopen(urllib.request.Request("https://spy.on.tc/api/ai", method="POST", headers={"authorization": f"Bearer {k}", "content-type": "application/json", "user-agent": "Mozilla/5.0 dung-mau"},
                data=json.dumps({"viec": "etp-dung-mau", "model": "haiku", "max_tokens": 120, "noi_dung": de, "bo_chinh_hang": True}).encode()), timeout=120)
            j = json.loads(r.read()); chi += round((j.get("chi_usd") or 0) * 26000); t = str(j.get("kq") or "")
            h = re.search(r"HOOK:\s*(.+)", t); w = re.search(r"WORD:\s*([^\s]+)", t)
            cau = (h.group(1).strip().strip('"“”').rstrip(".") if h else ""); nhan = (w.group(1).strip('"“”.,!') if w else "")
            if 4 <= len(cau.split()) <= 10 and ten.lower() not in cau.lower() and not re.search(r"(?i)hook|poster|line", cau):
                return cau, (nhan if nhan.lower() in cau.lower() else cau.split()[-1]), chi
            print(f"✗ câu nhử lần {lan + 1} không đạt: {t[:120]!r}", file=sys.stderr, flush=True)
        except Exception as e: print(f"✗ câu nhử lần {lan + 1} lỗi: {e}", file=sys.stderr, flush=True)
    return (("Nobody saw this coming", "Nobody") if lang != "es" else ("Nadie lo vio venir", "Nadie")) + (chi,)

# ---------- công cụ vẽ ----------
def vua(chu, ten_ph, rong, co, toi_da=3, co_min=48):
    """chia dòng + co chữ cho vừa bề rộng, tối đa toi_da dòng → (phông, các dòng)"""
    while True:
        f = ph(ten_ph, co); dong, cur = [], ""
        for w in chu.split():
            t = f"{cur} {w}".strip()
            if cur and f.getlength(t) > rong: dong.append(cur); cur = w
            else: cur = t
        dong.append(cur)
        if (len(dong) <= toi_da and max(f.getlength(x) for x in dong) <= rong) or co <= co_min: return f, dong
        co -= 6
def mat_chu(dong, f, y, gian=1.08, can="giua", x0=None):
    """mặt nạ L của các dòng chữ + hộp bao"""
    m = Image.new("L", (W, H)); d = ImageDraw.Draw(m); cao = int(f.size * gian); hop = [W, H, 0, 0]
    for i, t in enumerate(dong):
        w = f.getlength(t); x = (W - w) / 2 if can == "giua" else (x0 or 60); yy = y + i * cao
        d.text((x, yy), t, font=f, fill=255); bb = d.textbbox((x, yy), t, font=f)
        hop = [min(hop[0], bb[0]), min(hop[1], bb[1]), max(hop[2], bb[2]), max(hop[3], bb[3])]
    return m, hop
def doc(c1, c2, c3=None):
    """dải màu dọc W×H (2 hoặc 3 điểm)"""
    g = Image.new("RGB", (1, H))
    for r in range(H):
        t = r / (H - 1)
        if c3: a, b, u = (c1, c2, t * 2) if t < 0.5 else (c2, c3, (t - 0.5) * 2)
        else: a, b, u = c1, c2, t
        g.putpixel((0, r), tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3)))
    return g.resize((W, H))
def doc_trong(c1, c2, c3, hop):
    """dải màu dọc chỉ trải trong chiều cao hộp chữ (mặt chữ đổi màu từ đỉnh tới đáy chữ)"""
    h = max(1, hop[3] - hop[1]); g = Image.new("RGB", (1, h))
    for r in range(h):
        t = r / max(1, h - 1); a, b, u = (c1, c2, t * 2) if t < 0.5 else (c2, c3, (t - 0.5) * 2)
        g.putpixel((0, r), tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3)))
    nen = Image.new("RGB", (W, H)); nen.paste(g.resize((W, h)), (0, hop[1])); return nen
def bong(lop, m, lech=(6, 10), mo=10, a=190):
    s = Image.new("RGBA", (W, H), (0, 0, 0, 0)); s.putalpha(m.point(lambda v: v * a // 255)); s = s.filter(ImageFilter.GaussianBlur(mo))
    t = Image.new("RGBA", (W, H)); t.paste(s, lech); lop.alpha_composite(t)
def to(lop, m, mat):
    """tô mặt chữ m bằng ảnh / màu mat"""
    img = mat if isinstance(mat, Image.Image) else Image.new("RGB", (W, H), mat)
    l = img.convert("RGBA"); l.putalpha(m); lop.alpha_composite(l)
def vien(lop, m, day, mau):
    v = m.filter(ImageFilter.MaxFilter(day * 2 + 1)); to(lop, v, mau)
def sang_khoi(lop, m, mau=(255, 255, 240), toi=(60, 30, 0)):
    """nổi khối: viền sáng trên-trái, viền tối dưới-phải trong mặt chữ (vát cạnh)"""
    tren = ImageChops.subtract(m, ImageChops.offset(m, 3, 4)).filter(ImageFilter.GaussianBlur(1.2))
    duoi = ImageChops.subtract(m, ImageChops.offset(m, -3, -4)).filter(ImageFilter.GaussianBlur(1.2))
    for mm, c, a in ((tren, mau, 230), (duoi, toi, 200)):
        l = Image.new("RGBA", (W, H), c + (0,)); l.putalpha(mm.point(lambda v: v * a // 255)); lop.alpha_composite(l)
def phat_sang(lop, m, mau, mo=24, a=200):
    g = Image.new("RGBA", (W, H), mau + (0,)); g.putalpha(m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(mo)).point(lambda v: min(255, v * a // 255))); lop.alpha_composite(g)
def nut(lop, chu, y, f, nen, chu_mau=(255, 255, 255), vien_mau=None, dem=(56, 26), bo_tron=None, rong_min=0):
    d = ImageDraw.Draw(lop); x0, y0, x1, y1 = f.getbbox(chu); w = max(rong_min, x1 - x0 + 2 * dem[0]); h = y1 - y0 + 2 * dem[1]; x = (W - w) // 2
    r = bo_tron if bo_tron is not None else h // 2
    bo = Image.new("RGBA", (W, H)); ImageDraw.Draw(bo).rounded_rectangle((x + 4, y + 10, x + w + 4, y + h + 10), radius=r, fill=(0, 0, 0, 150)); lop.alpha_composite(bo.filter(ImageFilter.GaussianBlur(12)))
    if vien_mau: d.rounded_rectangle((x - 6, y - 6, x + w + 6, y + h + 6), radius=r + 6, fill=vien_mau)
    d.rounded_rectangle((x, y, x + w, y + h), radius=r, fill=nen)
    d.text((x + (w - (x1 - x0)) / 2 - x0, y + dem[1] - y0), chu, font=f, fill=chu_mau); return y + h
def ten_chu(p):
    return AT.ten_sach(p["ten"])
def nhan_tl(p):
    """nhãn thể loại cho dòng phụ sử thi"""
    tl = (p.get("the_loai") or "").lower()
    return {"fantasy": "A FANTASY ROMANCE EPIC", "soi": "A WEREWOLF ROMANCE", "co_trang": "AN EPIC TALE OF THE EMPIRE", "mafia": "A MAFIA LOVE STORY", "vien_tuong": "A SCI-FI ADVENTURE"}.get(tl, "AN EPIC SHORT DRAMA")

# ---------- 12 MẪU (mã = sổ etp-mau-cr.json) — mỗi hàm: (ngữ cảnh) → (nền.png hoặc None = nền khung phim thường, lớp chữ RGBA) ----------
def dt_ten_vang(c):
    """tên phim chữ vàng bóng nổi khối đặt 1/3 dưới, đè thẳng lên khung — không nền, không nút (kiểu Step Back! Hidden King / Great and Powerful Genie, 92 ngày)"""
    lop = Image.new("RGBA", (W, H)); f, dong = vua(c["ten"], "georgia_bi", W - 120, 150, 3)
    cao = int(f.size * 1.02) * len(dong); y = int(max(H * 0.60, min(H * 0.80 - cao, c["mat_day"] + 40)))
    m, hop = mat_chu(dong, f, y, 1.02); bong(lop, m, (8, 12), 14, 220); vien(lop, m, 7, (70, 38, 6))
    to(lop, m, doc_trong((255, 246, 200), (232, 172, 52), (176, 104, 18), hop)); sang_khoi(lop, m); return None, lop
def dt_logo_chat_lieu(c):
    """tên phim vẽ bằng chất liệu theo chủ đề phim (nước / lửa / phép thuật / băng) + hào quang + gạch hoạ tiết (kiểu Surf God's Revenge / Luna's Revenge)"""
    tl = (c["p"].get("the_loai") or "").lower(); txt = c["ten"].lower()
    chu_de = ("nuoc" if re.search(r"sea|surf|ocean|water|mermaid|tide", txt) else "lua" if re.search(r"dragon|fire|flame|phoenix|inferno", txt) else
              "bang" if re.search(r"ice|frost|snow|winter", txt) else "phep" if tl in ("fantasy", "soi", "vien_tuong") else "vang")
    bang = {"nuoc": ((235, 252, 255), (70, 180, 235), (10, 70, 150), (120, 220, 255)), "lua": ((255, 248, 200), (255, 150, 30), (170, 30, 10), (255, 120, 20)),
            "bang": ((250, 255, 255), (160, 220, 255), (60, 120, 200), (170, 230, 255)), "phep": ((255, 235, 255), (200, 120, 255), (80, 20, 150), (190, 110, 255)),
            "vang": ((255, 245, 205), (230, 175, 60), (130, 70, 10), (255, 200, 90))}[chu_de]
    lop = Image.new("RGBA", (W, H)); f, dong = vua(c["ten"].upper(), "copper", W - 110, 140, 3)
    cao = int(f.size * 1.0) * len(dong); y = int(max(H * 0.58, min(H * 0.80 - cao, c["mat_day"] + 50)))
    m, hop = mat_chu(dong, f, y, 1.0); phat_sang(lop, m, bang[3], 28, 230); vien(lop, m, 6, tuple(v // 3 for v in bang[2]))
    van = doc_trong(bang[0], bang[1], bang[2], hop)
    nhieu = Image.effect_noise((W, H), 40).convert("RGB"); van = Image.blend(van, ImageChops.multiply(van, nhieu.point(lambda v: 150 + v // 3)), 0.35)
    to(lop, m, van); sang_khoi(lop, m, (255, 255, 255), tuple(v // 2 for v in bang[2]))
    d = ImageDraw.Draw(lop); yy = hop[3] + 18
    for s in (-1, 1):   # hai gạch hoạ tiết nhọn hai bên dòng cuối
        x0 = W // 2 + s * 70; x1 = W // 2 + s * 380
        d.polygon([(x0, yy), (x1, yy - 5), (x1, yy + 5)], fill=bang[1] + (230,))
    d.ellipse((W // 2 - 12, yy - 12, W // 2 + 12, yy + 12), fill=bang[3] + (240,)); return None, lop
def _ten_hai_tang(c, y_min):
    """tên hai tầng: phần đầu trắng, TỪ CUỐI đỏ (kiểu UNDERCOVER PRISON KING) → (lớp, đáy)"""
    w = c["ten"].upper().split(); dau, cuoi = " ".join(w[:-1]) or w[0], w[-1] if len(w) > 1 else ""
    lop = Image.new("RGBA", (W, H)); f1, d1 = vua(dau, "impact", W - 160, 120, 2); f2 = ph("impact", f1.size)
    y = int(max(y_min, H * 0.58)); m1, h1 = mat_chu(d1, f1, y, 1.0)
    bong(lop, m1, (6, 10), 10, 210); vien(lop, m1, 5, (20, 20, 20)); to(lop, m1, doc_trong((255, 255, 255), (235, 235, 235), (190, 190, 190), h1))
    day = h1[3]
    if cuoi:
        dong2 = [cuoi]; m2, h2 = mat_chu(dong2, f2, day + 6, 1.0)
        bong(lop, m2, (6, 10), 10, 210); vien(lop, m2, 5, (40, 0, 0)); to(lop, m2, doc_trong((255, 120, 110), (230, 30, 30), (150, 10, 10), h2)); day = h2[3]
    return lop, day
def dt_ten_nut_vang(c):
    """tên hai tầng (từ khoá đỏ) giữa khung + nút bo tròn WATCH NOW viền vàng ngay dưới (kiểu Undercover Prison King, 45 ngày)"""
    lop, day = _ten_hai_tang(c, c["mat_day"] + 40)
    nut(lop, "WATCH NOW" if c["lang"] != "es" else "VER AHORA", day + 34, ph("impact", 64), (25, 20, 15), (255, 222, 140), (214, 160, 50), (60, 18)); return None, lop
def dt_key_art_neon(c):
    """BỐ CỤC: nền chuyển đỏ–tím rực có tia sáng + lưới rào, 2 nhân vật tách nền chồng lớp (to sau, nhỏ trước), câu nhử trên đỉnh tô đỏ một từ, tên + nút dưới"""
    BC = _nap("bo_cuc_po", "bo-cuc-po.py")
    nen = doc((40, 8, 70), (150, 20, 60), (20, 4, 30)).convert("RGBA"); d = ImageDraw.Draw(nen)
    for i in range(14):   # tia sáng từ trên phải
        a = math.radians(200 + i * 9); x2, y2 = W * 0.85 + math.cos(a) * 2600, H * 0.08 + math.sin(a) * -2600
        tia = Image.new("RGBA", (W, H)); ImageDraw.Draw(tia).polygon([(W * 0.85, H * 0.08), (x2, y2), (x2 + 120, y2 + 60)], fill=(255, 90, 160, 26)); nen.alpha_composite(tia)
    luoi = Image.new("RGBA", (W, H)); dl = ImageDraw.Draw(luoi)
    for k in range(-H, W, 70): dl.line([(k, H), (k + H, 0)], fill=(0, 0, 0, 70), width=3); dl.line([(k, 0), (k + H, H)], fill=(0, 0, 0, 70), width=3)
    nen.alpha_composite(luoi.filter(ImageFilter.GaussianBlur(1)))
    goc = [c["goc"]] + c.get("goc_khac", [])[:1]
    for i, g in enumerate(goc[::-1]):   # nhân vật phụ (sau, to, mờ tối) rồi nhân vật chính (trước)
        nguoi = BC.tach(Image.open(g).convert("RGB")); bb = nguoi.getchannel("A").getbbox()
        if not bb: continue
        nguoi = nguoi.crop(bb); cao = int(H * (0.62 if i == len(goc) - 1 else 0.78)); nguoi = nguoi.resize((int(nguoi.width * cao / nguoi.height), cao), Image.LANCZOS)
        if i < len(goc) - 1:   # nhân vật nền: tối, ngả đỏ tím, mờ dần xuống dưới — làm nền cho nhân vật chính, không giành mắt
            a = nguoi.getchannel("A"); nguoi = ImageOps.colorize(nguoi.convert("L"), (8, 0, 12), (150, 60, 90)).convert("RGBA")
            mo = Image.new("L", (1, 256)); mo.putdata([255 if v < 150 else max(0, 255 - (v - 150) * 3) for v in range(256)])
            nguoi.putalpha(ImageChops.multiply(a.point(lambda v: v * 210 // 255), mo.resize(nguoi.size)))
        x = (W - nguoi.width) // 2 + (140 if i < len(goc) - 1 else -40); y = int(H * (0.06 if i < len(goc) - 1 else 0.20))
        vien_sang = Image.new("RGBA", nguoi.size, (255, 80, 120, 0)); vien_sang.putalpha(nguoi.getchannel("A").filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(12)))
        nen.alpha_composite(vien_sang, (x, y)); nen.alpha_composite(nguoi, (x, y))
    duoi = Image.new("L", (1, 256)); duoi.putdata([0 if i < 150 else min(235, (i - 150) * 3) for i in range(256)])
    nen = Image.composite(Image.new("RGBA", (W, H), (10, 0, 15, 255)), nen, duoi.resize((W, H)))
    ra = os.path.join(c["tm"], f"nen-{c['ma']}.png"); nen.convert("RGB").save(ra)
    lop = Image.new("RGBA", (W, H)); _cau_dinh(lop, c, "arial_b", 50, H * 0.035, (255, 255, 255))
    l2, day = _ten_hai_tang({**c, "mat_day": H * 0.66}, H * 0.66); lop.alpha_composite(l2)
    nut(lop, "WATCH NOW" if c["lang"] != "es" else "VER AHORA", day + 30, ph("din", 76), (60, 8, 16), (255, 255, 255), (230, 40, 60), (70, 16), bo_tron=18); return ra, lop
def _cau_dinh(lop, c, ten_ph, co, y, mau, mau_nhan=(235, 40, 40)):
    """câu nhử trên đỉnh, MỘT từ tô đỏ"""
    f, dong = vua(c["cau"], ten_ph, W - 140, co, 2, 36); d = ImageDraw.Draw(lop); cao = int(f.size * 1.18); nhan = c["nhan"].lower().strip(".,!?¡¿")
    for i, t in enumerate(dong):
        x = (W - f.getlength(t)) / 2; yy = y + i * cao
        for tu in t.split(" "):
            ms = mau_nhan if tu.lower().strip(".,!?¡¿") == nhan else mau
            d.text((x + 3, yy + 4), tu, font=f, fill=(0, 0, 0, 200)); d.text((x, yy), tu, font=f, fill=ms + (255,)); x += f.getlength(tu + " ")
    return y + cao * len(dong)
def dt_cau_nhu_dinh(c):
    """câu nhử chữ có chân nghiêng trắng ở đỉnh khung, một từ tô đỏ; cảnh phim sạch phía dưới (kiểu What If I'm One Hell of a Fighter)"""
    lop = Image.new("RGBA", (W, H)); toi = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(toi)
    for r in range(int(H * 0.22)): d.line([(0, r), (W, r)], fill=(0, 0, 0, int(170 * (1 - r / (H * 0.22)))))
    lop.alpha_composite(toi); _cau_dinh(lop, c, "georgia_bi", 76, H * 0.07, (255, 255, 255))
    if AT.CO_FREE:   # lớp Free chuẩn nhưng chỉ NÚT (nhãn tím trên đỉnh trùng chỗ câu nhử — bản xem trước 19/11/2026 đè nhau)
        f = ImageFont.truetype(AT.FONT_FREE, 84); nut(lop, AT.FREE.get(c["lang"], AT.FREE["en"])[1], int(H * 0.70), f, AT.XANH, (255, 255, 255), None, (70, 34), bo_tron=40)
    return None, lop
def dt_su_thi(c):
    """BỐ CỤC: khung tối + viền tối (vignette) + chấm lửa, tên phim chữ có chân khắc ánh kim + dòng nhỏ 'A FANTASY ROMANCE EPIC' (kiểu Their Brother, the Dragon Sacrifice)"""
    nen = Image.open(c["nen"]).convert("RGB").point(lambda v: int(v * 0.8))
    vg = Image.new("L", (W, H)); ImageDraw.Draw(vg).ellipse((-W * 0.3, -H * 0.15, W * 1.3, H * 1.05), fill=255); vg = vg.filter(ImageFilter.GaussianBlur(160))
    nen = Image.composite(nen, Image.new("RGB", (W, H), (12, 6, 4)), vg).convert("RGBA")
    rng = random.Random(c["cid"]); tl = Image.new("RGBA", (W, H)); dt = ImageDraw.Draw(tl)
    for _ in range(140): x, y, r = rng.randint(0, W), rng.randint(0, H), rng.choice([2, 3, 4]); dt.ellipse((x - r, y - r, x + r, y + r), fill=(255, rng.randint(120, 200), 40, rng.randint(90, 200)))
    nen.alpha_composite(tl.filter(ImageFilter.GaussianBlur(1))); ra = os.path.join(c["tm"], f"nen-{c['ma']}.png"); nen.convert("RGB").save(ra)
    lop = Image.new("RGBA", (W, H)); f, dong = vua(c["ten"].upper(), "didot", W - 120, 130, 3)
    cao = int(f.size * 1.0) * len(dong); y = int(H * 0.80 - cao); m, hop = mat_chu(dong, f, y, 1.0)
    bong(lop, m, (5, 8), 12, 230); vien(lop, m, 4, (40, 20, 5)); to(lop, m, doc_trong((255, 236, 190), (205, 150, 70), (120, 70, 20), hop)); sang_khoi(lop, m)
    f2 = ph("didot", 34); t2 = nhan_tl(c["p"]); d = ImageDraw.Draw(lop); x = (W - f2.getlength(t2)) / 2
    d.text((x, hop[3] + 26), t2, font=f2, fill=(235, 205, 150, 255)); d.line([(W * 0.25, hop[3] + 14), (W * 0.75, hop[3] + 14)], fill=(220, 180, 110, 200), width=2); return ra, lop
def dt_hanh_dong_kim_loai(c):
    """tên phim chữ hẹp nghiêng đậm kiểu phim hành động, mặt kim loại xước, viền tối (kiểu American Sniper: The Last Round)"""
    lop0 = Image.new("RGBA", (W, H)); f, dong = vua(c["ten"].upper(), "impact", W - 160, 140, 3)
    cao = int(f.size * 0.98) * len(dong); y = int(max(H * 0.58, min(H * 0.80 - cao, c["mat_day"] + 40))); m, hop = mat_chu(dong, f, y, 0.98)
    xuoc = doc_trong((250, 250, 252), (170, 176, 186), (90, 96, 108), hop); rng = random.Random(c["cid"]); dx = ImageDraw.Draw(xuoc)
    for _ in range(400): x, yy = rng.randint(0, W), rng.randint(hop[1], max(hop[1] + 1, hop[3])); dx.line([(x, yy), (x + rng.randint(10, 60), yy + rng.randint(-2, 2))], fill=(255, 255, 255) if rng.random() < 0.5 else (60, 60, 70), width=1)
    bong(lop0, m, (8, 12), 12, 230); vien(lop0, m, 6, (15, 15, 20)); to(lop0, m, xuoc); sang_khoi(lop0, m, (255, 255, 255), (20, 20, 30))
    lop = lop0.transform((W, H), Image.AFFINE, (1, 0.18, -0.18 * (y + cao / 2), 0, 1, 0), Image.BICUBIC)   # nghiêng chữ
    return None, AT.lop_free(lop, c["lang"], hop[3]) if AT.CO_FREE else lop
def dt_khung_player(c):
    """BỐ CỤC: cảnh phim đặt giữa hai dải đen như màn hình trình phát, nút play đỏ ở giữa, nhãn EXCLUSIVE + tên phim phía dưới (kiểu American Sniper, 15 ngày)"""
    goc = Image.open(c["nen"]).convert("RGB"); bang_h = int(H * 0.42); y0 = int(H * 0.27)
    s = max(W / goc.width, bang_h / goc.height); g = goc.resize((round(goc.width * s), round(goc.height * s)), Image.LANCZOS)
    cy = int(min(max(0, c["mat_tam"] * g.height - bang_h / 2), g.height - bang_h)); g = g.crop((0, cy, W, cy + bang_h))
    nen = Image.new("RGB", (W, H), (8, 8, 10)); mo = goc.resize((W, H)).filter(ImageFilter.GaussianBlur(40)).point(lambda v: v // 4); nen.paste(mo); nen.paste(g, (0, y0))
    ra = os.path.join(c["tm"], f"nen-{c['ma']}.png"); nen.save(ra)
    lop = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lop); cx, cy2, r = W // 2, y0 + bang_h // 2, 92
    d.ellipse((cx - r, cy2 - r, cx + r, cy2 + r), fill=(230, 30, 40, 240)); d.polygon([(cx - 30, cy2 - 46), (cx - 30, cy2 + 46), (cx + 50, cy2)], fill=(255, 255, 255, 255))
    d.rectangle((0, y0 + bang_h - 10, W, y0 + bang_h - 4), fill=(255, 255, 255, 90)); d.rectangle((0, y0 + bang_h - 10, int(W * 0.34), y0 + bang_h - 4), fill=(230, 30, 40, 255))
    yy = y0 + bang_h + 60; f = ph("arial_b", 40); t = "EXCLUSIVE"; w = f.getlength(t) + 80; d.rounded_rectangle(((W - w) / 2, yy, (W + w) / 2, yy + 70), radius=12, fill=(230, 30, 40, 255))
    d.text(((W - f.getlength(t)) / 2, yy + 12), t, font=f, fill=(255, 255, 255, 255))
    f2, dong = vua(c["ten"].upper(), "impact", W - 140, 110, 3); m, hop = mat_chu(dong, f2, yy + 110, 1.0); bong(lop, m); to(lop, m, (255, 255, 255))
    _cau_dinh(lop, c, "arial_b", 54, y0 - 170, (255, 255, 255)); return ra, lop
def dt_dai_free(c):
    """dải trắng mảnh trên đỉnh chữ đen 'WATCH MOVIES NOW! FREE' — báo miễn phí ngay giây đầu, cảnh phim giữ nguyên (kiểu My Billionaire Boss, 32 ngày)"""
    lop = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lop); t = "WATCH MOVIES NOW! FREE" if c["lang"] != "es" else "¡MIRA PELÍCULAS AHORA! GRATIS"
    f = ph("arial_black", 46); d.rectangle((0, int(H * 0.035), W, int(H * 0.035) + 92), fill=(255, 255, 255, 255)); d.text(((W - f.getlength(t)) / 2, int(H * 0.035) + 18), t, font=f, fill=(10, 10, 10, 255))
    f2, dong = vua(c["ten"], "georgia_bi", W - 160, 96, 3); cao = int(f2.size * 1.08) * len(dong); y = int(H * 0.80 - cao)
    m, _ = mat_chu(dong, f2, y); bong(lop, m); vien(lop, m, 4, (0, 0, 0)); to(lop, m, (255, 255, 255)); return None, lop
def dt_theo_mua(c):
    """BỐ CỤC theo mùa (Giáng sinh): khung phim + tuyết rơi + viền ánh đèn ấm, tên phim nhiều tầng + nút WATCH NOW viền vàng (kiểu Found A Homeless Billionaire for Christmas)"""
    nen = Image.open(c["nen"]).convert("RGBA"); rng = random.Random(c["cid"]); tuyet = Image.new("RGBA", (W, H)); dt = ImageDraw.Draw(tuyet)
    for _ in range(420): x, y, r = rng.randint(0, W), rng.randint(0, H), rng.choice([2, 3, 3, 4, 6]); dt.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, rng.randint(120, 230)))
    nen.alpha_composite(tuyet.filter(ImageFilter.GaussianBlur(0.8)))
    den = Image.new("RGBA", (W, H)); dd = ImageDraw.Draw(den)
    for i in range(0, W, 54): dd.ellipse((i, 18, i + 22, 40), fill=[(255, 60, 60, 230), (255, 210, 80, 230), (80, 220, 120, 230)][i // 54 % 3])
    nen.alpha_composite(den.filter(ImageFilter.GaussianBlur(2))); nen.alpha_composite(den)
    ra = os.path.join(c["tm"], f"nen-{c['ma']}.png"); nen.convert("RGB").save(ra)
    lop = Image.new("RGBA", (W, H)); f, dong = vua(c["ten"].upper(), "impact", W - 140, 112, 3); cao = int(f.size * 1.0) * len(dong)
    y = int(max(H * 0.56, min(H * 0.76 - cao, c["mat_day"] + 40))); m, hop = mat_chu(dong, f, y, 1.0)
    bong(lop, m); vien(lop, m, 6, (120, 10, 20)); to(lop, m, doc_trong((255, 255, 255), (255, 240, 220), (240, 210, 180), hop))
    nut(lop, "WATCH NOW" if c["lang"] != "es" else "VER AHORA", hop[3] + 40, ph("impact", 62), (25, 20, 15), (255, 222, 140), (214, 160, 50), (60, 18)); return ra, lop
def dt_logo_goc(c):
    """logo tên phim chữ nghiêng nhỏ ở góc trên trái + một dòng 'phụ đề' (câu nhử) trơn giữa dưới — trông như cảnh trích từ phim thật (kiểu Extraordinary Mother of a Billionaire)"""
    lop = Image.new("RGBA", (W, H)); f, dong = vua(c["ten"], "georgia_i", int(W * 0.55), 44, 2, 30); m, _ = mat_chu(dong, f, int(H * 0.04), 1.1, "trai", 50)
    bong(lop, m, (3, 4), 4, 220); to(lop, m, (255, 236, 200))
    f2, d2 = vua(c["cau"], "arial_b", W - 200, 46, 2, 34); m2, _ = mat_chu(d2, f2, int(H * 0.70), 1.15); vien(lop, m2, 3, (0, 0, 0)); to(lop, m2, (255, 255, 255)); return None, lop
def dt_nut_free_do(c):
    """nút bo tròn đỏ nhỏ 'Watch Free' đặt 1/3 dưới, đè thẳng lên cảnh phim — không tên phim, không nền (kiểu Lulu the Little Goddess, 29 ngày)"""
    lop = Image.new("RGBA", (W, H)); nut(lop, "Watch Free" if c["lang"] != "es" else "Ver gratis", int(H * 0.70), ph("arial_b", 52), (229, 36, 54), (255, 255, 255), None, (64, 22)); return None, lop

HAM = {k: v for k, v in globals().items() if k.startswith("dt_") and callable(v)}
CAN_CAU = {"dt_key_art_neon", "dt_cau_nhu_dinh", "dt_khung_player", "dt_logo_goc"}   # mẫu có câu nhử (AI viết)

def ngu_canh(cid, tm_rieng=None):
    p = AT.phim([cid])[0]; lang = "es" if str(p.get("locale")).startswith("es") else "en"; ten = ten_chu(p)
    tm = os.path.join(AT.C, str(cid)); os.makedirs(tm, exist_ok=True)
    the_loai = AT.sql(f"select coalesce(the_loai, '') from etp.phim where content_id = {int(cid)}"); p["the_loai"] = the_loai
    return p, lang, ten, tm

_NHO = {}
def mot(ma, cid, xem=False, ban=1):
    """dựng ban bản theo mẫu ma cho phim cid → danh sách creative_id (xem=True: chỉ tệp)"""
    if ma not in HAM: raise SystemExit(f"mẫu {ma} chưa có hàm vẽ trong dung-mau.py")
    muc = next((x for x in SO if x["ma"] == ma), None)
    if not muc: raise SystemExit(f"mẫu {ma} không có trong sổ")
    dang = "poster động" if muc["loai"] == "bo_cuc" and "poster động" in muc["dung_cho"] else "ảnh tĩnh"
    tt = (lambda *a, **k: None) if xem else (lambda b, t="dang", g=None, **k: ghi_tt(ma, cid, b, t, g, **k))
    vnd = 0
    try:
        tt("tai_tap", g="tải 3 tập miễn phí + trích khung")
        p, lang, ten, tm = ngu_canh(cid)
        if not p.get("url"): raise RuntimeError("phim chưa có link tập trên Ethopex (etp.phim.url trống) — không tải được tập để dựng; chọn phim khác hoặc đợi đồng bộ có link")
        if cid not in _NHO:   # một phim chỉ tải tập / xếp khung / viết câu nhử MỘT lần trong tiến trình (bảng xem trước vẽ 12 mẫu)
            uv = AT.khung(cid, p["url"], tm)
            tt("chon_khung", g=f"{len(uv)} khung ứng viên → AI xếp hạng")
            uv, _, v = AT.xep_ai(ten, uv) if len(uv) > 1 else (uv, "", 0); vnd += v
            _NHO[cid] = {"uv": uv}
        uv = _NHO[cid]["uv"]
        if ma in CAN_CAU and "cau" not in _NHO[cid]: c_, n_, v = cau_nhu(ten, TB.mo_ta(p["url"]), lang); vnd += v; _NHO[cid]["cau"] = (c_, n_)
        cau, nhan = _NHO[cid].get("cau", ("", "")) if ma in CAN_CAU else ("", "")
        cr = []
        for b in range(ban):
            k = uv[b % len(uv)]; k["lang"] = lang
            tt("ve_mau", g=f"bản {b + 1}/{ban}: vẽ mẫu trên khung {k['tap']}#{k['so']}")
            AT.CO_FREE, cu = False, AT.CO_FREE   # nền sạch không lớp Free — mẫu tự quyết lớp CTA của nó
            try: nen, _ = AT.anh(cid, ten, k, tm, 100 + b)
            finally: AT.CO_FREE = cu
            goc = os.path.join(tm, f"goc-{100 + b}.png"); khac = [os.path.join(tm, f"goc-{200 + b}.png")]
            if ma == "dt_key_art_neon" and len(uv) > 1:   # nhân vật thứ hai từ khung xếp hạng kế
                k2 = uv[(b + 1) % len(uv)]; AT.sh("ffmpeg", "-v", "error", "-y", "-ss", "3", "-i", os.path.join(tm, k2["tap"] + ".mp4"), "-vf", f"{AT.LOC},select=eq(n\\,{k2['so'] - 1})", "-frames:v", "1", khac[0])
            c = {"ma": ma, "cid": cid, "p": p, "lang": lang, "ten": ten, "tm": tm, "nen": nen, "goc": goc, "goc_khac": [x for x in khac if os.path.exists(x)],
                 "mat_day": (k["mat"][1] + k["mat"][3]) * H, "mat_tam": k["mat"][1] + k["mat"][3] / 2, "cau": cau, "nhan": nhan}
            nen2, lop = HAM[ma](c); nen = nen2 or nen
            chu = os.path.join(tm, f"chu-{ma}-{b}.png"); lop.save(chu)
            out = os.path.join(tm, f"{ma}-{cid}-{b + 1}.mp4")
            if xem:   # xem: ảnh ghép tĩnh, không giọng
                Image.alpha_composite(Image.open(nen).convert("RGBA"), lop).convert("RGB").save(out.replace(".mp4", ".jpg"), quality=88); cr.append(out.replace(".mp4", ".jpg")); continue
            tt("giong", g="giọng đọc (cổng giọng chung)")
            kg = AT.xoay_giong([p], None)[cid]; mp3, v, _ = AT.giong(cid, lang, ten, kg, tm, b % len(AT.CAU[lang])); vnd += v
            tt("video", g="dựng video 1080×1920")
            giay = AT.dung(nen, chu, mp3, out)
            tt("thu_vien", g=f"nạp thư viện ({giay}s)")
            tv = TB.nap(cid, lang, out, dang, f"mẫu:{ma} · {muc['ten']} · bản {b + 1}/{ban} · khung {k['tap']}#{k['so']}", v)
            if not tv: raise RuntimeError("nạp thư viện không ra mã")
            AT.sql(f"update etp.mau_dung set tv_ids = array_append(tv_ids, {int(tv)}) where mau = {s_(ma)} and content_id = {int(cid)}")
            tt("creative", g=f"tải lên Ethopex qua cổng mẫu (tv{tv})")
            subprocess.run(["python3", os.path.join(D, "thu-vien-len.py"), str(tv)], check=False)
            c_id = AT.sql(f"select coalesce(creative_id::text, '') from etp.thu_vien where id = {int(tv)}")
            if c_id: cr.append(int(c_id)); AT.sql(f"update etp.mau_dung set creative_ids = array_append(creative_ids, {int(c_id)}) where mau = {s_(ma)} and content_id = {int(cid)}")
        if not xem:
            if cr: tt("xong", "xong", f"{len(cr)} creative: " + ", ".join(f"#{x}" for x in cr), vnd=vnd)
            else: tt("creative", "loi", "dựng xong nhưng không thành creative (cổng chữ / studio loại) — xem nhật ký", vnd=vnd)
        return cr
    except Exception as e:
        if not xem: tt("loi", "loi", f"{type(e).__name__}: {str(e)[:300]}", vnd=vnd)
        raise

def hang():
    """mọi phim anh chọn (etp.mau_phim) cho mẫu có hàm vẽ ở đây mà chưa dựng xong / chưa đang dựng"""
    ds = AT.sql(bang_sql() + " select m.mau || ':' || m.content_id from etp.mau_phim m left join etp.mau_dung d using (mau, content_id) "
                f"where m.mau in ({','.join(s_(x) for x in HAM)}) and (d.mau is null or d.trang_thai = 'cho') order by m.luc")
    for l in [x for x in (ds or "").splitlines() if ":" in x]:
        ma, cid = l.split(":")
        try: mot(ma, int(cid))
        except Exception: traceback.print_exc()

def bang_xem(cid):
    """mọi mẫu trên một phim → ảnh ghép xem trước (không giọng, không nạp)"""
    anh = []
    for ma in HAM:
        try: anh += [(ma, f) for f in mot(ma, cid, xem=True)]
        except Exception as e: print("✗", ma, e, file=sys.stderr)
    tm = ngu_canh(cid)[3]; o = 360; ra = Image.new("RGB", (o * 6, int(o * 16 / 9 + 40) * 2), (20, 20, 20)); d = ImageDraw.Draw(ra); f = ph("arial_b", 20)
    for i, (ma, fp) in enumerate(anh[:12]):
        im = Image.open(fp).convert("RGB").resize((o, int(o * 16 / 9))); x, y = (i % 6) * o, (i // 6) * (int(o * 16 / 9) + 40); ra.paste(im, (x, y)); d.text((x + 8, y + int(o * 16 / 9) + 8), ma, font=f, fill=(255, 255, 255))
    out = os.path.join(tm, "bang-mau.jpg"); ra.save(out, quality=85); print(out)

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    if a[0] == "--hang": hang()
    elif a[0] == "--bang": bang_xem(int(a[1]))
    else: print(json.dumps(mot(a[0], int(a[1]), "--xem" in a, int(a[a.index("--ban") + 1]) if "--ban" in a else 1)))
