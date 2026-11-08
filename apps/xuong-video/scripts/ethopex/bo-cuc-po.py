#!/usr/bin/env python3
"""BỐ CỤC ẢNH DẠNG PO THEO TỪNG PHIM — $0 (anh 08/11/2026: "Giải pháp phải là $0" · "tao cần là bố cục đa dạng của các mẫu poster" ·
"Nó phải thay đổi tuỳ theo phim nữa chứ"): không GPU thuê, không API trả phí. PO = ẢNH + giọng → video (giọng / dựng đã có ở anh-tinh.py).

MỖI PHIM MỘT BỘ THIẾT KẾ RIÊNG — máy đọc HỒ SƠ PHIM (doc_phim) rồi mới dựng:
  thể loại   etp.phim.the_loai (tình cảm · tỷ phú · võ danh · sói · fantasy · mẹ con · mafia · cổ trang…) → CHỌN BỐ CỤC + PHÔNG + giọng chữ
  bảng màu   lượng tử hoá poster gốc của phim (poster.jpg) → màu tối / màu sáng / màu nhấn — mọi bố cục tô bằng màu CỦA PHIM, không màu cố định
  tên phim   chữ tên tách từ chính poster gốc (ten-poster.png, anh-tinh.ten_poster) — đúng kiểu chữ của phim; thiếu thì chữ theo phông thể loại
  tagline    câu đầu đoạn tóm tắt phim (att-*.chu.txt)
  khung      khung hình thật có người rõ (đúng diễn viên, khớp trang phim) — phụ đề xoá bằng máy đọc chữ + xoa() của anh-tinh.py; người tách nền rembg (CPU)
Bố cục (học từ poster phim, bảng Pinterest anh gửi) — mỗi thể loại một bộ 5 trong 9:
  kem · mot_mau · chu_sau · ghep · toi_gian · leon · chan_dung · khung_tron · hai_nguoi   (mô tả ở từng hàm)
Chạy (iMac): ~/.venvs/poster-mau/bin/python bo-cuc-po.py <content_id> [<content_id> …]
  → ~/.cache/ethopex/anh-tinh/<id>/bo-cuc/<kiểu>.png + bảng ghép ~/.cache/ethopex/anh-tinh/bo-cuc-bang.jpg (mỗi phim một hàng, ghi hồ sơ phim)"""
import colorsys, glob, importlib.util, json, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageStat

C = os.path.expanduser("~/.cache/ethopex/anh-tinh"); W, H = 1080, 1920
F = "/System/Library/Fonts/Supplemental/"
# phông: (tệp, chỉ số trong .ttc)
PH = {"impact": ("Impact.ttf", 0), "din": ("DIN Condensed Bold.ttf", 0), "futura": ("Futura.ttc", 0), "futura_dam": ("Futura.ttc", 4),
      "didot": ("Didot.ttc", 0), "didot_nghieng": ("Didot.ttc", 1), "bodoni_nghieng": ("Bodoni 72.ttc", 1), "copper": ("Copperplate.ttc", 2),
      "basker": ("Baskerville.ttc", 4), "basker_nghieng": ("Baskerville.ttc", 5)}
def phong(ten, co): f, i = PH[ten]; return ImageFont.truetype(F + f, co, index=i)

# THỂ LOẠI → bộ bố cục (thứ tự = ưu tiên) + phông tên (khi thiếu chữ tên từ poster) + phông tagline + câu mời mặc định
LOAI = {
    "ty_phu":   (["chan_dung", "kem", "hai_nguoi", "toi_gian", "mot_mau"], "didot", "basker_nghieng", "Power. Money. Revenge."),
    "mafia":    (["chan_dung", "mot_mau", "chu_sau", "hai_nguoi", "leon"], "didot", "basker_nghieng", "Loyalty has a price."),
    "hoi_han":  (["toi_gian", "hai_nguoi", "kem", "chan_dung", "khung_tron"], "didot_nghieng", "basker_nghieng", "Some regrets come too late."),
    "tinh_cam": (["hai_nguoi", "khung_tron", "kem", "toi_gian", "chan_dung"], "bodoni_nghieng", "basker_nghieng", "Love was never part of the deal."),
    "me_con":   (["khung_tron", "kem", "hai_nguoi", "toi_gian", "ghep"], "bodoni_nghieng", "basker_nghieng", "A mother never gives up."),
    "doi_thuong": (["kem", "khung_tron", "hai_nguoi", "ghep", "toi_gian"], "basker", "basker_nghieng", "Life changes in a single day."),
    "vo_danh":  (["chu_sau", "mot_mau", "leon", "ghep", "chan_dung"], "impact", "futura", "Never underestimate a nobody."),
    "he_thong": (["chu_sau", "mot_mau", "ghep", "leon", "chan_dung"], "impact", "futura", "The system has chosen him."),
    "fantasy":  (["mot_mau", "chu_sau", "chan_dung", "ghep", "khung_tron"], "copper", "basker_nghieng", "Destiny awakens."),
    "soi":      (["mot_mau", "chan_dung", "chu_sau", "hai_nguoi", "toi_gian"], "copper", "basker_nghieng", "The moon chose her."),
    "co_trang": (["chan_dung", "toi_gian", "mot_mau", "kem", "hai_nguoi"], "copper", "basker_nghieng", "An empire built on secrets."),
    "vien_tuong": (["mot_mau", "chu_sau", "ghep", "chan_dung", "leon"], "futura_dam", "futura", "The future starts now."),
}
LOAI_MAC = (["kem", "chu_sau", "hai_nguoi", "mot_mau", "toi_gian"], "futura_dam", "basker_nghieng", "Watch the full story.")

# KHUNG SẠCH CHỮ: phụ đề / logo in cứng đọc bằng máy đọc chữ của anh-tinh.py (Vision macOS, $0) rồi xoá bằng chính xoa() của nó — một chỗ, không bản thứ hai
_s = importlib.util.spec_from_file_location("anh_tinh", os.path.join(os.path.dirname(os.path.abspath(__file__)), "anh-tinh.py")); AT = importlib.util.module_from_spec(_s); _s.loader.exec_module(AT)
_sach, _cat, _rb = {}, {}, None
def mo(p):
    """khung đã xoá phụ đề / chữ in cứng"""
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

def cat(p):
    """người tách nền của khung sạch p (nhớ)"""
    if p not in _cat: _cat[p] = tach(mo(p))
    return _cat[p]

def chon_khung(cid, so=3):
    """khung có người rõ: lấy mẫu ~36 khung, chấm = diện tích người (12–55%, gần giữa) × độ nét; trả `so` khung cách xa nhau + số khung có ≥ 2 người"""
    ds = sorted(glob.glob(os.path.join(C, str(cid), "khung", "*.jpg")))
    if not ds: raise SystemExit(f"#{cid}: không có khung trong {C}/{cid}/khung")
    mau = ds[:: max(1, len(ds) // 36)]; diem = []; hai = 0
    for i, p in enumerate(mau):
        nho = Image.open(p).convert("RGB"); nho = nho.resize((nho.width // 4, nho.height // 4))
        a = tach(nho).getchannel("A"); s = ImageStat.Stat(a).mean[0] / 255
        bb = a.point(lambda v: 255 if v > 128 else 0).getbbox()
        if not bb: continue
        if (bb[2] - bb[0]) / nho.width > 0.7 and s > 0.18: hai += 1   # người trải rộng gần hết khung ≈ hai người cạnh nhau
        if not (0.12 <= s <= 0.55): continue
        giua = 1 - abs((bb[0] + bb[2]) / 2 / nho.width - 0.5)
        net = ImageStat.Stat(nho.convert("L").filter(ImageFilter.FIND_EDGES)).var[0] ** 0.5
        diem.append((s * giua * net, i, p))
    diem.sort(reverse=True); chon = []
    for _, i, p in diem:
        if all(abs(i - j) >= 4 for j, _ in chon): chon.append((i, p))
        if len(chon) == so: break
    return ([p for _, p in chon] or mau[:so]), hai

def bang_mau(poster, khung):
    """màu CỦA PHIM: lượng tử hoá poster gốc (thiếu thì khung) → toi (tối nhất), sang (sáng nhất), nhan (đậm + rực nhất, đủ sáng)"""
    im = Image.open(poster if os.path.exists(poster) else khung).convert("RGB").resize((200, 300))
    q = im.quantize(8, method=Image.Quantize.MEDIANCUT); pal = q.getpalette()[:24]; dem = sorted(q.getcolors(), reverse=True)
    mau = [tuple(pal[i * 3:i * 3 + 3]) for _, i in dem]
    hsv = lambda c: colorsys.rgb_to_hsv(*[x / 255 for x in c])
    toi = min(mau, key=lambda c: hsv(c)[2]); sang = max(mau, key=lambda c: hsv(c)[2] - hsv(c)[1] * 0.3)
    nhan = max(mau, key=lambda c: hsv(c)[1] * (0.4 + hsv(c)[2]) if hsv(c)[2] > 0.35 else 0)
    h, s_, v = hsv(toi); toi = tuple(round(x * 255) for x in colorsys.hsv_to_rgb(h, min(1, s_ * 1.1), min(v, 0.16)))   # nền tối đủ sâu, giữ sắc của phim
    h, s_, v = hsv(nhan); nhan = tuple(round(x * 255) for x in colorsys.hsv_to_rgb(h, max(s_, 0.55), max(v, 0.75)))
    h, s_, v = hsv(sang); sang = tuple(round(x * 255) for x in colorsys.hsv_to_rgb(h, min(s_, 0.12), max(v, 0.92)))   # nền giấy sáng ngả sắc phim
    return {"toi": toi, "sang": sang, "nhan": nhan}

def doc_phim(cid):
    """HỒ SƠ PHIM: tên, thể loại (box3 etp.phim / etp.dong_phim), bảng màu poster gốc, chữ tên từ poster, tagline, khung, số khung hai người"""
    q = (f"select coalesce((select ten from etp.phim where content_id = {int(cid)}), (select ten from etp.dong_phim where content_id = {int(cid)} order by id desc limit 1))"
         f" || '|' || coalesce((select the_loai from etp.phim where content_id = {int(cid)}), (select the_loai from etp.dong_phim where content_id = {int(cid)} and the_loai is not null order by id desc limit 1), '')")
    r = subprocess.run(["ssh", "root@167.233.241.16", f"cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql \"$DATABASE_URL\" -tAc \"{q}\""], capture_output=True, text=True, timeout=60)
    ten, _, loai = (r.stdout.strip() or f"Phim {cid}|").partition("|")
    d = os.path.join(C, str(cid)); khung, hai = chon_khung(cid)
    tag = ""
    for t in sorted(glob.glob(os.path.join(d, "att-*.chu.txt"))):
        # câu tóm tắt THẬT của phim: bỏ tiền tố ghi chú nội bộ ("Angle 1 (…):"), bỏ câu kêu gọi xem / tên nền tảng (không phải tagline)
        cau = re.split(r"(?<=[.!?])\s+", re.sub(r"^\s*Angle\s*\d+\s*(\([^)]*\))?\s*:\s*", "", open(t).read().strip()))
        tag = next((c for c in cau if 25 <= len(c) <= 90 and not re.search(r"(?i)\b(watch|netshort|reelshort|dramabox|free|learn more|app|episode|series)\b", c)), "")
        if tag: break
    tp = os.path.join(d, "ten-poster.png")
    bo, ph_ten, ph_tag, moi = LOAI.get(loai, LOAI_MAC)
    kieu = list(bo)
    if hai >= 3 and "hai_nguoi" not in kieu: kieu[-1] = "hai_nguoi"   # phim nhiều cảnh hai người → luôn có bố cục hai nhân vật
    return {"cid": cid, "ten": ten, "loai": loai or "?", "khung": khung, "hai": hai, "mau": bang_mau(os.path.join(d, "poster.jpg"), khung[0]),
            "ten_anh": Image.open(tp).convert("RGBA") if os.path.exists(tp) else None, "tag": tag or moi, "ph_ten": ph_ten, "ph_tag": ph_tag, "kieu": kieu}

# ---------- công cụ vẽ ----------
def phu(im, w, h):
    """cắt phủ kín w×h, giữ phần trên (mặt)"""
    r = max(w / im.width, h / im.height); im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x = (im.width - w) // 2; y = max(0, min(im.height - h, int((im.height - h) * 0.25)))
    return im.crop((x, y, x + w, y + h))

def vua(chu, ph, rong, cao_max):
    co = cao_max
    while co > 20:
        f = phong(ph, co); b = f.getbbox(chu)
        if b[2] - b[0] <= rong: return f
        co -= 4
    return phong(ph, 20)

def chia_dong(ten, toi_da=3):
    tu = ten.split(); n = min(toi_da, max(1, round(len(ten) / 14)))
    if n == 1 or len(tu) == 1: return [ten]
    dong, cur, muc = [], [], len(ten) / n
    for t in tu:
        if cur and len(" ".join(cur + [t])) > muc * 1.15 and len(dong) < n - 1: dong.append(" ".join(cur)); cur = [t]
        else: cur.append(t)
    return dong + [" ".join(cur)]

def chu_ten(d, ten, ph, y, rong, mau, cao_max=220, gian=8, x0=None):
    for dg in chia_dong(ten):
        f = vua(dg, ph, rong, cao_max); b = f.getbbox(dg)
        x = ((W - (b[2] - b[0])) // 2 if x0 is None else x0) - b[0]
        d.text((x, y - b[1]), dg, font=f, fill=mau); y += b[3] - b[1] + gian
    return y

def tieu_de(im, P, x, y, rong, cao, mau=None, chu_hoa=False):
    """TÊN PHIM: chữ tên tách từ poster gốc (đúng kiểu chữ của phim) đặt vừa hộp, có bóng mờ cho rõ; thiếu thì chữ theo phông thể loại. Trả y đáy."""
    if P["ten_anh"] is not None:
        t = P["ten_anh"]; r = min(rong / t.width, cao / t.height); t = t.resize((round(t.width * r), round(t.height * r)), Image.LANCZOS)
        bong = Image.new("RGBA", t.size, (0, 0, 0, 0)); bong.putalpha(t.getchannel("A").point(lambda v: v * 0.75).filter(ImageFilter.GaussianBlur(10)))
        px = x + (rong - t.width) // 2; im.paste(bong, (px + 4, y + 6), bong); im.paste(t, (px, y), t); return y + t.height
    ten = P["ten"].upper() if chu_hoa else P["ten"]
    return chu_ten(ImageDraw.Draw(im), ten, P["ph_ten"], y, rong, mau or P["mau"]["nhan"], cao_max=min(220, cao // max(1, len(chia_dong(ten)))))

def tagline(im, P, y, mau, rong=900):
    """tagline tối đa 2 dòng, cỡ ≥ 40 cho đọc được trên điện thoại"""
    d = ImageDraw.Draw(im)
    for dg in chia_dong(P["tag"], 2):
        f = vua(dg, P["ph_tag"], rong, 56); b = f.getbbox(dg)
        d.text(((W - (b[2] - b[0])) // 2 - b[0], y), dg, font=f, fill=mau); y += b[3] - b[1] + 14

def nguoi(P, p, cao):
    n = cat(p); bb = n.getchannel("A").getbbox(); n = n.crop(bb) if bb else n
    r = cao / n.height; return n.resize((round(n.width * r), round(n.height * r)), Image.LANCZOS)

# ---------- 9 bố cục — mọi màu / chữ lấy từ hồ sơ phim P ----------
def kem(P):
    """nền giấy ngả sắc phim, ảnh khung phía trên viền mảnh, tên phim + vạch + tagline (The Godfather / Titanic)"""
    m = P["mau"]; im = Image.new("RGB", (W, H), m["sang"]); im.paste(phu(mo(P["khung"][0]), 960, 1150), (60, 60))
    y = tieu_de(im, P, 60, 1270, 960, 330, mau=m["toi"]); d = ImageDraw.Draw(im)
    d.line((60, y + 30, W - 60, y + 30), fill=m["toi"], width=3); tagline(im, P, y + 54, m["toi"]); return im

def mot_mau(P):
    """người tách nền đổ HAI MÀU (tối + nhấn của phim) trên nền tối của phim, tên phim phía trên (Joker / Oppenheimer)"""
    m = P["mau"]; n = nguoi(P, P["khung"][0], H * 0.74)
    hm = ImageOps.colorize(ImageOps.autocontrast(n.convert("L")), m["toi"], m["nhan"]).convert("RGBA"); hm.putalpha(n.getchannel("A"))
    im = Image.new("RGB", (W, H), m["toi"]); im.paste(hm, ((W - hm.width) // 2, H - hm.height), hm)
    tieu_de(im, P, 60, 90, 960, 360, chu_hoa=True); tagline(im, P, 470, m["sang"]); return im

def chu_sau(P):
    """tên phim KHỔNG LỒ phía SAU, người tách nền đè lên trước, nền khung mờ tối (Monster / The Batman)"""
    m = P["mau"]; goc = mo(P["khung"][0])
    nen = Image.blend(phu(goc, W, H).filter(ImageFilter.GaussianBlur(26)), Image.new("RGB", (W, H), m["toi"]), 0.6)
    tieu_de(nen, P, 20, 110, 1040, 640, chu_hoa=True)
    n = nguoi(P, P["khung"][0], H * 0.72); nen.paste(n, ((W - n.width) // 2, H - n.height), n)
    tagline(nen, P, H - 190, m["sang"]); return nen

def ghep(P):
    """ba khung thật xếp chéo, dải tên giữa nền sáng của phim (ghép mảnh)"""
    m = P["mau"]; im = Image.new("RGB", (W, H), m["toi"]); cao = H // 3
    for i, p in enumerate((P["khung"] * 3)[:3]):
        o = phu(mo(p), W, cao + 120); mk = Image.new("L", (W, cao + 120), 0)
        ImageDraw.Draw(mk).polygon([(0, 60), (W, 0), (W, cao + 60), (0, cao + 120)], fill=255); im.paste(o, (0, i * cao - 40), mk)
    d = ImageDraw.Draw(im); y0 = H // 2 - 170; d.rectangle((0, y0, W, y0 + 340), fill=m["sang"])
    tieu_de(im, P, 70, y0 + 30, 940, 230, mau=m["toi"]); tagline(im, P, y0 + 280, m["toi"]); return im

def toi_gian(P):
    """người trắng đen trên nền giấy sắc phim + vệt màu nhấn chéo, tên phim dưới (The Substance)"""
    m = P["mau"]; n = nguoi(P, P["khung"][0], H * 0.64)
    tg = ImageOps.autocontrast(n.convert("L")).convert("RGBA"); tg.putalpha(n.getchannel("A"))
    im = Image.new("RGB", (W, H), m["sang"]); ImageDraw.Draw(im).polygon([(120, 1250), (980, 380), (1040, 460), (180, 1330)], fill=m["nhan"])
    im.paste(tg, ((W - tg.width) // 2, 180), tg); y = tieu_de(im, P, 70, 1420, 940, 300, mau=m["toi"]); tagline(im, P, y + 30, m["toi"]); return im

def leon(P):
    """người màu bên trái, từ DÀI NHẤT của tên xếp dọc từng chữ cột phải màu nhấn, cả tên nhỏ trên đầu (Léon)"""
    m = P["mau"]; n = nguoi(P, P["khung"][0], H * 0.88); im = Image.new("RGB", (W, H), m["sang"])
    im.paste(n, (max(-n.width // 3, 360 - n.width // 2 - 100), H - n.height), n)
    tu = max(re.findall(r"[A-Za-z0-9]+", P["ten"]) or ["?"], key=len).upper()[:8]
    co = min(240, int((H - 200) / len(tu))); f = phong("impact", co); d = ImageDraw.Draw(im)
    for i, c in enumerate(tu):
        b = f.getbbox(c); d.text((W - 150 - (b[2] - b[0]) // 2 - b[0], 150 + i * co - b[1]), c, font=f, fill=m["nhan"])
    tieu_de(im, P, 50, 50, 640, 90, mau=m["toi"]); return im

def chan_dung(P):
    """cận mặt rất lớn, viền tối sắc phim, tên phim + tagline phía dưới (teaser Oppenheimer / The Batman)"""
    m = P["mau"]; goc = mo(P["khung"][0]); a = cat(P["khung"][0]).getchannel("A"); bb = a.getbbox() or (0, 0, goc.width, goc.height)
    cx = (bb[0] + bb[2]) // 2; side = int((bb[2] - bb[0]) * 0.9)
    mat = goc.crop((max(0, cx - side // 2), max(0, bb[1] - side // 10), min(goc.width, cx + side // 2), min(goc.height, bb[1] + int(side * 1.25))))
    im = phu(mat, W, H); v = Image.new("L", (W, H), 0); ImageDraw.Draw(v).ellipse((-W * 0.3, -H * 0.15, W * 1.3, H * 0.95), fill=255)
    im = Image.composite(im, Image.new("RGB", (W, H), m["toi"]), v.filter(ImageFilter.GaussianBlur(160)))
    y = tieu_de(im, P, 70, 1420, 940, 300, mau=m["sang"]); tagline(im, P, y + 30, m["sang"]); return im

def khung_tron(P):
    """ảnh khung trong vòng tròn giữa nền màu nhấn của phim + dải tối dưới (Train to Busan)"""
    m = P["mau"]; im = Image.new("RGB", (W, H), m["nhan"]); o = phu(mo(P["khung"][1 % len(P["khung"])]), 860, 860)
    mk = Image.new("L", (860, 860), 0); ImageDraw.Draw(mk).ellipse((0, 0, 859, 859), fill=255); im.paste(o, (110, 200), mk)
    ImageDraw.Draw(im).rectangle((0, 1230, W, H), fill=m["toi"])
    y = tieu_de(im, P, 70, 1290, 940, 330, mau=m["nhan"]); tagline(im, P, y + 30, m["sang"]); return im

def hai_nguoi(P):
    """hai khung chia chéo trên / dưới, băng chéo màu nhấn mang tên phim (poster hai nhân vật)"""
    m = P["mau"]; im = Image.new("RGB", (W, H)); a, b = phu(mo(P["khung"][0]), W, H), phu(mo(P["khung"][1 % len(P["khung"])]), W, H)
    mk = Image.new("L", (W, H), 0); ImageDraw.Draw(mk).polygon([(0, 0), (W, 0), (W, H * 0.42), (0, H * 0.58)], fill=255)
    im.paste(b, (0, 0)); im.paste(a, (0, 0), mk)
    bang = Image.new("RGBA", (W + 400, 300), m["nhan"] + (255,)); tieu_de(bang, P, 200, 30, W, 240, mau=m["toi"])
    bang = bang.rotate(8.5, expand=True, resample=Image.BICUBIC); im.paste(bang, ((W - bang.width) // 2, int(H * 0.5) - bang.height // 2), bang)
    tagline(im, P, H - 190, (255, 255, 255)); return im

KIEU = {"kem": kem, "mot_mau": mot_mau, "chu_sau": chu_sau, "ghep": ghep, "toi_gian": toi_gian, "leon": leon, "chan_dung": chan_dung, "khung_tron": khung_tron, "hai_nguoi": hai_nguoi}
TEN_LOAI = {"ty_phu": "tỷ phú", "mafia": "mafia", "hoi_han": "hối hận", "tinh_cam": "tình cảm", "me_con": "mẹ con", "doi_thuong": "đời thường", "vo_danh": "võ danh",
            "he_thong": "hệ thống", "fantasy": "fantasy", "soi": "sói", "co_trang": "cổ trang", "vien_tuong": "viễn tưởng"}

def lam(cid):
    P = doc_phim(cid); ra = os.path.join(C, str(cid), "bo-cuc"); os.makedirs(ra, exist_ok=True)
    for f in glob.glob(os.path.join(ra, "*.png")): os.replace(f, f + ".cu")   # bản cũ đổi đuôi, không xoá
    tep = []
    for ma in P["kieu"]:
        p = os.path.join(ra, f"{ma}.png"); KIEU[ma](P).save(p); tep.append((ma, p))
    return P, tep

def bang(ds, ra):
    """bảng ghép: mỗi phim một hàng — hồ sơ phim (thể loại, màu, tagline) + 5 bố cục đã chọn theo phim"""
    o = 330, 587; im = Image.new("RGB", (o[0] * 5 + 40, (o[1] + 110) * len(ds) + 20), "#111"); d = ImageDraw.Draw(im)
    f, f2 = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 26), ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 20)   # nhãn tiếng Việt
    for r, (P, tep) in enumerate(ds):
        y = 20 + r * (o[1] + 110)
        d.text((20, y), f"#{P['cid']}  {P['ten']}  ·  thể loại: {TEN_LOAI.get(P['loai'], P['loai'])}  ·  tên: {'chữ từ poster gốc' if P['ten_anh'] is not None else 'phông thể loại'}", font=f, fill="#ddd")
        for i, k in enumerate(("toi", "sang", "nhan")): d.rectangle((20 + i * 34, y + 38, 48 + i * 34, y + 62), fill=P["mau"][k])
        d.text((130, y + 40), f"tagline: {P['tag'][:110]}", font=f2, fill="#aaa")
        for c, (ma, p) in enumerate(tep):
            im.paste(Image.open(p).convert("RGB").resize(o, Image.LANCZOS), (20 + c * (o[0] + 5), y + 75)); d.text((24 + c * (o[0] + 5), y + 78), ma, font=f2, fill="#fff")
    im.save(ra, quality=88)

if __name__ == "__main__":
    ids = [x for x in sys.argv[1:] if x.isdigit()]; ds = []
    for cid in ids:
        P, tep = lam(cid); ds.append((P, tep)); print(f"#{cid} {P['ten']} · {P['loai']} · {[m for m, _ in tep]}", flush=True)
    if ds: p = os.path.join(C, "bo-cuc-bang.jpg"); bang(ds, p); print("bảng:", p)
