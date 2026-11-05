#!/usr/bin/env python3
"""KIỂU CREATIVE "ẢNH TĨNH" (anh 05/11/2026, mẫu video của đội: một khung đẹp nét trong phim + tên phim + giọng ~9s).
Giọng đúng form anh chốt: "Watch {title} for Free Now. Watch More Now!" (ES: "¡Mira {title} gratis ahora! ¡Mira más ahora!").
Áp trước cho PHIM MỚI BẮT ĐẦU LÃI của nhà: camp đầu ≤ NGAY_MOI ngày, 3 ngày gần nhất thu > chi (chi ≥ $3), còn camp ACTIVE, chưa có bản ảnh tĩnh,
cổng không chặn (apps/etp/cong.phim_chan_len). Mới nhất lên trước.
MỘT lệnh lo trọn, mỗi phim:
  1. tải 3 tập miễn phí (tai-tap.py) → khung mỗi 1,5 giây → doc-chu --mat (Vision: điểm mặt Apple + chữ) → chọn khung mặt to, nét, không chữ in cứng
  2. khung gốc độ phân giải đầy đủ → 1080x1920 + tên phim chữ vàng nửa dưới (không che mặt) + phóng chậm 5%
  3. giọng ElevenLabs v3 trên box3 (scripts/lich-su/giong.mts, khoá FAL ở box3; ~60 ký tự ≈ $0,006 ≈ 160₫/phim, dùng lại khi cùng câu)
  4. cổng chữ trên video (kiem-thoai.py) → thư viện etp (thu-vien-them.mts, dạng "ảnh tĩnh", nguồn anh_tinh) → creative (thu-vien-len.py)
Từ đó nhịp ethopex (apps/cty/worker/ethopex.mjs) thấy creative ảnh tĩnh chấm Sạch của phim đang chạy → lên camp $1, giờ chạy theo lịch chung (nhan-ban.lich_len).
Dùng (iMac): python3 anh-tinh.py [content_id …] [--so N] [--xem]
  không id = tự chọn N phim (mặc định 10) · --xem = chỉ dựng + tờ khung (~/.cache/ethopex/anh-tinh/to-<giờ>.jpg), không nạp thư viện / tạo creative"""
import hashlib, json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import cam_box3; cam_box3.cam()   # CẤM dựng video trên box3 (anh 03/11/2026)
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageStat

D = os.path.dirname(os.path.abspath(__file__)); B = "root@167.233.241.16"; C = os.path.expanduser("~/.cache/ethopex/anh-tinh")
ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
XV = f"{ENV}; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx"
DANG, NGUON, NGAY_MOI, GIAY_MIN, W, H = "ảnh tĩnh", "anh_tinh", 14, 9.0, 1080, 1920
GIONG = {"en": ("George", "Watch {t} for Free Now. Watch More Now!"), "es": ("Aria", "¡Mira {t} gratis ahora! ¡Mira más ahora!")}
FONT = "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf"
MA_HOA = ["-c:v", "h264_videotoolbox", "-b:v", "3M", "-maxrate", "4500k", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "44100"]   # như cat-canh.MA_HOA (Mac)

def sql(q):
    return subprocess.run(["ssh", B, f"{ENV}; psql \"$DATABASE_URL\" -tAq"], input=q, capture_output=True, text=True, check=True).stdout.strip()
def sh(*a, han=900): return subprocess.run(list(a), capture_output=True, text=True, timeout=han)
def ten_sach(t): return re.sub(r"\s*[（(](?:DUBBED|Doblado)[)）]\s*", " ", t or "").strip()

def chon(so):
    """phim mới bắt đầu lãi (nhà) — cổng chặn lấy từ apps/etp/cong.phim_chan_len (một nguồn với thay-the / nhan-ban)"""
    chan = json.loads(subprocess.run(["ssh", B, f"{ENV}; cd apps/etp && python3 -c 'import json, cong; print(json.dumps(cong.phim_chan_len()))'"],
                                     capture_output=True, text=True, check=True).stdout.strip() or "{}")
    ds = json.loads(sql(f"""with p as (select c.content_id, min(c.tao) dau, sum(n.chi) filter (where n.ngay >= current_date - 3) chi3, sum(n.thu) filter (where n.ngay >= current_date - 3) thu3
        from etp.camp c join etp.so_ngay n using (camp_id) where c.content_id is not null group by 1)
      select coalesce(json_agg(x order by x.dau desc), '[]') from (select p.content_id, f.ten, coalesce(f.locale, 'en') locale, f.url, p.dau, round(p.thu3 - p.chi3, 2) lai3 from p join etp.phim f using (content_id)
        where p.dau > now() - interval '{NGAY_MOI} days' and p.chi3 >= 3 and p.thu3 > p.chi3 and f.url is not null
          and exists (select 1 from etp.camp k where k.content_id = p.content_id and k.trang_thai = 'ACTIVE')
          and not exists (select 1 from etp.thu_vien v where v.content_id = p.content_id and v.dang = '{DANG}')) x""") or "[]")
    for x in ds:
        if str(x["content_id"]) in chan: print(f"bỏ {x['content_id']} {x['ten']}: cổng chặn — {chan[str(x['content_id'])]}")
    return [x for x in ds if str(x["content_id"]) not in chan][:so]

def phim(ids):
    return json.loads(sql(f"select coalesce(json_agg(x), '[]') from (select content_id, ten, coalesce(locale, 'en') locale, url from etp.phim where content_id in ({','.join(map(str, ids))})) x") or "[]")

def may_doc():
    import importlib.util
    s = importlib.util.spec_from_file_location("kt", os.path.join(D, "kiem-thoai.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m.may_doc()

def goc_nho(k):
    """hộp chữ là logo nhỏ ở góc (chữ "R" ReelShort…) — xoá được, không loại khung"""
    return k[3] * k[4] < 0.006 and (k[1] < 0.2 or k[1] + k[3] > 0.8)

def diem(anh, mat, chu):
    """điểm một khung: mặt chính to + Apple chấm nét/sáng/nhìn thẳng (≥ 0,45: dưới mức đó Vision nhận nhầm đồ vật — chiếc giày 172316, 05/11/2026).
    Chữ in cứng chỉ được nằm DƯỚI mặt ở nửa dưới (phụ đề, tên nhân vật) hoặc là logo nhỏ ở góc — anh() xoá hết; chữ đè mặt / nửa trên = loại.
    Mặt phải xong trước 62% chiều cao để tên phim nằm dưới mặt. → (điểm, hộp mặt, hộp chữ cần xoá)"""
    mat = [m for m in mat or [] if m[4] >= 0.45]
    if not mat or len(mat) > 3: return 0, None, None
    x, y, w, h, q = max(mat, key=lambda m: m[2] * m[3])
    cx = x + w / 2
    if not 0.14 < h < 0.5 or y < 0.04 or y + h > 0.62 or not 0.25 < cx < 0.75: return 0, None, None
    if any(not goc_nho(k) and k[2] < max(0.5, y + h) for k in chu): return 0, None, None
    im = Image.open(anh).convert("L"); X, Y = im.size
    o = im.crop((int(x * X), int(y * Y), int((x + w) * X), int((y + h) * Y)))
    sang = ImageStat.Stat(o).mean[0]
    if not 55 < sang < 210: return 0, None, None
    net = ImageStat.Stat(o.filter(ImageFilter.FIND_EDGES)).stddev[0]
    return q * (0.6 + 0.4 * min(1, h / 0.25)) * (0.6 + 0.4 * min(1, net / 40)) * (1 if not chu else 0.92), (x, y, w, h), \
        [[k[1] - k[3] / 2, k[2] - k[4] / 2, k[3] * 2, k[4] * 2] if goc_nho(k) else k[1:] for k in chu]   # khung sạch chữ nhỉnh hơn · logo góc: OCR chỉ bắt chữ "R", ô vuông bao quanh rộng gấp đôi

def dau_tinh(kd, tap):
    """logo / watermark ĐỨNG YÊN của app gốc ở 4 góc: trung bình các khung một tập — nội dung nhoè đi, logo giữ nét (đo 05/11/2026: "R" ReelShort
    nhảy giữa góc trên-trái và dưới-phải, cả hai hiện rõ trên ảnh trung bình) → [x, y, rộng, cao] 0–1"""
    fs = sorted(f for f in os.listdir(kd) if f.startswith(tap))[::2][:80]; tb = None
    for i, f in enumerate(fs):
        im = Image.open(os.path.join(kd, f)).convert("L"); tb = im if tb is None else Image.blend(tb, im, 1 / (i + 1))
    if tb is None: return []
    e = tb.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(9)); X, Y = e.size; ra = []
    for x0, y0, x1, y1 in ((0, 0, .3, .2), (.7, 0, 1, .2), (0, .8, .3, 1), (.7, .8, 1, 1)):
        b = e.crop((int(x0 * X), int(y0 * Y), int(x1 * X), int(y1 * Y))).getbbox()
        if b and 6 < b[2] - b[0] < 0.16 * X and 6 < b[3] - b[1] < 0.09 * Y: ra.append(   # logo nhỏ gọn; vùng lớn hơn = cảnh đứng yên (tóc, tường), không phải logo — 172316 lấp nhầm hai góc tóc 05/11/2026
            [x0 + b[0] / X, y0 + b[1] / Y, (b[2] - b[0]) / X, (b[3] - b[1]) / Y])
    return ra

def xoa(im, hop):
    """xoá chữ in cứng / logo trong các hộp (0–1) bằng LẤP TỪ VIỀN VÀO: lòng hộp đổ màu trung bình của vành quanh nó rồi làm mờ lặp nhiều lượt,
    mỗi lượt giữ nguyên phần ngoài hộp → màu xung quanh lan vào. Lọc trung vị (bản đầu) nuốt được nét chữ nhưng để lại viền ô logo mờ (05/11/2026)."""
    X, Y = im.size
    for x, y, w, h in hop:
        p = int(0.012 * X); b = (int(x * X) - p, int(y * Y) - p, int((x + w) * X) + p, int((y + h) * Y) + p)
        v = max(b[2] - b[0], b[3] - b[1]) // 2 + p; n = (max(0, b[0] - v), max(0, b[1] - v), min(X, b[2] + v), min(Y, b[3] + v))
        if b[2] - b[0] < 4 or b[3] - b[1] < 4: continue
        o = im.crop(n); m = Image.new("L", o.size, 0); ImageDraw.Draw(m).rectangle((b[0] - n[0], b[1] - n[1], b[2] - n[0], b[3] - n[1]), fill=255)
        nen = Image.new("RGB", o.size, tuple(int(c) for c in ImageStat.Stat(o, ImageChops.invert(m)).mean))
        r = Image.composite(nen, o, m)
        bk = max(5, min(b[2] - b[0], b[3] - b[1]) // 6)   # hộp to thì lan xa hơn, không để mảng phẳng
        for _ in range(30): r = Image.composite(r.filter(ImageFilter.GaussianBlur(bk)), o, m)
        im.paste(Image.composite(r, o, m.filter(ImageFilter.GaussianBlur(p / 2))), n[:2])
    return im

def khung(cid, url, tm):
    """→ (tập, giây, khung mặt, điểm, ảnh nhỏ) của khung đẹp nhất trong 3 tập miễn phí"""
    sh("python3", os.path.join(D, "tai-tap.py"), url, tm, "3", han=1800)
    taps = sorted(f for f in os.listdir(tm) if re.fullmatch(r"tap\d+\.mp4", f))[:3]
    if not taps: raise RuntimeError("không tải được tập miễn phí")
    kd = os.path.join(tm, "khung"); os.makedirs(kd, exist_ok=True)
    for f in os.listdir(kd): os.remove(os.path.join(kd, f))
    for t in taps:   # bỏ 3 giây đầu (logo app / tóm tắt tập trước)
        sh("ffmpeg", "-v", "error", "-ss", "3", "-i", os.path.join(tm, t), "-vf", "fps=2/3,scale=540:-2", "-q:v", "3", os.path.join(kd, f"{t[:-4]}_%04d.jpg"))
    fs = sorted(os.path.join(kd, f) for f in os.listdir(kd) if f.endswith(".jpg"))
    ra = []
    for i in range(0, len(fs), 200):
        for l in subprocess.run([may_doc(), "--mat", *fs[i:i + 200]], capture_output=True, text=True, timeout=900).stdout.splitlines():
            j = json.loads(l); d, m, ch = diem(j["anh"], j.get("mat"), j.get("khung") or [])
            if d: tap, so = re.match(r".*/(tap\d+)_(\d+)\.jpg", j["anh"]).groups(); ra.append((d, tap, 3 + (int(so) - 1) * 1.5, m, j["anh"], ch))
    if not ra: raise RuntimeError(f"không khung nào đạt (mặt to nét, chữ không đè mặt) trong {len(fs)} khung")
    d, tap, g, m, nho, ch = max(ra, key=lambda r: r[0])
    return {"tap": tap, "giay": g, "mat": m, "diem": round(d, 3), "nho": nho, "so_khung": len(fs), "dat": len(ra), "xoa": ch + dau_tinh(kd, tap)}

def anh(cid, ten, k, tm):
    """khung gốc → nền 1080x1920 (nền.png, sẽ phóng chậm) + lớp tên phim (chu.png, đứng yên) đặt dưới mặt"""
    goc = os.path.join(tm, "goc.png")
    sh("ffmpeg", "-v", "error", "-y", "-ss", str(k["giay"]), "-i", os.path.join(tm, k["tap"] + ".mp4"), "-frames:v", "1", goc)
    im = xoa(Image.open(goc).convert("RGB"), k["xoa"]); s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x0 = min(max(0, round((k["mat"][0] + k["mat"][2] / 2) * im.width - W / 2)), im.width - W); y0 = (im.height - H) // 2
    im = im.crop((x0, y0, x0 + W, y0 + H)).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    toi = Image.new("L", (1, 256)); toi.putdata([0 if i < 140 else min(190, (i - 140) * 2) for i in range(256)])   # dải tối nửa dưới cho chữ đọc rõ
    im = Image.composite(Image.new("RGB", (W, H)), im, toi.resize((W, H)))
    im.save(os.path.join(tm, "nen.png"))
    t, c = ten.upper() if len(ten) <= 18 else ten, 120
    while True:
        f = ImageFont.truetype(FONT, c); dong, cur = [], ""
        for w_ in t.split():
            thu = f"{cur} {w_}".strip()
            if cur and f.getlength(thu) > W - 140: dong.append(cur); cur = w_
            else: cur = thu
        dong.append(cur)
        if len(dong) <= 3 or c <= 64: break
        c -= 8
    cao = int(c * 1.12) * len(dong); mat_day = (k["mat"][1] + k["mat"][3]) * H
    y = int(min(max(H * 0.66 - cao / 2, mat_day + 60), H * 0.80 - cao))   # dưới mặt; chừa ~20% đáy cho khung ứng dụng (tên trang, nút)
    lop = Image.new("RGBA", (W, H)); bong = Image.new("RGBA", (W, H)); d, db = ImageDraw.Draw(lop), ImageDraw.Draw(bong)
    mask = Image.new("L", (W, H)); dm = ImageDraw.Draw(mask)
    for i, x in enumerate(dong):
        xx, yy = (W - f.getlength(x)) / 2, y + i * int(c * 1.12)
        db.text((xx + 6, yy + 8), x, font=f, fill=(0, 0, 0, 200)); dm.text((xx, yy), x, font=f, fill=255)
        d.text((xx, yy), x, font=f, fill=(0, 0, 0, 0), stroke_width=7, stroke_fill=(40, 20, 0, 255))
    vang = Image.new("RGBA", (1, H)); vang.putdata([(255, 236 - int(60 * max(0, min(1, (r - y) / max(1, cao)))), 150 - int(110 * max(0, min(1, (r - y) / max(1, cao)))), 255) for r in range(H)])
    lop.paste(vang.resize((W, H)), (0, 0), mask)
    Image.alpha_composite(bong.filter(ImageFilter.GaussianBlur(8)), lop).save(os.path.join(tm, "chu.png"))
    return os.path.join(tm, "nen.png"), os.path.join(tm, "chu.png")

def giong(cid, lang, ten, tm):
    """giọng đọc (box3 — khoá FAL chỉ ở đó) → (giong.mp3, ₫ đã chi); cùng câu thì dùng lại, không đọc lần hai"""
    v, mau = GIONG[lang]; cau = mau.format(t=ten); h = hashlib.sha1(f"{v}|{cau}".encode()).hexdigest()[:10]; f = os.path.join(tm, f"giong-{h}.mp3")
    if os.path.exists(f): return f, 0
    xa = f"/var/tmp/anh-tinh/{cid}"; job = os.path.join(tm, "giong.json")
    json.dump({"ngon_ngu": lang, "giong": {"voice": v}, "cau": [{"chu": cau}]}, open(job, "w"), ensure_ascii=False)
    sh("ssh", B, f"mkdir -p {xa}"); sh("scp", "-q", job, f"{B}:{xa}/giong.json")
    r = sh("ssh", B, f"{XV} scripts/lich-su/giong.mts {xa}/giong.json {xa}", han=600)
    if r.returncode != 0: raise RuntimeError(f"giọng: {(r.stderr or r.stdout)[-200:]}")
    sh("scp", "-q", f"{B}:{xa}/giong.mp3", f)
    return f, round(len(cau) / 1000 * 0.10 * 26000)

def dung(nen, chu, mp3, ra):
    L = max(GIAY_MIN, float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3).stdout) + 1.4); n = int(L * 30)
    r = sh("ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", nen, "-loop", "1", "-i", chu, "-i", mp3, "-filter_complex",
           f"[0:v]scale={W * 2}:{H * 2}:flags=lanczos,zoompan=z='1+0.05*on/{n}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s={W}x{H}:fps=30,setsar=1[n];"
           f"[1:v]format=rgba,fade=in:st=0.2:d=0.4:alpha=1[c];[n][c]overlay=0:0:shortest=1[v];[2:a]adelay=400|400,apad[a]",
           "-map", "[v]", "-map", "[a]", "-t", f"{L:.2f}", *MA_HOA, ra)
    if r.returncode != 0: raise RuntimeError(f"ffmpeg: {r.stderr[-300:]}")
    return round(L, 1)

def mot(p, xem):
    cid, lang = int(p["content_id"]), "es" if str(p.get("locale")).startswith("es") else "en"; ten = ten_sach(p["ten"])
    tm = os.path.join(C, str(cid)); os.makedirs(tm, exist_ok=True)
    try:
        k = khung(cid, p["url"], tm); nen, chu = anh(cid, ten, k, tm); mp3, vnd = giong(cid, lang, ten, tm)
        out = os.path.join(tm, f"anh-tinh-{cid}.mp4"); giay = dung(nen, chu, mp3, out)
        r = sh("python3", os.path.join(D, "kiem-thoai.py"), out, "0", str(giay))   # cổng chữ trên video (tên phim) — cùng cổng mọi creative
        if r.returncode != 0: raise RuntimeError(r.stdout.strip()[-200:])
        kq = {"content_id": cid, "ten": ten, "lang": lang, "file": out, "giay": giay, "vnd": vnd, **{x: k[x] for x in ("tap", "diem", "dat", "so_khung", "nho")}, "xoa": len(k["xoa"]), "giay_khung": k["giay"]}
        if xem: return kq
        xa = f"/var/tmp/anh-tinh/{cid}"; sh("ssh", B, f"mkdir -p {xa}"); sh("rsync", "-a", out, f"{B}:{xa}/", han=900)
        ghi = f"ảnh tĩnh: {k['tap']} giây {k['giay']:.1f} · điểm mặt {k['diem']} ({k['dat']}/{k['so_khung']} khung đạt)"
        r = sh("ssh", B, f"{XV} scripts/ethopex/thu-vien-them.mts 0 {xa}/{os.path.basename(out)} --content={cid} --dang='{DANG}' --nguon={NGUON} --lang={lang} --chi-vnd={vnd} --ghi='{ghi}'", han=600)
        if r.returncode != 0: raise RuntimeError(f"thư viện: {(r.stderr or r.stdout)[-200:]}")
        kq["tv"] = int(sql(f"select id from etp.thu_vien where content_id = {cid} and dang = '{DANG}' and nguon = '{NGUON}' and creative_id is null order by id desc limit 1") or 0)
        return kq
    except Exception as e:
        return {"content_id": cid, "ten": ten, "loi": str(e)[-300:]}

def to_khung(kq, ra):
    """tờ khung: mỗi phim một ô (khung đã chọn + tên) để người xem soát trước"""
    ok = [x for x in kq if not x.get("loi")]
    if not ok: return None
    o = 270; to = Image.new("RGB", (o * min(5, len(ok)), int(o * 16 / 9) * ((len(ok) + 4) // 5)), "black")
    for i, x in enumerate(ok):
        f = os.path.join(C, str(x["content_id"]), "xem.jpg"); sh("ffmpeg", "-v", "error", "-y", "-ss", "3", "-i", x["file"], "-frames:v", "1", "-vf", f"scale={o}:-2", f)
        to.paste(Image.open(f), ((i % 5) * o, (i // 5) * int(o * 16 / 9)))
    to.save(ra, quality=88); return ra

if __name__ == "__main__":
    a = sys.argv[1:]; xem = "--xem" in a
    so = int(a[a.index("--so") + 1]) if "--so" in a else 10
    ids = [int(x) for x in a if x.isdigit() and (a.index(x) == 0 or a[a.index(x) - 1] != "--so")]
    ds = phim(ids) if ids else chon(so)
    if not ds: sys.exit("không có phim nào hợp (mới bắt đầu lãi, chưa có ảnh tĩnh)")
    print(f"{len(ds)} phim: " + " · ".join(f"{x['content_id']} {ten_sach(x['ten'])[:30]}" for x in ds), flush=True)
    with ThreadPoolExecutor(3) as ex: kq = list(ex.map(lambda p: mot(p, xem), ds))
    for x in kq: print(json.dumps(x, ensure_ascii=False), flush=True)
    print("tờ khung:", to_khung(kq, os.path.join(C, f"to-{time.strftime('%d%m%H%M')}.jpg")))
    print(f"giọng: {sum(x.get('vnd', 0) for x in kq)}₫")
    tv = [str(x["tv"]) for x in kq if x.get("tv")]
    if tv: subprocess.run(["python3", os.path.join(D, "thu-vien-len.py"), *tv])   # thư viện → creative; chấm Sạch thì nhịp ethopex lên camp theo lịch chung
