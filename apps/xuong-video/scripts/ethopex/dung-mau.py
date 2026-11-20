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
import colorsys, importlib.util, json, math, os, random, re, subprocess, sys, traceback, urllib.error, urllib.request
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

D = os.path.dirname(os.path.abspath(__file__))
def _nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(D, tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
AT = _nap("anh_tinh", "anh-tinh.py"); TB = _nap("tinh_ba_kieu", "tinh-ba-kieu.py")
W, H = AT.W, AT.H
SO = json.load(open(os.path.join(D, "..", "..", "..", "etp2", "src", "lib", "etp-mau-cr.json"), encoding="utf-8"))["mau"]
F = "/System/Library/Fonts/Supplemental/"
PH = {"impact": ("Impact.ttf", 0), "arial_black": ("Arial Black.ttf", 0), "didot": ("Didot.ttc", 0), "bodoni": ("Bodoni 72.ttc", 0), "copper": ("Copperplate.ttc", 2),
      "basker": ("Baskerville.ttc", 4), "basker_ng": ("Baskerville.ttc", 5), "georgia_bi": ("Georgia Bold Italic.ttf", 0), "georgia_i": ("Georgia Italic.ttf", 0),
      "din": ("DIN Condensed Bold.ttf", 0), "futura": ("Futura.ttc", 4), "arial_b": ("Arial Bold.ttf", 0), "snell": ("SnellRoundhand.ttc", 2), "didot_b": ("Didot.ttc", 2)}
# VÙNG AN TOÀN (Meta, 9:16 Reels / Stories): ~14% trên cùng bị thanh tiêu đề + tên Page che, ~20–35% dưới cùng bị chữ QC + nút — chữ trên đỉnh đặt từ TREN_AN
TREN_AN = 0.12
def ph(ten, co): f, i = PH[ten]; return ImageFont.truetype(F + f, co, index=i)

# ---------- trạng thái ----------
def bang_sql():
    return ("create table if not exists etp.mau_dung (mau text not null, content_id integer not null, buoc text not null default 'cho', trang_thai text not null default 'cho', "
            "ghi text, creative_ids integer[] not null default '{}', tv_ids integer[] not null default '{}', vnd integer not null default 0, bat_dau timestamptz, "
            "cap_nhat timestamptz not null default now(), primary key (mau, content_id)); "
            # NHẬT KÝ (anh 19/11/2026 "Bấm vào từng phim đang sx thì xem đc chi tiết các bước, các vấn đề theo timeline"): mỗi lần đổi bước / lỗi một dòng
            "create table if not exists etp.mau_dung_nk (id bigserial primary key, mau text not null, content_id integer not null, luc timestamptz not null default now(), "
            "buoc text not null, trang_thai text not null, ghi text, may text); create index if not exists mau_dung_nk_viec on etp.mau_dung_nk (mau, content_id, luc);")
def s_(v): return "null" if v is None else "$Q$" + str(v).replace("$Q$", "") + "$Q$"
def ghi_tt(mau, cid, buoc, tt="dang", ghi=None, **k):
    them = "".join(f", {c} = {v}" for c, v in k.items())
    AT.sql(bang_sql() + f" insert into etp.mau_dung (mau, content_id, buoc, trang_thai, ghi, bat_dau) values ({s_(mau)}, {int(cid)}, {s_(buoc)}, {s_(tt)}, {s_(ghi)}, now()) "
           f"on conflict (mau, content_id) do update set buoc = excluded.buoc, trang_thai = excluded.trang_thai, ghi = excluded.ghi, cap_nhat = now(){them}; "
           f"insert into etp.mau_dung_nk (mau, content_id, buoc, trang_thai, ghi, may) values ({s_(mau)}, {int(cid)}, {s_(buoc)}, {s_(tt)}, {s_(ghi)}, {s_(os.uname().nodename.split('.')[0])})")
    print(f"[{mau} · {cid}] {buoc} · {tt}{' · ' + ghi if ghi else ''}", flush=True)

def ghi_poster(cid, url, tm=None):
    """POSTER GỐC CỦA PHIM (anh 19/11/2026 "POSTER GỐC CỦA PHIM ĐANG CHỌN CƠ MÀ"): ảnh poster.jpg tai-tap đã tải về thư mục phim (og:image trang phim công khai) → thu còn rộng 540,
    ghi THẲNG BẢN ẢNH (base64) + link gốc vào etp.phim_poster → ngăn dựng theo mẫu etp2 đặt cạnh creative máy dựng để so. Ghi bản ảnh chứ không chỉ link vì máy chủ ảnh
    ReelShort trả trang chặn (HTML) cho nơi khác gọi — gắn link trực tiếp ra ô đen. Hỏng thì báo ra stderr, không chặn việc dựng."""
    try:
        import base64, io
        tm = tm or os.path.expanduser(f"~/.cache/ethopex/anh-tinh/{int(cid)}"); po = os.path.join(tm, "poster.jpg")
        if not os.path.exists(po): print(f"poster gốc phim {cid}: chưa có {po}", file=sys.stderr); return None
        im = Image.open(po).convert("RGB"); im.thumbnail((540, 1200)); b = io.BytesIO(); im.save(b, "JPEG", quality=82)
        link = None
        try: TT = _nap("tai_tap", "tai-tap.py"); link = TT.og_anh(TT.mo_rong(url)) if url else None
        except Exception as e: print(f"poster gốc phim {cid}: không đọc được link gốc ({e}) — vẫn ghi bản ảnh", file=sys.stderr)
        AT.sql("create table if not exists etp.phim_poster (content_id integer primary key, url text not null, luc timestamptz not null default now()); "
               "alter table etp.phim_poster add column if not exists anh_b64 text; "
               f"insert into etp.phim_poster (content_id, url, anh_b64) values ({int(cid)}, {s_(link or '')}, {s_(base64.b64encode(b.getvalue()).decode())}) "
               "on conflict (content_id) do update set url = excluded.url, anh_b64 = excluded.anh_b64, luc = now()")
        return len(b.getvalue())
    except Exception as e: print(f"poster gốc phim {cid} lỗi: {e}", file=sys.stderr); return None

# ---------- câu nhử (cổng AI chung, haiku rẻ) ----------
def cau_nhu(ten, mo_ta, lang, tranh=()):
    """câu nhử 4–10 chữ + MỘT từ nhấn (tô đỏ) — kiểu 'To fight crime, he became a criminal'. Chữ trơn hai dòng HOOK / WORD (19/11/2026: khuôn JSON qua tuyến
    rẻ bị điền lệch ô — 'cau' ra lại đề bài, câu thật lạc sang 'nhan'), kiểm độ dài, hỏng thì gọi lại một lần; hai lần hỏng → câu dự phòng (báo to)."""
    k = dict(l.strip().split("=", 1) for l in open(os.path.expanduser("~/.secrets/cong-ai.env")) if "=" in l)["CONG_AI_KEY"].strip().strip('"')
    de = (f"Short drama: {ten}\nSynopsis: {mo_ta[:700]}\n\nWrite ONE intriguing movie-poster hook line in {'Spanish' if lang == 'es' else 'English'} (4-10 words, no spoiler of the ending, "
          "no quotes, no emoji, do not repeat the title). Then the single most dramatic word of that line.\nAnswer EXACTLY two lines:\nHOOK: <line>\nWORD: <word>"
          + ("\n\nEarlier ads for this drama already used these hooks - write a clearly DIFFERENT angle (another character, another emotion or another story beat):\n- " + "\n- ".join(tranh[-6:]) if tranh else ""))
    chi = 0
    for lan in range(2):
        try:
            r = urllib.request.urlopen(urllib.request.Request("https://spy.on.tc/api/ai", method="POST", headers={"authorization": f"Bearer {k}", "content-type": "application/json", "user-agent": "Mozilla/5.0 dung-mau"},
                data=json.dumps({"viec": "etp-dung-mau", "model": "haiku", "max_tokens": 120, "noi_dung": de, "bo_chinh_hang": True}).encode()), timeout=120)
            j = json.loads(r.read()); chi += round((j.get("chi_usd") or 0) * 26000); t = str(j.get("kq") or "")
            h = re.search(r"HOOK:\s*(.+)", t); w = re.search(r"WORD:\s*([^\s]+)", t)
            cau = (h.group(1).strip().strip('"“”').rstrip(".") if h else ""); nhan = (w.group(1).strip('"“”.,!') if w else "")
            if 4 <= len(cau.split()) <= 10 and ten.lower() not in cau.lower() and not re.search(r"(?i)hook|poster|line", cau) and cau.lower() not in [x.lower() for x in tranh]:
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
def nut(lop, chu, y, f, nen, chu_mau=(255, 255, 255), vien_mau=None, dem=(56, 26), bo_tron=None, rong_min=0, x_tam=None):
    d = ImageDraw.Draw(lop); x0, y0, x1, y1 = f.getbbox(chu); w = max(rong_min, x1 - x0 + 2 * dem[0]); h = y1 - y0 + 2 * dem[1]; x = int((x_tam or W / 2) - w / 2)
    r = bo_tron if bo_tron is not None else h // 2
    bo = Image.new("RGBA", (W, H)); ImageDraw.Draw(bo).rounded_rectangle((x + 4, y + 10, x + w + 4, y + h + 10), radius=r, fill=(0, 0, 0, 150)); lop.alpha_composite(bo.filter(ImageFilter.GaussianBlur(12)))
    if vien_mau: d.rounded_rectangle((x - 6, y - 6, x + w + 6, y + h + 6), radius=r + 6, fill=vien_mau)
    d.rounded_rectangle((x, y, x + w, y + h), radius=r, fill=nen)
    d.text((x + (w - (x1 - x0)) / 2 - x0, y + dem[1] - y0), chu, font=f, fill=chu_mau); return y + h
def dat_y(c, cao, lo_min=0.56, lo_max=0.86):
    """CHỮ KHÔNG CHE MẶT (luật nhà; 19/11/2026 American Sniper: tên phim đè mặt đứa trẻ vì máy chỉ né mặt LỚN NHẤT): khoảng trống không có mặt nào trên khung —
    ưu tiên DƯỚI mặt thấp nhất (trong [lo_min, lo_max] chiều cao), hết chỗ thì TRÊN mặt cao nhất (dưới vùng che của Reels), cả hai không đủ thì sát đáy cho phép."""
    mats = c.get("mats") or [(c["mat_day"] - 1, c["mat_day"])]
    duoi = max(b for _, b in mats) + 30; tren = min(a for a, _ in mats) - 30
    y = max(H * lo_min, duoi)
    if y + cao <= H * lo_max: return int(y)
    if tren - cao >= H * (TREN_AN + 0.06): return int(tren - cao)
    return int(H * lo_max - cao)

def khe(c, cao, lo_min=0.56, lo_max=0.86):
    """vị trí y trong một khoảng trống KHÔNG có mặt đủ chứa khối cao `cao`, hoặc None"""
    mats = c.get("mats") or [(c["mat_day"] - 1, c["mat_day"])]
    duoi = max(H * lo_min, max(b for _, b in mats) + 30); tren = min(a for a, _ in mats) - 30
    if duoi + cao <= H * lo_max: return int(duoi)
    if tren - cao >= H * (TREN_AN + 0.06): return int(tren - cao)
    return None

def dat_chu(c, chu, ten_ph, rong, co, toi_da=3, gian=1.0, them=0, lo_min=0.56, lo_max=0.86):
    """chia dòng + CO CHỮ cho tới khi khối chữ vừa một khoảng trống không có mặt (chữ không che mặt) → (phông, dòng, y). Không cỡ nào vừa → cỡ nhỏ nhất ở vị trí đỡ nhất."""
    f = dong = None
    for co_thu in range(co, 47, -6):
        f, dong = vua(chu, ten_ph, rong, co_thu, toi_da)
        y = khe(c, int(f.size * gian) * len(dong) + them, lo_min, lo_max)
        if y is not None: return f, dong, y
    return f, dong, dat_y(c, int(f.size * gian) * len(dong) + them, lo_min, lo_max)

def ten_chu(p):
    return AT.ten_sach(p["ten"])
def nhan_tl(p):
    """nhãn thể loại cho dòng phụ sử thi"""
    tl = (p.get("the_loai") or "").lower()
    return {"fantasy": "A FANTASY ROMANCE EPIC", "soi": "A WEREWOLF ROMANCE", "co_trang": "AN EPIC TALE OF THE EMPIRE", "mafia": "A MAFIA LOVE STORY", "vien_tuong": "A SCI-FI ADVENTURE"}.get(tl, "AN EPIC SHORT DRAMA")

# ---------- 12 MẪU (mã = sổ etp-mau-cr.json) — mỗi hàm: (ngữ cảnh) → (nền.png hoặc None = nền khung phim thường, lớp chữ RGBA) ----------
def dt_ten_vang(c):
    """tên phim chữ vàng bóng nổi khối đặt 1/3 dưới, đè thẳng lên khung — không nền, không nút (kiểu Step Back! Hidden King / Great and Powerful Genie, 92 ngày)"""
    lop = Image.new("RGBA", (W, H)); f, dong, y = dat_chu(c, c["ten"], "georgia_bi", W - 120, 150, 3, 1.02, 0, 0.60)
    m, hop = mat_chu(dong, f, y, 1.02); bong(lop, m, (8, 12), 14, 220); vien(lop, m, 7, (70, 38, 6))
    to(lop, m, doc_trong((255, 246, 200), (232, 172, 52), (176, 104, 18), hop)); sang_khoi(lop, m); return None, lop
# CHUẨN MẪU "LOGO GỐC CỦA PHIM" (anh 20/11/2026 "Vấn đề về vị trí chữ, cắt rồi ghép thì sao ? Hãy chuẩn hoá cho mẫu creative này trước") — một bộ số cố định, không chỉnh theo phim:
LOGO_RONG = 0.90      # logo rộng 90% khung (bản dải: tràn đủ bề ngang khung)
LOGO_CAO = 0.26       # nhưng không cao quá 26% khung
LOGO_VUNG = (0.56, 0.86)   # logo chỉ nằm trong dải 56–86% chiều cao: dưới mặt, trên vùng nút / chú thích của Reels
LOGO_CACH_MAT = 100   # mép trên logo cách đáy mặt thấp nhất ≥ 100px (hộp mặt của máy đọc dừng ở miệng, cằm còn thò ra)
LOGO_CO_MIN = 0.80    # khung chật thì co logo tối đa xuống 80% cỡ chuẩn; vẫn không vừa = khung đó KHÔNG dùng cho mẫu này (máy đổi khung khác, xem chon_khung_cho)
# TẦNG AI của bước tách logo (anh 20/11/2026 "nếu ko đc thì vẫn phải cho AI vào support, dùng mô hình nào rẻ nhất" → "ok. Làm thử đi"): poster nền rối thì nhờ mô hình ảnh
# rẻ nhất của cổng AI chung (Nano Banana: ckey 111₫ → PlenX 200₫, không lùi về chính hãng) vẽ lại poster KHÔNG CHỮ; logo-goc.py lấy logo = chỗ poster gốc lệch nền sạch đó.
# Thử 5 poster nền rối 20/11/2026: 3 ra logo sạch, 2 trượt cổng chất lượng → dải poster. Một lần / phim (nhớ nen-sach.png), tiền cộng vào chi phí bản dựng.
DE_NEN_SACH = ("Recreate this exact poster image without any lettering: the same picture with the title and all words gone. Where the letters were, continue only what is directly behind them. "
               "Keep the dark shading, gradient and vignette behind the title exactly as dark as it is now - do not brighten, clean up or repaint that area. "
               "Everything else stays pixel-identical: same framing and crop, same people and objects at the same position and size, same colours and lighting.")
_CHI_LOGO = [0]   # ₫ tầng AI của các lượt tách logo chưa tính — vòng dựng cộng vào chi phí rồi đặt về 0
def nen_sach_ai(c):
    def lam(poster):
        import base64
        ra = os.path.join(c["tm"], "nen-sach.png")
        if os.path.exists(ra) and os.path.getsize(ra) > 20000: return ra
        TT = _nap("tai_tap", "tai-tap.py"); link = TT.og_anh(TT.mo_rong(c["p"]["url"])) if c.get("p", {}).get("url") else None
        if not link: raise RuntimeError("không có link poster công khai để gửi mô hình ảnh")
        k = dict(l.strip().split("=", 1) for l in open(os.path.expanduser("~/.secrets/cong-ai.env")) if "=" in l)["CONG_AI_KEY"].strip().strip('"')
        try:
            r = urllib.request.urlopen(urllib.request.Request("https://spy.on.tc/api/ai", method="POST", headers={"authorization": f"Bearer {k}", "content-type": "application/json", "user-agent": "Mozilla/5.0 dung-mau"},
                data=json.dumps({"loai": "anh", "viec": "etp-dung-mau", "ma": str(c.get("cid") or ""), "prompt": DE_NEN_SACH, "ti_le": "3:4", "tham_chieu": [link], "bo_chinh_hang": True}).encode()), timeout=400)
            j = json.loads(r.read())
        except urllib.error.HTTPError as e: raise RuntimeError(f"cổng ảnh từ chối: {e.read()[:200].decode('utf8', 'replace')}")
        if not j.get("anh_b64"): raise RuntimeError(f"cổng ảnh không trả ảnh: {str(j.get('loi'))[:160]}")
        open(ra, "wb").write(base64.b64decode(j["anh_b64"])); v = round((j.get("chi_usd") or 0) * 26000); _CHI_LOGO[0] += v
        print(f"logo gốc: nền sạch AI {j.get('model')} {v}₫ → {ra}", flush=True); return ra
    return lam
LOGO_BAN = 4   # đổi cách tách thì tăng số này → logo đã nhớ của mọi phim tách lại
def logo_goc(c):
    """logo gốc đã tách của phim (MỘT lần / phim, nhớ logo-goc.png + .json) → (ảnh RGBA đã đưa về cỡ chuẩn, 'cat' | 'ai' | 'dai'); không tách được → dừng kêu to"""
    ra = os.path.join(c["tm"], "logo-goc.png"); so = ra[:-4] + ".json"; ly = []; kieu = None
    try:
        n = json.load(open(so))
        if n.get("ban") == LOGO_BAN and os.path.exists(ra): kieu = n["kieu"]
    except Exception: pass
    if not kieu:
        tp, kieu = _nap("logo_goc", "logo-goc.py").tach(c["ten"], os.path.join(c["tm"], "poster.jpg"), ra, ly.append, nen_sach_ai(c))
        if not tp: raise RuntimeError(f"không lấy được logo gốc từ poster phim ({'; '.join(ly) or 'không rõ'}) — mẫu Logo gốc không dựng bằng chữ vẽ thay")
        json.dump({"ban": LOGO_BAN, "kieu": kieu, "ghi": ly}, open(so, "w"), ensure_ascii=False)
        print(f"logo gốc: kiểu {kieu}" + (f" · {'; '.join(ly)}" if ly else ""), flush=True)
    lg = Image.open(ra).convert("RGBA"); tl = W / lg.width if kieu == "dai" else min(W * LOGO_RONG / lg.width, H * LOGO_CAO / lg.height)
    return lg.resize((max(1, round(lg.width * tl)), max(1, round(lg.height * tl))), Image.LANCZOS), kieu
# CỔNG CHUNG "CHỮ KHÔNG CHE MẶT" cho MỌI mẫu (anh 20/11/2026 "các mẫu mới tìm thấy hnay từ spy và chưa có quy trình chuẩn thế này thì chuẩn bị luôn"): trước đây mỗi hàm vẽ tự
# né mặt theo toạ độ dọc của khung gốc (đoán), nhiều mẫu vẫn đè mặt khi khung chật. Giờ vòng dựng ĐO trên ảnh thật: máy đọc mặt chạy trên nền cuối (1080×1920, nền riêng của mẫu nếu có)
# → hộp mặt nới 15% → phần lớp chữ / nút phủ lên hộp mặt. Quá CHE_MAT_TOI_DA thì thử khung xếp hạng kế (tối đa KHUNG_THU khung); hết khung vẫn che → DỪNG kêu to, không đăng bản che mặt.
CHE_MAT_TOI_DA = 0.04   # tối đa 4% diện tích hộp mặt bị chữ phủ (mép tóc / cằm chạm nhẹ thì qua)
KHUNG_THU = int(os.environ.get("KHUNG_THU", 10))
def mat_tren(anh):
    """hộp mặt (x0, y0, x1, y1 — điểm ảnh) trên một ảnh 1080×1920, nới 15% mỗi phía"""
    jm = json.loads(subprocess.run([AT.may_doc(), "--mat", anh], capture_output=True, text=True, timeout=300).stdout.strip() or "{}")
    ra = []
    for m in jm.get("mat") or []:
        if m[4] < 0.45 or m[3] < 0.04: continue
        x, y, w, h = m[0] * W, m[1] * H, m[2] * W, m[3] * H
        ra.append((max(0, x - 0.15 * w), max(0, y - 0.15 * h), min(W, x + 1.15 * w), min(H, y + 1.15 * h)))
    return ra
def che_mat(lop, hop):
    """phần (0..1) diện tích hộp mặt bị lớp chữ phủ (alpha > 60) — lấy hộp bị phủ NHIỀU nhất; CHE_MAT_HOP giữ hộp đó để báo lỗi chỉ đúng chỗ"""
    a = lop.split()[3]; toi = 0.0
    for x0, y0, x1, y1 in hop:
        v = a.crop((int(x0), int(y0), int(x1), int(y1))); n = max(1, v.width * v.height); r = sum(1 for t in v.getdata() if t > 60) / n
        if r > toi: toi = r; CHE_MAT_HOP[0] = (int(x0), int(y0), int(x1), int(y1))
    return toi
CHE_MAT_HOP = [None]

def nen_dat_mat(c, tren, duoi):
    """MẪU BỐ CỤC CỐ ĐỊNH (băng trên, tên trên + nút dưới…) chừa một CỬA SỔ cho mặt: dời / co nền để mặt chính nằm giữa cửa sổ [tren, duoi] (px) và không cao quá 80% cửa sổ;
    chỗ hở lấp bằng chính khung phóng to làm mờ tối (kiểu nền mờ QC đối thủ hay dùng). Không đọc ra mặt → giữ nền cũ. → đường dẫn nền mới"""
    hop = mat_tren(c["nen"])
    if not hop: return c["nen"]
    x0, y0, x1, y1 = max(hop, key=lambda b: (b[2] - b[0]) * (b[3] - b[1])); im = Image.open(c["nen"]).convert("RGB")
    z = min(1.0, 0.8 * (duoi - tren) / max(1, y1 - y0)); nho = im.resize((round(W * z), round(H * z)), Image.LANCZOS)
    oy = round((tren + duoi) / 2 - (y0 + y1) / 2 * z); lo, hi = sorted((0, W - nho.width)); ox = round(min(hi, max(lo, W / 2 - (x0 + x1) / 2 * z)))
    if z == 1.0 and abs(oy) < 8: return c["nen"]
    s_ = 1.35; nen = im.resize((round(W * s_), round(H * s_))).crop((round(W * (s_ - 1) / 2), round(H * (s_ - 1) / 2), round(W * (s_ - 1) / 2) + W, round(H * (s_ - 1) / 2) + H))
    nen = ImageEnhance.Brightness(nen.filter(ImageFilter.GaussianBlur(45))).enhance(0.55)
    mk = Image.new("L", nho.size, 0); ImageDraw.Draw(mk).rectangle((30, 30, nho.width - 30, nho.height - 30), fill=255); mk = mk.filter(ImageFilter.GaussianBlur(18))
    for canh, dk in (("tren", oy <= 0), ("duoi", oy + nho.height >= H), ("trai", ox <= 0), ("phai", ox + nho.width >= W)):   # mép chạm mép khung thì không mờ
        if dk: ImageDraw.Draw(mk).rectangle({"tren": (0, 0, nho.width, 40), "duoi": (0, nho.height - 40, nho.width, nho.height), "trai": (0, 0, 40, nho.height), "phai": (nho.width - 40, 0, nho.width, nho.height)}[canh], fill=255)
    nen.paste(nho, (ox, oy), mk); ra = os.path.join(c["tm"], f"nen-dat-{c['ma']}.png"); nen.save(ra); return ra

def logo_cho(c, cao):
    """chỗ đặt một khối cao `cao` dưới mọi mặt của khung → (y, hệ số co) hoặc None nếu co tới LOGO_CO_MIN vẫn không vừa"""
    mats = c.get("mats") or [(c["mat_day"] - 1, c["mat_day"])]; tren = max(H * LOGO_VUNG[0], max(b for _, b in mats) + LOGO_CACH_MAT)
    for k in (1.0, 0.9, LOGO_CO_MIN):
        if tren + cao * k <= H * LOGO_VUNG[1]: return int(tren + (H * LOGO_VUNG[1] - tren - cao * k) * 0.35), k   # lệch nhẹ về phía mặt, không dính đáy
    return None
def dt_logo_chat_lieu(c):
    """LOGO GỐC CỦA PHIM (anh 19/11/2026: "Logo phải giữ nguyên phong cách gốc") — lấy logo từ poster gốc của phim (logo-goc.py: cắt rời khi nền poster êm, không thì nguyên
    dải poster chứa logo mép mờ dần), đưa về cỡ chuẩn, đặt dưới mọi mặt trong vùng chuẩn. Khung không đủ chỗ → lỗi (vòng dựng đã chọn khung đủ chỗ trước khi tới đây)."""
    lg, kieu = logo_goc(c); cho = logo_cho(c, lg.height)
    if not cho: raise RuntimeError("khung không đủ chỗ dưới mặt cho logo ở cỡ chuẩn (chữ không che mặt) — cần khung khác")
    y, k = cho
    if k < 1: lg = lg.resize((round(lg.width * k), round(lg.height * k)), Image.LANCZOS)
    lop = Image.new("RGBA", (W, H)); bg = Image.new("RGBA", (W, H)); bg.paste(lg, ((W - lg.width) // 2, y), lg)
    if kieu != "dai":   # logo cắt rời (không AI / có AI): viền tối sát nét + quầng mềm để đọc rõ trên khung sáng (bản dải đã mang nền của chính nó)
        al = bg.split()[3]
        toi = ImageChops.lighter(al.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3)).point(lambda v: min(235, int(v * 1.4))),
                                 al.filter(ImageFilter.GaussianBlur(30)).point(lambda v: min(140, int(v * 1.6))))
        nen = Image.new("RGBA", (W, H), (0, 0, 0, 0)); nen.putalpha(toi); lop = Image.alpha_composite(lop, nen)
    return None, Image.alpha_composite(lop, bg)
CAN_CHO = {"dt_logo_chat_lieu": lambda c: (logo_goc(c)[0].height, logo_cho)}   # mẫu cần KHUNG ĐỦ CHỖ: (chiều cao khối, hàm thử chỗ) — vòng dựng duyệt khung xếp hạng tới khi vừa
def _ten_hai_tang(c, y_min, them=130):
    """tên hai tầng: phần đầu trắng, TỪ CUỐI đỏ (kiểu UNDERCOVER PRISON KING) → (lớp, đáy)"""
    w = c["ten"].upper().split(); dau, cuoi = " ".join(w[:-1]) or w[0], w[-1] if len(w) > 1 else ""
    lop = Image.new("RGBA", (W, H)); f1, d1 = vua(dau, "impact", W - 160, 120, 2); f2 = ph("impact", f1.size)
    y = dat_y(c, int(f1.size * 1.0) * len(d1) + (f2.size if cuoi else 0) + them, 0.58) if y_min != H * 0.66 else int(y_min); m1, h1 = mat_chu(d1, f1, y, 1.0)
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
    lop = Image.new("RGBA", (W, H)); _cau_dinh(lop, c, "arial_b", 50, H * TREN_AN, (255, 255, 255))
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
    lop.alpha_composite(toi); _cau_dinh(lop, c, "georgia_bi", 76, H * TREN_AN, (255, 255, 255))
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
    lop0 = Image.new("RGBA", (W, H)); f, dong, y = dat_chu(c, c["ten"].upper(), "impact", W - 160, 140, 3, 0.98, 230 if AT.CO_FREE else 0, 0.58); cao = int(f.size * 0.98) * len(dong); m, hop = mat_chu(dong, f, y, 0.98)   # chừa 230px cho nút Free dưới tên
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
    # NÚT PLAY KHÔNG ĐÈ MẶT (cổng che mặt 20/11/2026: nút giữa màn đè 5–10% mặt nhân vật): mặt chiếm giữa → nút sang bên còn rộng hơn, cách mép mặt 40px
    try: mats = [b for b in mat_tren(ra) if b[1] < cy2 + r and b[3] > cy2 - r]
    except Exception: mats = []
    if mats and any(b[0] - r < cx < b[2] + r for b in mats):
        x0m, x1m = min(b[0] for b in mats), max(b[2] for b in mats)
        cx = int(x0m - r - 40) if x0m > W - x1m else int(x1m + r + 40); cx = min(W - r - 30, max(r + 30, cx))
    d.ellipse((cx - r, cy2 - r, cx + r, cy2 + r), fill=(230, 30, 40, 240)); d.polygon([(cx - 30, cy2 - 46), (cx - 30, cy2 + 46), (cx + 50, cy2)], fill=(255, 255, 255, 255))
    d.rectangle((0, y0 + bang_h - 10, W, y0 + bang_h - 4), fill=(255, 255, 255, 90)); d.rectangle((0, y0 + bang_h - 10, int(W * 0.34), y0 + bang_h - 4), fill=(230, 30, 40, 255))
    yy = y0 + bang_h + 60; f = ph("arial_b", 40); t = "EXCLUSIVE"; w = f.getlength(t) + 80; d.rounded_rectangle(((W - w) / 2, yy, (W + w) / 2, yy + 70), radius=12, fill=(230, 30, 40, 255))
    d.text(((W - f.getlength(t)) / 2, yy + 12), t, font=f, fill=(255, 255, 255, 255))
    f2, dong = vua(c["ten"].upper(), "impact", W - 140, 110, 3); m, hop = mat_chu(dong, f2, yy + 110, 1.0); bong(lop, m); to(lop, m, (255, 255, 255))
    _cau_dinh(lop, c, "arial_b", 54, y0 - 170, (255, 255, 255)); return ra, lop
def dt_dai_free(c):
    """dải trắng mảnh trên đỉnh chữ đen 'WATCH MOVIES NOW! FREE' — báo miễn phí ngay giây đầu, cảnh phim giữ nguyên (kiểu My Billionaire Boss, 32 ngày)"""
    lop = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lop); t = "WATCH MOVIES NOW! FREE" if c["lang"] != "es" else "¡MIRA PELÍCULAS AHORA! GRATIS"
    f = ph("arial_black", 46); y0 = int(H * TREN_AN); d.rectangle((0, y0, W, y0 + 92), fill=(255, 255, 255, 255)); d.text(((W - f.getlength(t)) / 2, y0 + 18), t, font=f, fill=(10, 10, 10, 255))
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
    y = dat_y(c, cao + 130); m, hop = mat_chu(dong, f, y, 1.0)
    bong(lop, m); vien(lop, m, 6, (120, 10, 20)); to(lop, m, doc_trong((255, 255, 255), (255, 240, 220), (240, 210, 180), hop))
    nut(lop, "WATCH NOW" if c["lang"] != "es" else "VER AHORA", hop[3] + 40, ph("impact", 62), (25, 20, 15), (255, 222, 140), (214, 160, 50), (60, 18)); return ra, lop
def dt_logo_goc(c):
    """logo tên phim chữ nghiêng nhỏ ở góc trên trái + một dòng 'phụ đề' (câu nhử) trơn giữa dưới — trông như cảnh trích từ phim thật (kiểu Extraordinary Mother of a Billionaire)"""
    lop = Image.new("RGBA", (W, H)); f, dong = vua(c["ten"], "georgia_i", int(W * 0.55), 44, 2, 30); m, _ = mat_chu(dong, f, int(H * TREN_AN), 1.1, "trai", 50)
    bong(lop, m, (3, 4), 4, 220); to(lop, m, (255, 236, 200))
    f2, d2 = vua(c["cau"], "arial_b", W - 200, 46, 2, 34); m2, _ = mat_chu(d2, f2, int(H * 0.70), 1.15); vien(lop, m2, 3, (0, 0, 0)); to(lop, m2, (255, 255, 255)); return None, lop
def dt_nut_free_do(c):
    """nút bo tròn đỏ nhỏ 'Watch Free' đặt 1/3 dưới, đè thẳng lên cảnh phim — không tên phim, không nền (kiểu Lulu the Little Goddess, 29 ngày)"""
    lop = Image.new("RGBA", (W, H)); nut(lop, "Watch Free" if c["lang"] != "es" else "Ver gratis", int(H * 0.70), ph("arial_b", 52), (229, 36, 54), (255, 255, 255), None, (64, 22)); return None, lop

def _ep_ngang(lop, ty=0.82, cy=None):
    """ép chữ hẹp lại theo chiều ngang quanh giữa khung (kiểu chữ cao, hẹp của poster)"""
    hep = lop.resize((int(W * ty), H), Image.LANCZOS); o = Image.new("RGBA", (W, H)); o.alpha_composite(hep, ((W - hep.width) // 2, 0)); return o
def _goc2(c):
    """khung phụ (khung xếp hạng kế) — ảnh nhỏ / tách nền"""
    return c["goc_khac"][0] if c.get("goc_khac") else c["goc"]
def dt_discover_banner(c):
    """BỐ CỤC: băng trên 2 dòng (DISCOVER THE FULL STORY đen trên nền sáng · EPISODE BY EPISODE trắng trên dải xám), mép chéo cắt khung; góc dưới trái nêm tối chứa
    ảnh nhỏ khung phụ; tên phim chữ hẹp nghiêng trắng góc dưới phải + nút đỏ WATCH MORE (kiểu American Sniper · Movie World)"""
    y0 = int(H * TREN_AN)
    nen = Image.open(nen_dat_mat(c, y0 + 400, int(H * 0.62))).convert("RGBA"); d = ImageDraw.Draw(nen)   # mặt nằm GIỮA mép chéo của băng trên và nêm tối dưới (cửa sổ ~ 610–1190px)
    d.polygon([(0, 0), (W, 0), (W, y0 + 300), (0, y0 + 400)], fill=(236, 236, 236, 255))   # mảng sáng mép chéo
    RN, CN = 470, 400   # ảnh nhỏ cột TRÁI; tên + nút ở cột PHẢI từ x = RN + 30 (trước đây ảnh 620 rộng, tên đặt từ 42% → đè mặt trong ảnh nhỏ, cổng che mặt 20/11/2026)
    nho = Image.open(_goc2(c)).convert("RGB"); s_ = RN / nho.width; nho = nho.resize((RN, int(nho.height * s_))).crop((0, 0, RN, CN))
    nem = Image.new("L", (W, H)); ImageDraw.Draw(nem).polygon([(0, int(H * 0.68)), (W, int(H * 0.60)), (W, H), (0, H)], fill=255)
    toi = Image.new("RGBA", (W, H), (14, 14, 16, 255)); nen = Image.composite(toi, nen, nem)
    mk = Image.new("L", (RN, CN)); ImageDraw.Draw(mk).polygon([(0, 84), (RN, 0), (RN, CN), (0, CN)], fill=255); nen.paste(nho, (0, int(H * 0.70)), mk)
    ra = os.path.join(c["tm"], f"nen-{c['ma']}.png"); nen.convert("RGB").save(ra)
    lop = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lop)
    t1, t2 = ("DISCOVER THE FULL STORY", "EPISODE BY EPISODE") if c["lang"] != "es" else ("DESCUBRE LA HISTORIA", "EPISODIO A EPISODIO")
    f1 = ph("din", 118); d.text(((W - f1.getlength(t1)) / 2, y0 + 10), t1, font=f1, fill=(30, 30, 30, 255))
    f2 = ph("din", 128); w2 = f2.getlength(t2); d.rectangle((0, y0 + 140, W, y0 + 280), fill=(48, 48, 50, 255)); d.text(((W - w2) / 2, y0 + 150), t2, font=f2, fill=(255, 255, 255, 255))
    XC = RN + 40; f3, dong = vua(c["ten"].upper(), "impact", W - XC - 60, 84, 3); m, hop = mat_chu(dong, f3, int(H * 0.70), 1.0, "trai", XC)
    l3 = Image.new("RGBA", (W, H)); bong(l3, m); vien(l3, m, 3, (0, 0, 0)); to(l3, m, (255, 255, 255))
    l3 = l3.transform((W, H), Image.AFFINE, (1, 0.16, -0.16 * (hop[1] + hop[3]) / 2, 0, 1, 0), Image.BICUBIC); lop.alpha_composite(l3)
    nut(lop, "WATCH MORE" if c["lang"] != "es" else "VER MÁS", hop[3] + 50, ph("din", 76), (190, 22, 30), (255, 255, 255), (120, 10, 16), (44, 14), bo_tron=14, x_tam=(XC + W - 40) / 2); return ra, lop
def dt_ong_ngam(c):
    """BỐ CỤC ống ngắm: khung phim trong vòng tròn ống ngắm (viền kim loại tối, chữ thập, số khoảng cách cam phát sáng), ngoài vòng tối; tên phim chữ hẹp nghiêng
    trắng kim loại phía dưới (kiểu American Sniper · Hot Movies Every Day, 41 ngày) — hợp phim hành động / quân đội / sát thủ"""
    goc = Image.open(c["goc"]).convert("RGB"); r = int(W * 0.47); cx, cy = W // 2, int(H * 0.36)
    s_ = max(2 * r / goc.width, 2 * r / goc.height) * 1.15; g = goc.resize((int(goc.width * s_), int(goc.height * s_)), Image.LANCZOS)
    x0 = int(min(max(0, (c["mat_tam"] * 0 + 0.5) * g.width - r), g.width - 2 * r)); y0 = int(min(max(0, c["mat_tam"] * g.height - r), g.height - 2 * r)); g = g.crop((x0, y0, x0 + 2 * r, y0 + 2 * r))
    nen = Image.new("RGB", (W, H), (6, 6, 8)); mo = goc.resize((W, H)).filter(ImageFilter.GaussianBlur(30)).point(lambda v: v // 6); nen.paste(mo)
    mk = Image.new("L", (2 * r, 2 * r)); ImageDraw.Draw(mk).ellipse((0, 0, 2 * r, 2 * r), fill=255); nen.paste(g, (cx - r, cy - r), mk)
    d = ImageDraw.Draw(nen); d.ellipse((cx - r - 40, cy - r - 40, cx + r + 40, cy + r + 40), outline=(30, 30, 34), width=46); d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(0, 0, 0), width=10)
    d.line([(cx - r, cy), (cx + r, cy)], fill=(10, 10, 10), width=3); d.line([(cx, cy - r), (cx, cy + r)], fill=(10, 10, 10), width=3)
    for t in range(1, 5): d.line([(cx + t * r // 5, cy - 14), (cx + t * r // 5, cy + 14)], fill=(10, 10, 10), width=2); d.line([(cx - t * r // 5, cy - 14), (cx - t * r // 5, cy + 14)], fill=(10, 10, 10), width=2)
    d.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=(230, 30, 30))
    ra = os.path.join(c["tm"], f"nen-{c['ma']}.png"); nen.save(ra)
    lop = Image.new("RGBA", (W, H)); so = f"{random.Random(c['cid']).randint(1200, 4200)}M"; f = ph("din", 92); m, _ = mat_chu([so], f, cy - r + 50, 1.0)
    phat_sang(lop, m, (255, 140, 20), 16, 230); to(lop, m, (255, 190, 60))
    f2, dong = vua(c["ten"].upper(), "impact", W - 140, 140, 3); cao = int(f2.size * 0.98) * len(dong); m2, hop = mat_chu(dong, f2, int(H * 0.70), 0.98)
    l2 = Image.new("RGBA", (W, H)); bong(l2, m2, (8, 12), 12, 230); vien(l2, m2, 6, (10, 10, 14)); to(l2, m2, doc_trong((255, 255, 255), (200, 205, 214), (120, 126, 140), hop)); sang_khoi(l2, m2, (255, 255, 255), (20, 20, 30))
    lop.alpha_composite(l2.transform((W, H), Image.AFFINE, (1, 0.18, -0.18 * (hop[1] + hop[3]) / 2, 0, 1, 0), Image.BICUBIC)); return ra, lop
def dt_full_series_dau(c):
    """băng chữ trên đỉnh 2 dòng 'Full series / now available' chữ hẹp đậm trắng đổ bóng + tên phim chữ có chân nghiêng trắng 3 dòng phía dưới (kiểu American Sniper · Screen Hub)"""
    lop = Image.new("RGBA", (W, H)); t = ("Full series", "now available") if c["lang"] != "es" else ("Serie completa", "ya disponible")
    f = ph("din", 96); m, _ = mat_chu(list(t), f, int(H * TREN_AN), 1.05); bong(lop, m, (4, 6), 8, 220); to(lop, m, (255, 255, 255))
    f2, dong, y = dat_chu(c, c["ten"], "georgia_i", W - 200, 120, 3, 1.12, 0, 0.58)
    m2, _ = mat_chu(dong, f2, y, 1.12); bong(lop, m2, (5, 8), 10, 220); to(lop, m2, (255, 255, 255)); return None, lop
def dt_stream_banner(c):
    """hộp đen bo tròn viền vàng trên đỉnh: 'STREAM THE FULL SERIES' trắng + '"WATCH MORE" - KEEP WATCHING FOR FREE!' vàng; tên phim chữ hẹp nghiêng trắng giữa dưới
    (kiểu My Billionaire Boss / Undercover Prison King / Surf God's Revenge)"""
    lop = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lop); y0 = int(H * TREN_AN)
    t1, t2 = ("STREAM THE FULL SERIES", '"WATCH MORE" - KEEP WATCHING FOR FREE!') if c["lang"] != "es" else ("MIRA LA SERIE COMPLETA", '"VER MÁS" - ¡SIGUE MIRANDO GRATIS!')
    f1, f2 = ph("arial_black", 44), ph("arial_black", 32); w = max(f1.getlength(t1), f2.getlength(t2)) + 90
    d.rounded_rectangle(((W - w) / 2, y0, (W + w) / 2, y0 + 150), radius=22, fill=(8, 8, 8, 235), outline=(214, 170, 60, 255), width=4)
    d.text(((W - f1.getlength(t1)) / 2, y0 + 24), t1, font=f1, fill=(255, 255, 255, 255)); d.text(((W - f2.getlength(t2)) / 2, y0 + 88), t2, font=f2, fill=(255, 214, 70, 255))
    l2, _ = _ten_nghieng(c, int(H * 0.62)); lop.alpha_composite(l2); return None, lop
def _ten_nghieng(c, y):
    f, dong = vua(c["ten"].upper(), "impact", W - 220, 120, 3); m, hop = mat_chu(dong, f, y, 0.98)
    l = Image.new("RGBA", (W, H)); bong(l, m, (6, 10), 10, 220); vien(l, m, 4, (0, 0, 0)); to(l, m, (255, 255, 255))
    return l.transform((W, H), Image.AFFINE, (1, 0.17, -0.17 * (hop[1] + hop[3]) / 2, 0, 1, 0), Image.BICUBIC), hop
def dt_watch_more_gian(c):
    """nhãn nhỏ 'WATCH MORE' trong hộp tối giữa đỉnh + phần đầu tên phim CHỮ GIÃN mảnh trắng + phần cuối tên phim chữ hẹp cao VÀNG nổi khối (kiểu Undercover Prison King,
    hầu hết QC mới của phim — 'U N D E R C O V E R / PRISON KING')"""
    lop = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lop); y0 = int(H * TREN_AN); f = ph("arial_b", 34); t = "WATCH MORE" if c["lang"] != "es" else "VER MÁS"; w = f.getlength(t) + 40
    d.rectangle(((W - w) / 2, y0, (W + w) / 2, y0 + 56), fill=(40, 34, 20, 220)); d.text(((W - f.getlength(t)) / 2, y0 + 9), t, font=f, fill=(255, 226, 150, 255))
    tu = c["ten"].upper().split(); dau, cuoi = (" ".join(tu[:1]), " ".join(tu[1:])) if len(tu) > 2 else ((tu[0], " ".join(tu[1:])) if len(tu) == 2 else ("", tu[0]))
    f2, dong = vua(cuoi, "impact", int((W - 120) / 0.84), 190, 2)
    y = dat_y(c, (74 if dau else 0) + int(f2.size * 0.98) * len(dong), 0.60)
    if dau:
        gian = " ".join(dau); f1 = ph("didot", 54); d.text(((W - f1.getlength(gian)) / 2, y), gian, font=f1, fill=(245, 245, 245, 255)); y += 74
    m, hop = mat_chu(dong, f2, y, 0.98)
    l2 = Image.new("RGBA", (W, H)); bong(l2, m, (6, 10), 12, 220); vien(l2, m, 5, (60, 34, 4)); to(l2, m, doc_trong((255, 244, 190), (236, 176, 50), (150, 90, 12), hop)); sang_khoi(l2, m)
    lop.alpha_composite(_ep_ngang(l2, 0.84)); return None, lop
def dt_vang_do_script(c):
    """tên phim HAI MÀU: 'The' nhỏ vàng nghiêng · thân tên chữ có chân VÀNG nổi khối · phần cuối chữ viết tay ĐỎ đè lên (kiểu The Godmother's New Heir, 9 QC đang chạy)"""
    lop = Image.new("RGBA", (W, H)); tu = c["ten"].split(); mo = tu[0] if tu[0].lower() in ("the", "a", "my", "el", "la") and len(tu) > 2 else ""
    than = tu[1:] if mo else tu; cat = max(1, len(than) // 2); vang, do_ = " ".join(than[:-cat] or than[:1]), " ".join(than[-cat:]) if len(than) > 1 else ""
    y = dat_y(c, (70 if mo else 0) + 150 * 2 + (150 if do_ else 0), 0.54)
    if mo:
        f0 = ph("georgia_bi", 60); m0, _ = mat_chu([mo], f0, y, 1.0); bong(lop, m0); to(lop, m0, (240, 200, 110)); y += 70
    f1, d1 = vua(vang.upper(), "didot_b", W - 100, 150, 2); m1, h1 = mat_chu(d1, f1, y, 0.95)
    bong(lop, m1, (6, 10), 12, 220); vien(lop, m1, 5, (70, 40, 6)); to(lop, m1, doc_trong((255, 240, 180), (226, 166, 44), (150, 92, 14), h1)); sang_khoi(lop, m1)
    if do_:
        f2, d2 = vua(do_, "snell", W - 160, 150, 2); m2, h2 = mat_chu(d2, f2, h1[3] - 30, 1.0)
        bong(lop, m2, (5, 8), 10, 220); vien(lop, m2, 3, (60, 0, 6)); to(lop, m2, doc_trong((255, 80, 80), (214, 18, 30), (130, 6, 14), h2))
    return None, lop
def dt_full_series_free(c):
    """tên phim hai tầng (từ cuối đỏ) + dòng 'FULL SERIES - FREE' trắng đậm bên dưới (kiểu Undercover Prison King)"""
    lop, day = _ten_hai_tang(c, c["mat_day"] + 40); f = ph("arial_black", 58); t = "FULL SERIES - FREE" if c["lang"] != "es" else "SERIE COMPLETA - GRATIS"
    m, _ = mat_chu([t], f, day + 22, 1.0); bong(lop, m); vien(lop, m, 3, (0, 0, 0)); to(lop, m, (255, 255, 255)); return None, lop
def dt_ten_tren_nut_duoi(c):
    """vương miện nhỏ + tên phim chữ có chân VÀNG nổi khối ở TRÊN (dưới vùng che), nhân vật giữa khung, nút tối viền vàng 'WATCH NOW!' ở DƯỚI (kiểu Undercover Prison King, 10 ngày)"""
    lop = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lop); y = int(H * TREN_AN); cx = W // 2
    d.polygon([(cx - 46, y + 40), (cx - 46, y + 6), (cx - 23, y + 24), (cx, y), (cx + 23, y + 24), (cx + 46, y + 6), (cx + 46, y + 40)], fill=(236, 186, 70, 255))
    f, dong = vua(c["ten"].upper(), "copper", W - 120, 120, 3); m, hop = mat_chu(dong, f, y + 60, 1.0)
    bong(lop, m, (5, 8), 10, 220); vien(lop, m, 5, (70, 40, 6)); to(lop, m, doc_trong((255, 244, 196), (232, 176, 60), (160, 96, 18), hop)); sang_khoi(lop, m)
    nut(lop, "WATCH NOW!" if c["lang"] != "es" else "¡VER AHORA!", int(H * 0.74), ph("georgia_bi", 64), (40, 24, 10), (255, 236, 190), (214, 160, 50), (70, 18))
    nen = nen_dat_mat(c, hop[3] + 40, int(H * 0.74) - 40); return (None if nen == c["nen"] else nen), lop   # mặt nằm GIỮA đáy tên và nút

HAM = {k: v for k, v in globals().items() if k.startswith("dt_") and callable(v)}
CAN_CAU = {"dt_key_art_neon", "dt_cau_nhu_dinh", "dt_khung_player", "dt_logo_goc"}
CAN_KHUNG2 = {"dt_key_art_neon", "dt_discover_banner"}   # mẫu cần khung phụ (khung xếp hạng kế)   # mẫu có câu nhử (AI viết)

def ngu_canh(cid, tm_rieng=None):
    p = AT.phim([cid])[0]; lang = "es" if str(p.get("locale")).startswith("es") else "en"; ten = ten_chu(p)
    tm = os.path.join(AT.C, str(cid)); os.makedirs(tm, exist_ok=True)
    the_loai = AT.sql(f"select coalesce(the_loai, '') from etp.phim where content_id = {int(cid)}"); p["the_loai"] = the_loai
    return p, lang, ten, tm

# cổng trang phim của dòng phim (apps/etp/dong_phim.py TRANG) — chạy trên box3 trong /opt/earns-marketing-os-v2
TRANG = r'''
import importlib.util, sys, json
s = importlib.util.spec_from_file_location("nb", "apps/xuong-video/scripts/ethopex/nhan-ban.py"); m = importlib.util.module_from_spec(s); sys.argv = ["nb"]; s.loader.exec_module(m)
tk = m.q("select ad_account_id from etp.tai_khoan where nha and ad_account_id is not null order by nguoi_id limit 1")
print(json.dumps({"ly": m.trang_chua_san(%d, tk)}, ensure_ascii=False))
'''
_NHO = {}
def mot(ma, cid, xem=False, ban=1):
    """dựng ban bản theo mẫu ma cho phim cid → danh sách creative_id (xem=True: chỉ tệp)"""
    if ma not in HAM: raise SystemExit(f"mẫu {ma} chưa có hàm vẽ trong dung-mau.py")
    muc = next((x for x in SO if x["ma"] == ma), None)
    if not muc: raise SystemExit(f"mẫu {ma} không có trong sổ")
    dang = "poster động" if muc["loai"] == "bo_cuc" and "poster động" in muc["dung_cho"] else "ảnh tĩnh"
    dang_o = ["tai_tap"]   # bước đang làm — lỗi thì ghi ĐÚNG bước hỏng (19/11/2026: ghi buoc='loi' làm Máy SX không biết hỏng ở nhịp nào)
    def tt(b, t="dang", g=None, **k):
        if b not in ("xong", "loi"): dang_o[0] = b
        if not xem: ghi_tt(ma, cid, dang_o[0] if b == "loi" else b, t, g, **k)
    vnd = 0
    # PHIM CẤM (anh 19/11/2026 "ko cho mở camp mới, lên creative dưới mọi hình thức"): không dựng creative cho phim trong sổ ethopex_phim_cam — trước bước tốn AI.
    # Đọc bằng xuong.phim_cam → cong.phim_cam (một hàm); lỗi đọc → coi như cấm (an toàn trước).
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import xuong as _XG
    try: _cam = _XG.phim_cam([cid]).get(int(cid))
    except Exception as e: _cam = f"không đọc được sổ phim cấm ({str(e)[:100]}) — dừng cho an toàn"
    if _cam:
        if not xem: ghi_tt(ma, cid, "tai_tap", "dung", f"PHIM CẤM: {_cam}"[:300])
        print(f"✗ phim #{cid} cấm — không dựng: {_cam[:160]}", flush=True)
        return []
    try:
        tt("tai_tap", g="tải 3 tập miễn phí + trích khung")
        p, lang, ten, tm = ngu_canh(cid)
        if not p.get("url"):
            # PHIM CHƯA CÓ LINK TẬP (anh 19/11/2026 "lỗi thì chúng mày phải chủ động mà sửa đi"): làm ĐÚNG bước Trang phim của dòng phim — thêm phim vào workspace
            # Ethopex của Nhà (nhan-ban.trang_chua_san → ensure-clone, idempotent) rồi gọi đồng bộ; trang có link tập 1 thì dong-bo điền etp.phim.url → lượt sau dựng tiếp
            tt("trang_phim", g="phim chưa có link tập — máy thêm phim vào workspace Ethopex của Nhà để lấy link tập 1")
            r = AT.sh("ssh", AT.B, f"{AT.ENV}; python3 - <<'PYEOF'\n{TRANG % int(cid)}\nPYEOF", han=300)
            m = re.findall(r'^\{"ly".*$', r.stdout, re.M); ly = json.loads(m[-1])["ly"] if m else f"không đọc được cổng trang phim: {(r.stderr or r.stdout)[-200:]}"
            AT.sh("ssh", AT.B, "systemctl start --no-block etp-dong-bo", han=60)   # đồng bộ kho trang phim ngay, không chờ 10 phút
            tt("trang_phim", "cho", f"chờ Ethopex sinh trang + link tập 1 (lượt sau tự dựng tiếp) · {ly or 'trang phim đã đủ, chờ đồng bộ điền link'}"[:300])
            return []
        if cid not in _NHO:   # một phim chỉ tải tập / xếp khung / viết câu nhử MỘT lần trong tiến trình (bảng xem trước vẽ 12 mẫu)
            uv = AT.khung(cid, p["url"], tm)
            if not xem: ghi_poster(cid, p["url"], tm)
            tt("chon_khung", g=f"{len(uv)} khung ứng viên → AI xếp hạng")
            mt = TB.mo_ta(p["url"])
            uv, ly_xep, v = AT.xep_ai(ten, uv, mt, p.get("the_loai") or "") if len(uv) > 1 else (uv, "", 0); vnd += v
            if ly_xep: print(f"xếp khung: {ly_xep[:300]}", flush=True)
            _NHO[cid] = {"uv": uv, "mo_ta": mt}
        uv = _NHO[cid]["uv"]
        # BẢN SAU KHÁC BẢN TRƯỚC (anh 20/11/2026 "khi chọn cắt tiếp creative 1 lần nữa cho cùng phim thì làm sao để mẫu có sự khác đi ?"): trước đây lần nào cũng lấy khung xếp hạng 1,
        # cùng câu nhử, cùng câu đọc → ra bản y hệt. Giờ sổ etp.mau_dung nhớ khung + câu nhử đã dùng của (mẫu, phim): lần sau bỏ khung đã dùng, ưu tiên khung KHÁC CẢM XÚC,
        # câu nhử viết góc khác, câu đọc xoay theo số bản. Hết khung mới → dừng nói rõ (không lặp bản cũ).
        da_khung, da_cau = [], []
        if not xem:
            r_ = AT.sql(bang_sql() + " alter table etp.mau_dung add column if not exists khung_dung text[] not null default '{}'; alter table etp.mau_dung add column if not exists cau_dung text[] not null default '{}'; "
                        f"select coalesce(array_to_string(khung_dung, ';'), '') || E'\t' || coalesce(array_to_string(cau_dung, ';'), '') from etp.mau_dung where mau = {s_(ma)} and content_id = {int(cid)}") or "\t"
            da_khung, da_cau = ([x for x in y.split(";") if x] for y in (r_.split("\t") + [""])[:2])
        khoa = lambda u: f"{u['tap']}#{u['so']}"; cx_dung = {x.split("|")[1] for x in da_khung if "|" in x}
        uv = [u for u in uv if khoa(u) not in {x.split("|")[0] for x in da_khung}]
        if not uv: raise RuntimeError(f"phim này đã dùng hết {len(da_khung)} khung ứng viên cho mẫu — không còn khung mới để ra bản khác")
        if da_khung: uv = sorted(uv, key=lambda u: bool(u.get("cam_xuc")) and u.get("cam_xuc") in cx_dung)   # khác cảm xúc lên trước, giữ thứ hạng AI trong từng nhóm
        if ma in CAN_CAU and (da_cau or "cau" not in _NHO[cid]): c_, n_, v = cau_nhu(ten, _NHO[cid].get("mo_ta") or TB.mo_ta(p["url"]), lang, tuple(da_cau)); vnd += v; _NHO[cid]["cau"] = (c_, n_)
        cau, nhan = _NHO[cid].get("cau", ("", "")) if ma in CAN_CAU else ("", "")
        cr = []
        for b in range(ban):
            cao_cho = CAN_CHO[ma]({"tm": tm, "ten": ten, "p": p, "cid": cid}) if ma in CAN_CHO else None; vnd += _CHI_LOGO[0]; _CHI_LOGO[0] = 0   # tách logo TRƯỚC khi chọn khung: không có logo thì dừng luôn, chưa tốn gì
            tot = None   # (che mặt, khung, nền, lớp, c) tốt nhất đã thử
            for lan in range(min(len(uv), KHUNG_THU)):
                k = uv[(b + lan) % len(uv)]; k["lang"] = lang   # uv đã bỏ khung các bản trước dùng
                tt("ve_mau", g=f"bản {b + 1}/{ban}: vẽ mẫu trên khung {k['tap']}#{k['so']}" + (f" (khung xếp hạng {lan + 1} — các khung trước chữ che mặt / không đủ chỗ)" if lan else ""))
                AT.CO_FREE, cu = False, AT.CO_FREE   # nền sạch không lớp Free — mẫu tự quyết lớp CTA của nó
                try: nen, _ = AT.anh(cid, ten, k, tm, 100 + b)
                finally: AT.CO_FREE = cu
                goc = os.path.join(tm, f"goc-{100 + b}.png"); khac = [os.path.join(tm, f"goc-{200 + b}.png")]
                if ma in CAN_KHUNG2 and len(uv) > 1:   # nhân vật thứ hai từ khung xếp hạng kế
                    k2 = uv[(b + 1) % len(uv)]; AT.sh("ffmpeg", "-v", "error", "-y", "-ss", "3", "-i", os.path.join(tm, k2["tap"] + ".mp4"), "-vf", f"{AT.LOC},select=eq(n\\,{k2['so'] - 1})", "-frames:v", "1", khac[0])
                mats = []
                try:   # mọi mặt trên khung gốc (máy đọc Vision của anh-tinh) — khung 9:16 cắt từ khung gốc nên quy toạ độ dọc theo cùng tỉ lệ
                    jm = json.loads(subprocess.run([AT.may_doc(), "--mat", goc], capture_output=True, text=True, timeout=120).stdout.strip() or "{}")
                    mats = [((m[1]) * H, (m[1] + m[3]) * H) for m in jm.get("mat") or [] if m[4] >= 0.45 and m[3] >= 0.05]
                except Exception as e: print("đọc mặt lỗi — chỉ né mặt chính:", e, file=sys.stderr)
                c = {"ma": ma, "cid": cid, "p": p, "lang": lang, "ten": ten, "tm": tm, "nen": nen, "goc": goc, "goc_khac": [x for x in khac if os.path.exists(x)], "mats": mats,
                     "mat_day": (k["mat"][1] + k["mat"][3]) * H, "mat_tam": k["mat"][1] + k["mat"][3] / 2, "cau": cau, "nhan": nhan}
                if cao_cho and not cao_cho[1](c, cao_cho[0]): continue
                try: nen2, lop = HAM[ma](c)
                except RuntimeError as e:
                    if "không đủ chỗ" in str(e): continue
                    raise
                nen_x = nen2 or nen
                try: cm = che_mat(lop, mat_tren(nen_x))
                except Exception as e: print("đo che mặt lỗi — coi như không che:", e, file=sys.stderr); cm = 0.0
                if tot is None or cm < tot[0]: tot = (cm, k, nen_x, lop, c)
                if cm <= CHE_MAT_TOI_DA: break
                print(f"✗ khung {k['tap']}#{k['so']}: chữ phủ {cm:.0%} hộp mặt {CHE_MAT_HOP[0]} — thử khung kế", file=sys.stderr, flush=True)
            if tot is None: raise RuntimeError(f"{min(len(uv), KHUNG_THU)} khung xếp hạng đầu đều không đủ chỗ dưới mặt cho khối chữ của mẫu (chữ không che mặt)")
            if tot[0] > CHE_MAT_TOI_DA: raise RuntimeError(f"{min(len(uv), KHUNG_THU)} khung xếp hạng đầu, khung tốt nhất chữ vẫn phủ {tot[0]:.0%} hộp mặt (chuẩn ≤ {CHE_MAT_TOI_DA:.0%}) — chữ không che mặt")
            _, k, nen, lop, c = tot
            chu = os.path.join(tm, f"chu-{ma}-{b}.png"); lop.save(chu)
            out = os.path.join(tm, f"{ma}-{cid}-{b + 1}.mp4")
            if xem:   # xem: ảnh ghép tĩnh, không giọng
                Image.alpha_composite(Image.open(nen).convert("RGBA"), lop).convert("RGB").save(out.replace(".mp4", ".jpg"), quality=88); cr.append(out.replace(".mp4", ".jpg")); continue
            tt("giong", g="giọng đọc (cổng giọng chung)")
            kg = AT.xoay_giong([p], None)[cid]; mp3, v, _ = AT.giong(cid, lang, ten, kg, tm, (len(da_khung) + b) % len(AT.CAU[lang])); vnd += v   # câu đọc xoay theo số bản đã dựng
            tt("video", g="dựng video 1080×1920")
            giay = AT.dung(nen, chu, mp3, out)
            tt("thu_vien", g=f"nạp thư viện ({giay}s)")
            tv = TB.nap(cid, lang, out, dang, f"mẫu:{ma} · {muc['ten']} · bản {len(da_khung) + 1} · khung {k['tap']}#{k['so']}" + (f" · {k['cam_xuc']} · {k.get('nhan_vat') or ''}" if k.get("cam_xuc") else ""), v)
            if not tv: raise RuntimeError("nạp thư viện không ra mã")
            AT.sql(f"update etp.mau_dung set tv_ids = array_append(tv_ids, {int(tv)}), khung_dung = array_append(khung_dung, {s_(khoa(k) + '|' + (k.get('cam_xuc') or ''))})"
                   + (f", cau_dung = array_append(cau_dung, {s_(cau.replace(';', ','))})" if cau else "") + f" where mau = {s_(ma)} and content_id = {int(cid)}")
            uv = [u for u in uv if khoa(u) != khoa(k)]; da_khung.append(khoa(k) + "|" + (k.get("cam_xuc") or ""))
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
                f"where m.mau in ({','.join(s_(x) for x in HAM)}) and (d.mau is null or d.trang_thai = 'cho') order by d.cap_nhat nulls first, m.luc")
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
    tm = ngu_canh(cid)[3]; o = 360; ra = Image.new("RGB", (o * 6, int(o * 16 / 9 + 40) * 4), (20, 20, 20)); d = ImageDraw.Draw(ra); f = ph("arial_b", 20)
    for i, (ma, fp) in enumerate(anh[:24]):
        im = Image.open(fp).convert("RGB").resize((o, int(o * 16 / 9))); x, y = (i % 6) * o, (i // 6) * (int(o * 16 / 9) + 40); ra.paste(im, (x, y)); d.text((x + 8, y + int(o * 16 / 9) + 8), ma, font=f, fill=(255, 255, 255))
    out = os.path.join(tm, "bang-mau.jpg"); ra.save(out, quality=85); print(out)

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    if a[0] == "--hang": hang()
    elif a[0] == "--bang": bang_xem(int(a[1]))
    elif a[0] == "--poster": print(ghi_poster(int(a[1]), ngu_canh(int(a[1]))[0].get("url")))   # ghi bù poster gốc cho phim đã dựng trước 19/11/2026
    else: print(json.dumps(mot(a[0], int(a[1]), "--xem" in a, int(a[a.index("--ban") + 1]) if "--ban" in a else 1)))
