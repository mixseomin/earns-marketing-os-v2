#!/usr/bin/env python3
"""TẢI TẬP PHIM TỪ SITE GỐC (anh 21/10/2026: đợt NetShort + DramaBox — creative cắt đoạn 20–30s + 2–3' trong phim; nguồn = tập miễn phí trên site,
không phụ thuộc QC spy). Chỉ đọc trang công khai + tải mp4 tập miễn phí (NetShort mở ~tập 1–8, DramaBox tập đầu, ReelShort tập trước paid_start — chỉ 720p) + poster (og:image).
Dùng: tai-tap.py <link phim> <thư mục ra> [số tập=3]  → <ra>/tap01.mp4 …, <ra>/poster.jpg, <ra>/tap.json ([{tap, giay, url}])"""
import urllib.parse, html as H, json, os, re, subprocess, sys, urllib.request, urllib.error

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
def lay(url, ref=None):
    h = {"User-Agent": UA, "Accept": "text/html,image/avif,image/webp,image/*,*/*;q=0.8"}
    if ref: h["Referer"] = ref
    # link phim ES có dấu (domé, niña…) — mã hoá phần ngoài ASCII, giữ nguyên ký tự đã mã hoá (anh 24/10/2026: 12 phim lô 26/10 hỏng vì 'ascii' codec)
    url = urllib.parse.quote(url, safe=":/?#[]@!$&'()*+,;=%~")
    return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=40).read()
def sach(u): return u.replace("\\u0026", "&").replace("\\u002F", "/").replace("\\/", "/").rstrip("\\")

def video_trong(html, u=""):
    """link mp4 của tập đang mở trên trang (NetShort cfcdn · DramaBox hwvideo…narrowv3.mp4).
    u = link trang tập: trang tập N của dramaboxdb chứa CẢ link mp4 tập 1 lẫn link tập N (25/11/2026 Bugatti #85055: tập 2, 3 tải ra y hệt tập 1)
    → chỉ nhận link mang mã chương của chính tập đó (mp4 trước, không có thì HLS m3u8)."""
    ch = re.search(r"/(\d+)_Episode-\d+", u or "")
    if ch and "dramaboxdb.com" in u:
        ds = [sach(m) for m in re.findall(r'https?:(?:\\u002F|\\?/){2}[^"\s]*dramaboxdb\.com[^"\s]+?\.(?:mp4|m3u8)\?[^"\s]+', html) if f"/{ch.group(1)}" in sach(m)]
        ds.sort(key=lambda x: ".m3u8" in x)
        if ds: return ds[0]
    for m in re.findall(r'https?:(?:\\u002F|\\?/){2}cfcdn\.netshort\.com[^"\s]+', html): return sach(m)
    for m in re.findall(r'https?:(?:\\u002F|\\?/){2}[^"\s]*dramaboxdb\.com[^"\s]+?\.mp4\?[^"\s]+', html): return sach(m)
    for m in re.findall(r'"video_url":"(https?:[^"]+?\.m3u8)"', html): return sach(m)   # ReelShort (crazymaplestudios HLS, 720p — 21/10/2026)
    return None

_RS = {}
def chuong_rs(goc, html):
    """ReelShort: số tập → chapter_id (trang tập chỉ liệt kê vài tập đầu → đọc thêm trang /movie/ của phim). Tập từ paid_start trở đi bị khoá."""
    if goc in _RS: return _RS[goc]
    ds = {int(n): c for c, n in re.findall(r'"chapter_id":"([a-z0-9]{10})"[^{}]*?"serial_number":(\d+)', html)}
    m = re.search(r'href="(/(?:[a-z]{2}/)?movie/[^"]+)"', html)
    if m:
        try: ds |= {int(n): c for c, n in re.findall(r'"chapter_id":"([a-z0-9]{10})"[^{}]*?"serial_number":(\d+)', lay("https://www.reelshort.com" + H.unescape(m.group(1))).decode("utf-8", "ignore"))}
        except Exception as e: print("trang movie loi:", e, file=sys.stderr)
    tra = re.search(r'"paid_start":"?(\d+)', html); bid = re.search(r'"book_id":"([0-9a-f]{24})"', html)
    _RS[goc] = (ds, int(tra.group(1)) if tra else 10**6, bid.group(1) if bid else None); return _RS[goc]

def tap_url(goc, html, n):
    if "reelshort.com" in goc:
        ds, tra, bid = chuong_rs(goc, html)
        if n >= tra or n not in ds: return None
        # link trên trang có thể mang mã sách cũ (bản đổi tên) — ghép lại bằng book_id thật của trang
        return goc if n == 1 else re.sub(r'episode-1-(.+)-[0-9a-f]{24}-[a-z0-9]{10}', lambda m: f"episode-{n}-{m.group(1)}-{bid}-{ds[n]}", goc.split("?")[0])
    if "netshort.com" in goc: return goc if n == 1 else f"{goc.split('?')[0]}-ep-{n}"
    if "dramaboxdb.com" in goc:   # trang dramaboxdb (/movie/… hoặc /<lang>/ep/…) liệt kê link /ep/<id>_<slug>/<chap>_Episode-N — trước chỉ khớp dramabox.com nên chỉ có tập 1 (25/11/2026 #85055/#82854 Bugatti: 6 khung, hết khung sau 3 bản)
        m = re.findall(r'(?:https?://www\.dramaboxdb\.com)?(/(?:[a-z]{2}/)?ep/\d+_[^"\s/]+/\d+_Episode-' + str(n) + r')\b', html)
        return ("https://www.dramaboxdb.com" + m[0]) if m else (goc if n == 1 else None)
    m = [sach(x) for x in re.findall(r'(?:https?://www\.dramabox\.com)?/video/\d{11}_[^"\s/]+/\d+_Episode-' + str(n) + r'\b', html)]
    return (m[0] if m[0].startswith("http") else "https://www.dramabox.com" + m[0]) if m else (goc if n == 1 else None)

def giay_tap(p):
    """độ dài tập (giây); tệp hỏng / tải dở (moov atom not found) → None"""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True, timeout=120)
    try: return float(r.stdout.strip()) if r.returncode == 0 and float(r.stdout.strip()) > 0 else None
    except ValueError: return None

def ngon_ngu_ns(goc):
    """PHỤ ĐỀ NETSHORT (anh 27/11/2026 #1899 "Tiếng Anh mà Logo lại tiếng ES là sao?"): trang netshort.com/<lang>/… phát ĐÚNG mp4 gốc tiếng Anh, KHÔNG phụ đề in sẵn —
    phụ đề từng thứ tiếng là tệp webvtt riêng (subtitleList). Tải thẳng mp4 → creative thị trường ES/PT/FR… ra tiếng Anh trơn mà logo/chữ lại tiếng địa phương, mọi dạng (CC2, AD, LT…).
    Trả mã 2 chữ của trang ('es', 'pt'…) khi phim cần gắn phụ đề; None = trang tiếng Anh / không phải NetShort / bản lồng tiếng (Doblado/Dublado/Dubbed)."""
    m = re.search(r"netshort\.com/([a-z]{2})(?:-[a-z]{2})?/", goc or "")
    return m.group(1) if m and m.group(1) != "en" else None

def vtt_ns(html, lang):
    """link webvtt đúng thứ tiếng trong subtitleList của trang tập (trang chứa phụ đề 14 thứ tiếng, chọn subtitleLanguage bắt đầu bằng <lang>_)."""
    for u, l in re.findall(r'\\?"url\\?":\\?"(https?:[^"\\]*(?:\\u0026[^"\\]*)*)\\?",\\?"format\\?":\\?"webvtt\\?"[^{}]*?\\?"subtitleLanguage\\?":\\?"([a-zA-Z_]+)', html):
        if l.lower().startswith(lang + "_") or l.lower() == lang: return sach(u)
    return None

def long_tieng(html):
    """bản lồng tiếng thật (tên phim trong <title> có Doblado/Dublado/Dubbed, hoặc trang có shortPlayDubAddress) → tiếng đã đúng, không gắn phụ đề"""
    t = re.search(r"<title>([^<]*)", html)
    return bool(t and re.search(r"(?i)doblad|dublad|dubbed|synchronis|doppiat", t.group(1))) or bool(re.search(r'shortPlayDubAddress\\?":\\?"http', html))

def doc_vtt(b):
    """webvtt → [(từ giây, tới giây, [dòng chữ])]"""
    def gi(s):
        p = s.replace(",", ".").split(":"); return sum(float(x) * 60 ** i for i, x in enumerate(reversed(p)))
    ds, t, chu = [], None, []
    for l in b.decode("utf-8", "ignore").replace("\r", "").split("\n") + [""]:
        m = re.match(r"\s*((?:\d+:)?\d+:\d+[.,]\d+)\s*-->\s*((?:\d+:)?\d+:\d+[.,]\d+)", l)
        if m: t, chu = (gi(m.group(1)), gi(m.group(2))), []; continue
        if t and l.strip(): chu.append(re.sub(r"<[^>]+>", "", H.unescape(l.strip())))
        elif t:
            if chu and t[1] > t[0]: ds.append((t[0], t[1], chu))
            t = None
    return ds

FA = next((f for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf") if os.path.exists(f)), "/System/Library/Fonts/Supplemental/Arial Bold.ttf")
def gan_phu_de(tap, vtt, goc):
    """IN CỨNG phụ đề vào tập: chữ trắng đậm viền đen, giữa, ~78% chiều cao (kiểu phụ đề NetShort trên app). Vẽ bằng PIL rồi phủ (overlay) — ffmpeg Homebrew trên iMac
    không có bộ lọc subtitles/drawtext (đo 27/11/2026), overlay thì máy nào cũng có. Mỗi câu một ảnh trong suốt, nối bằng ffconcat theo mốc giờ; ghi .pd.part, đọc được mới thay tập."""
    from PIL import Image, ImageDraw, ImageFont
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import nen_video as NV
    ds = doc_vtt(lay(vtt, ref=goc))
    if len(ds) < 3: raise RuntimeError(f"phụ đề {vtt[:60]} rỗng / đọc không được ({len(ds)} câu)")
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", tap], capture_output=True, text=True, timeout=60)
    w, h = (int(x) for x in r.stdout.strip().split(",")[:2])
    co = max(24, round(min(w, h) * 0.054)); f = ImageFont.truetype(FA, co); vien = max(2, co // 11)
    th = tap + ".pd"; os.makedirs(th + "-anh", exist_ok=True); trong = os.path.join(th + "-anh", "trong.png")
    Image.new("RGBA", (w, h), (0, 0, 0, 0)).save(trong)
    def ve(i, dong):
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im); ra_dong = []
        for x in dong:   # gói dòng trong 88% bề ngang
            cur = ""
            for tu in x.split():
                if cur and d.textlength(cur + " " + tu, font=f) > w * 0.88: ra_dong.append(cur); cur = tu
                else: cur = (cur + " " + tu).strip()
            if cur: ra_dong.append(cur)
        cao = round(co * 1.22); y = round(h * 0.78) - cao * len(ra_dong)
        for x in ra_dong:
            d.text(((w - d.textlength(x, font=f)) / 2, y), x, font=f, fill=(255, 255, 255, 255), stroke_width=vien, stroke_fill=(0, 0, 0, 255)); y += cao
        p = os.path.join(th + "-anh", f"c{i:04d}.png"); im.save(p); return p
    ff, moc = ["ffconcat version 1.0"], 0.0
    for i, (a, b, dong) in enumerate(ds):
        a = max(a, moc)
        if b <= a: continue
        if a > moc: ff += [f"file '{trong}'", f"duration {a - moc:.3f}"]
        ff += [f"file '{ve(i, dong)}'", f"duration {b - a:.3f}"]; moc = b
    ff += [f"file '{trong}'", "duration 1", f"file '{trong}'"]
    lst = os.path.join(th + "-anh", "ds.ffconcat"); open(lst, "w").write("\n".join(ff) + "\n")
    tam = tap + ".pd.part"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tap, "-f", "concat", "-safe", "0", "-i", lst,
                    "-filter_complex", "[1:v]format=rgba[s];[0:v][s]overlay=0:0:eof_action=pass:shortest=0[v]", "-map", "[v]", "-map", "0:a?",
                    *NV.nen_h264(18), "-c:a", "copy", "-movflags", "+faststart", "-f", "mp4", tam], check=True, timeout=1500)
    g0, g1 = giay_tap(tap), giay_tap(tam)
    if not g1 or abs(g1 - g0) > 1.5: raise RuntimeError(f"{os.path.basename(tap)}: gắn phụ đề xong nhưng tệp hỏng / lệch độ dài ({g0} → {g1})")
    os.replace(tam, tap)
    for x in os.listdir(th + "-anh"): os.remove(os.path.join(th + "-anh", x))
    os.rmdir(th + "-anh")

def da_het(ra):
    """Đã dò HẾT tập miễn phí và còn đủ tệp → không cần mạng. MỘT chỗ cho mọi nơi gọi (tho / dot-phim-moi / nguon-box / sua-cta cứ gọi tai-tap, không tự kiểm)."""
    try: k = int(open(os.path.join(ra, "tap-het")).read().strip())
    except (OSError, ValueError): return False
    # phim NetShort không phải tiếng Anh: tập nào chưa có dấu .pd (đã gắn phụ đề) → chưa xong, phải chạy lại để gắn (tập tải trước 27/11/2026 là tiếng Anh trơn)
    lp = os.path.join(ra, "phu-de")
    if os.path.exists(lp) and open(lp).read().strip() not in ("", "-") and not all(os.path.exists(os.path.join(ra, f"tap{n:02d}.mp4.pd")) for n in range(1, k + 1)): return False
    # cần cả poster: thư mục đủ tập mà thiếu poster (lần đầu tải poster hỏng / VPS 07/11/2026 #270 #273) trước đây trả ngay → poster không bao giờ được tải lại
    po = os.path.join(ra, "poster.jpg")
    return k > 0 and os.path.exists(po) and os.path.getsize(po) > 2000 and all(os.path.exists(os.path.join(ra, f"tap{n:02d}.mp4")) for n in range(1, k + 1))

def mo_ta(url):
    """TÓM TẮT THẬT của phim (20/11/2026: link rút gọn reelslink.com dẫn về trang App Store → máy đọc lời giới thiệu ỨNG DỤNG "Download ReelShort - Stream Drama & TV…" làm tóm tắt phim,
    câu nhử + AI xếp khung viết / chọn theo một câu chuyện không có thật — American Sniper ra khung người mẹ thay vì tay bắn tỉa). Mở rộng link về trang phim (tai-tap.mo_rong), lấy đoạn
    giới thiệu ĐẦY ĐỦ trong dữ liệu trang (meta description bị cắt "…"); chữ giới thiệu ứng dụng / cửa hàng → coi như không có tóm tắt (trả rỗng, bên gọi tự biết thiếu)."""
    try:
        h = lay(mo_rong(url)).decode("utf-8", "ignore")
        m = re.search(r'<meta[^>]+(?:property|name)="(?:og:)?description"[^>]+content="([^"]+)"', h)
        og = H.unescape(m.group(1)) if m else ""; loi = re.sub(r"\.{3}$|…$", "", og.split("; ")[-1]).strip()[:60]
        dai = [json.loads('"' + x + '"') for x in re.findall(r'"(?:special_desc|introduction|book_desc|description|desc|synopsis)"\s*:\s*"((?:[^"\\]|\\.){40,2000})"', h)]
        dai = [x for x in dai if loi and loi in x]; t = max(dai, key=len) if dai else og
        return "" if re.search(r"(?i)download reelshort|app store|google play|stream drama & tv", t[:120]) else t
    except Exception: return ""

def og_anh(goc):
    """link ảnh og:image (poster) trên trang phim công khai, không tải ảnh. Dùng chung: main() tải poster.jpg · nhom_goc.py khi Ethopex thiếu poster (anh 07/11/2026 "vào site của phim mà lấy")."""
    html1 = lay(goc).decode("utf-8", "ignore")
    if "reelshort.com" in goc and "/movie/" in goc:
        m = re.search(r'href="(/(?:[a-z]{2}/)?episodes/episode-1-[^"]+)"', html1)
        if m: goc = "https://www.reelshort.com" + H.unescape(m.group(1)); html1 = lay(goc).decode("utf-8", "ignore")
    og = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"|<meta[^>]+content="([^"]+)"[^>]+property="og:image"', html1)
    return H.unescape(og.group(1) or og.group(2)).split("@")[0] if og else None

def mo_rong(goc):
    """LINK RÚT GỌN reelslink.com/cps/<mã> (19/11/2026: American Sniper 49428 + 8 phim khác mang link này → "không tải được tập miễn phí", cả dòng phim lẫn máy dựng theo mẫu
    chết ở bước tải tập): 302 tới link mở app ReelShort (onelink, parm1 = mã phim 24 hex) → trang phim https://www.reelshort.com/movie/<mã> (ReelShort tự chuyển về trang
    chuẩn có tên) — từ đó đường ReelShort sẵn có đọc tập miễn phí. Link khác giữ nguyên; mở rộng hỏng thì giữ link cũ (lỗi tải tập kêu như trước)."""
    if "reelslink.com/" not in goc: return goc
    try:
        class _Dung(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *a, **k): return None
        r = urllib.request.build_opener(_Dung()).open(urllib.request.Request(goc, headers={"User-Agent": UA}), timeout=30)
        loc = r.headers.get("Location") or ""
    except urllib.error.HTTPError as e:
        loc = e.headers.get("Location") or ""
    except Exception as e:
        print(f"mở rộng {goc} lỗi: {e}", file=sys.stderr); return goc
    m = re.search(r"parm1(?:%3D|=)([0-9a-f]{24})", urllib.parse.unquote(loc)) or re.search(r"([0-9a-f]{24})", loc)
    if not m: print(f"mở rộng {goc}: không thấy mã phim ReelShort trong {loc[:120]}", file=sys.stderr); return goc
    return f"https://www.reelshort.com/movie/{m.group(1)}"

def main(goc, ra, so=3):
    os.makedirs(ra, exist_ok=True)
    # KHOÁ THEO THƯ MỤC PHIM (21/11/2026, Genie 49869: dòng CC #7059 và CT #7060 cùng gọi tai-tap vào một nguon/49869 — #7060 cắt lúc mới có 4/9 tập
    # → "không có khung cuối sạch"). Lượt sau CHỜ lượt đang tải xong rồi mới xét da_het, không bao giờ đọc thư mục đang tải dở.
    import fcntl; khoa = open(os.path.join(ra, ".tai.lock"), "w"); fcntl.flock(khoa, fcntl.LOCK_EX)
    goc = mo_rong(goc)
    lang = ngon_ngu_ns(goc); lp = os.path.join(ra, "phu-de")
    if lang and not os.path.exists(lp): open(lp, "w").write(lang)   # ghi TRƯỚC da_het: thư mục tải từ trước (tiếng Anh trơn) không được trả ngay
    if da_het(ra):
        kq = json.load(open(os.path.join(ra, "tap.json")))
        print(json.dumps({"phim": goc, "tap": [(x["tap"], x["giay"]) for x in kq], "poster": os.path.exists(os.path.join(ra, "poster.jpg")), "da_het": True}, ensure_ascii=False)); return
    html1 = lay(goc).decode("utf-8", "ignore"); kq = []
    if "reelshort.com" in goc and "/movie/" in goc:   # link trang phim (vd 80386 /es/movie/…) → đổi sang link tập 1 trên chính trang đó (23/10/2026: tải 0 tập)
        m = re.search(r'href="(/(?:[a-z]{2}/)?episodes/episode-1-[^"]+)"', html1)
        if m: goc = "https://www.reelshort.com" + H.unescape(m.group(1)); html1 = lay(goc).decode("utf-8", "ignore")
    if lang and long_tieng(html1): open(lp, "w").write("-"); lang = None   # bản lồng tiếng: tiếng đã đúng
    def phu_de(n, ra_tap, html):
        """tập n chưa có dấu .pd → gắn phụ đề <lang>; không tìm thấy phụ đề đúng thứ tiếng thì KÊU (không bao giờ để lọt tập tiếng Anh trơn sang creative thị trường khác)"""
        if not lang or os.path.exists(ra_tap + ".pd"): return
        try:
            vtt = vtt_ns(html, lang)
            if not vtt: raise RuntimeError(f"tap {n}: trang NetShort /{lang}/ không có phụ đề {lang} — tập là tiếng Anh trơn, không dùng được cho thị trường {lang}")
            gan_phu_de(ra_tap, vtt, goc)
        except Exception:
            # mọi nơi gọi (tho, dot-phim-moi, nguon-box, sua-cta, anh-tinh) đọc thẳng tapNN.mp4 và không xét mã thoát → tập tiếng Anh trơn KHÔNG được nằm dưới tên đó
            os.replace(ra_tap, ra_tap + ".chua-phu-de"); raise
        open(ra_tap + ".pd", "w").write(lang); print(f"tap {n}: da gan phu de {lang}", file=sys.stderr)
    og = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"|<meta[^>]+content="([^"]+)"[^>]+property="og:image"', html1)
    if og:
        try:
            u = H.unescape(og.group(1) or og.group(2)).split("@")[0]   # 21/10/2026: tên có dấu nháy ra "&#x27;" → 400 nếu không giải mã HTML
            b = lay(u, ref=goc)
            if len(b) < 2000 or b[:1] in (b"<", b"{"): raise ValueError("poster không phải ảnh")
            open(os.path.join(ra, "poster.jpg"), "wb").write(b)
        except Exception as e: print("poster loi:", e, file=sys.stderr)
    het = False   # True = gặp tập khoá / hết tập trước trần → đã dò HẾT tập miễn phí (ghi dấu tap-het)
    for n in range(1, so + 1):
        u = tap_url(goc, html1, n)
        if not u: het = True; break
        ra_tap = os.path.join(ra, f"tap{n:02d}.mp4")
        if not os.path.exists(ra_tap) and os.path.exists(ra_tap + ".chua-phu-de"): os.replace(ra_tap + ".chua-phu-de", ra_tap)   # lượt trước gắn hỏng: dùng lại bản tải, gắn lại
        if os.path.exists(ra_tap) and os.path.getsize(ra_tap) > 100_000:   # DÙNG LẠI tập đã tải, chỉ tải tập còn thiếu (05/11/2026 #80386: có sẵn 8 tập → nơi gọi không tải nữa, sót tập 9)
            giay = giay_tap(ra_tap)
            if giay:
                if lang and not os.path.exists(ra_tap + ".pd"): phu_de(n, ra_tap, html1 if n == 1 else lay(u).decode("utf-8", "ignore"))   # tập tải trước khi có luật phụ đề
                kq.append({"tap": n, "giay": round(giay, 1), "url": u}); continue
            # tập HỎNG (07/11/2026: HP tap01 80386 tải dở từ 06/11, moov atom not found → mọi lượt sau đổ ở ffprobe): cất sang .hong rồi tải lại
            os.replace(ra_tap, ra_tap + ".hong"); print(f"tap {n}: tep cu hong — tai lai", file=sys.stderr)
        html = html1 if n == 1 else lay(u).decode("utf-8", "ignore")
        v = video_trong(html, u)
        if not v: print(f"tap {n}: khong co video (khoa / het tap mien phi)", file=sys.stderr); het = True; break
        # tải vào .part, kiểm đọc được rồi mới đổi tên: tải bị giết giữa chừng không bao giờ để lại tapNN.mp4 dở cho lượt sau dùng lại
        tam = ra_tap + ".part"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-headers", f"User-Agent: {UA}\r\nReferer: {goc}\r\n", "-i", v, "-c", "copy", "-f", "mp4", tam], check=True, timeout=900)
        giay = giay_tap(tam)
        if not giay: raise RuntimeError(f"tap {n}: tai xong nhung tep khong doc duoc (Invalid data)")
        os.replace(tam, ra_tap)
        if os.path.exists(ra_tap + ".pd"): os.remove(ra_tap + ".pd")   # dấu cũ của tệp đã thay
        phu_de(n, ra_tap, html)
        kq.append({"tap": n, "giay": round(giay, 1), "url": u})
    json.dump(kq, open(os.path.join(ra, "tap.json"), "w"), ensure_ascii=False)
    if het and kq: open(os.path.join(ra, "tap-het"), "w").write(str(len(kq)))   # lần gọi sau thấy dấu này (da_het) thì trả ngay, không dò mạng
    print(json.dumps({"phim": goc, "tap": [(x["tap"], x["giay"]) for x in kq], "poster": os.path.exists(os.path.join(ra, "poster.jpg")) and os.path.getsize(os.path.join(ra, "poster.jpg")) > 2000}, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3)
