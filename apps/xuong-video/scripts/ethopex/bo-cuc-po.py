#!/usr/bin/env python3
"""BỐ CỤC ĐA DẠNG cho ảnh dạng PO (poster động) — $0 (anh 08/11/2026 "Giải pháp phải là $0" · "tao cần là bố cục đa dạng của các mẫu poster"):
không GPU thuê, không API trả phí. PO = ẢNH + giọng → video (giọng / dựng đã có ở anh-tinh.py) → chỉ tấm ảnh cần đa dạng bố cục.
Dựng từ KHUNG HÌNH THẬT của phim (đúng diễn viên, khớp trang phim) + tách người khỏi nền bằng rembg (CPU, miễn phí, u2net_human_seg tải một lần)
+ 9 bố cục học từ poster phim (bảng Pinterest anh gửi):
  kem       nền kem, ảnh khung phía trên, tên phim chữ đậm + vạch mảnh (The Godfather / Titanic)
  mot_mau   người tách nền đổ HAI MÀU trên nền phẳng, tên phim tràn ngang (Joker / Oppenheimer)
  chu_sau   tên phim khổng lồ đỏ phía SAU, người tách nền đè lên trước (Monster / The Batman)
  ghep      ba khung thật xếp chéo + dải tên giữa (ghép mảnh)
  toi_gian  người trắng đen trên nền giấy + vệt đỏ, chữ Didot (The Substance)
  leon      người màu bên trái, tên phim xếp dọc từng chữ cột phải (Léon)
  chan_dung cận mặt rất lớn, viền tối, tên chữ có chân trắng dưới (teaser Oppenheimer / The Batman)
  khung_tron ảnh trong vòng tròn giữa nền vàng + dải đen, tên chữ vàng (Train to Busan)
  hai_nguoi hai khung chia chéo + dải tên chéo đỏ (poster hai nhân vật)
Chạy (iMac): ~/.venvs/poster-mau/bin/python bo-cuc-po.py <content_id> [<content_id> …] [--ten "<tên>"]
  → ~/.cache/ethopex/anh-tinh/<id>/bo-cuc/<kiểu>.png + bảng ghép ~/.cache/ethopex/anh-tinh/bo-cuc-bang.jpg
Đầu vào: khung của anh-tinh.py (~/.cache/ethopex/anh-tinh/<id>/khung/*.jpg). Tên phim: --ten hoặc etp.dong_phim trên box3."""
import glob, importlib.util, json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageStat

C = os.path.expanduser("~/.cache/ethopex/anh-tinh"); W, H = 1080, 1920
F = "/System/Library/Fonts/Supplemental/"
FONT = {"impact": F + "Impact.ttf", "din": F + "DIN Condensed Bold.ttf", "futura": F + "Futura.ttc", "didot": F + "Didot.ttc"}
_rb = None
# KHUNG SẠCH CHỮ: phụ đề / logo in cứng trên khung bị đọc bằng máy đọc chữ của anh-tinh.py (Vision macOS, $0) rồi xoá bằng chính hàm xoa() của nó — một chỗ, không viết bản thứ hai
_s = importlib.util.spec_from_file_location("anh_tinh", os.path.join(os.path.dirname(os.path.abspath(__file__)), "anh-tinh.py")); AT = importlib.util.module_from_spec(_s); _s.loader.exec_module(AT)
_sach = {}
def mo(p):
    """mở khung đã xoá phụ đề / chữ in cứng (nhớ theo đường dẫn)"""
    if p not in _sach:
        j = json.loads(subprocess.run([AT.may_doc(), p], capture_output=True, text=True, timeout=120).stdout.strip() or "{}")
        hop = [[x - w / 2, y - h / 2, w * 2, h * 2] if AT.goc_nho([t, x, y, w, h]) else [x, y, w, h] for t, x, y, w, h in j.get("khung") or []]
        _sach[p] = AT.xoa(Image.open(p).convert("RGB"), hop) if hop else Image.open(p).convert("RGB")
    return _sach[p].copy()

def tach(im):
    """người tách nền (RGBA) — rembg u2net_human_seg, CPU"""
    global _rb
    from rembg import new_session, remove
    if _rb is None: _rb = new_session("u2net_human_seg")
    return remove(im, session=_rb)

def chon_khung(cid, so=3):
    """chọn khung có người rõ: lấy mẫu đều ~36 khung, chấm = diện tích người (12–55%, gần giữa) × độ nét; trả `so` khung cách xa nhau"""
    ds = sorted(glob.glob(os.path.join(C, str(cid), "khung", "*.jpg")))
    if not ds: raise SystemExit(f"#{cid}: không có khung trong {C}/{cid}/khung")
    mau = ds[:: max(1, len(ds) // 36)]
    diem = []
    for i, p in enumerate(mau):
        im = Image.open(p).convert("RGB"); nho = im.resize((im.width // 4, im.height // 4))   # chọn khung: ảnh thô đủ (đọc chữ chỉ cho khung được chọn)
        a = tach(nho).getchannel("A"); s = ImageStat.Stat(a).mean[0] / 255
        bb = a.point(lambda v: 255 if v > 128 else 0).getbbox()
        if not bb or not (0.12 <= s <= 0.55): continue
        giua = 1 - abs((bb[0] + bb[2]) / 2 / nho.width - 0.5)
        net = ImageStat.Stat(nho.convert("L").filter(ImageFilter.FIND_EDGES)).var[0] ** 0.5
        diem.append((s * giua * net, i, p))
    diem.sort(reverse=True); chon = []
    for _, i, p in diem:
        if all(abs(i - j) >= 4 for j, _ in chon): chon.append((i, p))
        if len(chon) == so: break
    return [p for _, p in chon] or mau[:so]

def phu(im, w, h):
    """cắt phủ kín w×h, giữ phần trên (mặt)"""
    r = max(w / im.width, h / im.height); im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x = (im.width - w) // 2; y = max(0, min(im.height - h, int((im.height - h) * 0.25)))
    return im.crop((x, y, x + w, y + h))

def font_vua(chu, ten_font, rong, cao_max, idx=0):
    co = cao_max
    while co > 20:
        f = ImageFont.truetype(FONT[ten_font], co, index=idx); b = f.getbbox(chu)
        if b[2] - b[0] <= rong: return f
        co -= 4
    return ImageFont.truetype(FONT[ten_font], 20, index=idx)

def chia_dong(ten, toi_da=3):
    tu = ten.split(); n = min(toi_da, max(1, round(len(ten) / 14)))
    if n == 1 or len(tu) == 1: return [ten]
    dong, cur, muc = [], [], len(ten) / n
    for t in tu:
        if cur and len(" ".join(cur + [t])) > muc * 1.15 and len(dong) < n - 1: dong.append(" ".join(cur)); cur = [t]
        else: cur.append(t)
    return dong + [" ".join(cur)]

def ve_ten(d, ten, font, y, rong, mau, cao_max=260, gian=10, idx=0):
    for dg in chia_dong(ten):
        f = font_vua(dg, font, rong, cao_max, idx); b = f.getbbox(dg)
        d.text(((W - (b[2] - b[0])) // 2 - b[0], y - b[1]), dg, font=f, fill=mau); y += b[3] - b[1] + gian
    return y

def nguoi_cat(cut, p, cao):
    goc = mo(p); n = cut(p, goc); bb = n.getchannel("A").getbbox(); n = n.crop(bb) if bb else n
    r = cao / n.height; return goc, n.resize((round(n.width * r), round(n.height * r)), Image.LANCZOS)

def kem(k, ten, cut):
    im = Image.new("RGB", (W, H), "#EFE8DA"); im.paste(phu(mo(k[0]), 960, 1180), (60, 60))
    d = ImageDraw.Draw(im); y = ve_ten(d, ten.upper(), "futura", 1300, 960, "#1b1b1b", cao_max=150, idx=4)
    d.line((60, y + 24, W - 60, y + 24), fill="#1b1b1b", width=3)
    d.text((60, y + 50), "FULL SERIES  ·  WATCH NOW", font=ImageFont.truetype(FONT["futura"], 34), fill="#555")
    return im

def mot_mau(k, ten, cut):
    _, n = nguoi_cat(cut, k[0], H * 0.78); toi, sang = (18, 32, 44), (247, 147, 30)
    m = ImageOps.colorize(ImageOps.autocontrast(n.convert("L")), toi, sang).convert("RGBA"); m.putalpha(n.getchannel("A"))
    im = Image.new("RGB", (W, H), toi); im.paste(m, ((W - m.width) // 2, H - m.height), m)
    ve_ten(ImageDraw.Draw(im), ten.upper(), "impact", 90, 980, sang, cao_max=230); return im

def chu_sau(k, ten, cut):
    goc, n = nguoi_cat(cut, k[0], H * 0.72)
    nen = Image.blend(phu(goc, W, H).filter(ImageFilter.GaussianBlur(28)), Image.new("RGB", (W, H), "black"), 0.55)
    ve_ten(ImageDraw.Draw(nen), ten.upper(), "impact", 120, 1040, "#d7261e", cao_max=420, gian=0)
    nen.paste(n, ((W - n.width) // 2, H - n.height), n); return nen

def ghep(k, ten, cut):
    im = Image.new("RGB", (W, H), "black"); cao = H // 3
    for i, p in enumerate((k * 3)[:3]):
        o = phu(mo(p), W, cao + 120)
        m = Image.new("L", (W, cao + 120), 0); ImageDraw.Draw(m).polygon([(0, 60), (W, 0), (W, cao + 60), (0, cao + 120)], fill=255)
        im.paste(o, (0, i * cao - 40), m)
    d = ImageDraw.Draw(im); y0 = H // 2 - 150; d.rectangle((0, y0, W, y0 + 300), fill="#f4f1ea")
    ve_ten(d, ten.upper(), "din", y0 + 40, 980, "#111", cao_max=120); return im

def toi_gian(k, ten, cut):
    _, n = nguoi_cat(cut, k[0], H * 0.66)
    tg = ImageOps.autocontrast(n.convert("L")).convert("RGBA"); tg.putalpha(n.getchannel("A"))
    im = Image.new("RGB", (W, H), "#e9e6df"); d = ImageDraw.Draw(im)
    d.polygon([(120, 1250), (980, 380), (1040, 460), (180, 1330)], fill="#c3271b")
    im.paste(tg, ((W - tg.width) // 2, 200), tg); ve_ten(d, ten, "didot", 1520, 940, "#161616", cao_max=150); return im

def leon(k, ten, cut):
    """người màu bên trái, tên phim xếp DỌC từng chữ cái cột phải (Léon)"""
    _, n = nguoi_cat(cut, k[0], H * 0.9); im = Image.new("RGB", (W, H), "#f2efe8")
    im.paste(n, (max(-n.width // 4, 380 - n.width // 2 - 120), H - n.height), n)
    d = ImageDraw.Draw(im); chu = [c for c in ten.split()[0].upper() if c.isalnum()][:7] or ["?"]
    co = min(250, int((H - 160) / len(chu))); f = ImageFont.truetype(FONT["impact"], co)
    for i, c in enumerate(chu):
        b = f.getbbox(c); d.text((W - 90 - (b[2] - b[0]) // 2 - b[0] - 60, 80 + i * co - b[1]), c, font=f, fill="#111")
    rest = " ".join(ten.split()[1:])
    if rest: d.text((60, 70), rest.upper(), font=font_vua(rest.upper(), "din", 560, 70), fill="#111")
    return im

def chan_dung(k, ten, cut):
    """cận mặt rất lớn, viền tối, tên phim chữ có chân trắng phía dưới (teaser Oppenheimer / The Batman)"""
    goc = mo(k[0]); a = cut(k[0], goc).getchannel("A"); bb = a.getbbox() or (0, 0, goc.width, goc.height)
    w = bb[2] - bb[0]; cx = (bb[0] + bb[2]) // 2; top = bb[1]; side = int(w * 0.9)
    mat = goc.crop((max(0, cx - side // 2), max(0, top - side // 10), min(goc.width, cx + side // 2), min(goc.height, top + int(side * 1.25))))
    im = phu(mat, W, H); v = Image.new("L", (W, H), 0); ImageDraw.Draw(v).ellipse((-W * 0.3, -H * 0.15, W * 1.3, H * 0.95), fill=255)
    im = Image.composite(im, Image.new("RGB", (W, H), "black"), v.filter(ImageFilter.GaussianBlur(160)))
    d = ImageDraw.Draw(im); y = ve_ten(d, ten.upper(), "didot", 1500, 960, "#f5f2ea", cao_max=120, idx=1)
    d.text((W // 2, y + 30), "THE FULL STORY  ·  NOW STREAMING", font=ImageFont.truetype(FONT["futura"], 30), fill="#bdb6a8", anchor="mt"); return im

def khung_tron(k, ten, cut):
    """ảnh khung trong vòng tròn giữa nền phẳng + dải màu dưới, tên phim chữ đen (Train to Busan)"""
    im = Image.new("RGB", (W, H), "#f0c419"); o = phu(mo(k[1 % len(k)]), 860, 860)
    m = Image.new("L", (860, 860), 0); ImageDraw.Draw(m).ellipse((0, 0, 859, 859), fill=255); im.paste(o, (110, 230), m)
    d = ImageDraw.Draw(im); d.rectangle((0, 1250, W, H), fill="#1d1d1b")
    ve_ten(d, ten.upper(), "din", 1330, 980, "#f0c419", cao_max=170); return im

def hai_nguoi(k, ten, cut):
    """hai khung chia chéo trên / dưới, dải tên chéo giữa (poster hai nhân vật)"""
    im = Image.new("RGB", (W, H), "black"); a, b = phu(mo(k[0]), W, H), phu(mo(k[1 % len(k)]), W, H)
    m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).polygon([(0, 0), (W, 0), (W, H * 0.42), (0, H * 0.58)], fill=255)
    im.paste(b, (0, 0)); im.paste(a, (0, 0), m)
    bang = Image.new("RGBA", (W + 400, 260), (215, 38, 30, 255)); d2 = ImageDraw.Draw(bang)
    f = font_vua(ten.upper(), "impact", W - 80, 150); bx = f.getbbox(ten.upper())
    d2.text(((W + 400 - (bx[2] - bx[0])) // 2 - bx[0], (260 - (bx[3] - bx[1])) // 2 - bx[1]), ten.upper(), font=f, fill="white")
    bang = bang.rotate(8.5, expand=True, resample=Image.BICUBIC); im.paste(bang, ((W - bang.width) // 2, int(H * 0.5) - bang.height // 2), bang); return im

KIEU = {"kem": kem, "mot_mau": mot_mau, "chu_sau": chu_sau, "ghep": ghep, "toi_gian": toi_gian, "leon": leon, "chan_dung": chan_dung, "khung_tron": khung_tron, "hai_nguoi": hai_nguoi}

def ten_phim(cid):
    q = f"select ten from etp.dong_phim where content_id = {int(cid)} order by id desc limit 1"
    r = subprocess.run(["ssh", "root@167.233.241.16", f"cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql \"$DATABASE_URL\" -tAc \"{q}\""], capture_output=True, text=True, timeout=60)
    return r.stdout.strip() or f"Phim {cid}"

def lam(cid, ten=None):
    ten = ten or ten_phim(cid); ra = os.path.join(C, str(cid), "bo-cuc"); os.makedirs(ra, exist_ok=True)
    k = chon_khung(cid); cache = {}
    cut = lambda p, im: cache.setdefault(p, tach(im))
    tep = []
    for ma, f in KIEU.items():
        p = os.path.join(ra, f"{ma}.png"); f(k, ten, cut).save(p); tep.append(p)
    return ten, tep

def bang(ds, ra):
    o = 300, 533; im = Image.new("RGB", (o[0] * len(KIEU) + 20 + 5 * len(KIEU), (o[1] + 70) * len(ds) + 20), "#111"); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT["futura"], 26)
    for r, (cid, ten, tep) in enumerate(ds):
        y = 20 + r * (o[1] + 70); d.text((20, y), f"#{cid}  {ten}", font=f, fill="#ddd")
        for c, p in enumerate(tep): im.paste(Image.open(p).convert("RGB").resize(o, Image.LANCZOS), (20 + c * (o[0] + 5), y + 40))
    im.save(ra, quality=88)

if __name__ == "__main__":
    a = sys.argv[1:]; ten = a[a.index("--ten") + 1] if "--ten" in a else None
    ids = [x for x in a if x.isdigit()]; ds = []
    for cid in ids:
        t, tep = lam(cid, ten if len(ids) == 1 else None); ds.append((cid, t, tep)); print(f"#{cid} {t}: {len(tep)} ảnh → {os.path.dirname(tep[0])}", flush=True)
    if ds:
        p = os.path.join(C, "bo-cuc-bang.jpg"); bang(ds, p); print("bảng:", p)
