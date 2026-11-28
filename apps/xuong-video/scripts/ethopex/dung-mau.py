#!/usr/bin/env python3
"""MÁY DỰNG THEO MẪU HỌC TỪ ĐỐI THỦ — $0 dựng (PIL + ffmpeg trên iMac), chỉ tốn giọng ~156₫ + AI viết câu nhử ~20₫ / bản.
Anh 19/11/2026: "Tao cần xem trạng thái quá trình dựng ở đó luôn! Chưa có máy thì mày phải dựng lên" — mẫu đối thủ trong sổ (<repo etp2>/src/lib/etp-mau-cr.json,
dt_*) có hàm vẽ ở đây; phim anh chọn ở tab Mẫu Creative (etp.mau_phim) → dựng → thư viện → creative (cổng mẫu len-creative nhận đúng mẫu qua dấu "mẫu:<mã>").
Dùng lại máy ảnh tĩnh (anh-tinh.py): tải 3 tập, khung đẹp AI xếp hạng, xoá phụ đề, tên phim tách từ poster, giọng (cổng giọng chung), dựng video phóng chậm.
TRẠNG THÁI từng bước ghi etp.mau_dung (mau, content_id) → chân thẻ tab Mẫu Creative hiện ngay: cho → tai_tap → chon_khung → ve_mau → giong → video → thu_vien → creative → xong | loi.
Chạy (iMac, ~/.venvs/poster-mau/bin/python — có rembg):
  dung-mau.py <mã mẫu> <content_id> [--xem]   (--xem: chỉ dựng ảnh + video, không nạp thư viện / không tải creative)
  dung-mau.py <mã mẫu> <content_id> --thu     (dựng trọn video như bản thật — giọng, AI chuyển động của mẫu ảnh động — không ghi sổ, không nạp, không tải)
  dung-mau.py --hang                           (mọi phim đã chọn cho mẫu có hàm vẽ mà chưa dựng)
  dung-mau.py --bang <content_id>              (vẽ mọi mẫu trên một phim → bảng ghép xem trước, không giọng, không nạp)
  dung-mau.py --xem-soan                       (xem trước các bản soạn etp2 đang chờ — máy dòng phim gọi mỗi 10 giây khi có việc)"""
import colorsys, copy, importlib.util, json, time, math, os, random, re, subprocess, sys, traceback, urllib.error, urllib.request
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps, ImageStat

D = os.path.dirname(os.path.abspath(__file__))
def _nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(D, tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
AT = _nap("anh_tinh", "anh-tinh.py"); TB = _nap("tinh_ba_kieu", "tinh-ba-kieu.py"); CQ = _nap("cta_qc", "cta_qc.py")
W, H = AT.W, AT.H
sys.path.insert(0, os.path.join(D, "..", "..", "..", "etp")); from goc_etp2 import tep as _tep_etp2   # repo etp2 riêng (27/11/2026)
_SO = json.load(open(_tep_etp2("src", "lib", "etp-mau-cr.json"), encoding="utf-8")); SO = _SO["mau"]
NUT_CHU = _SO["thu_vien"]["nut"]["chu"]   # chữ nút CTA đúng luật (thư viện ô CTA của ngăn Creative etp2) — en / es cùng vị trí là bản dịch của nhau
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
            "buoc text not null, trang_thai text not null, ghi text, may text); create index if not exists mau_dung_nk_viec on etp.mau_dung_nk (mau, content_id, luc); "
            # TIỀN AI NGOÀI TỪNG BƯỚC (anh 20/11/2026 #1716 "Thêm thông tin đoạn dùng AI, mất chi phí ngoài"): ₫ của bước ghi lên đúng dòng nhật ký bước đó
            "alter table etp.mau_dung_nk add column if not exists vnd integer;")
def s_(v): return "null" if v is None else "$Q$" + str(v).replace("$Q$", "") + "$Q$"
def ghi_tt(mau, cid, buoc, tt="dang", ghi=None, vnd_truoc=0, **k):
    """vnd_truoc: ₫ AI ngoài bước VỪA XONG tiêu (xếp khung, câu nhử, tách logo, giọng) — cộng vào dòng nhật ký cuối của việc này (chính bước đó) trước khi ghi dòng mới"""
    them = "".join(f", {c} = {v}" for c, v in k.items())
    don = (f" update etp.mau_dung_nk set vnd = coalesce(vnd, 0) + {int(vnd_truoc)} where id = (select max(id) from etp.mau_dung_nk where mau = {s_(mau)} and content_id = {int(cid)});"
           if vnd_truoc > 0 else "")
    AT.sql(bang_sql() + don + f" insert into etp.mau_dung (mau, content_id, buoc, trang_thai, ghi, bat_dau) values ({s_(mau)}, {int(cid)}, {s_(buoc)}, {s_(tt)}, {s_(ghi)}, now()) "
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
def mat_chu(dong, f, y, gian=1.08, can="giua", x0=None, khung=None):
    """mặt nạ L của các dòng chữ + hộp bao. khung = bề rộng tấm vẽ (mặc định W; rộng hơn W khi chữ sẽ bị _ep_ngang ép lại).
    CỔNG CHỮ TRÀN KHUNG (anh 20/11/2026 "lởm thế này": chữ 'S' đầu tên phim bị cắt ở mẫu Watch more gián — chữ vẽ rộng 1.143px trên tấm 1.080px rồi mới ép):
    chữ chạm mép tấm vẽ thì DỪNG kêu rõ, không ra bản cụt chữ."""
    Wk = int(khung or W); m = Image.new("L", (Wk, H)); d = ImageDraw.Draw(m); cao = int(f.size * gian); hop = [Wk, H, 0, 0]
    for i, t in enumerate(dong):
        w = f.getlength(t); x = (Wk - w) / 2 if can == "giua" else (x0 or 60); yy = y + i * cao
        d.text((x, yy), t, font=f, fill=255); bb = d.textbbox((x, yy), t, font=f)
        if bb[0] < 4 or bb[2] > Wk - 4: raise RuntimeError(f"chữ tràn khung: dòng '{t}' rộng {bb[2] - bb[0]}px trên tấm {Wk}px — co chữ / chia dòng trước khi vẽ")
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
    s = Image.new("RGBA", m.size, (0, 0, 0, 0)); s.putalpha(m.point(lambda v: v * a // 255)); s = s.filter(ImageFilter.GaussianBlur(mo))
    t = Image.new("RGBA", lop.size); t.paste(s, lech); lop.alpha_composite(t)
def to(lop, m, mat):
    """tô mặt chữ m bằng ảnh / màu mat"""
    img = mat if isinstance(mat, Image.Image) else Image.new("RGB", m.size, mat)
    if img.size != m.size: img = img.resize(m.size)   # tấm vẽ rộng (chữ sắp ép ngang): dải màu dọc giãn ngang, không đổi theo chiều dọc
    l = img.convert("RGBA"); l.putalpha(m); lop.alpha_composite(l)
def vien(lop, m, day, mau):
    v = m.filter(ImageFilter.MaxFilter(day * 2 + 1)); to(lop, v, mau)
def sang_khoi(lop, m, mau=(255, 255, 240), toi=(60, 30, 0)):
    """nổi khối: viền sáng trên-trái, viền tối dưới-phải trong mặt chữ (vát cạnh)"""
    tren = ImageChops.subtract(m, ImageChops.offset(m, 3, 4)).filter(ImageFilter.GaussianBlur(1.2))
    duoi = ImageChops.subtract(m, ImageChops.offset(m, -3, -4)).filter(ImageFilter.GaussianBlur(1.2))
    for mm, c, a in ((tren, mau, 230), (duoi, toi, 200)):
        l = Image.new("RGBA", m.size, c + (0,)); l.putalpha(mm.point(lambda v: v * a // 255)); lop.alpha_composite(l)
def phat_sang(lop, m, mau, mo=24, a=200):
    g = Image.new("RGBA", m.size, mau + (0,)); g.putalpha(m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(mo)).point(lambda v: min(255, v * a // 255))); lop.alpha_composite(g)
def cta(c, en):
    """CHỮ NÚT (anh 23/11/2026 "CTA … đâu?"): chữ anh ghim ở ô CTA của bản soạn (c["cta"], món thư viện sổ › thu_vien.nut.chu) nếu đúng ngôn ngữ phim,
    không ghim thì chữ mặc định của mẫu `en` (bản ES = cùng vị trí trong sổ). Chữ trái luật CTA (Tap / Click / mũi tên) → dừng, không vẽ."""
    g = c.get("cta") or ""; ds = NUT_CHU.get(c["lang"]) or NUT_CHU["en"]
    t = g.split(":", 1)[1] if ":" in g and g.split(":", 1)[0] == (c["lang"] if c["lang"] in NUT_CHU else "en") else (ds[NUT_CHU["en"].index(en)] if en in NUT_CHU["en"] else en)
    t = co_free(t, c["lang"])
    if CQ.sai_luat(t): raise RuntimeError(f"chữ nút {t!r} trái luật CTA ({CQ.sai_luat(t)!r}) — chọn chữ khác ở ô CTA")
    return t

def co_free(t, lang):
    """MỌI CREATIVE PHẢI CÓ CHỮ FREE TRONG VIDEO (anh 27/11/2026 "Khi sinh creative phải có phần chữ Free trong video"): chữ nút chưa có free / gratis →
    đổi sang bản Free cùng cỡ chữ (WATCH FREE / VER GRATIS — hoa thì hoa, thường thì thường). Mọi mẫu vẽ nút đều qua cta() → cả lớp, không vá từng mẫu."""
    if re.search(r"\bfree\b|\bgratis\b", t, re.I): return t
    f = CQ.NUT_FREE["es" if lang == "es" else "en"]
    return f if t.upper() == t else f.title() if lang != "es" else "Ver gratis"

def nut(lop, chu, y, f, nen, chu_mau=(255, 255, 255), vien_mau=None, dem=(56, 26), bo_tron=None, rong_min=0, x_tam=None):
    while f.getlength(chu) + 2 * dem[0] > W - 80 and f.size > 30: f = f.font_variant(size=f.size - 4)   # chữ nút dài (anh ghim "WATCH FREE · LEARN MORE") co lại, không tràn khung
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
def logo_khoa_ai(c):
    """ảnh khoá màu của phim (chuẩn tách nền logo — logo-goc.anh_khoa, một hàm cho mọi máy); nhớ logo-khoa.png, MỘT lần / phim"""
    def lam(poster, chat=False):   # chat: lần 2 lệnh chặt — logo-goc.tach gọi khoa(poster, chat) (347f6114e); thiếu tham số này thì tầng khoá màu sập ở mọi phim (Twin 212128 logo vỡ, 28/11/2026)
        TT = _nap("tai_tap", "tai-tap.py"); link = TT.og_anh(TT.mo_rong(c["p"]["url"])) if c.get("p", {}).get("url") else None
        ra, v = _nap("logo_goc", "logo-goc.py").anh_khoa(link, os.path.join(c["tm"], "logo-khoa.png"), c.get("cid") or "", chat); _CHI_LOGO[0] += v; return ra
    return lam
SQL_GAN_PHIEU = _nap("cho_len", "cho_len.py").SQL_GAN_PHIEU   # gắn thẻ Chờ lên vào phiếu + mức ROAS của thẻ — một câu cho AD (đây) và CC2 (cho_len.ghi_cho)
LOGO_BAN = 8   # 8: tầng khoá màu sập vì sai số tham số khoa(poster, chat) từ 27/11 20:54 — tách lại (28/11/2026 Twin 212128) · 7: mác nền tảng (DramaBox Exclusive/Exclusivo) thắng hộp tên + từ dính phải ghép đủ từ của tên (27/11/2026 Deny Me, ¡Atrás!) · đổi cách tách thì tăng số này → logo đã nhớ của mọi phim tách lại (6: vùng cắt nới theo nét + cổng "logo bị cụt", 26/11/2026 #116378 mất chữ KING)
def day_logo(cid, tep, kieu, ep=False):
    """logo gốc của phim → kho R2 (box3 kho phat ethopex logo-goc) + etp.logo_goc (migration 0489) → etp2 phiếu lên camp hiện logo.
    Đã có đúng LOGO_BAN thì thôi (một câu SQL); đẩy lỗi KHÔNG chặn bản dựng — kêu to ra stderr."""
    try:
        if not ep and AT.sql(f"select 1 from etp.logo_goc where content_id = {int(cid)} and ban = {LOGO_BAN}"): return None
        B = "root@167.233.241.16"; xa = f"/tmp/logo-goc-{int(cid)}.png"
        subprocess.run(["rsync", "-a", tep, f"{B}:{xa}"], check=True, capture_output=True, timeout=120)
        r = subprocess.run(["ssh", B, f"kho phat {xa} ethopex thanh-pham logo-goc-{int(cid)}-v{LOGO_BAN}.png | tail -1; rm -f {xa}"], capture_output=True, text=True, timeout=120)
        url = (r.stdout.strip().splitlines() or [""])[-1]
        if not url.startswith("http"): raise RuntimeError(f"kho phat không trả link: {r.stderr.strip()[-200:]}")
        AT.sql(f"insert into etp.logo_goc (content_id, url, kieu, ban) values ({int(cid)}, {s_(url)}, {s_(kieu)}, {LOGO_BAN}) "
               f"on conflict (content_id) do update set url = excluded.url, kieu = excluded.kieu, ban = excluded.ban, cap_nhat = now()")
        print(f"logo gốc #{cid} → {url}", flush=True); return url
    except Exception as e: print(f"⚠ đẩy logo gốc #{cid} lỗi (bản dựng vẫn tiếp): {e}", file=sys.stderr); return None
def day_logo_cu():
    """đẩy MỘT LẦN mọi logo gốc đã tách sẵn trong ~/.cache/ethopex/anh-tinh/<cid>/ (đúng LOGO_BAN) lên kho — dung-mau.py --day-logo"""
    g = os.path.expanduser("~/.cache/ethopex/anh-tinh"); n = 0
    for cid in sorted(os.listdir(g)):
        tep = os.path.join(g, cid, "logo-goc.png")
        if not cid.isdigit() or not os.path.exists(tep): continue
        try: j = json.load(open(tep[:-4] + ".json"))
        except Exception: continue
        if j.get("ban") == LOGO_BAN and day_logo(int(cid), tep, j.get("kieu")): n += 1
    print(f"đã đẩy {n} logo gốc")
def logo_goc(c, cao=None):
    """cao = trần chiều cao riêng của mẫu (phần khung) — mặc định LOGO_CAO · logo gốc đã tách của phim (MỘT lần / phim, nhớ logo-goc.png + .json) → (ảnh RGBA đã đưa về cỡ chuẩn, 'cat' | 'ai' | 'dai'); không tách được → dừng kêu to"""
    ra = os.path.join(c["tm"], "logo-goc.png"); so = ra[:-4] + ".json"; ly = []; kieu = None
    try:
        n = json.load(open(so))
        if n.get("ban") == LOGO_BAN and os.path.exists(ra): kieu = n["kieu"]
    except Exception: pass
    if not kieu:
        tp, kieu = _nap("logo_goc", "logo-goc.py").tach(c["ten"], os.path.join(c["tm"], "poster.jpg"), ra, ly.append, nen_sach_ai(c), logo_khoa_ai(c))
        if not tp: raise RuntimeError(f"không lấy được logo gốc từ poster phim ({'; '.join(ly) or 'không rõ'}) — mẫu Logo gốc không dựng bằng chữ vẽ thay")
        json.dump({"ban": LOGO_BAN, "kieu": kieu, "ghi": ly}, open(so, "w"), ensure_ascii=False)
        print(f"logo gốc: kiểu {kieu}" + (f" · {'; '.join(ly)}" if ly else ""), flush=True)
    if c.get("cid"): day_logo(int(c["cid"]), ra, kieu)
    lg = Image.open(ra).convert("RGBA"); tl = W / lg.width if kieu == "dai" else min(W * LOGO_RONG / lg.width, H * (cao or LOGO_CAO) / lg.height)
    return lg.resize((max(1, round(lg.width * tl)), max(1, round(lg.height * tl))), Image.LANCZOS), kieu
# CỔNG CHUNG "CHỮ KHÔNG CHE MẶT" cho MỌI mẫu (anh 20/11/2026 "các mẫu mới tìm thấy hnay từ spy và chưa có quy trình chuẩn thế này thì chuẩn bị luôn"): trước đây mỗi hàm vẽ tự
# né mặt theo toạ độ dọc của khung gốc (đoán), nhiều mẫu vẫn đè mặt khi khung chật. Giờ vòng dựng ĐO trên ảnh thật: máy đọc mặt chạy trên nền cuối (1080×1920, nền riêng của mẫu nếu có)
# → hộp mặt nới 15% → phần lớp chữ / nút phủ lên hộp mặt. Quá CHE_MAT_TOI_DA thì thử khung xếp hạng kế (tối đa KHUNG_THU khung); hết khung vẫn che → DỪNG kêu to, không đăng bản che mặt.
CHE_MAT_TOI_DA = 0.04   # tối đa 4% diện tích hộp mặt bị chữ phủ (mép tóc / cằm chạm nhẹ thì qua)
KHUNG_THU = int(os.environ.get("KHUNG_THU", 10))
def mat_tren(anh):
    """hộp mặt (x0, y0, x1, y1 — điểm ảnh) trên một ảnh 1080×1920, nới 15% mỗi phía"""
    jm = (AT.doc_mat([anh], 300) or [{}])[-1]
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

def logo_cho(c, cao, vung=LOGO_VUNG):
    """chỗ đặt một khối cao `cao` dưới mọi mặt của khung → (y, hệ số co) hoặc None nếu co tới LOGO_CO_MIN vẫn không vừa"""
    mats = c.get("mats") or [(c["mat_day"] - 1, c["mat_day"])]; tren = max(H * vung[0], max(b for _, b in mats) + LOGO_CACH_MAT)
    for k in (1.0, 0.9, LOGO_CO_MIN):
        if tren + cao * k <= H * vung[1]: return int(tren + (H * vung[1] - tren - cao * k) * 0.35), k   # lệch nhẹ về phía mặt, không dính đáy
    return None
def dt_logo_chat_lieu(c): return None, _lop_logo(c)[0]
def _lop_logo(c, them=0, cao=None, vung=LOGO_VUNG):
    """LOGO GỐC CỦA PHIM (anh 19/11/2026: "Logo phải giữ nguyên phong cách gốc") — lấy logo từ poster gốc của phim (logo-goc.py: cắt rời khi nền poster êm, không thì nguyên
    dải poster chứa logo mép mờ dần), đưa về cỡ chuẩn, đặt dưới mọi mặt trong vùng chuẩn. Khung không đủ chỗ → lỗi (vòng dựng đã chọn khung đủ chỗ trước khi tới đây)."""
    lg, kieu = logo_goc(c, cao); cho = logo_cho(c, lg.height + them, vung)   # them = khối đặt ngay dưới logo (nút CTA của mẫu ảnh động) — cùng phải nằm dưới mặt
    if not cho: raise RuntimeError("khung không đủ chỗ dưới mặt cho logo ở cỡ chuẩn (chữ không che mặt) — cần khung khác")
    y, k = cho
    if k < 1: lg = lg.resize((round(lg.width * k), round(lg.height * k)), Image.LANCZOS)
    lop = Image.new("RGBA", (W, H)); bg = Image.new("RGBA", (W, H)); bg.paste(lg, ((W - lg.width) // 2, y), lg)
    if kieu != "dai":   # logo cắt rời (không AI / có AI): viền tối sát nét + quầng mềm để đọc rõ trên khung sáng (bản dải đã mang nền của chính nó)
        al = bg.split()[3]
        toi = ImageChops.lighter(al.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3)).point(lambda v: min(235, int(v * 1.4))),
                                 al.filter(ImageFilter.GaussianBlur(30)).point(lambda v: min(140, int(v * 1.6))))
        nen = Image.new("RGBA", (W, H), (0, 0, 0, 0)); nen.putalpha(toi); lop = Image.alpha_composite(lop, nen)
    return Image.alpha_composite(lop, bg), y + lg.height
# MẪU ẢNH ĐỘNG: logo TO + nút cách xa logo (anh 25/11/2026 "Logo này bé quá, to lên ! Chữ Watch More ở dưới dính vào logo quá" — phim 179465: logo ~400px, nút cách 24px)
NUT_CACH = 70    # mép dưới logo → mép trên nút (trước 24: nút dính vào logo + quầng tối của logo)
NUT_DONG = NUT_CACH + 130   # chỗ cho nút CTA dưới logo (khoảng cách + nút ~110 + viền / bóng)
LOGO_CAO_DONG = 0.34          # trần cao logo mẫu ảnh động (logo dọc kiểu chữ xếp tầng bị trần 26% ép còn ~37% bề ngang)
LOGO_VUNG_DONG = (0.50, 0.94)  # dải logo + nút: cao hơn dải chung (mặt vẫn được giữ cách LOGO_CACH_MAT), nút xuống sát đáy
def bang_mau_logo(lg):
    """BẢNG MÀU CỦA LOGO PHIM (anh 25/11/2026 "chữ all episode và watch more dùng layout và thiết kế cho hợp với logo"): đọc điểm ảnh đặc của logo gốc →
    (sáng, giữa, tối, viền): sắc độ chiếm nhiều nhất trong các điểm có màu (vàng kim, đỏ máu, xanh băng…), lấy điểm sáng / trung vị / tối của sắc đó;
    viền = điểm đặc tối nhất (nét viền của chính logo). Logo không màu (trắng / bạc) → bảng bạc."""
    import colorsys
    im = lg.convert("RGBA"); im.thumbnail((360, 360)); px = [p[:3] for p in im.getdata() if p[3] > 200]
    hsv = [(colorsys.rgb_to_hsv(*(v / 255 for v in p)), p) for p in px]
    mau = [(h, p) for h in hsv for h, p in [h] if h[1] > 0.35 and h[2] > 0.3]
    toi = sorted(px, key=sum)[: max(1, len(px) // 20)] if px else [(20, 16, 12)]
    vien_ = tuple(min(60, sum(p[i] for p in toi) // len(toi)) for i in range(3))
    if len(mau) < max(30, len(px) // 20): return (255, 255, 255), (214, 216, 222), (120, 124, 134), (18, 18, 22)
    o = [0] * 18
    for (h, _, _), _p in mau: o[int(h * 18) % 18] += 1
    k = max(range(18), key=lambda i: o[i] + 0.5 * (o[i - 1] + o[(i + 1) % 18]))
    cung = sorted((p for (h, _, v), p in mau if min(abs(int(h * 18) - k), 18 - abs(int(h * 18) - k)) <= 1), key=lambda p: colorsys.rgb_to_hsv(*(v / 255 for v in p))[2])
    lay = lambda t: cung[min(len(cung) - 1, int(len(cung) * t))]
    sang = tuple(min(255, int(v * 1.08) + 12) for v in lay(0.95))
    return sang, lay(0.6), lay(0.15), vien_
def nhan_logo(lop, c, pal):
    """nhãn trên cùng hợp logo: chữ hoa nét chân (Copperplate) tô dải màu của logo, viền màu nét viền logo, hai vạch trang trí cùng màu hai bên — không dải trắng"""
    sang, giua, toi, vien_ = pal; chu = AT.FREE.get(c["lang"], AT.FREE["en"])[0].upper()   # to + sáng (anh 25/11/2026 "chữ episodes... khó nhìn quá": 76px đỏ thẫm trên nền gạch không đọc được)
    f, dong = vua(chu, "copper", W - 200, 104, toi_da=1, co_min=60)   # MỘT dòng khi vừa ở cỡ ≥ 60px (EN "ALL EPISODES RELEASED" 62px) — vua() không vừa thì tự bẻ dòng, nên phải kiểm cả số dòng
    if len(dong) > 1 or f.getlength(dong[0]) > W - 200: f, dong = vua(chu, "copper", W - 200, 104, toi_da=2, co_min=56)   # nhãn dài (ES "TODOS LOS EPISODIOS YA DISPONIBLES" 1.241px ở 60px) chia 2 dòng thay vì tràn khung
    m, hop = mat_chu(dong, f, int(H * 0.06))
    # TÁCH KHỎI NỀN (anh 25/11/2026 "nổi hơn, tách ra khỏi nền chung một chút"): tấm tối mép mờ sau cả dải nhãn + quầng tối ôm chữ, rồi viền dày + vát sáng
    t0, t1 = hop[1] - 34, hop[3] + 34; tam = Image.new("L", (W, H)); ImageDraw.Draw(tam).rectangle((0, t0, W, t1), fill=235)
    for k in range(W // 2):   # dải mờ dần về hai mép (dải băng, không phải khối vuông)
        a_ = max(0, min(255, int((k / (W * 0.18)) * 255))); ImageDraw.Draw(tam).line((k, t0, k, t1), fill=a_ * 235 // 255); ImageDraw.Draw(tam).line((W - 1 - k, t0, W - 1 - k, t1), fill=a_ * 235 // 255)
    toi_nen = Image.new("RGBA", (W, H), tuple(v // 6 for v in vien_) + (0,)); toi_nen.putalpha(tam.filter(ImageFilter.GaussianBlur(3))); lop.alpha_composite(toi_nen)   # dải gần đen: chữ sáng nổi trên mọi nền
    chi = Image.new("L", (W, H)); dc = ImageDraw.Draw(chi)   # hai chỉ màu logo viền trên / dưới dải
    for yy in (t0, t1): dc.rectangle((0, yy - 2, W, yy + 2), fill=255)
    chi = ImageChops.multiply(chi, tam.point(lambda v: min(255, v * 255 // 235))); to(lop, chi, giua)
    bong(lop, m.filter(ImageFilter.MaxFilter(15)), (0, 0), 14, 220); bong(lop, m, (4, 8), 6, 255)
    vien(lop, m, 8, tuple(v // 4 for v in vien_)); to(lop, m, doc_trong((255, 255, 255), (255, 246, 222), (244, 222, 172), hop))   # ruột trắng ngà, viền tối dày — dải màu logo tối quá trên nền tối
    d = ImageDraw.Draw(lop); ym = (hop[1] + hop[3]) // 2
    for a_, b_ in ((70, hop[0] - 30), (hop[2] + 30, W - 70)):
        if b_ - a_ > 40:
            d.line((a_, ym, b_, ym), fill=vien_ + (240,), width=9); d.line((a_, ym, b_, ym), fill=giua + (255,), width=4)
            for xx in ((b_,) if a_ == 70 else (a_,)): d.regular_polygon((xx, ym, 13), 4, fill=sang + (255,), outline=vien_ + (255,))
def nut_logo(lop, chu, y, pal):
    """nút CTA hợp logo: viên thuốc tô dải màu của logo (sáng → giữa → tối), viền nét viền logo + chỉ sáng bên trong, chữ màu viền (đậm, đọc rõ trên nền sáng)"""
    sang, giua, toi, vien_ = pal; f = ph("copper", 66)
    while f.getlength(chu) + 2 * 70 > W - 200 and f.size > 32: f = f.font_variant(size=f.size - 4)
    x0, y0, x1, y1 = f.getbbox(chu); w, h = x1 - x0 + 140, y1 - y0 + 56; x = (W - w) // 2; r = h // 2
    bo = Image.new("RGBA", (W, H)); ImageDraw.Draw(bo).rounded_rectangle((x - 30, y - 24, x + w + 30, y + h + 30), radius=r + 30, fill=(0, 0, 0, 150)); lop.alpha_composite(bo.filter(ImageFilter.GaussianBlur(26)))   # quầng tối tách nút khỏi nền
    bo = Image.new("RGBA", (W, H)); ImageDraw.Draw(bo).rounded_rectangle((x + 6, y + 14, x + w + 6, y + h + 14), radius=r, fill=(0, 0, 0, 220)); lop.alpha_composite(bo.filter(ImageFilter.GaussianBlur(10)))   # bóng đổ sâu
    ImageDraw.Draw(lop).rounded_rectangle((x - 8, y - 8, x + w + 8, y + h + 8), radius=r + 8, fill=vien_ + (255,))
    mk = Image.new("L", (W, H)); ImageDraw.Draw(mk).rounded_rectangle((x, y, x + w, y + h), radius=r, fill=255); to(lop, mk, doc_trong(sang, giua, toi, (x, y, x + w, y + h)))
    bong_sang = Image.new("L", (W, H)); ImageDraw.Draw(bong_sang).rounded_rectangle((x + 14, y + 6, x + w - 14, y + h // 2), radius=r - 10, fill=90)   # vệt sáng nửa trên → nút nổi khối
    to(lop, bong_sang.filter(ImageFilter.GaussianBlur(4)), (255, 255, 255))
    ImageDraw.Draw(lop).rounded_rectangle((x + 8, y + 8, x + w - 8, y + h - 8), radius=r - 8, outline=sang + (200,), width=3)
    sang_chu = sum(giua) / 3 > 110; mc = vien_ if sang_chu else (255, 255, 255)
    d = ImageDraw.Draw(lop); tx, ty = x + 70 - x0, y + 28 - y0
    if not sang_chu: d.text((tx + 2, ty + 3), chu, font=f, fill=(0, 0, 0, 180))
    d.text((tx, ty), chu, font=f, fill=mc + (255,)); return y + h
def dt_anh_dong_logo(c):
    """ẢNH ĐỘNG LOGO GỐC + CTA (anh 24/11/2026, mẫu đối thủ KneDraQ - DE - 03: "dạng AT nhưng mở rộng thành kiểu ảnh động"): lớp phủ = logo gốc của phim
    (như dt_logo_chat_lieu) + nút CTA đỏ viền vàng ngay dưới. Nền KHÔNG đứng yên: bản dựng thật đưa khung sạch qua AI chuyển động (chuyen_dong) rồi dung_dong
    cho lớp phủ hiện ở giây 1,5. Xem trước = ảnh tĩnh này."""
    lop, day = _lop_logo(c, NUT_DONG, LOGO_CAO_DONG, LOGO_VUNG_DONG)
    pal = bang_mau_logo(logo_goc(c)[0])   # nhãn + nút lấy màu / kiểu chữ theo logo của phim (anh 25/11/2026 "dùng layout và thiết kế cho hợp với logo hoặc nội dung film")
    c["_nut"] = (pal, cta(c, "WATCH MORE"), day + NUT_CACH)   # nhip_nut dựng lại đúng nút này để nảy lúc giọng gọi CTA
    nut_logo(lop, *c["_nut"][1:], pal)
    nhan_logo(lop, c, pal)   # nhãn trên cùng "All Episodes Released" như mọi AT (anh 25/11/2026 "thiếu dòng ở trên: all episodes... ở creative")
    return None, lop
CAN_CHO = {"dt_logo_chat_lieu": lambda c: (logo_goc(c)[0].height, logo_cho), "dt_anh_dong_logo": lambda c: (logo_goc(c, LOGO_CAO_DONG)[0].height + NUT_DONG, lambda c_, cao: logo_cho(c_, cao, LOGO_VUNG_DONG))}   # mẫu cần KHUNG ĐỦ CHỖ: (chiều cao khối, hàm thử chỗ) — vòng dựng duyệt khung xếp hạng tới khi vừa
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
    nut(lop, cta(c, "WATCH NOW"), day + 34, ph("impact", 64), (25, 20, 15), (255, 222, 140), (214, 160, 50), (60, 18)); return None, lop
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
    nut(lop, cta(c, "WATCH NOW"), day + 30, ph("din", 76), (60, 8, 16), (255, 255, 255), (230, 40, 60), (70, 16), bo_tron=18); return ra, lop
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
        f = ImageFont.truetype(AT.FONT_FREE, 84); nut(lop, cta(c, "Watch For Free"), int(H * 0.70), f, AT.XANH, (255, 255, 255), None, (70, 34), bo_tron=40)
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
    nut(lop, cta(c, "WATCH NOW"), hop[3] + 40, ph("impact", 62), (25, 20, 15), (255, 222, 140), (214, 160, 50), (60, 18)); return ra, lop
def dt_logo_goc(c):
    """logo tên phim chữ nghiêng nhỏ ở góc trên trái + một dòng 'phụ đề' (câu nhử) trơn giữa dưới — trông như cảnh trích từ phim thật (kiểu Extraordinary Mother of a Billionaire)"""
    lop = Image.new("RGBA", (W, H)); f, dong = vua(c["ten"], "georgia_i", int(W * 0.55), 44, 2, 30); m, _ = mat_chu(dong, f, int(H * TREN_AN), 1.1, "trai", 50)
    bong(lop, m, (3, 4), 4, 220); to(lop, m, (255, 236, 200))
    f2, d2 = vua(c["cau"], "arial_b", W - 200, 46, 2, 34); m2, _ = mat_chu(d2, f2, int(H * 0.70), 1.15); vien(lop, m2, 3, (0, 0, 0)); to(lop, m2, (255, 255, 255)); return None, lop
def dt_nut_free_do(c):
    """nút bo tròn đỏ nhỏ 'Watch Free' đặt 1/3 dưới, đè thẳng lên cảnh phim — không tên phim, không nền (kiểu Lulu the Little Goddess, 29 ngày)"""
    lop = Image.new("RGBA", (W, H)); nut(lop, cta(c, "Watch Free"), int(H * 0.70), ph("arial_b", 52), (229, 36, 54), (255, 255, 255), None, (64, 22)); return None, lop

def _ep_ngang(lop, ty=0.82, cy=None):
    """ép chữ hẹp lại theo chiều ngang quanh giữa khung (kiểu chữ cao, hẹp của poster)"""
    # lop có thể RỘNG hơn W (vẽ ở tấm W / ty để chữ không bị cắt trước khi ép) — ép theo bề rộng thật của lop, rồi đặt giữa khung W
    hep = lop.resize((int(lop.width * ty), H), Image.LANCZOS)
    if hep.width > W: hep = hep.crop(((hep.width - W) // 2, 0, (hep.width - W) // 2 + W, H))
    o = Image.new("RGBA", (W, H)); o.alpha_composite(hep, ((W - hep.width) // 2, 0)); return o
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
    nut(lop, cta(c, "WATCH MORE"), hop[3] + 50, ph("din", 76), (190, 22, 30), (255, 255, 255), (120, 10, 16), (44, 14), bo_tron=14, x_tam=(XC + W - 40) / 2); return ra, lop
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
    """nhãn 'WATCH MORE' hộp tối chữ vàng SÁT ĐỈNH + phần đầu tên phim chữ có chân GIÃN RỘNG bằng bề ngang dòng vàng + phần cuối tên phim chữ hẹp cao VÀNG kim loại
    to gần trọn bề ngang, SÁT ĐÁY khung (kiểu Undercover Prison King — 5 QC đối thủ đang chạy).
    Chuẩn phong cách 20/11/2026 (anh "mẫu ad của đối thủ đẹp hơn hẳn … clone phải giống phong cách đến 99%"), số đo từ 3 QC gốc 1220111703796822 / 29095625563443078 /
    1162363903114246: dòng vàng rộng ~86% khung, đáy ở ~95% chiều cao; dòng giãn rộng ~84% khung, cao ~1/4 dòng vàng; nhãn ở ~4% từ đỉnh, không viền.
    Tên phim vẽ trên tấm rộng W / 0,84 rồi mới ép (không cắt chữ đầu / cuối dòng)."""
    EP = 0.84; WR = int(W / EP); lop = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lop)
    tu = c["ten"].upper().split(); dau, cuoi = (" ".join(tu[:1]), " ".join(tu[1:])) if len(tu) > 2 else ((tu[0], " ".join(tu[1:])) if len(tu) == 2 else ("", tu[0]))
    f2, dong = vua(cuoi, "impact", int(W * 0.86 / EP), 300, 1, 40)   # QC gốc: phần vàng MỘT dòng trọn bề ngang; tên quá dài (chữ < 130px) mới xuống hai dòng
    if f2.size < 130: f2, dong = vua(cuoi, "impact", int(W * 0.86 / EP), 220, 2)
    cao2 = int(f2.size * 0.98) * len(dong); ro_v = min(int(W * 0.86), int(max(f2.getlength(x) for x in dong) * EP))   # bề ngang dòng vàng sau khi ép
    f1 = None
    if dau:   # chữ giãn: cỡ ~ 0,26 cỡ vàng, khoảng giãn tính cho vừa đúng bề ngang dòng vàng
        f1 = ph("didot", max(34, int(f2.size * 0.26))); kt = list(dau); rk = sum(f1.getlength(x) for x in kt)
        gian = max(4.0, (ro_v * 0.97 - rk) / max(1, len(kt) - 1))
        if rk + gian * (len(kt) - 1) > W - 80: f1 = ph("didot", max(28, int(f1.size * (W - 80) / (rk + gian * (len(kt) - 1))))); rk = sum(f1.getlength(x) for x in kt); gian = max(4.0, (min(ro_v, W - 80) * 0.97 - rk) / max(1, len(kt) - 1))
    cao1 = int(f1.size * 1.25) if f1 else 0
    tong = cao1 + cao2; y = int(H * 0.955 - tong)
    mats = c.get("mats") or [(c["mat_day"] - 1, c["mat_day"])]
    if y < max(b for _, b in mats) + 20: y = dat_y(c, tong, 0.60, 0.955)   # mặt quá thấp (chữ sát đáy sẽ che mặt) → chỗ trống gần nhất như các mẫu khác
    if f1:
        x = (W - (rk + gian * (len(kt) - 1))) / 2; m1 = Image.new("L", (W, H)); d1 = ImageDraw.Draw(m1)
        for ch in kt: d1.text((x, y), ch, font=f1, fill=255); x += f1.getlength(ch) + gian
        bong(lop, m1, (2, 4), 6, 200); to(lop, m1, (242, 236, 222)); y += cao1
    m, hop = mat_chu(dong, f2, y, 0.98, khung=WR)
    l2 = Image.new("RGBA", (WR, H)); phat_sang(l2, m, (255, 170, 40), 30, 120); bong(l2, m, (5, 9), 10, 230); vien(l2, m, 4, (58, 30, 4))
    to(l2, m, doc_trong((255, 250, 210), (246, 196, 72), (170, 104, 16), hop)); sang_khoi(l2, m, (255, 255, 235), (90, 48, 6))
    lop.alpha_composite(_ep_ngang(l2, EP))
    # NHÃN WATCH MORE sát đỉnh (~4% chiều cao), hộp tối không viền, chữ vàng nhạt — như QC gốc; đỉnh khung thường là tường / nền, không phải mặt
    f = ph("arial_b", 40); t = cta(c, "WATCH MORE"); x0, y0_, x1, y1_ = f.getbbox(t); w, h = x1 - x0 + 44, y1_ - y0_ + 26
    yn = int(H * 0.04); xn = (W - w) // 2
    tren = min(a for a, _ in mats)
    if yn + h > tren - 10: yn = max(8, tren - h - 14)   # đầu sát mép trên: nhãn lùi lên, không đè tóc / trán
    d.rectangle((xn, yn, xn + w, yn + h), fill=(24, 20, 14, 225)); d.text((xn + 22 - x0, yn + 13 - y0_), t, font=f, fill=(248, 212, 140, 255))
    return None, lop
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
    nut(lop, cta(c, "WATCH NOW!"), int(H * 0.74), ph("georgia_bi", 64), (40, 24, 10), (255, 236, 190), (214, 160, 50), (70, 18))
    nen = nen_dat_mat(c, hop[3] + 40, int(H * 0.74) - 40); return (None if nen == c["nen"] else nen), lop   # mặt nằm GIỮA đáy tên và nút

# ---------- ẢNH ĐỘNG: khung sạch → VideoExpress chuyển động (scripts/vx-mot.mts, 0₫ — anh 27/11/2026 cấm cổng video trả tiền cho AD) → lớp phủ hiện ở giây 1,5 ----------
DONG = {"dt_anh_dong_logo"}   # mẫu có nền chuyển động (dạng ảnh tĩnh mở rộng thành ảnh động)
DONG_GIAY, DONG_HIEN = 8, 1.5   # giây clip AI · giây lớp phủ (logo + nút) hiện
DONG_LENH2 = ("Continue this exact shot from a short drama with subtle cinematic motion: slow camera pull-back to a slightly wider framing, gentle movement of hair, clothes "
              "and light, natural breathing and small eye movement. Keep every face, person, outfit and the composition exactly the same, no new people, no text, no logo, no cuts, no scene change.")
DONG_LENH = ("Subtle cinematic motion of this exact still frame from a short drama: slow camera push-in, gentle movement of hair, clothes and light, natural breathing "
             "and small eye movement. Keep every face, person, outfit and the composition exactly the same, no new people, no text, no logo, no cuts, no scene change.")
LAT_LECH = 4.0   # chênh trung bình (/255) tối đa giữa khung lật và gương của khung cũ để coi là cùng khung
CHI_LAT = [False]   # --lat: cấm gửi AI chuyển động (chỉ lật clip đã trả)
def chuyen_dong(nen, tm, cid, ma, b):
    """khung sạch (chưa chữ) → clip VideoExpress 9:16 (scripts/vx-mot.mts, 0₫) → (tệp mp4, 0). Lỗi thì dừng kêu to, không lùi về cổng video trả tiền."""
    _l = "-lat" if CHI_LAT[0] else ""   # bản lật mang tên riêng: chung tên dong-<mẫu>-<b> với clip gốc thì vòng dưới bỏ qua đúng clip gương của nó + ghi đè clip đã trả
    jpg = os.path.join(tm, f"dong-{ma}{_l}-{b}.jpg"); moi = Image.open(nen).convert("RGB"); ra = os.path.join(tm, f"dong-{ma}{_l}-{b}.mp4")
    # DỰNG LẠI CÙNG KHUNG = DÙNG LẠI CLIP ĐÃ TRẢ TIỀN (anh 25/11/2026 thêm nhãn "All Episodes" vào mẫu → dựng lại creative Genie): clip AI chỉ phụ thuộc khung sạch,
    # lớp chữ phủ sau (dung_dong) — khung y hệt lần trước (chênh trung bình < 1/255) mà clip còn trên máy thì không gửi AI lần nữa, 0₫
    if os.path.exists(ra) and os.path.exists(jpg):
        cu = Image.open(jpg).convert("RGB")
        if cu.size == moi.size and sum(ImageStat.Stat(ImageChops.difference(cu, moi)).mean) / 3 < 1.0:
            print(f"chuyển động: dùng lại clip đã trả tiền của đúng khung này ({ra}) · 0₫", flush=True); return ghep_hai(ra, cid, ma, b), 0
    # KHUNG LẬT (mot(lat=True)): khung mới = gương của một khung đã có clip trong thư mục phim → clip đó lật ngang (ffmpeg hflip), 0₫
    import glob
    guong = ImageOps.mirror(moi); lech = lambda a, b: sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
    ds_lech = []
    for j in sorted(glob.glob(os.path.join(tm, f"dong-{ma}-*.jpg"))):
        mp = j[:-4] + ".mp4"
        if j == jpg or "-lat-" in os.path.basename(j) or not os.path.exists(mp): continue
        cu = Image.open(j).convert("RGB"); d = lech(cu, guong) if cu.size == moi.size else 999; ds_lech.append(f"{os.path.basename(j)} {d:.1f}")
        if d < LAT_LECH:
            r = AT.sh("ffmpeg", "-v", "error", "-y", "-i", mp, "-vf", "hflip", "-an", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", ra)
            if r.returncode or not os.path.exists(ra): raise RuntimeError(f"lật clip lỗi: {r.stderr[-200:]}")
            if os.path.exists(mp[:-4] + "-2.mp4"):   # clip nối tiếp của khung gốc cũng lật theo
                r = AT.sh("ffmpeg", "-v", "error", "-y", "-i", mp[:-4] + "-2.mp4", "-vf", "hflip", "-an", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", ra[:-4] + "-2.mp4")
                if r.returncode: raise RuntimeError(f"lật clip nối tiếp lỗi: {r.stderr[-200:]}")
            moi.save(jpg, quality=92); print(f"chuyển động: khung lật của {os.path.basename(j)} → clip đó lật ngang · 0₫", flush=True); return ghep_hai(ra, cid, ma, b), 0
    if CHI_LAT[0]: raise RuntimeError(f"--lat: không tìm thấy clip đã trả tiền khớp khung gốc của bản lật (lệch /255, ngưỡng {LAT_LECH}: {', '.join(ds_lech) or 'không có clip'}) — không gửi AI (giữ giá ~0₫)")
    moi.save(jpg, quality=92)
    # CHỈ VIDEOEXPRESS (anh 27/11/2026: "AD chỉ lên qua ckey hoặc VideoExpress · dùng videoexpress để làm video") — ckey không bán video, cổng AI chung
    # rơi xuống Kie veo3_lite 4.550₫/bản. VideoExpress = tài khoản đã mua trọn, 0₫, chạy qua phiên br trên iMac (scripts/vx-mot.mts). Lỗi thì DỪNG, không lùi về cổng trả tiền.
    vx_clip(jpg, DONG_LENH, ra, os.path.expanduser(f"~/.cache/ethopex/anh-dong/{int(cid)}-{ma}-{b}.vx.json"))
    return ghep_hai(ra, cid, ma, b), 0
def vx_clip(anh, lenh_chu, ra, so):
    """một ảnh khung đầu + câu chuyển động → clip VideoExpress tại ra (scripts/vx-mot.mts, 0₫). Lỗi thì dừng kêu to.
    Sổ uuid (so) ghi TRƯỚC khi chờ: lỗi giữa chừng thì lần chạy sau chỉ chờ + tải đúng việc đã gửi, không gửi trùng."""
    os.makedirs(os.path.dirname(so), exist_ok=True)
    g = json.load(open(so)) if os.path.exists(so) and time.time() - os.path.getmtime(so) < 24 * 3600 else {}
    lenh = os.path.splitext(ra)[0] + ".txt"; open(lenh, "w").write(lenh_chu)
    xv = os.path.normpath(os.path.join(D, "..", ".."))
    for lan in range(2):   # lần 2: uuid cũ VideoExpress bỏ việc → gửi lại một lần
        th = ["--ra", ra, *(["--uuid", g["uuid"]] if g.get("uuid") else ["--anh", anh, "--prompt-tep", lenh])]
        tsx = next((x for x in (os.path.join(xv, "..", "..", "node_modules", ".bin", "tsx"), os.path.expanduser("~/Me/GitHub/earns-marketing-os-v2/node_modules/.bin/tsx")) if os.path.exists(x)), None)
        if not tsx: raise RuntimeError("không thấy tsx (node_modules của repo) để chạy scripts/vx-mot.mts")
        p = subprocess.Popen([tsx, "scripts/vx-mot.mts", *th], cwd=xv, stdout=subprocess.PIPE, text=True,
                             env={**os.environ, "NODE_OPTIONS": "--conditions=react-server"})
        kq = {}
        for dong in p.stdout:
            if not dong.startswith("VX: "): continue
            kq = json.loads(dong[4:])
            if kq.get("gui"): json.dump({"uuid": kq["uuid"]}, open(so, "w")); print(f"chuyển động: videoexpress · 0₫ · việc {kq['uuid']}", flush=True)
        p.wait(timeout=60)
        if kq.get("ok"): break
        if g.get("uuid") and "bỏ việc" in str(kq.get("loi")): os.remove(so); g = {}; continue
        raise RuntimeError(f"VideoExpress chuyển động hỏng: {kq.get('loi') or f'vx-mot thoát mã {p.returncode}'}")
    if not kq.get("ok"): raise RuntimeError(f"VideoExpress chuyển động hỏng: {kq.get('loi')}")
    print(f"chuyển động: videoexpress xong · {kq.get('giay')}s {kq.get('kho')} · 0₫", flush=True)
    os.remove(so)
    return ra
def ghep_hai(ra, cid, ma, b):
    """HAI CLIP VIDEOEXPRESS NỐI LIỀN (anh 27/11/2026 "Videoexpress sinh 2 video ghép vào cho đa dạng hơn là dùng 1 cái rồi cắt lên xuống"):
    clip 2 sinh tiếp từ KHUNG CUỐI clip 1 với câu kéo lùi máy (clip 1 đẩy vào) → 16s chuyển động liền mạch, hết lặp clip 2 về gần khung đầu nên vòng lặp
    không giật. Thay xuôi-ngược một clip. Clip 2 đã có thì không gửi lại; --lat (cấm gửi AI) mà thiếu clip 2 → trả clip 1 (dung_dong xuôi-ngược như cũ)."""
    g_ = ra[:-4]; ra2, ghep = g_ + "-2.mp4", g_ + "-ghep.mp4"
    if not os.path.exists(ra2):
        if CHI_LAT[0]: return ra
        cuoi = g_ + "-cuoi.png"
        r = AT.sh("ffmpeg", "-v", "error", "-y", "-sseof", "-0.15", "-i", ra, "-update", "1", "-frames:v", "1", cuoi)
        if r.returncode or not os.path.exists(cuoi): raise RuntimeError(f"lấy khung cuối clip 1 lỗi: {r.stderr[-200:]}")
        print("chuyển động: clip 2 sinh tiếp từ khung cuối clip 1 (videoexpress, 0₫)", flush=True)
        vx_clip(cuoi, DONG_LENH2, ra2, os.path.expanduser(f"~/.cache/ethopex/anh-dong/{int(cid)}-{ma}-{b}-2.vx.json"))
    if not os.path.exists(ghep) or os.path.getmtime(ghep) < max(os.path.getmtime(ra), os.path.getmtime(ra2)):
        w_, h_ = AT.sh("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", ra).stdout.strip().split(",")[:2]
        kc = f"fps=30,scale={w_}:{h_}:force_original_aspect_ratio=increase,crop={w_}:{h_},setsar=1"
        r = AT.sh("ffmpeg", "-v", "error", "-y", "-i", ra, "-i", ra2, "-filter_complex",
                  f"[0:v]{kc}[a];[1:v]trim=start_frame=1,setpts=PTS-STARTPTS,{kc}[b];[a][b]concat=n=2:v=1:a=0[v]",   # bỏ khung đầu clip 2 (trùng khung cuối clip 1)
                  "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", ghep + ".tmp.mp4")
        if r.returncode: raise RuntimeError(f"ffmpeg nối hai clip: {r.stderr[-300:]}")
        os.replace(ghep + ".tmp.mp4", ghep)
    return ghep
GIONG_TRE = 0.4   # giọng vào sau 0,4s (adelay của dung_dong)
NHIP_GIAY, NHIP_NAY = 1.8, 0.5   # độ dài hiệu ứng nút · giây mỗi nhịp nảy
def moc_cta(mp3, cau_cta):
    """GIÂY GIỌNG BẮT ĐẦU ĐỌC CÂU CTA trong mp3 (câu CTA luôn là vế cuối {c} của mẫu câu giọng — "Watch More Now!", "“See more” to continue watching!"):
    khoảng lặng gần nhất với (độ dài giọng − giây ước đọc câu CTA). Cổng giọng không trả mốc từng từ → đo bằng silencedetect, 0₫."""
    dai = float(AT.sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3).stdout)
    r = AT.sh("ffmpeg", "-hide_banner", "-i", mp3, "-af", "silencedetect=noise=-35dB:d=0.12", "-f", "null", "-")
    het = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr) if float(x) < dai - 0.6]
    dich = dai - (len(re.sub(r"\W", "", cau_cta)) * 0.075 + 0.35)
    return min(het, key=lambda e: abs(e - dich)) if het else max(0.0, dich)
def nhip_nut(c, tm, b):
    """NÚT CTA NẢY ĐÚNG LÚC GIỌNG GỌI (anh 25/11/2026 "thêm hiệu ứng nút cta ở đoạn voice nhắc đến"): dựng lại đúng nút của mẫu trên lớp trống, cắt sát →
    chuỗi khung PNG NHIP_GIAY giây: nảy 3 nhịp (phóng 1 → 1,12 → 1) + quầng sáng màu logo bùng theo nhịp + vệt sáng lướt ngang thân nút → (thư mục, x, y)."""
    import shutil
    pal, chu, y = c["_nut"]; lo = Image.new("RGBA", (W, H)); nut_logo(lo, chu, y, pal)
    x0, y0, x1, y1 = lo.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox(); pad = 80
    box = (max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)); nut = lo.crop(box); bw, bh = nut.size
    dac = nut.split()[3].point(lambda v: 255 if v > 200 else 0)   # thân nút (phần đặc, không gồm quầng tối)
    qs = dac.filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(22))
    d = os.path.join(tm, f"nhip-nut-{b}"); shutil.rmtree(d, True); os.makedirs(d)
    for i in range(int(NHIP_GIAY * 30)):
        t = i / 30; nay = math.sin(math.pi * (t % NHIP_NAY) / NHIP_NAY) if t < 3 * NHIP_NAY else 0.0; s = 1 + 0.12 * nay
        f = Image.new("RGBA", (bw, bh))
        def phong(im): w2, h2 = round(bw * s), round(bh * s); im = im.resize((w2, h2), Image.LANCZOS); o = Image.new(im.mode, (bw, bh)); o.paste(im, ((bw - w2) // 2, (bh - h2) // 2)); return o
        if nay > 0.02: q = Image.new("RGBA", (bw, bh), pal[0] + (0,)); q.putalpha(phong(qs).point(lambda v: min(255, int(v * 1.7 * nay)))); f.alpha_composite(q)
        f.alpha_composite(phong(nut))
        if 0.15 <= t <= 0.85:   # vệt sáng chéo lướt trái → phải một lần, chỉ trên thân nút
            xv = int(-0.25 * bw + (t - 0.15) / 0.7 * 1.5 * bw); v = Image.new("L", (bw, bh)); ImageDraw.Draw(v).polygon([(xv, 0), (xv + 70, 0), (xv + 10, bh), (xv - 60, bh)], fill=210)
            v = ImageChops.multiply(v.filter(ImageFilter.GaussianBlur(10)), phong(dac)); w_ = Image.new("RGBA", (bw, bh), (255, 255, 255, 0)); w_.putalpha(v); f.alpha_composite(w_)
        f.save(os.path.join(d, f"{i:03d}.png"))
    return d, box[0], box[1]
def dung_dong(clip, chu, mp3, ra, nhip=None):
    """clip AI + lớp phủ hiện mờ ở giây DONG_HIEN + giọng → mp4 1080×1920. Bỏ tiếng của clip AI.
    CLIP NGẮN HƠN GIỌNG → XUÔI-NGƯỢC LẶP cho phủ hết (anh 27/11/2026 "video ngắn hơn thoại": clip AI 8s, giọng 21,6s → trước đây giữ khung cuối,
    hình đứng im ~14s chỉ còn nút nảy). Xuôi-ngược dựng ở độ phân giải gốc của clip (720p, reverse giữ cả clip trong RAM), 0₫, không gọi AI thêm.
    nhip = (thư mục khung nhip_nut, x, y, giây bắt đầu) → nút nảy chồng đúng chỗ nút tĩnh lúc giọng đọc câu CTA."""
    L = max(AT.GIAY_MIN + 1, float(AT.sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3).stdout) + 1.4)
    bo = clip if clip.endswith("-ghep.mp4") else os.path.splitext(clip)[0] + "-xn.mp4"   # hai clip đã nối (ghep_hai) lặp thẳng; còn một clip thì xuôi + ngược
    if bo != clip and (not os.path.exists(bo) or os.path.getmtime(bo) < os.path.getmtime(clip)):
        r = AT.sh("ffmpeg", "-v", "error", "-y", "-i", clip, "-filter_complex", "[0:v]split[a][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[a][r]concat=n=2:v=1:a=0[v]",
                  "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", bo + ".tmp.mp4")
        if r.returncode != 0: raise RuntimeError(f"ffmpeg xuôi-ngược: {r.stderr[-300:]}")
        os.replace(bo + ".tmp.mp4", bo)
    vao, loc = [], "[n][c]overlay=0:0[v]"
    if nhip:
        vao = ["-framerate", "30", "-i", os.path.join(nhip[0], "%03d.png")]
        loc = f"[n][c]overlay=0:0[v0];[3:v]format=rgba,setpts=PTS+{nhip[3]:.2f}/TB[nn];[v0][nn]overlay={nhip[1]}:{nhip[2]}:eof_action=pass[v]"
    r = AT.sh("ffmpeg", "-v", "error", "-y", "-stream_loop", "-1", "-i", bo, "-loop", "1", "-i", chu, "-i", mp3, *vao, "-filter_complex",
              f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},fps=30,setsar=1[n];"
              f"[1:v]format=rgba,fade=in:st={DONG_HIEN}:d=0.4:alpha=1[c];{loc};[2:a]adelay=400|400,apad[a]",
              "-map", "[v]", "-map", "[a]", "-t", f"{L:.2f}", *AT.MA_HOA, ra)
    if r.returncode != 0: raise RuntimeError(f"ffmpeg: {r.stderr[-300:]}")
    return round(L, 1)

HAM = {k: v for k, v in globals().items() if k.startswith("dt_") and callable(v)}
CAN_CAU = {x["ma"] for x in SO if x.get("cau_nhu")}   # mẫu có câu nhử (AI viết, hoặc anh gõ ở ngăn Creative của phim) — một nguồn: sổ etp-mau-cr.json "cau_nhu"
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
def mot(ma, cid, xem=False, ban=1, tc_xem=None, thu=False, lat=False):
    """dựng ban bản theo mẫu ma cho phim cid → danh sách creative_id (xem=True: chỉ tệp).
    tc_xem = bản soạn etp2 cần XEM TRƯỚC ({cau, nhan, chu_dau, o}) — dựng đúng như bản thật sẽ ra (cùng ô ghim), chỉ ảnh tĩnh, không giọng / không nạp"""
    XT = tc_xem is not None; CANH.clear(); xem = xem or thu   # thu = dựng trọn video (giọng + AI chuyển động) nhưng không ghi sổ / không nạp thư viện / không tải creative
    if ma not in HAM: raise SystemExit(f"mẫu {ma} chưa có hàm vẽ trong dung-mau.py")
    muc = next((x for x in SO if x["ma"] == ma), None)
    if not muc: raise SystemExit(f"mẫu {ma} không có trong sổ")
    dang = muc["dung_cho"][0] if ma in DONG else "poster động" if (muc["loai"] == "bo_cuc" and "poster động" in muc["dung_cho"]) else "ảnh tĩnh"   # mẫu trong DONG: dạng lấy từ dung_cho của sổ mẫu (dạng AD của sổ dạng — anh 24/11/2026)
    dang_o = ["tai_tap"]   # bước đang làm — lỗi thì ghi ĐÚNG bước hỏng (19/11/2026: ghi buoc='loi' làm Máy SX không biết hỏng ở nhịp nào)
    da_ghi = [0]   # ₫ đã ghi lên nhật ký — mỗi lần đổi bước, phần tiêu thêm (vnd − da_ghi) ghi vào dòng của bước vừa xong (#1716)
    def tt(b, t="dang", g=None, **k):
        if b not in ("xong", "loi"): dang_o[0] = b
        if not xem: ghi_tt(ma, cid, dang_o[0] if b == "loi" else b, t, g, vnd_truoc=vnd - da_ghi[0], **({"vnd": vnd} | k)); da_ghi[0] = vnd
    vnd = 0; soan = 0   # soan = mã bản soạn của anh (etp.cr_soan) khi việc đến từ ngăn "Creative của phim" — đặt trước try để nhánh lỗi đọc được
    # PHIM CẤM (anh 19/11/2026 "ko cho mở camp mới, lên creative dưới mọi hình thức"): không dựng creative cho phim trong sổ ethopex_phim_cam — trước bước tốn AI.
    # Đọc bằng xuong.phim_cam → cong.phim_cam (một hàm); lỗi đọc → coi như cấm (an toàn trước).
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import xuong as _XG
    try: _cam = _XG.phim_cam([cid]).get(int(cid))
    except Exception as e: _cam = f"không đọc được sổ phim cấm ({str(e)[:100]}) — dừng cho an toàn"
    if _cam:
        if not xem:
            ghi_tt(ma, cid, "tai_tap", "dung", f"PHIM CẤM: {_cam}"[:300])
            AT.sql(f"update etp.cr_soan s set trang_thai = 'loi', ghi = {s_(('PHIM CẤM: ' + _cam)[:300])}, cap_nhat = now() from etp.mau_dung d where d.mau = {s_(ma)} and d.content_id = {int(cid)} and s.id = (d.tuy_chon->>'soan')::int; "
                   f"update etp.phieu_len p set trang_thai = 'loi', loi = {s_(('PHIM CẤM: ' + _cam)[:300])}, cap_nhat = now() from etp.mau_dung d where d.mau = {s_(ma)} and d.content_id = {int(cid)} and p.id = (d.tuy_chon->>'phieu')::int; "
                   f"update etp.mau_dung set tuy_chon = null where mau = {s_(ma)} and content_id = {int(cid)}")
        print(f"✗ phim #{cid} cấm — không dựng: {_cam[:160]}", flush=True)
        return []
    try:
        tt("tai_tap", g="tải 3 tập miễn phí + trích khung")
        p, lang, ten, tm = ngu_canh(cid)
        if not p.get("url") and xem: raise RuntimeError("phim chưa có link tập — máy chưa trích được khung (bản dựng thật sẽ tự lấy link trước)")
        if not p.get("url"):
            # PHIM CHƯA CÓ LINK TẬP (anh 19/11/2026 "lỗi thì chúng mày phải chủ động mà sửa đi"): làm ĐÚNG bước Trang phim của dòng phim — thêm phim vào workspace
            # Ethopex của Nhà (nhan-ban.trang_chua_san → ensure-clone, idempotent) rồi gọi đồng bộ; trang có link tập 1 thì dong-bo điền etp.phim.url → lượt sau dựng tiếp
            tt("trang_phim", g="phim chưa có link tập — máy thêm phim vào workspace Ethopex của Nhà để lấy link tập 1")
            r = AT.sh("ssh", AT.B, f"{AT.ENV}; python3 - <<'PYEOF'\n{TRANG % int(cid)}\nPYEOF", han=300)
            m = re.findall(r'^\{"ly".*$', r.stdout, re.M); ly = json.loads(m[-1])["ly"] if m else f"không đọc được cổng trang phim: {(r.stderr or r.stdout)[-200:]}"
            AT.sh("ssh", AT.B, "systemctl start --no-block etp-dong-bo", han=60)   # đồng bộ kho trang phim ngay, không chờ 10 phút
            tt("trang_phim", "cho", f"chờ Ethopex sinh trang + link tập 1 (lượt sau tự dựng tiếp) · {ly or 'trang phim đã đủ, chờ đồng bộ điền link'}"[:300])
            return []
        if cid not in _NHO and (xem or lat): _NHO.update({cid: x for x in [doc_uv(tm)] if x})   # lật: ứng viên lấy từ khung sạch đã trả (dưới) — không tải / xếp AI lại (xep-khung box3 hay quá 300 giây, 26/11/2026)
        if cid not in _NHO and lat: _NHO[cid] = {"uv": [], "mo_ta": TB.mo_ta(p["url"])}   # xem trước: khung đã xếp hạng nằm trên đĩa → không tải / không xếp lại (0₫)
        if cid not in _NHO:   # một phim chỉ tải tập / xếp khung / viết câu nhử MỘT lần trong tiến trình (bảng xem trước vẽ 12 mẫu)
            uv = AT.khung(cid, p["url"], tm)
            if not xem: ghi_poster(cid, p["url"], tm)
            tt("chon_khung", g=f"{len(uv)} khung ứng viên → AI xếp hạng")
            mt = TB.mo_ta(p["url"])
            gp = {}; uv, ly_xep, v = AT.xep_ai(ten, uv, mt, p.get("the_loai") or "", chon_giong=gp) if len(uv) > 1 else (uv, "", 0); vnd += v   # cùng lượt: AI chọn kiểu giọng theo chủ đề phim
            if ly_xep: print(f"xếp khung: {ly_xep[:300]}", flush=True)
            _NHO[cid] = {"uv": uv, "mo_ta": mt, **({"giong": gp["giong"], "giong_ly_do": gp.get("giong_ly_do") or ""} if gp.get("giong") else {})}; ghi_uv(tm, _NHO[cid])
        uv_du = copy.deepcopy(_NHO[cid]["uv"]); uv = copy.deepcopy(uv_du)   # bản sao: AT.anh cộng dồn k["xoa"] — không để lượt sau mang vệt xoá của lượt trước
        # BẢN SAU KHÁC BẢN TRƯỚC (anh 20/11/2026 "khi chọn cắt tiếp creative 1 lần nữa cho cùng phim thì làm sao để mẫu có sự khác đi ?"): trước đây lần nào cũng lấy khung xếp hạng 1,
        # cùng câu nhử, cùng câu đọc → ra bản y hệt. Giờ sổ etp.mau_dung nhớ khung + câu nhử đã dùng của (mẫu, phim): lần sau bỏ khung đã dùng, ưu tiên khung KHÁC CẢM XÚC,
        # câu nhử viết góc khác, câu đọc xoay theo số bản. Hết khung mới → dừng nói rõ (không lặp bản cũ).
        da_khung, da_cau = [], []
        if not xem:
            r_ = AT.sql(bang_sql() + " alter table etp.mau_dung add column if not exists khung_dung text[] not null default '{}'; alter table etp.mau_dung add column if not exists cau_dung text[] not null default '{}'; "
                        f"select coalesce(array_to_string(khung_dung, ';'), '') || E'\t' || coalesce(array_to_string(cau_dung, ';'), '') from etp.mau_dung where mau = {s_(ma)} and content_id = {int(cid)}") or "\t"
            da_khung, da_cau = ([x for x in y.split(";") if x] for y in (r_.split("\t") + [""])[:2])
        khoa = lambda u: f"{u['tap']}#{u['so']}" + ("~lat" if u.get("lat") else ""); cx_dung = {x.split("|")[1] for x in da_khung if "|" in x}
        uv = [u for u in uv if khoa(u) not in {x.split("|")[0] for x in da_khung}]
        if not uv and not lat: raise RuntimeError(f"phim này đã dùng hết {len(da_khung)} khung ứng viên cho mẫu — không còn khung mới để ra bản khác")   # lật: ứng viên dựng riêng bên dưới
        if da_khung: uv = sorted(uv, key=lambda u: bool(u.get("cam_xuc")) and u.get("cam_xuc") in cx_dung)   # khác cảm xúc lên trước, giữ thứ hạng AI trong từng nhóm
        # BẢN ANH SOẠN (etp2 ngăn "Creative của phim", 23/11/2026): etp.mau_dung.tuy_chon = {soan, cau, nhan, chu_dau} — câu nhử anh gõ thay câu AI, chữ QC dòng đầu anh gõ
        tc = dict(tc_xem) if XT else {}
        if not xem:
            try: tc = json.loads(AT.sql(f"alter table etp.mau_dung add column if not exists tuy_chon jsonb; select coalesce(tuy_chon::text, '') from etp.mau_dung where mau = {s_(ma)} and content_id = {int(cid)}") or "{}") or {}
            except Exception as e: print("đọc tuỳ chọn bản soạn lỗi — dựng như thường:", e, file=sys.stderr); tc = {}
        soan = int(tc.get("soan") or 0)
        # PHIẾU LÊN CAMP (etp2, migration 0488, anh 27/11/2026): tuy_chon.phieu = id phiếu → bản dựng vào Chờ lên mang phieu_id; anh duyệt là lên camp đúng phiếu
        phieu = int(tc.get("phieu") or 0)
        if phieu and not xem: ban = max(ban, min(5, int(tc.get("ban") or 1)))   # phiếu nhiều mức ROAS: mỗi mức một creative MỚI (khung khác) — anh 27/11/2026
        def phieu_tt(t, g=None):
            if phieu: AT.sql(f"update etp.phieu_len set trang_thai = {s_(t)}, loi = {s_(g[:400]) if g else 'null'}, cap_nhat = now() where id = {phieu} and trang_thai in ('dung', 'cho_duyet')")
        # Ô ANH GHIM (bước Thành phần): khung = đúng khung đó (không tự đổi khung, kể cả khung bản trước đã dùng) · khung_phu = nhân vật thứ hai · giong = đúng câu đọc
        o_ = tc.get("o") or {}; tim = lambda g: next((u for u in uv_du if g and g.get("nguon") == "khung_phim" and khoa(u) == g.get("id")), None)
        k_ghim, k2_ghim = tim(o_.get("khung")), tim(o_.get("khung_phu"))
        if o_.get("khung") and not k_ghim: raise RuntimeError(f"khung anh ghim {o_['khung'].get('id')} không còn trong khung ứng viên của phim — ghim lại khung khác")
        g_ghim = next((int(x.split(":")[1]) for x in [str((o_.get("giong") or {}).get("id") or "")] if re.fullmatch(r"[a-z]{2}:\d+", x)), None)
        hien = AT.mau_hien(lang, len(AT.CAU[lang]))   # câu đọc anh đã xoá ở ngăn Lên camp (cau_doc_an) không xoay vào — câu anh GHIM vẫn đọc đúng câu ghim
        if g_ghim is not None and g_ghim >= len(AT.CAU[lang]): raise RuntimeError(f"câu đọc anh ghim {lang}:{g_ghim} không có trong sổ (có {len(AT.CAU[lang])} câu — sổ câu sinh thêm etp.cau_hinh cau_doc_them đọc không được?)")
        # MỖI CREATIVE MỘT HÌNH (anh 25/11/2026 "chỉ đổi giọng mà ko đổi hình thì ko đc coi là khác nhau. Vi phạm nghiêm trọng"): khung đã có creative CHƯA BỊ LOẠI của (mẫu, phim)
        # trong kho thư viện = cấm dựng lại — kể cả khung anh ghim, kể cả sổ mau_dung bị xoá (đọc thẳng thu_vien, không tin mỗi da_khung)
        co_hinh = set() if xem and not lat else {x for x in (AT.sql(f"select coalesce(string_agg(distinct substring(t.ghi from 'khung ([^ ]+)'), ';'), '') from etp.thu_vien t left join etp.cham_duyet u on u.creative_id = t.creative_id "
                                                         f"where t.content_id = {int(cid)} and t.creative_id is not null and t.ghi like {s_('mẫu:' + ma + ' %')} and u.ok is not false") or "").split(";") if x}
        if k_ghim and khoa(k_ghim) in co_hinh:   # khung ghim đã ra creative (bản đầu) → bản sau bỏ ghim, chọn khung khác — không chết cả lượt (anh 25/11/2026 "32 camp sẵn sàng lên lúc 22h")
            print(f"khung anh ghim {khoa(k_ghim)} đã có creative cùng mẫu — bản này bỏ ghim, chọn khung khác (mỗi creative một hình)", file=sys.stderr); k_ghim = None
        if lat:   # LẬT KHUNG TRÁI ↔ PHẢI (anh 26/11/2026 "nếu khung ko đạt thì có thể lật video từ trái sang phải… để có creative mới"): ứng viên = bản LẬT của các khung
            # đã có creative cùng mẫu → hình mới (gương), clip AI = clip đã trả tiền của khung gốc lật ngang (chuyen_dong tự nhận ra), không gọi AI chuyển động
            def _lat(u):
                v = copy.deepcopy(u); v["lat"] = True; m = v["mat"]; v["mat"] = [1 - m[0] - m[2], m[1], m[2], m[3]]
                v["xoa"] = [[1 - x - w, y, w, h] for x, y, w, h in v.get("xoa") or []]; return v
            # nguồn lật = KHUNG SẠCH ĐÃ TRẢ TIỀN (dong-<mẫu>-N.jpg + clip .mp4 trong thư mục phim): dựng lại khung từ phim (khung → xoá chữ AI) ra ảnh khác
            # khung đã gửi AI (đo 26/11/2026 phim 85055: lệch 66–85/255) → không bao giờ khớp clip; nên lấy thẳng ảnh đã gửi, gương nó, clip của nó lật ngang
            import glob, hashlib
            uv = []
            for j in sorted(glob.glob(os.path.join(tm, f"dong-{ma}-[0-9]*.jpg"))):
                if not os.path.exists(j[:-4] + ".mp4"): continue
                g_ = ImageOps.mirror(Image.open(j).convert("RGB")); gp = j[:-4] + "-guong.png"; g_.save(gp)
                try: ms = sorted([m for m in (AT.doc_mat([gp], 300) or [{}])[-1].get("mat") or [] if m[4] >= 0.45], key=lambda m: -m[2] * m[3])
                except Exception as e: print("đọc mặt khung lật lỗi:", e, file=sys.stderr); ms = []
                uv.append({"tap": "lat" + hashlib.md5(open(j, "rb").read()).hexdigest()[:8], "so": 0, "lat": True, "dong_goc": gp, "mat": list(ms[0][:4]) if ms else [0.3, 0.2, 0.4, 0.3], "xoa": []})
            k_ghim = None
            if not uv: raise RuntimeError(f"--lat: thư mục phim không còn khung sạch đã trả tiền (dong-{ma}-N.jpg + .mp4) để lật")
        uv = [u for u in uv if khoa(u) not in co_hinh]
        if not uv and not k_ghim: raise RuntimeError(f"phim này không còn khung chưa có creative cho mẫu {ma} — mỗi creative phải khác hình, không lặp khung")
        if k_ghim: uv = [k_ghim]
        cta_ghim = str((o_.get("cta") or {}).get("id") or "")   # ô CTA: "en:WATCH MORE" (sổ › thu_vien.nut.chu)
        h_ghim = ((o_.get("hook") or {}).get("chu") or (o_.get("hook") or {}).get("ten") or "").strip()
        if not (tc.get("cau") or "").strip() and h_ghim: tc["cau"] = h_ghim; tc["nhan"] = ""   # ô Hook ghim = câu nhử dùng đúng câu đó (câu gõ ở bước Chữ vẫn thắng)
        def soan_tt(t, g=None, **k):   # ghi trạng thái về bản soạn của anh (nếu việc này đến từ bản soạn)
            if soan: AT.sql(f"update etp.cr_soan set trang_thai = {s_(t)}, cap_nhat = now()" + (f", ghi = {s_(g[:500])}" if g else "") + "".join(f", {c} = {int(v)}" for c, v in k.items()) + f" where id = {soan}")
        if (tc.get("cau") or "").strip(): _ct = tc["cau"].strip(); _cn = (tc.get("nhan") or "").strip(); _NHO[cid]["cau"] = (_ct, _cn if _cn and _cn.lower() in _ct.lower() else _ct.split()[-1])
        elif ma in CAN_CAU and (da_cau or "cau" not in _NHO[cid]): c_, n_, v = cau_nhu(ten, _NHO[cid].get("mo_ta") or TB.mo_ta(p["url"]), lang, tuple(da_cau)); vnd += v; _NHO[cid]["cau"] = (c_, n_)
        cau, nhan = _NHO[cid].get("cau", ("", "")) if ma in CAN_CAU or (tc.get("cau") or "").strip() else ("", "")
        if (tc.get("cau") or "").strip(): _NHO[cid].pop("cau", None)   # câu anh gõ chỉ dùng cho đúng bản này
        cr = []; cho_duyet = []; ly_len = "cổng chữ / studio loại — xem nhật ký dung-mau"   # lý do mặc định khi bước tải lên không in lỗi nào
        for b in range(ban):
            cao_cho = CAN_CHO[ma]({"tm": tm, "ten": ten, "p": p, "cid": cid}) if ma in CAN_CHO else None; vnd += _CHI_LOGO[0]; _CHI_LOGO[0] = 0   # tách logo TRƯỚC khi chọn khung: không có logo thì dừng luôn, chưa tốn gì
            tot = None   # (che mặt, khung, nền, lớp, c) tốt nhất đã thử
            nb = (300 if XT else 100) + b   # xem trước dùng tệp riêng — không đè tệp của lượt dựng thật đang chạy cùng thư mục phim
            for lan in range(min(len(uv), KHUNG_THU)):
                k = uv[(b + lan) % len(uv)]; k["lang"] = lang   # uv đã bỏ khung các bản trước dùng
                if khoa(k) in {x.split("|")[0] for x in da_khung} and not xem: continue   # vòng modulo quay về khung bản trước của chính lượt này → bỏ (một hình một creative)
                tt("ve_mau", g=f"bản {b + 1}/{ban}: vẽ mẫu trên khung {k['tap']}#{k['so']}" + (f" (khung xếp hạng {lan + 1} — các khung trước chữ che mặt / không đủ chỗ)" if lan else ""))
                AT.CO_FREE, cu = False, AT.CO_FREE   # nền sạch không lớp Free — mẫu tự quyết lớp CTA của nó
                try:
                    if k.get("dong_goc"):   # khung lật: nền = gương khung sạch đã trả tiền, nguyên ảnh (không cắt / xoá lại)
                        nen = os.path.join(tm, f"nen-{nb}.png"); Image.open(k["dong_goc"]).convert("RGB").save(nen); Image.open(k["dong_goc"]).convert("RGB").save(os.path.join(tm, f"goc-{nb}.png"))
                    else: nen, _ = AT.anh(cid, ten, k, tm, nb)
                finally: AT.CO_FREE = cu
                goc = os.path.join(tm, f"goc-{nb}.png"); khac = [os.path.join(tm, f"goc-{nb + 100}.png")]
                if os.path.exists(khac[0]): os.remove(khac[0])
                if ma in CAN_KHUNG2 and not k.get("dong_goc") and (k2_ghim or len(uv_du) > 1):   # nhân vật thứ hai: khung anh ghim, không ghim thì khung xếp hạng kế
                    k2 = k2_ghim or next(u for u in uv_du[(b + 1):] + uv_du if khoa(u) != khoa(k)); AT.sh("ffmpeg", "-v", "error", "-y", "-ss", "3", "-i", os.path.join(tm, k2["tap"] + ".mp4"), "-vf", f"{AT.LOC},select=eq(n\\,{k2['so'] - 1})", "-frames:v", "1", khac[0])
                mats = []
                try:   # mọi mặt trên khung gốc (máy đọc Vision của anh-tinh) — khung 9:16 cắt từ khung gốc nên quy toạ độ dọc theo cùng tỉ lệ
                    jm = (AT.doc_mat([goc], 300) or [{}])[-1]
                    mats = [((m[1]) * H, (m[1] + m[3]) * H) for m in jm.get("mat") or [] if m[4] >= 0.45 and m[3] >= 0.05]
                except Exception as e: print("đọc mặt lỗi — chỉ né mặt chính:", e, file=sys.stderr)
                c = {"ma": ma, "cid": cid, "p": p, "lang": lang, "ten": ten, "tm": tm, "nen": nen, "goc": goc, "goc_khac": [x for x in khac if os.path.exists(x)], "mats": mats,
                     "mat_day": (k["mat"][1] + k["mat"][3]) * H, "mat_tam": k["mat"][1] + k["mat"][3] / 2, "cau": cau, "nhan": nhan, "cta": cta_ghim}
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
            if tot is None and k_ghim: raise RuntimeError(f"khung anh ghim {khoa(k_ghim)} không đủ chỗ dưới mặt cho khối chữ của mẫu — ghim khung khác (mặt cao hơn / ít người hơn)")
            if tot is None: raise RuntimeError(f"{min(len(uv), KHUNG_THU)} khung xếp hạng đầu đều không đủ chỗ dưới mặt cho khối chữ của mẫu (chữ không che mặt)")
            if tot[0] > CHE_MAT_TOI_DA and XT: CANH.append(f"chữ phủ {tot[0]:.0%} hộp mặt (chuẩn ≤ {CHE_MAT_TOI_DA:.0%}) — bản thật sẽ bị chặn, ghim khung khác")
            elif tot[0] > CHE_MAT_TOI_DA: raise RuntimeError(f"{min(len(uv), KHUNG_THU)} khung xếp hạng đầu, khung tốt nhất chữ vẫn phủ {tot[0]:.0%} hộp mặt (chuẩn ≤ {CHE_MAT_TOI_DA:.0%}) — chữ không che mặt")
            _, k, nen, lop, c = tot
            chu = os.path.join(tm, f"chu-{ma}-{b}{'-xem' if XT else ''}.png"); lop.save(chu)
            out = os.path.join(tm, f"{ma}-{cid}-{b + 1}{'-xem' if XT else ''}.mp4")
            if xem and not thu:   # xem: ảnh ghép tĩnh, không giọng
                Image.alpha_composite(Image.open(nen).convert("RGBA"), lop).convert("RGB").save(out.replace(".mp4", ".jpg"), quality=88); cr.append(out.replace(".mp4", ".jpg")); continue
            tt("giong", g="giọng đọc (cổng giọng chung)")
            kg, ng = AT.giong_phim(p, _NHO[cid].get("giong"), str((o_.get("giong") or {}).get("kieu") or "") or None)   # giọng theo phim + chủ đề phim (anh 25/11/2026)
            out0 = out
            for kg, ng in AT.giong_ban(kg, ng, len(da_khung) + b):   # MỘT giọng mỗi khung = giọng của phim, không xoay về giọng cố định (anh 27/11/2026)
                out = out0 if kg == AT.GIONG_MAC_DINH else out0.replace(".mp4", f"-g{kg}.mp4")
                print(f"giọng: {kg} · {AT.KIEU_GIONG[kg][0]} · {ng}" + (f" — {_NHO[cid]['giong_ly_do']}" if ng.startswith("AI") and _NHO[cid].get("giong_ly_do") else ""), flush=True)
                so_cau = g_ghim % len(AT.CAU[lang]) if g_ghim is not None else hien[(len(da_khung) + b) % len(hien)]; mp3, v, _ = AT.giong(cid, lang, ten, kg, tm, so_cau); vnd += v   # câu đọc xoay theo số bản đã dựng
                if ma in DONG:
                    tt("video", g=f"AI làm khung chuyển động {DONG_GIAY}s + dựng video 1080×1920 (lớp phủ hiện ở giây {DONG_HIEN})")
                    clip, v = chuyen_dong(nen, tm, cid, ma, b); vnd += v; nhip = None
                    if c.get("_nut"):   # nút CTA nảy đúng lúc giọng đọc câu CTA (vế cuối mẫu câu giọng)
                        t_cta = max(DONG_HIEN + 0.5, GIONG_TRE + moc_cta(mp3, AT.CAU[lang][so_cau][2])); nhip = (*nhip_nut(c, tm, b), t_cta); print(f"nút CTA nảy ở giây {t_cta:.2f}", flush=True)
                    giay = dung_dong(clip, chu, mp3, out, nhip)
                else:
                    tt("video", g="dựng video 1080×1920")
                    giay = AT.dung(nen, chu, mp3, out)
                if thu: print(f"[thử] {out} · {giay}s · {vnd}₫", flush=True); cr.append(out); continue
                tt("thu_vien", g=f"nạp thư viện ({giay}s)")
                tv = TB.nap(cid, lang, out, dang, f"mẫu:{ma} · {muc['ten']} · bản {len(da_khung) + 1} · khung {khoa(k)}" + (f" · {k['cam_xuc']} · {k.get('nhan_vat') or ''}" if k.get("cam_xuc") else "") + (f" · bản soạn #{soan}" if soan else "") + f" · giọng {kg}", v, (tc.get("chu_dau") or "").strip() or None)
                if not tv: raise RuntimeError("nạp thư viện không ra mã")
                soan_tt("dung", "đã vào thư viện — đang tải creative lên Ethopex", tv_id=tv)
                AT.sql(f"update etp.mau_dung set tv_ids = array_append(tv_ids, {int(tv)}) where mau = {s_(ma)} and content_id = {int(cid)}")
                tt("creative", g=f"tải lên Ethopex qua cổng mẫu (tv{tv})")
                r_tv = subprocess.run(["python3", os.path.join(D, "thu-vien-len.py"), str(tv)], check=False, capture_output=True, text=True)
                sys.stdout.write(r_tv.stdout); sys.stderr.write(r_tv.stderr); sys.stdout.flush()
                loi_tv = [d.strip() for d in (r_tv.stderr + r_tv.stdout).splitlines() if d.strip().startswith(("✗", "RuntimeError", "SystemExit", "LINE "))]
                if loi_tv: ly_len = " · ".join(loi_tv[-2:])[:300]   # câu lỗi THẬT của bước tải lên → ô lỗi camp (anh 27/11/2026: câu đoán "cổng chữ / studio loại" che mất lỗi SQL)
                if phieu: AT.sql(SQL_GAN_PHIEU.format(p=phieu, dk=f"c.khoa = 'tv{int(tv)}'")); phieu_tt("cho_duyet")
                c_id = AT.sql(f"select coalesce(creative_id::text, '') from etp.thu_vien where id = {int(tv)}")
                if c_id: cr.append(int(c_id)); AT.sql(f"update etp.mau_dung set creative_ids = array_append(creative_ids, {int(c_id)}) where mau = {s_(ma)} and content_id = {int(cid)}")
                else:   # cổng mẫu đặt bản vào hàng CHỜ ANH DUYỆT (etp.cho_len) thay vì tải ngay — không phải lỗi (27/11/2026: 14 bản chờ duyệt / đã lên bị ghi "dựng xong nhưng không thành creative")
                    h_ = AT.sql(f"select id from etp.cho_len where khoa = 'tv{int(tv)}' and trang_thai in ('cho', 'duyet', 'dang_len') order by id desc limit 1")
                    if h_: cho_duyet.append(f"tv{int(tv)} (#{h_})")
            if thu: continue
            AT.sql(f"update etp.mau_dung set khung_dung = array_append(khung_dung, {s_(khoa(k) + '|' + (k.get('cam_xuc') or ''))})"
                   + (f", cau_dung = array_append(cau_dung, {s_(cau.replace(';', ','))})" if cau else "") + f" where mau = {s_(ma)} and content_id = {int(cid)}")
            uv = [u for u in uv if khoa(u) != khoa(k)]; da_khung.append(khoa(k) + "|" + (k.get("cam_xuc") or ""))
        if not xem:
            if cr: tt("xong", "xong", f"{len(cr)} creative: " + ", ".join(f"#{x}" for x in cr), vnd=vnd); soan_tt("xong", f"creative #{cr[-1]} đã vào thư viện", creative_id=cr[-1])
            elif cho_duyet:   # "cho_duyet" (KHÔNG "cho": --hang + dong_phim nhặt "cho" dựng lại → tốn tiền); creative_id do cho_len.xong ghi (→ xong) khi bản lên
                g_ = "chờ anh duyệt ở etp2 › Camp › Chờ lên: " + ", ".join(cho_duyet); tt("creative", "cho_duyet", g_, vnd=vnd); soan_tt("dung", g_)
            else: tt("creative", "loi", f"dựng xong nhưng không thành creative — {ly_len}", vnd=vnd); soan_tt("loi", f"dựng xong nhưng không thành creative — {ly_len}")
            if not cr and not cho_duyet: phieu_tt("loi", f"dựng xong nhưng không thành creative — {ly_len}")
            if soan or phieu: AT.sql(f"update etp.mau_dung set tuy_chon = null where mau = {s_(ma)} and content_id = {int(cid)}")
        return cr
    except Exception as e:
        if not xem:
            tt("loi", "loi", f"{type(e).__name__}: {str(e)[:300]}", vnd=vnd)
            try:
                if soan: soan_tt("loi", f"{type(e).__name__}: {str(e)[:300]}")
                if phieu: phieu_tt("loi", f"dựng lỗi: {type(e).__name__}: {str(e)[:300]}")
                if soan or phieu: AT.sql(f"update etp.mau_dung set tuy_chon = null where mau = {s_(ma)} and content_id = {int(cid)}")
            except Exception: pass
        raise

# ---------- XEM TRƯỚC BẢN SOẠN (etp2 ngăn Creative của phim, anh 23/11/2026) ----------
CANH = []   # cảnh báo của lượt xem trước (chữ che mặt…) — bản xem vẫn ra để anh thấy, bản thật sẽ bị chặn
XEM_BOX = "/var/lib/etp-xem"   # box3: ảnh xem trước + ảnh nhỏ khung ứng viên, trang etp2 đọc qua /etp/xem?f=<cid>/…
def ghi_uv(tm, nho):
    try: json.dump({"uv": nho["uv"], "mo_ta": nho.get("mo_ta") or "", **{k: nho[k] for k in ("giong", "giong_ly_do") if nho.get(k)}, **({"cau": list(nho["cau"])} if nho.get("cau") else {})}, open(os.path.join(tm, "xem-uv.json"), "w"), ensure_ascii=False)
    except Exception as e: print("không ghi được khung đã xếp ra đĩa:", e, file=sys.stderr)
def doc_uv(tm):
    """khung đã xếp hạng của lượt dựng trước — chỉ dùng khi tập + ảnh nhỏ còn trên đĩa (máy dọn bộ nhớ đệm thì trích lại)"""
    try:
        j = json.load(open(os.path.join(tm, "xem-uv.json")))
        if j.get("uv") and all(os.path.exists(os.path.join(tm, u["tap"] + ".mp4")) and os.path.exists(u["nho"]) for u in j["uv"]):
            return {"uv": j["uv"], "mo_ta": j.get("mo_ta") or "", **{k: j[k] for k in ("giong", "giong_ly_do") if j.get(k)}, **({"cau": tuple(j["cau"])} if j.get("cau") else {})}
    except Exception: pass
    return None

def day_khung(cid, tm):
    """ảnh nhỏ khung ứng viên → box3 + etp.cr_khung (thư viện Khung phim của bước Thành phần). Chỉ đẩy khi bộ khung đổi."""
    uv = (_NHO.get(cid) or {}).get("uv") or []
    if not uv: return
    khoa = [f"{u['tap']}#{u['so']}" for u in uv]
    co = set((AT.sql(f"select khoa from etp.cr_khung where content_id = {int(cid)}") or "").splitlines())
    if co == set(khoa): return
    xa = f"{XEM_BOX}/{int(cid)}/k"; AT.sh("ssh", AT.B, f"mkdir -p {xa}")
    r = AT.sh("rsync", "-a", *[u["nho"] for u in uv], f"{AT.B}:{xa}/", han=300)
    if r.returncode: raise RuntimeError(f"đẩy ảnh khung lên box3 lỗi: {(r.stderr or r.stdout)[-200:]}")
    vals = ",".join(f"({int(cid)}, {s_(k_)}, {s_(os.path.basename(u['nho']))}, {s_(u['tap'])}, {int(u['so'])}, {s_(u.get('cam_xuc'))}, {s_(u.get('nhan_vat'))}, {i + 1})" for i, (k_, u) in enumerate(zip(khoa, uv)))
    AT.sql(f"delete from etp.cr_khung where content_id = {int(cid)}; insert into etp.cr_khung (content_id, khoa, tep, tap, so, cam_xuc, nhan_vat, hang) values {vals}")
    print(f"[xem] phim #{cid}: {len(uv)} khung ứng viên → thư viện Khung phim", flush=True)

def xem_soan():
    """mọi bản soạn đang chờ xem trước → dựng ảnh tĩnh thật (mẫu + chữ + ô ghim), đẩy lên box3, ghi xem_anh. Anh sửa tiếp trong lúc dựng → dựng lại lượt sau."""
    for _ in range(30):
        r = AT.sql("select coalesce(json_agg(json_build_object('id', id, 'cid', content_id, 'mau', mau, 'cau', cau, 'nhan', nhan, 'chu_dau', chu_dau, 'o', o) order by xem_yc), '[]') "
                   "from etp.cr_soan where xem_tt = 'cho' and mau is not null and trang_thai in ('nhap', 'loi')") or "[]"
        ds = json.loads(r)
        if not ds: return
        for s in ds:
            yc = AT.sql(f"update etp.cr_soan set xem_tt = 'dang' where id = {int(s['id'])} and xem_tt = 'cho' returning xem_yc::text")
            if not yc: continue
            cid, t0, anh, loi = int(s["cid"]), time.time(), None, None
            try:
                if s["mau"] not in HAM: raise RuntimeError(f"mẫu {s['mau']} chưa có hàm vẽ trong máy dựng")
                fs = mot(s["mau"], cid, xem=True, tc_xem={"cau": s.get("cau") or "", "nhan": s.get("nhan") or "", "chu_dau": s.get("chu_dau") or "", "o": s.get("o") or {}})
                if not fs: raise RuntimeError("phim trong sổ cấm — không dựng creative")
                tm = os.path.join(AT.C, str(cid)); day_khung(cid, tm); ghi_uv(tm, _NHO[cid]) if cid in _NHO else None   # câu nhử AI vừa viết cũng nằm lại đĩa — lượt xem sau 0₫
                ten_ = f"xem-{int(s['id'])}-{int(time.time())}.jpg"; f = os.path.join(tm, ten_)
                im = Image.open(fs[0]).convert("RGB"); im.thumbnail((540, 960)); im.save(f, quality=85)
                AT.sh("ssh", AT.B, f"mkdir -p {XEM_BOX}/{cid}"); r2 = AT.sh("rsync", "-a", f, f"{AT.B}:{XEM_BOX}/{cid}/", han=120); os.remove(f)
                if r2.returncode: raise RuntimeError(f"đẩy ảnh xem trước lên box3 lỗi: {(r2.stderr or r2.stdout)[-200:]}")
                anh, loi = f"{cid}/{ten_}", ("; ".join(CANH) or None)
                print(f"[xem] bản soạn #{s['id']} · {s['mau']} · phim #{cid}: {time.time() - t0:.0f}s{' · ' + loi if loi else ''}", flush=True)
            except Exception as e:
                loi = f"{type(e).__name__}: {str(e)[:400]}"; print(f"[xem] bản soạn #{s['id']} lỗi: {loi}", file=sys.stderr, flush=True)
            AT.sql(f"update etp.cr_soan set xem_tt = case when xem_yc > {s_(yc)}::timestamptz then 'cho' else {s_('xong' if anh else 'loi')} end, "
                   f"xem_loi = {s_(loi)}, xem_xong = now(){', xem_anh = ' + s_(anh) if anh else ''} where id = {int(s['id'])}")

SONG_SONG = 10  # số phim dựng cùng lúc trong --hang. Khe VideoExpress (5 render) giữ ở vx-br guiCoKhe, nên 10 phim = 5 phim đang render + 5 phim làm trước bước khung / ghép / chữ (anh 27/11/2026: ~12 clip/giờ → tối ưu theo 5 khe × 4 phút)
def hang():
    """mọi phim anh chọn (etp.mau_phim) HỢP mọi việc ghi thẳng vào etp.mau_dung 'cho' (phiếu lên camp etp2 — chỉ ghi mau_dung, không ghi mau_phim;
    27/11/2026 phiếu #1 AD nằm chờ mãi vì hàng chỉ đọc mau_phim) cho mẫu có hàm vẽ ở đây mà chưa dựng xong / chưa đang dựng"""
    def doc_hang(): return AT.sql(bang_sql() + " select m.mau || ':' || m.content_id from (select mau, content_id, luc from etp.mau_phim union select mau, content_id, cap_nhat from etp.mau_dung where trang_thai = 'cho') m "
                "left join etp.mau_dung d using (mau, content_id) "
                f"where m.mau in ({','.join(s_(x) for x in HAM)}) and (d.mau is null or d.trang_thai = 'cho') group by m.mau, m.content_id order by min(d.cap_nhat) nulls first, min(m.luc)")
    # SONG SONG (anh 27/11/2026 "VE chạy song song được 5 hay 10 video một lần"): mỗi phim một tiến trình con `dung-mau.py <mẫu> <phim>` (= mot(mẫu, phim),
    # tiến trình riêng vì mot() dùng biến chung CANH / _CHI_LOGO / CHI_LAT), tối đa SONG_SONG phim cùng lúc — bước VideoExpress ~4 phút không còn xếp hàng từng phim.
    # ĐỌC LẠI HÀNG mỗi khi có khe (27/11/2026: 4 phim xếp lại giữa lượt nằm chờ tới khi cả lượt cũ xong — hàng chỉ đọc một lần lúc mở):
    # chạy tới khi không còn phim đang dựng và hàng hết việc mới. `dang` giữ (mẫu, phim) để không mở trùng trước khi tiến trình con kịp ghi 'dang'.
    dang, xong = {}, set()
    while True:
        dang = {k: p for k, p in dang.items() if p.poll() is None or xong.add(k)}
        moi = [] if len(dang) >= SONG_SONG else [tuple(l.split(":")) for l in (doc_hang() or "").splitlines() if ":" in l]
        moi = [k for k in moi if k not in dang and k not in xong]
        for k in moi[:SONG_SONG - len(dang)]:
            dang[k] = subprocess.Popen([sys.executable, os.path.abspath(__file__), k[0], str(int(k[1]))])
        if not dang: break
        time.sleep(10)

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
    if a[0] == "--nang-cap-xong":   # mẫu đã nâng cấp theo lý do "Sinh lại" của anh (etp.mau_sinh_lai) → đưa việc về hàng chờ, máy dựng bản mới
        ma_, cid_, ghi_ = a[1], int(a[2]), (a[3] if len(a) > 3 else "đã nâng cấp mẫu")
        print(AT.sql(f"""update etp.mau_sinh_lai set trang_thai = 'xong', nang_cap = {s_(ghi_)}, xong_luc = now() where mau = {s_(ma_)} and content_id = {cid_} and trang_thai = 'cho_nang_cap';
            update etp.mau_dung set buoc = 'cho', trang_thai = 'cho', cap_nhat = now(), ghi = {s_(('mẫu đã nâng cấp: ' + ghi_ + ' — chờ máy dựng bản mới')[:500])}
            where mau = {s_(ma_)} and content_id = {cid_} and trang_thai = 'cho_nang_cap' returning mau || ' · ' || content_id || ' → hàng chờ'""") or "không có việc nào đang chờ nâng cấp cho mẫu + phim này"); sys.exit(0)
    if a[0] == "--hang": hang()
    elif a[0] == "--xem-soan": xem_soan()
    elif a[0] == "--day-logo": day_logo_cu()
    elif a[0] == "--bang": bang_xem(int(a[1]))
    elif a[0] == "--poster": print(ghi_poster(int(a[1]), ngu_canh(int(a[1]))[0].get("url")))   # ghi bù poster gốc cho phim đã dựng trước 19/11/2026
    else: CHI_LAT[0] = "--lat" in a; print(json.dumps(mot(a[0], int(a[1]), "--xem" in a, int(a[a.index("--ban") + 1]) if "--ban" in a else 1, thu="--thu" in a, lat="--lat" in a)))
